# Dolomites Trip Dashboard

GitHub Pages-ready static site with offline support after first online load.

## Files
- `index.html`
- `styles.css`
- `app.js`
- `trip-data.json`
- `sw.js`
- `manifest.webmanifest`
- `icons/`
- `.nojekyll`

## Publish on GitHub Pages
1. Create a repo and upload all files in this folder.
2. In GitHub, open **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**.
4. Select your publishing branch and root folder.
5. Wait for GitHub Pages to publish the site.

## Offline use
1. Open the site once while online.
2. Let the page fully load.
3. The service worker caches the core files for offline reuse.

## Cache versioning
Current cache name:
`dolomites-trip-dashboard-v6-20260317`

Whenever you update the site files, bump the cache name in `sw.js` so users receive the new version.

## Paths
This project uses relative paths like `./app.js`, `./sw.js`, and `./trip-data.json`, which is the right setup for GitHub Pages repos such as:
`https://username.github.io/my-repo/`
