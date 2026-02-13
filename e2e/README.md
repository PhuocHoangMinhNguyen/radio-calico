# E2E Tests

27 Playwright tests covering smoke tests, critical user flows, and API integration.

## Quick Start

```bash
# Install
pnpm add -D @playwright/test
pnpm exec playwright install

# Run tests
pnpm test:e2e              # All tests
pnpm test:e2e:ui           # Interactive UI mode
pnpm test:e2e:headed       # Watch browser
```

## Test Suites

- **smoke.spec.ts** (4 tests) - Homepage, health, accessibility, responsive
- **critical-flows.spec.ts** (12 tests) - Play/pause, voting, bookmarks, keyboard shortcuts
- **api-integration.spec.ts** (11 tests) - Health check, CRUD, rate limiting, frontend-backend sync

## Configuration

`playwright.config.ts`:
- Browsers: Chromium, Firefox, WebKit
- Timeout: 30s per test, 10s for assertions
- Retries: 2 in CI, 0 locally
- Auto-starts dev server on localhost:3000

## Debugging

```bash
pnpm exec playwright test --debug               # Debug mode
pnpm exec playwright test --headed              # See browser
pnpm exec playwright test smoke.spec.ts         # Single file
pnpm exec playwright show-report                # View results
```

## Writing Tests

Use semantic selectors:
```typescript
await page.getByRole('button', { name: /play/i }).click();
await expect(page.getByRole('button', { name: /pause/i })).toBeVisible();
```

## Resources

- [Playwright docs](https://playwright.dev/)
- [VS Code extension](https://marketplace.visualstudio.com/items?itemName=ms-playwright.playwright)
