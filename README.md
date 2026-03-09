# Alt Tab Chrome

Chrome extension that adds an Alt+Tab style tab switcher.

## Development

1. Load the extension as unpacked in Chrome from this directory.
2. Use the keyboard shortcuts declared in `manifest.json`.

## Build

Run:

```bash
npm run build
```

This writes a release zip to `dist/`.

## Releases

GitHub Actions builds the extension on pushes to `main` and attaches a zip to GitHub Releases when you push a `v*` tag.
