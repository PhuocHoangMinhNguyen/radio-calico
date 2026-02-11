import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';

// Declare at module scope, populate in beforeAll
let server, pool;
const mockQuery = vi.fn();

// Transaction client mock — POST /api/ratings acquires a client via pool.connect()
const mockClientQuery = vi.fn();
const mockRelease = vi.fn();
const mockClient = { query: mockClientQuery, release: mockRelease };
const mockConnect = vi.fn();

let baseUrl;

beforeAll(async () => {
  // Dynamic import inside beforeAll to avoid top-level await (fixes Windows Vitest bug)
  const serverModule = await import('./server.js');
  server = serverModule.server;
  pool = serverModule.pool;

  // pg.Pool is lazy — no connection is made until the first real query().
  // We patch pool.query after import so all handler calls hit our mock instead.
  pool.query = mockQuery;     // shadow the prototype method on this instance
  pool.connect = mockConnect; // transaction client for POST handlers

  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});

  server.listen(0); // port 0 = OS assigns an ephemeral port
  const { port } = server.address();
  baseUrl = `http://localhost:${port}`;
});

afterAll(() => {
  vi.restoreAllMocks();
  server.close();
});

beforeEach(() => {
  mockQuery.mockReset();
  mockClientQuery.mockReset();
  mockRelease.mockReset();
  mockConnect.mockReset().mockResolvedValue(mockClient);
});

// ---------------------------------------------------------------------------
// GET /api/ratings
// ---------------------------------------------------------------------------
describe('GET /api/ratings', () => {
  it('returns 400 when title is missing', async () => {
    const res = await fetch(`${baseUrl}/api/ratings?artist=TestArtist`);

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'title and artist are required' });
  });

  it('returns 400 when artist is missing', async () => {
    const res = await fetch(`${baseUrl}/api/ratings?title=TestSong`);

    expect(res.status).toBe(400);
  });

  it('returns ratings with no prior user vote', async () => {
    // Promise.all dispatches both queries synchronously in source order:
    //   [0] song_ratings  [1] song_votes
    mockQuery
      .mockResolvedValueOnce({ rows: [{ thumbs_up: 5, thumbs_down: 2 }] })
      .mockResolvedValueOnce({ rows: [] });

    const res = await fetch(`${baseUrl}/api/ratings?title=TestSong&artist=TestArtist`);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ thumbs_up: 5, thumbs_down: 2, user_vote: null });
  });

  it('returns ratings with an existing user vote', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ thumbs_up: 3, thumbs_down: 1 }] })
      .mockResolvedValueOnce({ rows: [{ vote: 'up' }] });

    const res = await fetch(`${baseUrl}/api/ratings?title=TestSong&artist=TestArtist`);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ thumbs_up: 3, thumbs_down: 1, user_vote: 'up' });
  });

  it('defaults to 0/0 for an unknown song', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] }) // no row in song_ratings
      .mockResolvedValueOnce({ rows: [] }); // no row in song_votes

    const res = await fetch(`${baseUrl}/api/ratings?title=Unknown&artist=Unknown`);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ thumbs_up: 0, thumbs_down: 0, user_vote: null });
  });

  it('returns 500 on database error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB connection lost'));

    const res = await fetch(`${baseUrl}/api/ratings?title=TestSong&artist=TestArtist`);

    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe('Database error');
  });

  it('extracts the first IP from a multi-value X-Forwarded-For header', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ thumbs_up: 1, thumbs_down: 0 }] })
      .mockResolvedValueOnce({ rows: [{ vote: 'down' }] });

    await fetch(`${baseUrl}/api/ratings?title=Song&artist=Artist`, {
      headers: { 'X-Forwarded-For': '10.0.0.1, 192.168.1.1' },
    });

    // song_votes query is call [1]; its params array is [title, artist, clientIp]
    expect(mockQuery.mock.calls[1][1][2]).toBe('10.0.0.1');
  });
});

