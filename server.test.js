import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';

// pg.Pool is lazy — no connection is made until the first real query().
// We patch pool.query after import so all handler calls hit our mock instead.
const { server, pool } = await import('./server.js');
const mockQuery = vi.fn();

let baseUrl;

beforeAll(() => {
  pool.query = mockQuery; // shadow the prototype method on this instance

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

  it('inserts a new vote and returns updated counts', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] }) // SELECT existing vote → none
      .mockResolvedValueOnce({ rows: [] }) // INSERT song_votes
      .mockResolvedValueOnce({ rows: [{ thumbs_up: 1, thumbs_down: 0 }] }); // UPSERT RETURNING

    const res = await post({ title: 'Song', artist: 'Artist', rating: 'up' });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ thumbs_up: 1, thumbs_down: 0, user_vote: 'up' });
  });

  it('returns current state without mutation when the same vote is resubmitted', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ vote: 'up' }] }) // existing vote matches
      .mockResolvedValueOnce({ rows: [{ thumbs_up: 3, thumbs_down: 1 }] }); // SELECT current

    const res = await post({ title: 'Song', artist: 'Artist', rating: 'up' });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ thumbs_up: 3, thumbs_down: 1, user_vote: 'up' });
    // Only 2 queries fired: SELECT existing + SELECT current.  No UPDATE ran.
    expect(mockQuery).toHaveBeenCalledTimes(2);
  });

  it('changes vote from up to down and adjusts aggregate counts', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ vote: 'up' }] }) // existing vote
      .mockResolvedValueOnce({ rows: [] }) // UPDATE song_votes
      .mockResolvedValueOnce({ rows: [{ thumbs_up: 2, thumbs_down: 3 }] }); // UPDATE RETURNING

    const res = await post({ title: 'Song', artist: 'Artist', rating: 'down' });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ thumbs_up: 2, thumbs_down: 3, user_vote: 'down' });

    // Verify the aggregate UPDATE decrements the old column and increments the new
    const aggregateQuery = mockQuery.mock.calls[2][0];
    expect(aggregateQuery).toMatch(/thumbs_up = GREATEST\(0, thumbs_up - 1\)/);
    expect(aggregateQuery).toMatch(/thumbs_down = thumbs_down \+ 1/);
  });

  it('changes vote from down to up and adjusts aggregate counts', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ vote: 'down' }] }) // existing vote
      .mockResolvedValueOnce({ rows: [] }) // UPDATE song_votes
      .mockResolvedValueOnce({ rows: [{ thumbs_up: 5, thumbs_down: 1 }] }); // UPDATE RETURNING

    const res = await post({ title: 'Song', artist: 'Artist', rating: 'up' });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ thumbs_up: 5, thumbs_down: 1, user_vote: 'up' });

    const aggregateQuery = mockQuery.mock.calls[2][0];
    expect(aggregateQuery).toMatch(/thumbs_down = GREATEST\(0, thumbs_down - 1\)/);
    expect(aggregateQuery).toMatch(/thumbs_up = thumbs_up \+ 1/);
  });

  it('returns 500 on database error', async () => {
    mockQuery.mockRejectedValueOnce(new Error('Connection timeout'));

    const res = await post({ title: 'Song', artist: 'Artist', rating: 'up' });

    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe('Database error');
  });
});
