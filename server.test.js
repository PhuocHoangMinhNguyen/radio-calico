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
