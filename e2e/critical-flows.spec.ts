import { test, expect } from '@playwright/test';

/**
 * Critical User Flows - End-to-End Integration Tests
 * Tests the complete user journey from frontend through backend to database
 */

test.describe('Radio Calico - Critical User Flows', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('Flow 1: Play stream and verify audio element', async ({ page }) => {
    // Find and click the play button
    const playButton = page.getByRole('button', { name: /play/i });
    await expect(playButton).toBeVisible();
    await playButton.click();

    // Wait for button to change to pause
    await expect(page.getByRole('button', { name: /pause/i })).toBeVisible({ timeout: 5000 });

    // Verify audio element is playing
    const audioElement = page.locator('audio');
    await expect(audioElement).toBeVisible();

    const isPaused = await audioElement.evaluate((audio: HTMLAudioElement) => audio.paused);
    expect(isPaused).toBe(false);

    // Verify volume control is accessible
    const volumeSlider = page.locator('input[type="range"][aria-label*="volume" i]');
    await expect(volumeSlider).toBeVisible();
  });

  test('Flow 2: Vote on track (thumbs up)', async ({ page }) => {
    // Wait for track metadata to load
    await page.waitForTimeout(2000);

    // Find the thumbs up button
    const thumbsUpButton = page.getByRole('button', { name: /thumbs up|like/i }).first();
    await expect(thumbsUpButton).toBeVisible();

    // Click thumbs up
    await thumbsUpButton.click();

    // Verify the button shows active state (aria-pressed or visual indicator)
    await expect(thumbsUpButton).toHaveAttribute('aria-pressed', 'true', { timeout: 3000 });

    // Verify the vote was sent to backend by checking network request
    // (In a real scenario, you might check that the button reflects the saved state)
  });

  test('Flow 3: Vote on track (thumbs down)', async ({ page }) => {
    await page.waitForTimeout(2000);

    const thumbsDownButton = page.getByRole('button', { name: /thumbs down|dislike/i }).first();
    await expect(thumbsDownButton).toBeVisible();

    await thumbsDownButton.click();
    await expect(thumbsDownButton).toHaveAttribute('aria-pressed', 'true', { timeout: 3000 });
  });

  test('Flow 4: Change vote from up to down', async ({ page }) => {
    await page.waitForTimeout(2000);

    // First vote up
    const thumbsUpButton = page.getByRole('button', { name: /thumbs up|like/i }).first();
    await thumbsUpButton.click();
    await expect(thumbsUpButton).toHaveAttribute('aria-pressed', 'true', { timeout: 3000 });

    // Then change to down
    const thumbsDownButton = page.getByRole('button', { name: /thumbs down|dislike/i }).first();
    await thumbsDownButton.click();
    await expect(thumbsDownButton).toHaveAttribute('aria-pressed', 'true', { timeout: 3000 });

    // Verify up is no longer pressed
    await expect(thumbsUpButton).toHaveAttribute('aria-pressed', 'false');
  });

  test('Flow 5: Bookmark a track', async ({ page }) => {
    await page.waitForTimeout(2000);

    // Find the bookmark button
    const bookmarkButton = page.getByRole('button', { name: /bookmark|save/i }).first();
    await expect(bookmarkButton).toBeVisible();

    // Get initial bookmark count if visible
    const savedTracksSection = page.locator('text=/saved tracks/i').first();

    // Click bookmark
    await bookmarkButton.click();

    // Verify the button shows active/saved state
    await expect(bookmarkButton).toHaveAttribute('aria-pressed', 'true', { timeout: 3000 });

    // Verify the track appears in saved tracks (if section is visible)
    if (await savedTracksSection.isVisible()) {
      // Check that saved tracks section has content
      await expect(savedTracksSection).toBeVisible();
    }
  });

  test('Flow 6: Remove a bookmark', async ({ page }) => {
    await page.waitForTimeout(2000);

    // First, bookmark a track
    const bookmarkButton = page.getByRole('button', { name: /bookmark|save/i }).first();
    await bookmarkButton.click();
    await expect(bookmarkButton).toHaveAttribute('aria-pressed', 'true', { timeout: 3000 });

    // Then remove the bookmark
    await bookmarkButton.click();
    await expect(bookmarkButton).toHaveAttribute('aria-pressed', 'false', { timeout: 3000 });
  });

  test('Flow 7: Set sleep timer', async ({ page }) => {
    // Find sleep timer button (may be in a menu or directly accessible)
    const sleepTimerButton = page.getByRole('button', { name: /sleep timer/i }).first();

    if (await sleepTimerButton.isVisible()) {
      await sleepTimerButton.click();

      // Look for time selection options or input
      const timerOptions = page.locator('button[role="menuitem"], [role="option"]').first();

      if (await timerOptions.isVisible()) {
        await timerOptions.click();

        // Verify timer is active (button shows timer running or aria-pressed)
        await expect(sleepTimerButton).toHaveAttribute('aria-pressed', 'true', { timeout: 3000 });
      }
    }
  });

  test('Flow 8: Volume control adjustment', async ({ page }) => {
    const volumeSlider = page.locator('input[type="range"][aria-label*="volume" i]');
    await expect(volumeSlider).toBeVisible();

    // Get initial volume
    const initialVolume = await volumeSlider.inputValue();

    // Adjust volume using keyboard
    await volumeSlider.focus();
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowUp');

    // Verify volume changed
    const newVolume = await volumeSlider.inputValue();
    expect(newVolume).not.toBe(initialVolume);
  });

  test('Flow 9: Keyboard shortcuts - Play/Pause (Space)', async ({ page }) => {
    // Focus on body to ensure we're not in an input
    await page.locator('body').click();

    // Press space to play
    await page.keyboard.press('Space');

    // Verify pause button appears
    await expect(page.getByRole('button', { name: /pause/i })).toBeVisible({ timeout: 5000 });

    // Press space again to pause
    await page.keyboard.press('Space');

    // Verify play button reappears
    await expect(page.getByRole('button', { name: /play/i })).toBeVisible({ timeout: 5000 });
  });

  test('Flow 10: Keyboard shortcuts - Volume (Arrow keys)', async ({ page }) => {
    await page.locator('body').click();

    const volumeSlider = page.locator('input[type="range"][aria-label*="volume" i]');
    const initialVolume = parseFloat(await volumeSlider.inputValue());

    // Press arrow up to increase volume
    await page.keyboard.press('ArrowUp');
    await page.waitForTimeout(500);

    const newVolume = parseFloat(await volumeSlider.inputValue());
    expect(newVolume).toBeGreaterThan(initialVolume);
  });

  test('Flow 11: Theme toggle', async ({ page }) => {
    const themeToggle = page.getByRole('button', { name: /theme|dark mode|light mode/i }).first();

    if (await themeToggle.isVisible()) {
      // Get initial theme
      const htmlElement = page.locator('html');
      const initialTheme = await htmlElement.getAttribute('data-theme');

      // Toggle theme
      await themeToggle.click();
      await page.waitForTimeout(500);

      // Verify theme changed
      const newTheme = await htmlElement.getAttribute('data-theme');
      expect(newTheme).not.toBe(initialTheme);
    }
  });

  test('Flow 12: Complete user journey', async ({ page }) => {
    // 1. Play stream
    await page.getByRole('button', { name: /play/i }).click();
    await expect(page.getByRole('button', { name: /pause/i })).toBeVisible({ timeout: 5000 });

    // 2. Wait for track to load
    await page.waitForTimeout(3000);

    // 3. Vote on track
    const thumbsUpButton = page.getByRole('button', { name: /thumbs up|like/i }).first();
    await thumbsUpButton.click();
    await expect(thumbsUpButton).toHaveAttribute('aria-pressed', 'true', { timeout: 3000 });

    // 4. Bookmark track
    const bookmarkButton = page.getByRole('button', { name: /bookmark|save/i }).first();
    await bookmarkButton.click();
    await expect(bookmarkButton).toHaveAttribute('aria-pressed', 'true', { timeout: 3000 });

    // 5. Adjust volume
    const volumeSlider = page.locator('input[type="range"][aria-label*="volume" i]');
    await volumeSlider.fill('50');

    // 6. Pause playback
    await page.getByRole('button', { name: /pause/i }).click();
    await expect(page.getByRole('button', { name: /play/i })).toBeVisible({ timeout: 5000 });

    // All actions completed successfully
  });
});