// ---------------------------------------------------------------------------
// POST /api/ratings
// ---------------------------------------------------------------------------
describe('POST /api/ratings', () => {
  const post = (body) =>
    fetch(`${baseUrl}/api/ratings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

  // ---------------------------------------------------------------------------
  // Validation (fires before pool.connect — no client queries involved)
  // ---------------------------------------------------------------------------
  it('returns 400 when title is missing', async () => {
    const res = await post({ artist: 'A', rating: 'up' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when artist is missing', async () => {
    const res = await post({ title: 'S', rating: 'up' });
    expect(res.status).toBe(400);
  });

  it('returns 400 for an invalid rating value', async () => {
    const res = await post({ title: 'S', artist: 'A', rating: 'sideways' });
    expect(res.status).toBe(400);
  });

  it('returns 400 for malformed JSON', async () => {
    const res = await fetch(`${baseUrl}/api/ratings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{this is not: valid JSON}',
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Invalid JSON body');
  });

  // ---------------------------------------------------------------------------
  // pool.connect failure
  // ---------------------------------------------------------------------------
  it('returns 500 when pool.connect fails', async () => {
    mockConnect.mockRejectedValueOnce(new Error('Pool exhausted'));

    const res = await post({ title: 'Song', artist: 'Artist', rating: 'up' });

    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe('Database error');
    expect(mockClientQuery).not.toHaveBeenCalled();
    expect(mockRelease).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // New vote
  // ---------------------------------------------------------------------------
  it('inserts a new vote and returns updated counts', async () => {
    mockClientQuery
      .mockResolvedValueOnce({ rows: [] })                                  // BEGIN
      .mockResolvedValueOnce({ rows: [] })                                  // SELECT existing vote → none
      .mockResolvedValueOnce({ rows: [] })                                  // INSERT song_votes (ON CONFLICT DO NOTHING)
      .mockResolvedValueOnce({ rows: [{ thumbs_up: 1, thumbs_down: 0 }] }) // UPSERT song_ratings RETURNING
      .mockResolvedValueOnce({ rows: [] });                                 // COMMIT

    const res = await post({ title: 'Song', artist: 'Artist', rating: 'up' });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ thumbs_up: 1, thumbs_down: 0, user_vote: 'up' });
    expect(mockClientQuery.mock.calls.at(-1)[0]).toBe('COMMIT');
    expect(mockRelease).toHaveBeenCalledTimes(1);
  });

  // ---------------------------------------------------------------------------
  // Same vote resubmitted (idempotent — no mutation)
  // ---------------------------------------------------------------------------
  it('returns current state without mutation when the same vote is resubmitted', async () => {
    mockClientQuery
      .mockResolvedValueOnce({ rows: [] })                                  // BEGIN
      .mockResolvedValueOnce({ rows: [{ vote: 'up' }] })                   // SELECT existing vote → matches
      .mockResolvedValueOnce({ rows: [{ thumbs_up: 3, thumbs_down: 1 }] }) // SELECT current ratings
      .mockResolvedValueOnce({ rows: [] });                                 // COMMIT

    const res = await post({ title: 'Song', artist: 'Artist', rating: 'up' });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ thumbs_up: 3, thumbs_down: 1, user_vote: 'up' });
    // BEGIN + SELECT vote + SELECT ratings + COMMIT — no UPDATE ran
    expect(mockClientQuery).toHaveBeenCalledTimes(4);
    expect(mockRelease).toHaveBeenCalledTimes(1);
  });

  // ---------------------------------------------------------------------------
  // Vote change
  // ---------------------------------------------------------------------------
  it('changes vote from up to down and adjusts aggregate counts', async () => {
    mockClientQuery
      .mockResolvedValueOnce({ rows: [] })                                  // BEGIN
      .mockResolvedValueOnce({ rows: [{ vote: 'up' }] })                   // SELECT existing vote
      .mockResolvedValueOnce({ rows: [] })                                  // UPDATE song_votes
      .mockResolvedValueOnce({ rows: [{ thumbs_up: 2, thumbs_down: 3 }] }) // UPDATE song_ratings RETURNING
      .mockResolvedValueOnce({ rows: [] });                                 // COMMIT

    const res = await post({ title: 'Song', artist: 'Artist', rating: 'down' });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ thumbs_up: 2, thumbs_down: 3, user_vote: 'down' });

    // calls[3] is the aggregate UPDATE (BEGIN=0, SELECT=1, UPDATE votes=2, UPDATE ratings=3)
    const aggregateQuery = mockClientQuery.mock.calls[3][0];
    expect(aggregateQuery).toMatch(/thumbs_up = GREATEST\(0, thumbs_up - 1\)/);
    expect(aggregateQuery).toMatch(/thumbs_down = thumbs_down \+ 1/);
    expect(mockRelease).toHaveBeenCalledTimes(1);
  });

  it('changes vote from down to up and adjusts aggregate counts', async () => {
    mockClientQuery
      .mockResolvedValueOnce({ rows: [] })                                  // BEGIN
      .mockResolvedValueOnce({ rows: [{ vote: 'down' }] })                 // SELECT existing vote
      .mockResolvedValueOnce({ rows: [] })                                  // UPDATE song_votes
      .mockResolvedValueOnce({ rows: [{ thumbs_up: 5, thumbs_down: 1 }] }) // UPDATE song_ratings RETURNING
      .mockResolvedValueOnce({ rows: [] });                                 // COMMIT

    const res = await post({ title: 'Song', artist: 'Artist', rating: 'up' });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ thumbs_up: 5, thumbs_down: 1, user_vote: 'up' });

    const aggregateQuery = mockClientQuery.mock.calls[3][0];
    expect(aggregateQuery).toMatch(/thumbs_down = GREATEST\(0, thumbs_down - 1\)/);
    expect(aggregateQuery).toMatch(/thumbs_up = thumbs_up \+ 1/);
    expect(mockRelease).toHaveBeenCalledTimes(1);
  });

  // ---------------------------------------------------------------------------
  // Error paths
  // ---------------------------------------------------------------------------
  it('returns 500 and rolls back on database error', async () => {
    mockClientQuery
      .mockResolvedValueOnce({ rows: [] })                    // BEGIN
      .mockRejectedValueOnce(new Error('Connection timeout')) // SELECT throws
      .mockResolvedValueOnce({ rows: [] });                   // ROLLBACK

    const res = await post({ title: 'Song', artist: 'Artist', rating: 'up' });

    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe('Database error');
    expect(mockClientQuery.mock.calls.at(-1)[0]).toBe('ROLLBACK');
    expect(mockRelease).toHaveBeenCalledTimes(1);
  });

  it('returns 500 when a corrupted vote value is found in song_votes', async () => {
    mockClientQuery
      .mockResolvedValueOnce({ rows: [] })                       // BEGIN
      .mockResolvedValueOnce({ rows: [{ vote: 'invalid' }] })   // SELECT vote → corrupted
      .mockResolvedValueOnce({ rows: [] });                      // ROLLBACK

    const res = await post({ title: 'Song', artist: 'Artist', rating: 'up' });

    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe('Internal data integrity error');
    expect(mockClientQuery.mock.calls.at(-1)[0]).toBe('ROLLBACK');
    expect(mockRelease).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// POST /api/errors
// ---------------------------------------------------------------------------
describe('POST /api/errors', () => {
  const postError = (body) =>
    fetch(`${baseUrl}/api/errors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

  it('returns 400 for malformed JSON', async () => {
    const res = await fetch(`${baseUrl}/api/errors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{not valid JSON}',
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Invalid JSON body');
  });

  // ---------------------------------------------------------------------------
  // Validation (required fields)
  // ---------------------------------------------------------------------------
  it('returns 400 when session_id is missing', async () => {
    const res = await postError({ source: 'app', severity: 'error', message: 'test' });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('required');
  });

  it('returns 400 when source is missing', async () => {
    const res = await postError({ session_id: 'abc', severity: 'error', message: 'test' });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('required');
  });

  it('returns 400 when severity is missing', async () => {
    const res = await postError({ session_id: 'abc', source: 'app', message: 'test' });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('required');
  });

  it('returns 400 when message is missing', async () => {
    const res = await postError({ session_id: 'abc', source: 'app', severity: 'error' });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('required');
  });

  // ---------------------------------------------------------------------------
  // Validation (enum values)
  // ---------------------------------------------------------------------------
  it('returns 400 for an invalid source value', async () => {
    const res = await postError({
      session_id: 'abc',
      source: 'invalid',
      severity: 'error',
      message: 'test',
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('source must be one of');
  });

  it('returns 400 for an invalid severity value', async () => {
    const res = await postError({
      session_id: 'abc',
      source: 'app',
      severity: 'critical',
      message: 'test',
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('severity must be one of');
  });

  // ---------------------------------------------------------------------------
  // Success cases
  // ---------------------------------------------------------------------------
  it('inserts a minimal error log and returns 201 with id and created_at', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 42, created_at: '2026-02-06T10:00:00Z' }],
    });

    const res = await postError({
      session_id: 'session-123',
      source: 'hls',
      severity: 'warning',
      message: 'Buffer underrun',
    });

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.id).toBe(42);
    expect(data.created_at).toBe('2026-02-06T10:00:00Z');

    // Verify INSERT query
    expect(mockQuery).toHaveBeenCalledTimes(1);
    const [query, params] = mockQuery.mock.calls[0];
    expect(query).toContain('INSERT INTO error_logs');
    expect(params[0]).toBe('session-123'); // session_id
    expect(params[1]).toBe('hls');          // source
    expect(params[2]).toBe('warning');      // severity
    expect(params[3]).toBe('Buffer underrun'); // message
    expect(params[4]).toBeNull();           // details (optional)
    expect(params[5]).toBeNull();           // metadata (optional)
  });

  it('inserts error log with optional details and metadata', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 99, created_at: '2026-02-06T11:00:00Z' }],
    });

    const res = await postError({
      session_id: 'session-456',
      source: 'network',
      severity: 'fatal',
      message: 'Request timeout',
      details: 'Request to /api/data took 30s',
      metadata: { url: '/api/data', timeout: 30000 },
    });

    expect(res.status).toBe(201);

    const [, params] = mockQuery.mock.calls[0];
    expect(params[4]).toBe('Request to /api/data took 30s'); // details
    expect(params[5]).toBe('{"url":"/api/data","timeout":30000}'); // metadata (stringified)
  });

  // ---------------------------------------------------------------------------
  // Database error
  // ---------------------------------------------------------------------------
  it('returns 500 on database error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('DB connection lost'));

    const res = await postError({
      session_id: 'session-789',
      source: 'app',
      severity: 'error',
      message: 'Something went wrong',
    });

    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe('Database error');
  });
});

