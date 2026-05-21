# Total Tab

A calm, customizable new-tab hub for Chrome — color-coded bookmark folders + tabbed widget rail. Designed in this project and scaffolded as a working Manifest V3 extension.

## Install (developer mode)

1. Open `chrome://extensions` in Chrome.
2. Toggle **Developer mode** on (top-right).
3. Click **Load unpacked**.
4. Select this `extension/` folder.
5. Open a new tab — Total Tab takes over.

To disable, toggle the extension off in `chrome://extensions`. Your bookmarks and settings stay synced to your Chrome profile.

## What's in the box

```
extension/
├── manifest.json     ← MV3 manifest, new-tab override, storage permission
├── newtab.html       ← Page shell
├── newtab.css        ← Mist aesthetic (Manrope, soft surfaces, oklch wallpapers)
├── newtab.js         ← App logic (vanilla JS, ~700 lines, no build step)
├── icons/            ← 16/32/48/128 PNG icons
└── README.md
```

## Features

| Feature | Where |
|---|---|
| Color-coded bookmark folders, accordion-style | main area |
| Pinned tiles + full link list per folder | inside each folder |
| Rename folder (double-click name) | folder header |
| Recolor folder (click dot) | folder header |
| Delete folder, add new folder | ⋯ menu, "New folder" button |
| Add / remove bookmarks | ＋ rows, hover × on link |
| Live bookmark search (⌘K to focus) | header |
| Tabbed widget rail | right rail |
| Customize panel | ⚙ in header |
| Accent color, wallpaper, density, dark mode, name | Customize sheet |
| Cross-device sync | `chrome.storage.sync` |

## State storage

All state lives in `chrome.storage.sync` under three keys:
- `settings` — accent, wallpaper, density, dark, name
- `folders` — `[{ id, name, color }]`
- `bookmarks` — `{ [folderId]: { pinned: [...], rest: [...] } }`

In development outside the extension context, the storage adapter falls back to `localStorage`.

## Widgets

The widget tiles in the right rail currently show **placeholder data**. To wire them to real sources:

| Widget | Suggested source |
|---|---|
| Weather | [Open-Meteo](https://open-meteo.com/) — no API key, geolocation API |
| Agenda | Google Calendar via OAuth (requires `identity` permission) |
| Markets | [Yahoo Finance unofficial](https://github.com/gadicc/node-yahoo-finance2) or [Finnhub](https://finnhub.io/) |
| News | RSS via [rss2json](https://rss2json.com/) or any public JSON API |
| Sports | ESPN public scoreboard endpoints |
| Feeds | X public RSS (via bridges), Reddit `.json` endpoints, Mastodon public timelines |

Each widget's render function is in `newtab.js` (`renderWidgetBody(kind)`). To add a live data source:

1. Add a fetch in `renderWidgetBody` (cache via `chrome.storage.local` to respect rate limits).
2. Add the required `host_permissions` to `manifest.json` for the API origin.

## Customizing the design

The visual system uses CSS custom properties (`--accent`, `--accent-h`, `--bg`, `--surface`, etc.) defined at the top of `newtab.css`. Tinted and photo wallpapers are oklch gradients that pick up the accent hue — change the accent and the page retints itself.

Density variants are CSS classes on `<body>` (`.density-compact`, `.density-roomy`).

## Path to production

This scaffold is intentionally dependency-free so you can install it today. For production polish you may want to:

1. **Bundle / minify** — run through esbuild or Vite for smaller payloads.
2. **TypeScript** — add types to keep the data shape honest as widgets grow.
3. **React / Preact port** — there's a fully designed React prototype in the parent project (`Total Tab — Mist Final.html`); port it back here for richer state management.
4. **Drag-reorder folders + bookmarks** — `Sortable.js` or HTML5 drag-and-drop.
5. **Import existing Chrome bookmarks** — add `bookmarks` permission, read `chrome.bookmarks.getTree()`.
6. **Background image upload** — `chrome.storage.local` for large blobs, or a `wallpaper` permission.
7. **Onboarding** — first-run experience that imports Chrome bookmarks into a starter folder set.

## Iconography

The extension icons are generated procedurally — a rounded square in the accent color with two stacked rounded folders and a small rail, matching the page layout. To redesign, replace the four PNGs in `icons/`.

## License

Built for you in this project. Use it however you like.
