# Alt Tab Chrome

Chrome extension that adds an Alt+Tab style tab switcher.

## Usage

- Click the extension icon in Chrome to open the built-in shortcut help popup.
- In the popup, set the switcher theme to `System`, `Light`, or `Dark`. `System` follows Chrome and macOS appearance.
- Press `Option`+`Tab` to open the switcher and move forward through recent tabs.
- Press `Option`+`Shift`+`Tab` to move backward.
- While the switcher is open, use `ArrowUp` and `ArrowDown` to change the selection.
- Release `Option` to switch to the selected tab.
- Press `Esc` to close the switcher without switching tabs.

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

## Chrome Web Store

The first Chrome Web Store publication still has to be created in the Developer Dashboard. After that, tagged releases can upload and publish updates automatically through the Chrome Web Store API.

1. Build a zip with `npm run build`.
2. In the Chrome Web Store Developer Dashboard, create a new item and upload the zip in `dist/`.
3. Fill out the Store Listing, Privacy, Distribution, and Test Instructions sections as needed, then submit the item.
4. Once the item exists, add these GitHub settings to this repo:

```text
Variables:
- CWS_EXTENSION_ID
- CWS_PUBLISHER_ID

Secrets:
- CWS_CLIENT_ID
- CWS_CLIENT_SECRET
- CWS_REFRESH_TOKEN
```

After those values are set, each `v*` tag will build the zip, create or update the GitHub release, upload the same zip to the Chrome Web Store, and call the publish API.