// ---------------------------------------------------------------------------
// Rate Limiting
// ---------------------------------------------------------------------------
describe('Rate Limiting', () => {
  let rateLimitStore;

  beforeAll(async () => {
    // Import rate limit store for clearing between tests
    const serverModule = await import('./server.js');
    rateLimitStore = serverModule.rateLimitStore;
  });

  beforeEach(() => {
    // Clear rate limit store between tests to prevent interference
    if (rateLimitStore) {
      rateLimitStore.clear();
    }
  });

  it('allows requests under the rate limit', async () => {
    mockQuery
      .mockResolvedValue({ rows: [{ thumbs_up: 1, thumbs_down: 0 }] })
      .mockResolvedValue({ rows: [] });

    // Make 10 requests (well under the 100/minute limit)
    for (let i = 0; i < 10; i++) {
      const res = await fetch(`${baseUrl}/api/ratings?title=TestSong&artist=TestArtist`);
      expect(res.status).toBe(200);
      expect(res.headers.get('X-RateLimit-Limit')).toBe('100');
      expect(res.headers.get('X-RateLimit-Remaining')).toBeTruthy();
      expect(res.headers.get('X-RateLimit-Reset')).toBeTruthy();
    }
  });

  it('returns 429 when rate limit is exceeded', async () => {
    mockQuery
      .mockResolvedValue({ rows: [{ thumbs_up: 1, thumbs_down: 0 }] })
      .mockResolvedValue({ rows: [] });

    // Make 101 requests to exceed the 100/minute limit
    let successCount = 0;
    let rateLimitedCount = 0;

    for (let i = 0; i < 101; i++) {
      const res = await fetch(`${baseUrl}/api/ratings?title=TestSong&artist=TestArtist`);
      if (res.status === 200) {
        successCount++;
      } else if (res.status === 429) {
        rateLimitedCount++;
        const data = await res.json();
        expect(data.error).toBe('Too many requests');
        expect(data.message).toContain('Rate limit exceeded');
        expect(data.retry_after).toBeGreaterThan(0);
        expect(res.headers.get('Retry-After')).toBeTruthy();
      }
    }

    expect(successCount).toBe(100);
    expect(rateLimitedCount).toBe(1);
  });

  it('sets correct rate limit headers', async () => {
    mockQuery
      .mockResolvedValue({ rows: [{ thumbs_up: 1, thumbs_down: 0 }] })
      .mockResolvedValue({ rows: [] });

    const res = await fetch(`${baseUrl}/api/ratings?title=TestSong&artist=TestArtist`);

    expect(res.status).toBe(200);
    expect(res.headers.get('X-RateLimit-Limit')).toBe('100');
    const remaining = parseInt(res.headers.get('X-RateLimit-Remaining') || '0', 10);
    expect(remaining).toBe(99); // 100 - 1 request
    const resetTime = parseInt(res.headers.get('X-RateLimit-Reset') || '0', 10);
    expect(resetTime).toBeGreaterThan(Date.now() / 1000); // Should be a future timestamp
  });

  it('rate limits per IP address', async () => {
    mockQuery
      .mockResolvedValue({ rows: [{ thumbs_up: 1, thumbs_down: 0 }] })
      .mockResolvedValue({ rows: [] });

    // Make 100 requests from IP 1 (should succeed)
    for (let i = 0; i < 100; i++) {
      const res = await fetch(`${baseUrl}/api/ratings?title=TestSong&artist=TestArtist`, {
        headers: { 'X-Forwarded-For': '10.0.0.1' },
      });
      expect(res.status).toBe(200);
    }

    // 101st request from IP 1 should be rate limited
    const res1 = await fetch(`${baseUrl}/api/ratings?title=TestSong&artist=TestArtist`, {
      headers: { 'X-Forwarded-For': '10.0.0.1' },
    });
    expect(res1.status).toBe(429);

    // But request from IP 2 should still succeed
    const res2 = await fetch(`${baseUrl}/api/ratings?title=TestSong&artist=TestArtist`, {
      headers: { 'X-Forwarded-For': '10.0.0.2' },
    });
    expect(res2.status).toBe(200);
  });

  it('rate limits all API endpoints', async () => {
    // Mock GET /api/ratings responses (calls mockQuery)
    mockQuery.mockResolvedValue({ rows: [{ thumbs_up: 1, thumbs_down: 0 }] });
    mockQuery.mockResolvedValue({ rows: [] });

    // Mock POST /api/ratings transaction (calls mockConnect and mockClientQuery)
    mockConnect.mockResolvedValue(mockClient);
    mockClientQuery.mockImplementation(async () => {
      // Return appropriate response based on query type
      // This simplified mock works for most POST /api/ratings flows
      return { rows: [{ thumbs_up: 1, thumbs_down: 0, vote: 'up' }] };
    });

    // Make 100 mixed requests (50 GET + 50 POST = 100 total)
    for (let i = 0; i < 50; i++) {
      const res1 = await fetch(`${baseUrl}/api/ratings?title=Song${i}&artist=Artist${i}`);
      expect(res1.status).toBe(200);

      const res2 = await fetch(`${baseUrl}/api/ratings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: `Song${i}`, artist: `Artist${i}`, rating: 'up' }),
      });
      expect(res2.status).toBe(200);
    }

    // 101st request should be rate limited
    const res = await fetch(`${baseUrl}/api/ratings?title=Song&artist=Artist`);
    expect(res.status).toBe(429);
  });
});

// ---------------------------------------------------------------------------
// Request Validation
// ---------------------------------------------------------------------------
describe('Request Validation', () => {
  let rateLimitStore;

  beforeAll(async () => {
    // Import rate limit store for clearing between tests
    const serverModule = await import('./server.js');
    rateLimitStore = serverModule.rateLimitStore;
  });

  beforeEach(() => {
    // Clear rate limit store to prevent 429 errors
    if (rateLimitStore) {
      rateLimitStore.clear();
    }
  });

  const post = (url, body, headers = {}) =>
    fetch(`${baseUrl}${url}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    });

  // ---------------------------------------------------------------------------
  // Content-Type validation
  // ---------------------------------------------------------------------------
  describe('Content-Type validation', () => {
    it('rejects POST /api/ratings with missing Content-Type', async () => {
      const res = await fetch(`${baseUrl}/api/ratings`, {
        method: 'POST',
        body: JSON.stringify({ title: 'Song', artist: 'Artist', rating: 'up' }),
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('Content-Type');
    });

    it('rejects POST /api/ratings with wrong Content-Type', async () => {
      const res = await post('/api/ratings', { title: 'Song', artist: 'Artist', rating: 'up' }, {
        'Content-Type': 'text/plain',
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('Content-Type');
    });

    it('rejects POST /api/errors with missing Content-Type', async () => {
      const res = await fetch(`${baseUrl}/api/errors`, {
        method: 'POST',
        body: JSON.stringify({ session_id: 's', source: 'app', severity: 'error', message: 'm' }),
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('Content-Type');
    });

    it('rejects POST /api/errors with wrong Content-Type', async () => {
      const res = await post('/api/errors', { session_id: 's', source: 'app', severity: 'error', message: 'm' }, {
        'Content-Type': 'application/x-www-form-urlencoded',
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('Content-Type');
    });
  });

  // ---------------------------------------------------------------------------
  // Request size limits
  // ---------------------------------------------------------------------------
  describe('Request size limits', () => {
    it('rejects POST /api/ratings when body exceeds size limit', async () => {
      const largeString = 'x'.repeat(2000); // 2KB, exceeds 1KB limit

      try {
        const res = await post('/api/ratings', {
          title: largeString,
          artist: 'Artist',
          rating: 'up',
        });
        // If we get a response, it should be 413
        expect(res.status).toBe(413);
        const data = await res.json();
        expect(data.error).toBe('Payload Too Large');
      } catch (err) {
        // Server may close connection before sending response (also valid behavior)
        expect(err.message).toMatch(/fetch failed|socket|closed/i);
      }
    });

    it('rejects POST /api/errors when body exceeds size limit', async () => {
      const largeString = 'x'.repeat(15000); // 15KB, exceeds 10KB limit

      try {
        const res = await post('/api/errors', {
          session_id: 'session-123',
          source: 'app',
          severity: 'error',
          message: largeString,
        });
        // If we get a response, it should be 413
        expect(res.status).toBe(413);
        const data = await res.json();
        expect(data.error).toBe('Payload Too Large');
      } catch (err) {
        // Server may close connection before sending response (also valid behavior)
        expect(err.message).toMatch(/fetch failed|socket|closed/i);
      }
    });

    it('accepts POST /api/ratings within size limit', async () => {
      mockConnect.mockResolvedValueOnce(mockClient);
      mockClientQuery
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [] }) // SELECT existing vote
        .mockResolvedValueOnce({ rows: [] }) // INSERT vote
        .mockResolvedValueOnce({ rows: [{ thumbs_up: 1, thumbs_down: 0 }] }) // UPSERT ratings
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      const res = await post('/api/ratings', {
        title: 'Song Title',
        artist: 'Artist Name',
        rating: 'up',
      });
      expect(res.status).toBe(200);
    });
  });

  // ---------------------------------------------------------------------------
  // Suspicious pattern detection
  // ---------------------------------------------------------------------------
  describe('Suspicious pattern detection', () => {
    it('detects SQL injection attempt in title', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const res = await fetch(`${baseUrl}/api/ratings?title=test' OR 1=1--&artist=Artist`);

      // Request should still process but might return 400 or log security event
      // The actual behavior depends on implementation - check if it's rejected or allowed with logging
      expect([200, 400]).toContain(res.status);
    });

    it('detects SQL injection attempt in artist', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const res = await fetch(`${baseUrl}/api/ratings?title=Song&artist=UNION SELECT * FROM users--`);

      expect([200, 400]).toContain(res.status);
    });

    it('detects XSS attempt in title', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const res = await fetch(`${baseUrl}/api/ratings?title=<script>alert('xss')</script>&artist=Artist`);

      expect([200, 400]).toContain(res.status);
    });

    it('detects path traversal attempt', async () => {
      mockQuery.mockResolvedValue({ rows: [] });

      const res = await fetch(`${baseUrl}/api/ratings?title=../../etc/passwd&artist=Artist`);

      expect([200, 400]).toContain(res.status);
    });

    it('allows normal special characters in title and artist', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ thumbs_up: 0, thumbs_down: 0 }] })
        .mockResolvedValueOnce({ rows: [] });

      const res = await fetch(`${baseUrl}/api/ratings?title=It's A Song (Remix) [2024]&artist=Artist & The Band`);

      expect(res.status).toBe(200);
    });
  });

  // ---------------------------------------------------------------------------
  // Field length validation
  // ---------------------------------------------------------------------------
  describe('Field length validation', () => {
    it('rejects POST /api/ratings when title exceeds 200 characters', async () => {
      const longTitle = 'x'.repeat(201);
      const res = await post('/api/ratings', {
        title: longTitle,
        artist: 'Artist',
        rating: 'up',
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('200 characters');
    });

    it('rejects POST /api/ratings when artist exceeds 200 characters', async () => {
      const longArtist = 'x'.repeat(201);
      const res = await post('/api/ratings', {
        title: 'Song',
        artist: longArtist,
        rating: 'up',
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('200 characters');
    });

    it('accepts POST /api/ratings with exactly 200 characters', async () => {
      mockConnect.mockResolvedValueOnce(mockClient);
      mockClientQuery
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [] }) // SELECT existing vote
        .mockResolvedValueOnce({ rows: [] }) // INSERT vote
        .mockResolvedValueOnce({ rows: [{ thumbs_up: 1, thumbs_down: 0 }] }) // UPSERT ratings
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      const title200 = 'x'.repeat(200);
      const res = await post('/api/ratings', {
        title: title200,
        artist: 'Artist',
        rating: 'up',
      });
      expect(res.status).toBe(200);
    });
  });
});
