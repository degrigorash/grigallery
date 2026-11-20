# grigallery

A small personal gallery for screenshots and pictures worth keeping. Anyone can browse;
uploading, renaming and deleting need a login. The name of each picture carries its
context, so names are always shown and can be edited.

![Rows view on desktop](docs/screenshots/desktop-rows.png)

| Viewer | Phone |
| --- | --- |
| ![Viewer](docs/screenshots/desktop-viewer.png) | ![Phone grid](docs/screenshots/phone-grid.png) |

## Features

- **Views:** grid, justified rows and list. The choice is remembered and rendered by the server.
- **Viewer:** full screen, arrows, keyboard (← → Esc F), swipes on phones, tap to hide the controls.
  Every picture has its own link (`/?img=…`), and Back closes the viewer.
- **Sort and filter:** by upload date or name, search by name, filter by upload date.
- **Upload:** file picker, drag and drop anywhere on the page, or paste a screenshot (Ctrl+V).
  Names default to the file name and can be edited before and after upload.
- **Formats:** JPEG, PNG, WebP, GIF (animated previews too) and AVIF. Duplicates are recognised by content.
- **Phones:** three-column grid, compact list, swipe navigation, safe-area aware.

Stack: SvelteKit 3 (Svelte 5, TypeScript) on Node 24, SQLite via the built-in `node:sqlite`,
`sharp` for previews.

## Data

Everything lives in one folder (`/data` in the container):

```
data/
  originals/   files exactly as uploaded, named by random id
  thumbs/      WebP previews (animated for GIFs)
  gallery.db   names, sizes and dates
```

Copying this folder is a complete backup.
