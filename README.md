# Dolomites Trip Dashboard

GitHub Pages-ready export with offline support.

## Files
- `index.html` — main app
- `sw.js` — service worker for offline caching
- `manifest.webmanifest` — installable PWA metadata
- `icons/` — app icons
- `.nojekyll` — disables Jekyll processing on GitHub Pages

## Publish on GitHub Pages
1. Create a new GitHub repo.
2. Upload all files in this folder to the repo root.
3. In GitHub: **Settings → Pages**
4. Set source to **Deploy from a branch**
5. Choose **main** branch and **/(root)**
6. Save. Your site will publish at the repo URL.

## Offline use
- Open the site once while online.
- The service worker caches the app shell.
- After that, the dashboard can load offline on iPhone and Android browsers.

## Cache versioning
Current cache name:
`dolomites-trip-dashboard-v4-20260312`

When you update files later, bump the cache name in `sw.js` so old files are replaced cleanly.

## Relative paths
This export uses relative paths like `./sw.js` and `./manifest.webmanifest`, which works better on GitHub Pages repo URLs such as:
`https://username.github.io/my-repo/`
