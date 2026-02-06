# Generate icon-512.png for OG/Twitter Meta Tags

The OG/Twitter meta tags in `src/index.html` and `src/app/services/meta.service.ts` reference `icon-512.png` which currently doesn't exist (only SVG versions are available).

## Quick Fix Options

### Option 1: Use ImageMagick (if installed)
```bash
magick convert public/icons/icon-512.svg public/icons/icon-512.png
```

### Option 2: Use Inkscape (if installed)
```bash
inkscape public/icons/icon-512.svg --export-filename=public/icons/icon-512.png --export-width=512 --export-height=512
```

### Option 3: Online Converter
1. Open https://convertio.co/svg-png/ or https://cloudconvert.com/svg-to-png
2. Upload `public/icons/icon-512.svg`
3. Download the converted PNG
4. Save as `public/icons/icon-512.png`

### Option 4: Browser-based (Manual Screenshot)
1. Open `public/icons/icon-512.svg` in a browser
2. Use browser developer tools to set viewport to 512x512
3. Take a screenshot or use "Save image as..." (if browser supports it)
4. Save as `public/icons/icon-512.png`

## After Generation

The PNG file should be placed at:
- `public/icons/icon-512.png` (source)
- Will be copied to `dist/radio-calico/browser/icons/icon-512.png` during build

Meta tags will then correctly reference the PNG for better social media compatibility.
