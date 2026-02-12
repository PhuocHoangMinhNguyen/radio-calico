import { test, expect } from '@playwright/test';

/**
 * Smoke Tests - Basic functionality verification
 * These tests ensure the app loads and core features are accessible
 */

test.describe('Radio Calico - Smoke Tests', () => {
  test('should load the homepage', async ({ page }) => {
    await page.goto('/');

    // Wait for the page to load
    await page.waitForLoadState('networkidle');

    // Verify title
    await expect(page).toHaveTitle(/Radio Calico/);

    // Verify key UI elements are present
    await expect(page.getByRole('button', { name: /play/i })).toBeVisible();
    await expect(page.getByText(/lossless/i)).toBeVisible();
  });

  test('should display health status', async ({ page }) => {
    await page.goto('/');

    // Wait for metadata to load
    await page.waitForTimeout(2000);

    // Check for stream info section
    const streamInfo = page.locator('text=/Stream Info|Quality/i');
    await expect(streamInfo).toBeVisible();
  });

  test('should have accessible navigation', async ({ page }) => {
    await page.goto('/');

    // Test keyboard navigation
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // Verify focus is visible (check for focus-visible or outline)
    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toBeVisible();
  });

  test('should be responsive', async ({ page }) => {
    await page.goto('/');

    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.getByRole('button', { name: /play/i })).toBeVisible();

    // Test desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 });
    await expect(page.getByRole('button', { name: /play/i })).toBeVisible();
  });
});
