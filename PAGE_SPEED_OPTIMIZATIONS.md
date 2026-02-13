# Page Speed Optimization Checklist

**Priority:** High Impact Optimizations
**Estimated Total Impact:** -35-40% initial load time, -2s Time to Interactive
**Status:** Pending Implementation

---

## 1. Lazy Load HLS.js with Dynamic Import

**Priority:** HIGH (Highest Impact)
**Effort:** Medium (1 day)
**Impact:** -1.5s TTI, -666KB initial bundle
**Status:** ❌ Not Started

### Current Issue
HLS.js (666KB, 83% of initial bundle) is imported synchronously in `hls-player.service.ts` line 2:
```typescript
import Hls from 'hls.js';
```

This forces the browser to download and parse 666KB before the user can interact with the app.

### Implementation Steps

1. **Replace synchronous import with dynamic import** in `src/app/services/hls-player.service.ts`:

```typescript
// REMOVE line 2:
// import Hls from 'hls.js';

// ADD property to store Hls class:
private HlsClass: typeof Hls | null = null;

// MODIFY initializePlayer() method to lazy load HLS.js:
async initializePlayer(audioElement: HTMLAudioElement): Promise<void> {
  this.audio = audioElement;

  // Lazy load HLS.js only when needed
  if (!this.HlsClass) {
    const { default: Hls } = await import('hls.js');
    this.HlsClass = Hls;
  }

  if (this.HlsClass.isSupported()) {
    this.initializeHls(this.streamUrl);
  } else if (this.audio.canPlayType('application/vnd.apple.mpegurl')) {
    this.initializeNativeHls(this.streamUrl);
  } else {
    this.handleError(new Error('HLS not supported'));
  }
}

// UPDATE initializeHls() to use this.HlsClass:
private initializeHls(streamUrl: string): void {
  if (!this.HlsClass) return;

  this.hls = new this.HlsClass({
    maxBufferLength: 60,
    maxMaxBufferLength: 120,
    // ... rest of config
  });

  // ... rest of method
}
```

2. **Add loading state** to show user feedback while HLS.js downloads:

```typescript
// Add signal
readonly isLoadingPlayer = signal<boolean>(false);

// Update initializePlayer:
async initializePlayer(audioElement: HTMLAudioElement): Promise<void> {
  this.isLoadingPlayer.set(true);

  try {
    // ... existing code
  } finally {
    this.isLoadingPlayer.set(false);
  }
}
```

3. **Update PlayerBar component** to show loading indicator:

In `src/app/components/player-bar/player-bar.component.html`, add loading state to play button:
```html
@if (playerService.isLoadingPlayer()) {
  <span class="material-icons loading-spinner">hourglass_empty</span>
} @else {
  <!-- existing play/pause button -->
}
```

4. **Add error handling** for dynamic import failure:

```typescript
try {
  const { default: Hls } = await import('hls.js');
  this.HlsClass = Hls;
} catch (error) {
  this.handleError(new Error('Failed to load HLS player library'));
  return;
}
```

5. **Test scenarios:**
   - First play button click (HLS.js should download)
   - Subsequent plays (should use cached HLS.js)
   - Network error during HLS.js download
   - Verify bundle size reduction in build output

### Files to Modify
- `src/app/services/hls-player.service.ts` (main changes)
- `src/app/components/player-bar/player-bar.component.html` (optional loading indicator)
- `src/app/components/player-bar/player-bar.component.scss` (optional loading spinner styles)

### Verification
- Run `pnpm run build:prod` and verify main bundle is ~100KB (down from ~760KB)
- Check Network tab: HLS.js should load only when play button is clicked
- Verify no errors in console during first playback

---

## 2. Fix Google Fonts Blocking Render

**Priority:** HIGH
**Effort:** Low (2 hours)
**Impact:** -250ms FCP, -300ms TTI
**Status:** ❌ Not Started

### Current Issue
Two blocking `@import` statements in `src/styles.scss` lines 4-5:
```scss
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&display=swap');
@import url('https://fonts.googleapis.com/icon?family=Material+Icons');
```

These block CSS parsing and add 200-300ms to First Contentful Paint.

### Implementation Steps

1. **Remove `@import` from `src/styles.scss`** (delete lines 4-5)

2. **Add font `<link>` tags to `src/index.html`** in the `<head>` section, before the closing `</head>`:

```html
<!-- Preconnect to Google Fonts (add BEFORE existing preconnect) -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>

<!-- Load Inter font -->
<link
  href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&display=swap"
  rel="stylesheet">

<!-- Load Material Icons -->
<link
  href="https://fonts.googleapis.com/icon?family=Material+Icons"
  rel="stylesheet">
```

