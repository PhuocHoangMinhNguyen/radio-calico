import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RatingService } from './rating.service';

// ---------------------------------------------------------------------------
// localStorage stub — Node's test environment lacks full Web Storage support.
// vi.stubGlobal replaces globalThis.localStorage for the entire file.
// ---------------------------------------------------------------------------
let lsStore: Record<string, string> = {};

vi.stubGlobal('localStorage', {
  getItem(key: string) {
    return lsStore[key] ?? null;
  },
  setItem(key: string, value: string) {
    lsStore[key] = String(value);
  },
  removeItem(key: string) {
    delete lsStore[key];
  },
  clear() {
    lsStore = {};
  },
});

function mockResponse(data: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
  } as unknown as Response;
}

describe('RatingService', () => {
  let service: RatingService;
  let fetchSpy: any; // vi.spyOn return type varies by Vitest version

  beforeEach(() => {
    lsStore = {};
    fetchSpy = vi.spyOn(globalThis, 'fetch');
    TestBed.configureTestingModule({ providers: [RatingService] });
    service = TestBed.inject(RatingService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // fetchRatings
  // -------------------------------------------------------------------------
  describe('fetchRatings', () => {
    it('sets ratings and userRating from a successful response', async () => {
      fetchSpy.mockResolvedValueOnce(
        mockResponse({ thumbs_up: 7, thumbs_down: 3, user_vote: 'down' })
      );

      await service.fetchRatings('Song', 'Artist');

      expect(service.ratings()).toEqual({ thumbs_up: 7, thumbs_down: 3 });
      expect(service.userRating()).toBe('down');
    });

    it('reads userRating from localStorage when server omits user_vote', async () => {
      localStorage.setItem('rated:Song::Artist', 'up');
      fetchSpy.mockResolvedValueOnce(mockResponse({ thumbs_up: 2, thumbs_down: 0 }));

      await service.fetchRatings('Song', 'Artist');

      expect(service.userRating()).toBe('up');
    });

    it('server user_vote overrides localStorage', async () => {
      localStorage.setItem('rated:Song::Artist', 'up');
      fetchSpy.mockResolvedValueOnce(
        mockResponse({ thumbs_up: 2, thumbs_down: 1, user_vote: 'down' })
      );

      await service.fetchRatings('Song', 'Artist');

      expect(service.userRating()).toBe('down');
    });

    it('preserves localStorage userRating on network error', async () => {
      localStorage.setItem('rated:Song::Artist', 'down');
      fetchSpy.mockRejectedValueOnce(new Error('Network failure'));

      await service.fetchRatings('Song', 'Artist');

      // ratings reset to 0/0 at the top of fetchRatings; localStorage value persists
      expect(service.ratings()).toEqual({ thumbs_up: 0, thumbs_down: 0 });
      expect(service.userRating()).toBe('down');
    });

    it('leaves ratings at 0/0 on non-OK response', async () => {
      fetchSpy.mockResolvedValueOnce(mockResponse({ error: 'server error' }, 500));

      await service.fetchRatings('Song', 'Artist');

      expect(service.ratings()).toEqual({ thumbs_up: 0, thumbs_down: 0 });
    });

    it('aborts previous fetch when a new track triggers fetchRatings', async () => {
      let resolveSong1: ((value: Response) => void) | undefined;
      let resolveSong2: ((value: Response) => void) | undefined;

      // First fetch for Song 1 — hold it open
      fetchSpy.mockImplementationOnce(
        (_url: RequestInfo | URL, init?: RequestInit) =>
          new Promise<Response>((resolve, reject) => {
            resolveSong1 = resolve;
            // Abort signal should fire rejection
            if (init?.signal) {
              init.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
            }
          })
      );

      // Second fetch for Song 2 — also hold it open
      fetchSpy.mockImplementationOnce(
        () => new Promise<Response>((r) => { resolveSong2 = r; })
      );

      const p1 = service.fetchRatings('Song 1', 'Artist 1');
      const p2 = service.fetchRatings('Song 2', 'Artist 2'); // aborts p1

      // Resolve Song 1 (after abort) — should be ignored
      resolveSong1!(mockResponse({ thumbs_up: 99, thumbs_down: 99 }));
      await p1;

      // Resolve Song 2 (current) — should update signals
      resolveSong2!(mockResponse({ thumbs_up: 5, thumbs_down: 3 }));
      await p2;

      // Ratings should reflect Song 2, not the stale Song 1 response
      expect(service.ratings()).toEqual({ thumbs_up: 5, thumbs_down: 3 });
    });
  });

  // -------------------------------------------------------------------------
  // submitRating
  // -------------------------------------------------------------------------
  describe('submitRating', () => {
    it('does not call fetch when the same rating is submitted again', async () => {
      fetchSpy.mockResolvedValueOnce(
        mockResponse({ thumbs_up: 3, thumbs_down: 0, user_vote: 'up' })
      );
      await service.fetchRatings('Song', 'Artist');
      fetchSpy.mockClear();

      await service.submitRating('Song', 'Artist', 'up');

      expect(fetchSpy).not.toHaveBeenCalled();
      expect(service.ratings()).toEqual({ thumbs_up: 3, thumbs_down: 0 });
    });

    it('applies optimistic +1 for a first-time vote before fetch resolves', async () => {
      fetchSpy.mockResolvedValueOnce(
        mockResponse({ thumbs_up: 2, thumbs_down: 1 }) // no user_vote → null
      );
      await service.fetchRatings('Song', 'Artist');

      // Hold the POST open so we can read the optimistic state mid-flight
      let resolvePost: ((value: Response) => void) | undefined;
      fetchSpy.mockImplementation(
        () => new Promise<Response>((r) => { resolvePost = r; })
      );

      const p = service.submitRating('Song', 'Artist', 'up');

      // Optimistic state is set synchronously before the first await in submitRating
      expect(service.ratings()).toEqual({ thumbs_up: 3, thumbs_down: 1 });
      expect(service.userRating()).toBe('up');

      resolvePost!(mockResponse({ thumbs_up: 3, thumbs_down: 1, user_vote: 'up' }));
      await p;
    });

    it('applies optimistic decrement + increment when changing vote', async () => {
      fetchSpy.mockResolvedValueOnce(
        mockResponse({ thumbs_up: 4, thumbs_down: 1, user_vote: 'up' })
      );
      await service.fetchRatings('Song', 'Artist');

      let resolvePost: ((value: Response) => void) | undefined;
      fetchSpy.mockImplementation(
        () => new Promise<Response>((r) => { resolvePost = r; })
      );

      const p = service.submitRating('Song', 'Artist', 'down');

      // up: 4 − 1 = 3,  down: 1 + 1 = 2
      expect(service.ratings()).toEqual({ thumbs_up: 3, thumbs_down: 2 });
      expect(service.userRating()).toBe('down');

      resolvePost!(mockResponse({ thumbs_up: 3, thumbs_down: 2, user_vote: 'down' }));
      await p;
    });

    it('overwrites optimistic counts with server response (source of truth)', async () => {
      fetchSpy.mockResolvedValueOnce(mockResponse({ thumbs_up: 0, thumbs_down: 0 }));
      await service.fetchRatings('Song', 'Artist');

      // Server returns counts that diverge from the optimistic guess (concurrent votes)
      fetchSpy.mockResolvedValueOnce(
        mockResponse({ thumbs_up: 42, thumbs_down: 7, user_vote: 'up' })
      );
      await service.submitRating('Song', 'Artist', 'up');

      expect(service.ratings()).toEqual({ thumbs_up: 42, thumbs_down: 7 });
    });

    it('reverts signals and clears localStorage on error when there was no prior vote', async () => {
      fetchSpy.mockResolvedValueOnce(mockResponse({ thumbs_up: 2, thumbs_down: 1 }));
      await service.fetchRatings('Song', 'Artist');

      fetchSpy.mockRejectedValueOnce(new Error('Network error'));
      await service.submitRating('Song', 'Artist', 'up');

      expect(service.ratings()).toEqual({ thumbs_up: 2, thumbs_down: 1 });
      expect(service.userRating()).toBeNull();
      expect(localStorage.getItem('rated:Song::Artist')).toBeNull();
    });

    it('reverts signals and restores localStorage on error when changing an existing vote', async () => {
      fetchSpy.mockResolvedValueOnce(
        mockResponse({ thumbs_up: 3, thumbs_down: 1, user_vote: 'up' })
      );
      await service.fetchRatings('Song', 'Artist');

      fetchSpy.mockRejectedValueOnce(new Error('Network error'));
      await service.submitRating('Song', 'Artist', 'down');

      expect(service.ratings()).toEqual({ thumbs_up: 3, thumbs_down: 1 });
      expect(service.userRating()).toBe('up');
      // rollback writes currentRating back to localStorage
      expect(localStorage.getItem('rated:Song::Artist')).toBe('up');
    });

    it('persists vote to localStorage on success', async () => {
      fetchSpy.mockResolvedValueOnce(mockResponse({ thumbs_up: 0, thumbs_down: 0 }));
      await service.fetchRatings('Song', 'Artist');

      fetchSpy.mockResolvedValueOnce(
        mockResponse({ thumbs_up: 1, thumbs_down: 0, user_vote: 'up' })
      );
      await service.submitRating('Song', 'Artist', 'up');

      expect(localStorage.getItem('rated:Song::Artist')).toBe('up');
    });
  });

  // -------------------------------------------------------------------------
  // Stored-rating validation (exercised via fetchRatings)
  // -------------------------------------------------------------------------
  describe('stored rating validation', () => {
    it('ignores invalid values in localStorage', async () => {
      localStorage.setItem('rated:Song::Artist', 'sideways');
      fetchSpy.mockResolvedValueOnce(mockResponse({ thumbs_up: 1, thumbs_down: 0 }));

      await service.fetchRatings('Song', 'Artist');

      expect(service.userRating()).toBeNull();
    });
  });
});
