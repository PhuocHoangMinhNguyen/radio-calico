import { test, expect } from '@playwright/test';

/**
 * API Integration Tests
 * Tests the complete integration between frontend, backend, and database
 */

test.describe('API Integration - Frontend to Backend to Database', () => {
  const API_BASE = process.env.API_BASE_URL || 'http://localhost:3001';

  test('API: Health check endpoint returns healthy status', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/health`);

    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data.status).toBe('healthy');
    expect(data.database).toBe('connected');
    expect(data.timestamp).toBeDefined();
  });

  test('API: GET ratings returns valid data structure', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/ratings?title=TestSong&artist=TestArtist`);

    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    expect(data).toHaveProperty('thumbs_up');
    expect(data).toHaveProperty('thumbs_down');
    expect(data).toHaveProperty('user_vote');
    expect(typeof data.thumbs_up).toBe('number');
    expect(typeof data.thumbs_down).toBe('number');
  });

  test('API: POST rating (thumbs up) persists to database', async ({ request }) => {
    const testData = {
      title: `E2E Test Song ${Date.now()}`,
      artist: 'E2E Test Artist',
      rating: 'up',
    };

    // Post a thumbs up
    const postResponse = await request.post(`${API_BASE}/api/ratings`, {
      data: testData,
    });

    expect(postResponse.ok()).toBeTruthy();
    const postData = await postResponse.json();
    expect(postData.success).toBe(true);

    // Verify it was saved by fetching it
    const getResponse = await request.get(
      `${API_BASE}/api/ratings?title=${encodeURIComponent(testData.title)}&artist=${encodeURIComponent(testData.artist)}`
    );

    expect(getResponse.ok()).toBeTruthy();
    const getData = await getResponse.json();
    expect(getData.thumbs_up).toBeGreaterThanOrEqual(1);
    expect(getData.user_vote).toBe('up');
  });

  test('API: POST rating (thumbs down) persists to database', async ({ request }) => {
    const testData = {
      title: `E2E Test Song Down ${Date.now()}`,
      artist: 'E2E Test Artist',
      rating: 'down',
    };

    const postResponse = await request.post(`${API_BASE}/api/ratings`, {
      data: testData,
    });

    expect(postResponse.ok()).toBeTruthy();

    const getResponse = await request.get(
      `${API_BASE}/api/ratings?title=${encodeURIComponent(testData.title)}&artist=${encodeURIComponent(testData.artist)}`
    );

    const getData = await getResponse.json();
    expect(getData.thumbs_down).toBeGreaterThanOrEqual(1);
    expect(getData.user_vote).toBe('down');
  });

  test('API: Change vote from up to down updates database atomically', async ({ request }) => {
    const testData = {
      title: `E2E Vote Change ${Date.now()}`,
      artist: 'E2E Test Artist',
      rating: 'up',
    };

    // First vote up
    await request.post(`${API_BASE}/api/ratings`, { data: testData });

    // Get initial state
    const initialResponse = await request.get(
      `${API_BASE}/api/ratings?title=${encodeURIComponent(testData.title)}&artist=${encodeURIComponent(testData.artist)}`
    );
    const initialData = await initialResponse.json();
    const initialUp = initialData.thumbs_up;

    // Change vote to down
    testData.rating = 'down';
    await request.post(`${API_BASE}/api/ratings`, { data: testData });

    // Get final state
    const finalResponse = await request.get(
      `${API_BASE}/api/ratings?title=${encodeURIComponent(testData.title)}&artist=${encodeURIComponent(testData.artist)}`
    );
    const finalData = await finalResponse.json();

    // Verify atomic update: thumbs_up decreased, thumbs_down increased
    expect(finalData.thumbs_up).toBe(initialUp - 1);
    expect(finalData.thumbs_down).toBeGreaterThanOrEqual(1);
    expect(finalData.user_vote).toBe('down');
  });

  test('API: Rate limiting prevents excessive requests', async ({ request }) => {
    const testData = {
      title: 'Rate Limit Test',
      artist: 'Test Artist',
      rating: 'up',
    };

    // Send 102 requests rapidly (limit is 100 per minute)
    const requests = [];
    for (let i = 0; i < 102; i++) {
      requests.push(
        request.post(`${API_BASE}/api/ratings`, { data: testData }).catch(() => null)
      );
    }

    const responses = await Promise.all(requests);

    // Count how many were rate limited (429)
    const rateLimited = responses.filter((r) => r?.status() === 429);

    // At least one should be rate limited
    expect(rateLimited.length).toBeGreaterThan(0);

    // Check that 429 response includes Retry-After header
    if (rateLimited[0]) {
      const headers = rateLimited[0].headers();
      expect(headers['retry-after']).toBeDefined();
    }
  });

  test('API: Error logging endpoint accepts valid error data', async ({ request }) => {
    const errorData = {
      message: 'E2E Test Error',
      source: 'app',
      severity: 'info',
      metadata: {
        test: true,
        timestamp: new Date().toISOString(),
      },
    };

    const response = await request.post(`${API_BASE}/api/errors`, {
      data: errorData,
    });

    expect(response.ok()).toBeTruthy();
    expect([200, 201]).toContain(response.status());
  });

  test('API: Invalid request data returns 400', async ({ request }) => {
    // Missing required fields
    const response = await request.post(`${API_BASE}/api/ratings`, {
      data: { title: 'Only Title' }, // Missing artist and rating
    });

    expect(response.status()).toBe(400);
  });

  test('Frontend-to-Backend: Vote button updates reflect API changes', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    // Intercept API calls
    let apiCalled = false;
    page.on('response', (response) => {
      if (response.url().includes('/api/ratings') && response.request().method() === 'POST') {
        apiCalled = true;
      }
    });

    // Click thumbs up
    const thumbsUpButton = page.getByRole('button', { name: /thumbs up|like/i }).first();
    await thumbsUpButton.click();

    // Wait for API call to complete
    await page.waitForTimeout(2000);

    // Verify API was called
    expect(apiCalled).toBe(true);

    // Verify UI reflects the change
    await expect(thumbsUpButton).toHaveAttribute('aria-pressed', 'true');
  });

  test('Frontend-to-Backend: Bookmark persists in localStorage', async ({ page, context }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);

    // Bookmark a track
    const bookmarkButton = page.getByRole('button', { name: /bookmark|save/i }).first();
    await bookmarkButton.click();
    await expect(bookmarkButton).toHaveAttribute('aria-pressed', 'true', { timeout: 3000 });

    // Check localStorage
    const bookmarks = await page.evaluate(() => {
      const stored = localStorage.getItem('radio-calico-bookmarks');
      return stored ? JSON.parse(stored) : [];
    });

    expect(Array.isArray(bookmarks)).toBe(true);
    expect(bookmarks.length).toBeGreaterThan(0);

    // Reload page and verify bookmark persists
    await page.reload();
    await page.waitForTimeout(2000);

    const bookmarkButtonAfterReload = page
      .getByRole('button', { name: /bookmark|save/i })
      .first();
    await expect(bookmarkButtonAfterReload).toHaveAttribute('aria-pressed', 'true');
  });
});