3. **ALTERNATIVE: Preload fonts for even faster rendering** (optional, more aggressive):

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>

<!-- Preload font files directly -->
<link
  rel="preload"
  href="https://fonts.gstatic.com/s/inter/v12/UcC73FwrK3iLTeHuS_fvQtMwCp50KnMa1ZL7W0Q5nw.woff2"
  as="font"
  type="font/woff2"
  crossorigin>

<!-- Load stylesheets -->
<link
  href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&display=swap"
  rel="stylesheet">
<link
  href="https://fonts.googleapis.com/icon?family=Material+Icons"
  rel="stylesheet">
```

4. **Test rendering** to ensure fonts still load correctly and no FOUT (Flash of Unstyled Text) occurs

### Files to Modify
- `src/styles.scss` (remove lines 4-5)
- `src/index.html` (add link tags in head)

### Verification
- Check Network tab: fonts should load in parallel with other resources
- No blocking @import in styles.css
- FCP should improve (measure with Lighthouse)

---

## 3. Inline Critical CSS

**Priority:** HIGH
**Effort:** Medium (2 days)
**Impact:** -200ms FCP, -150ms LCP
**Status:** ❌ Not Started

### Current Issue
All 14KB CSS loaded via external stylesheet. No critical CSS inlined in `<head>`.

### Implementation Steps

This is more complex and requires a build-time solution. Two approaches:

#### Approach A: Manual Critical CSS (Simpler, Immediate)

1. **Identify critical above-the-fold styles** (player bar, hero section, app shell)

2. **Extract critical CSS** from compiled `dist/radio-calico/browser/styles-*.css` after build:
   - Player bar styles
   - Hero section styles
   - App container styles
   - Theme variables
   - Loading state styles

3. **Add critical CSS to `src/index.html`** in `<head>`:

```html
<style>
  /* Critical CSS - Above the fold styles */
  :root {
    --primary-color: #1DB954;
    --background-color: #121212;
    --surface-color: #1e1e1e;
    /* ... other critical CSS variables */
  }

  body {
    margin: 0;
    font-family: 'Inter', sans-serif;
    background-color: var(--background-color);
  }

  /* Player bar critical styles */
  .player-bar {
    /* ... critical player bar styles */
  }

  /* Hero section critical styles */
  .hero {
    /* ... critical hero styles */
  }
</style>
```

4. **Lazy load full stylesheet** using media attribute trick:

```html
<!-- Load full stylesheet with low priority -->
<link
  rel="stylesheet"
  href="styles.css"
  media="print"
  onload="this.media='all'">
<noscript>
  <link rel="stylesheet" href="styles.css">
</noscript>
```

#### Approach B: Automated with Critical or Critters (Better long-term)

1. **Install Critters** (Angular-recommended tool):
```bash
pnpm add -D critters
```

2. **Update `angular.json`** to enable inline critical CSS:

```json
{
  "projects": {
    "radio-calico": {
      "architect": {
        "build": {
          "configurations": {
            "production": {
              "optimization": {
                "styles": {
                  "inlineCritical": true
                }
              }
            }
          }
        }
      }
    }
  }
}
```

3. **Angular will automatically:**
   - Extract critical CSS during production build
   - Inline it in `<head>`
   - Lazy load remaining CSS

### Files to Modify
- **Approach A:** `src/index.html` (add inline styles)
- **Approach B:** `angular.json` (enable inlineCritical), `package.json` (add critters)

### Verification
- View page source: critical CSS should be inline in `<head>`
- Full stylesheet should load asynchronously
- No FOUC (Flash of Unstyled Content)
- Lighthouse score should improve

---

## 4. Remove Cover Art Cache-Busting

**Priority:** HIGH
**Effort:** Low (30 minutes)
**Impact:** -200ms per track change, reduced bandwidth
**Status:** ❌ Not Started

### Current Issue
`src/app/services/hls-player.service.ts` line 456 adds timestamp to cover URL:
```typescript
const newCoverUrl = `${COVER_URL}?t=${Date.now()}`;
```

This prevents browser caching and forces full image download for every track, even repeated tracks.

### Implementation Steps

1. **Remove cache-busting timestamp** in `src/app/services/hls-player.service.ts` line 456:

**BEFORE:**
```typescript
private updateCoverArt(): void {
  const newCoverUrl = `${COVER_URL}?t=${Date.now()}`;

  if (this.coverUrl() !== newCoverUrl) {
    this.coverUrl.set(newCoverUrl);
  }
}
```

**AFTER:**
```typescript
private updateCoverArt(): void {
  // Rely on CloudFront cache headers instead of cache-busting
  // Browser and service worker will cache based on HTTP headers
  if (this.coverUrl() !== COVER_URL) {
    this.coverUrl.set(COVER_URL);
  }
}
```

2. **ALTERNATIVE: Use ETag-based validation** if CloudFront cache is insufficient:

```typescript
private async updateCoverArt(): Promise<void> {
  try {
    // Fetch with cache validation (304 Not Modified response)
    const response = await fetch(COVER_URL, {
      cache: 'default' // Allows browser to use cached version with revalidation
    });

    if (response.ok) {
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);

      // Clean up old blob URL
      if (this.coverUrl().startsWith('blob:')) {
        URL.revokeObjectURL(this.coverUrl());
      }

      this.coverUrl.set(blobUrl);
    }
  } catch (error) {
    console.error('Failed to update cover art:', error);
  }
}
```

3. **Verify CloudFront cache headers** are set correctly (should have `Cache-Control: max-age=3600` or similar)

4. **Update service worker config** if needed to ensure cover art caching works as expected (already configured in `ngsw-config.json` with 1h maxAge)

### Files to Modify
- `src/app/services/hls-player.service.ts` (line 456)

### Verification
- Play same track twice in a session: cover should load from cache (Network tab: 200 from disk cache)
- Check service worker cache: up to 5 recent covers should be stored
- No cache-busting query param in cover URL

---

## 5. Allow Service Worker to Cache Metadata

**Priority:** HIGH
**Effort:** Low (15 minutes)
**Impact:** Reduced network requests, better offline experience
**Status:** ❌ Not Started

### Current Issue
`src/app/services/hls-player.service.ts` line 424 fetches metadata with `cache: 'no-store'`:
```typescript
const response = await fetch(METADATA_URL, { cache: 'no-store', signal });
```

This bypasses all browser caching AND the service worker's 10s freshness strategy configured in `ngsw-config.json`.

### Implementation Steps

1. **Change cache policy** in `src/app/services/hls-player.service.ts` line 424:

**BEFORE:**
```typescript
private async fetchMetadata(): Promise<void> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), METADATA_FETCH_TIMEOUT);

  try {
    const response = await fetch(METADATA_URL, { cache: 'no-store', signal: controller.signal });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    this.processMetadata(data);
  } catch (error) {
    // ... error handling
  } finally {
    clearTimeout(timeoutId);
  }
}
```

**AFTER:**
```typescript
private async fetchMetadata(): Promise<void> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), METADATA_FETCH_TIMEOUT);

  try {
    // Use 'default' cache policy to allow service worker caching
    // Service worker will respect its 10s maxAge freshness strategy
    const response = await fetch(METADATA_URL, {
      cache: 'default',
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    this.processMetadata(data);
  } catch (error) {
    // ... error handling
  } finally {
    clearTimeout(timeoutId);
  }
}
```

2. **Verify service worker configuration** in `ngsw-config.json` is correct (already configured):

```json
{
  "name": "metadata",
  "urls": [
    "https://d3d4yli4hf5bmh.cloudfront.net/metadatav2.json"
  ],
  "cacheConfig": {
    "strategy": "freshness",
    "maxAge": "10s",
    "timeout": "5s"
  }
}
```

This means:
- Service worker will cache metadata for up to 10 seconds
- After 10s, it will revalidate with the server
- If server takes > 5s to respond, serve from cache
- This aligns perfectly with the 10s polling interval

3. **OPTIONAL: Add If-None-Match header** for even better caching (if CloudFront supports ETags):

```typescript
// Store last ETag
private lastMetadataETag: string | null = null;

private async fetchMetadata(): Promise<void> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), METADATA_FETCH_TIMEOUT);

  try {
    const headers: HeadersInit = {};
    if (this.lastMetadataETag) {
      headers['If-None-Match'] = this.lastMetadataETag;
    }

    const response = await fetch(METADATA_URL, {
      cache: 'default',
      signal: controller.signal,
      headers
    });

    if (response.status === 304) {
      // Not modified, data hasn't changed
      return;
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    // Store ETag for next request
    const etag = response.headers.get('ETag');
    if (etag) {
      this.lastMetadataETag = etag;
    }

    const data = await response.json();
    this.processMetadata(data);
  } catch (error) {
    // ... error handling
  } finally {
    clearTimeout(timeoutId);
  }
}
```

### Files to Modify
- `src/app/services/hls-player.service.ts` (line 424)

### Verification
- Check Network tab: after first fetch, subsequent fetches should show "from ServiceWorker"
- If metadata hasn't changed, CloudFront may return 304 Not Modified (with ETag approach)
- No new network requests within 10s window (service worker serves from cache)
- Application tab > Service Worker > Cache Storage should show metadata entries

---

## Testing Checklist

After implementing all 5 optimizations, run these tests:

### Performance Tests
- [ ] Run Lighthouse audit (target: Performance score > 90)
- [ ] Measure FCP (target: < 2.0s on Fast 3G)
- [ ] Measure LCP (target: < 2.5s on Fast 3G)
- [ ] Measure TTI (target: < 4.0s on Fast 3G)
- [ ] Check bundle sizes: `pnpm run build:prod`
  - [ ] Main bundle: ~100KB (down from ~760KB)
  - [ ] HLS.js lazy chunk: ~666KB (new)
  - [ ] Total initial bundle: < 200KB

### Functional Tests
- [ ] First play button click downloads HLS.js dynamically
- [ ] Audio plays correctly after HLS.js loads
- [ ] Fonts render correctly (no FOUT)
- [ ] Cover art caches and reuses for repeated tracks
- [ ] Metadata fetches respect service worker cache
- [ ] Critical CSS loads immediately, full CSS loads after
- [ ] No console errors or warnings

### Regression Tests
- [ ] All existing unit tests pass: `pnpm run test:headless`
- [ ] Backend tests pass: `pnpm run test:api`
- [ ] E2E tests pass: `pnpm run test:e2e`
- [ ] App works offline (service worker active)
- [ ] Theme switching works
- [ ] Keyboard shortcuts work
- [ ] Bookmarks save/load correctly

### Browser Compatibility
- [ ] Chrome/Edge (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Mobile Chrome (Android)
- [ ] Mobile Safari (iOS)

---

## Expected Results

### Before Optimizations
- Initial bundle: ~760KB
- FCP: ~3.5s (Fast 3G)
- LCP: ~4.0s (Fast 3G)
- TTI: ~6.0s (Fast 3G)
- Lighthouse Performance: ~75

### After Optimizations
- Initial bundle: ~150KB (HLS.js deferred)
- FCP: ~2.0s (Fast 3G) → **-43% improvement**
- LCP: ~2.5s (Fast 3G) → **-38% improvement**
- TTI: ~3.5s (Fast 3G) → **-42% improvement**
- Lighthouse Performance: >90 → **+20% improvement**

### Key Improvements
- ✅ 666KB removed from initial bundle
- ✅ 250ms faster First Contentful Paint
- ✅ 200ms faster Largest Contentful Paint
- ✅ 1.5s faster Time to Interactive
- ✅ Better caching = reduced bandwidth usage
- ✅ Better offline experience

---

## Implementation Order

Recommended order to minimize conflicts:

1. **#2 - Fix Google Fonts** (easiest, no conflicts)
2. **#4 - Remove cover art cache-busting** (easy, standalone)
3. **#5 - Allow service worker metadata caching** (easy, standalone)
4. **#1 - Lazy load HLS.js** (medium complexity, test thoroughly)
5. **#3 - Inline critical CSS** (most complex, test last)

---

## Rollback Plan

If any optimization causes issues:

1. **HLS.js lazy loading issues:**
   - Revert `src/app/services/hls-player.service.ts` to synchronous import
   - Restore `import Hls from 'hls.js';` at top of file

2. **Font loading issues (FOUT):**
   - Restore `@import` statements to `src/styles.scss`
   - Remove `<link>` tags from `src/index.html`

3. **Critical CSS issues (FOUC):**
   - Remove inline `<style>` from `src/index.html`
   - Restore normal stylesheet loading

4. **Cover art caching issues:**
   - Restore timestamp: `const newCoverUrl = \`${COVER_URL}?t=${Date.now()}\`;`

5. **Metadata caching issues:**
   - Restore `cache: 'no-store'` in fetch call

---

## Additional Resources

- [Web Vitals](https://web.dev/vitals/) - Core Web Vitals metrics
- [Lighthouse CI](https://github.com/GoogleChrome/lighthouse-ci) - Automated performance testing
- [web-vitals library](https://github.com/GoogleChrome/web-vitals) - Real User Monitoring
- [Critters](https://github.com/GoogleChromeLabs/critters) - Critical CSS inlining
- [Angular Performance Guide](https://angular.dev/best-practices/runtime-performance)

---

**Last Updated:** 2026-02-13
**Author:** QA Testing Agent via Claude Code
**Full Audit Report:** Available in agent output (agent ID: a7a7be6)
