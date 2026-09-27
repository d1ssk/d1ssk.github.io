# Photography & More

A single-page portfolio for Daichi Sasaki's photography and art. Images share one gallery, retain their original aspect ratios, and have no labels underneath. Clicking an image opens a viewer with whatever information has been entered for that work.

The published site is plain HTML, CSS, JavaScript, JSON, and images. It requires no framework, package installation, or server-side build. JavaScript adds masonry placement and the image viewer. Without JavaScript, all images still appear and link to their larger versions.

## Local preview

From this directory, run:

```bash
python3 -m http.server 8000
```

Open <http://localhost:8000/>. When serving the parent repository, use <http://localhost:8000/portfolio/> instead. Use the local server for previewing; the viewer reads each work's JSON information over HTTP.

## Visual layout editor (local development)

From the repository root, run:

```bash
python3 portfolio/scripts/serve_editor.py
```

Open <http://localhost:8000/editor/>. From inside `portfolio/`, use `python3 scripts/serve_editor.py`. If port 8000 is busy, add `--port 8001`.

- Arrange photographs and drawings in the **3-column** view by dragging an image. Neighbouring works move into place while dragging; the page scrolls near the top and bottom edges. On touchscreens, drag the **⠿** handle so the image itself remains available for normal scrolling.
- Use **2列** / **1列** to preview the same sequence with fewer columns. The editor and public page share the same masonry layout calculation and preserve image proportions. Change the order in the 3-column view; the narrower views follow that order automatically.
- **Delete** hides a work and moves it to the **非表示** section below. **復活** returns it to the end of the active list. Image files and metadata are retained, including after saving and restarting the editor.
- **元に戻す** / **やり直す** undo and redo changes in the current session. Focus an image and use arrow keys to reorder it. Escape cancels a drag.
- Each work's **情報** button opens its metadata editor, including works in the hidden section. Edit title, **Location（場所）**, description, alternative text, and detail labels/values. Enter a shooting location and leave its **表示** checkbox selected to show it as **Location** in the public viewer. Add custom entries such as materials or year, or remove entries you no longer need.
- Under **詳細情報**, select **他の写真からコピー**, then choose a source thumbnail. Entries with labels absent from the current draft are appended with their original labels, values, and visibility settings. Existing labels are compared after trimming surrounding whitespace and are never overwritten, even when their values are empty. Copying again does not add duplicates. Both published and hidden works are available as sources; the current work is excluded. Review the preview, then use **変更を適用** and **保存** as usual. Copying remains part of the open dialog's edits, so **キャンセル** discards it and applying it supports Undo/Redo.
- Select **表示** next to title, location, description, or an individual detail to choose what appears in the public viewer. Hiding a field preserves its value. Empty entries are omitted. The live preview uses the public viewer's visibility rules; the public viewer additionally groups shooting settings. Alternative text is for accessibility and is always available to screen readers.
- **変更を適用** applies metadata edits to the current draft; **キャンセル** or Escape discards the open dialog's edits. Applied metadata edits participate in Undo/Redo and browser draft recovery along with layout edits. Source paths and generated image dimensions are shown for reference only.
- **保存** updates changed `info.json` files and `collection.json`, and regenerates `index.html` (including edited alternative text). The existing GitHub Pages publishing workflow publishes those files; saving in the editor does not itself push or deploy. Reload the public preview after saving.
- Uncommitted edits are retained as a browser-local draft when storage is available. If the saved collection or metadata changed elsewhere, the editor loads that newer collection instead of applying an old draft. Concurrent saves with outdated collection or metadata are rejected; reload to inspect the newer version.

This editor requires only Python's standard library. Its server listens on `127.0.0.1` and is intended for local development. The published gallery has no editor link or editing API; a normal static HTTP server cannot save editor changes.

Run editor regression tests from the repository root:

```bash
python3 -m unittest discover -s portfolio/scripts -p 'test_*.py'
node portfolio/scripts/test_information.cjs
```

## Directory structure

```text
portfolio/
├── index.html                  # Generated gallery; ready to publish
├── index.template.html         # Page title, layout, and viewer markup
├── styles.css
├── gallery.js
├── layout.js                   # Shared masonry layout for gallery and editor
├── information.js              # Shared metadata visibility rules
├── collection.json             # Work IDs in display order
├── scripts/
│   ├── update_gallery.py       # Import pool images or regenerate gallery HTML
│   ├── serve_editor.py         # Local editing server
│   ├── test_editor.py          # Persistence and import regression tests
│   └── editor/                 # Dedicated editor HTML, CSS, and JavaScript
├── assets/
│   ├── pool/                   # Local originals, ignored by the parent repo
│   └── works/
│       └── <work-id>/
│           ├── thumbnail.webp  # Up to 1200 pixels on the long edge
│           ├── full.webp       # Up to 2400 pixels on the long edge
│           └── info.json       # This work's editable information
└── README.md
```

Original images remain in `assets/pool/`. Resized display copies in `assets/works/` preserve the complete image and remove embedded metadata. Available EXIF shooting conditions are copied to the work's `info.json` at import time. Missing conditions, titles, and locations are not inferred.

## Edit one work's information

Edit its `assets/works/<work-id>/info.json`:

```json
{
  "title": "",
  "location": "",
  "description": "",
  "alt": "A description of the image for screen readers.",
  "details": [
    { "label": "Camera", "value": "SONY ILCE-7M3" },
    { "label": "Lens", "value": "FE 50mm F1.8" },
    { "label": "Aperture", "value": "f/3.2" },
    { "label": "Shutter speed", "value": "1/160 s" },
    { "label": "ISO", "value": "1600" },
    { "label": "Captured", "value": "2025-08-30 18:47:57 +09:00" }
  ],
  "source": "assets/pool/DSC04124.JPG",
  "image": {
    "width": 1200,
    "height": 800,
    "fullWidth": 2400,
    "fullHeight": 1600
  }
}
```

- Fill in any title, location, or description you want to show. Empty strings and missing fields are omitted. To hide a filled field while keeping its value, use `"visibility": {"title": false, "location": false, "description": false}` (only include the fields you want to control). These fields default to visible. The editor writes these flags automatically.
- Camera and lens values appear first without visible `Camera` / `Lens` labels, followed by aperture, shutter speed, and ISO together: `f/3.2 · 1/160 s · ISO 1600`. The editor preview also omits the equipment labels. Missing settings are omitted. Keep the imported labels `Camera`, `Lens`, `Aperture`, `Shutter speed`, and `ISO` to use this grouping; the labels remain available to screen readers.
- `Captured`, `Focal length`, `35mm equivalent`, and `Exposure compensation` remain in JSON but are hidden by default. To show one for a particular work, add `"show": true` to that entry. For example, `{ "label": "Captured", "value": "2025-08-30 18:47:57 +09:00", "show": true }` displays its capture date.
- Each `details` entry is optional. Add `"show": false` to hide any entry without deleting its data. You can also add labels such as `Materials`, `Dimensions`, or `Year`, in Japanese or English; custom entries appear after shooting conditions, in their JSON order. Entries with an empty label or value are hidden.
- The importer initially fills available camera, lens, aperture, shutter speed, ISO, focal length, exposure compensation, and capture date fields from EXIF. Time zones appear only when the source provides them.
- Title, location, description, and detail edits appear after reloading the page; gallery HTML does not need rebuilding for those changes. Information is cached while browsing an open page.
- `alt` supplies the image's accessible description. After changing it, regenerate the gallery with the command below.
- `source` identifies the original file. `image` contains generated display dimensions; keep these in sync with the image files.

## Add everything from pool

Place new JPG, JPEG, PNG, WebP, or TIFF files in `assets/pool/`, then run from this directory:

```bash
python3 scripts/update_gallery.py --import-pool
```

Importing images uses Pillow and ImageMagick, which are available in the current development environment. They are preparation tools; the published website does not depend on them.

The command prepares display images, creates an `info.json` for new works, appends new work IDs to `collection.json`, and regenerates `index.html`. Previously imported works that were hidden are not re-added. Existing titles, descriptions, alternative text, and detail entries are preserved. Replacing an original refreshes its display copies; edit its existing detail entries if the shooting conditions have changed.

Review a new work's `info.json`, particularly its alternative text. Files with non-Latin names receive a stable ASCII work ID, and `source` retains their original filename. Removing an original from pool does not remove an already published work.

## Reorder, remove, or regenerate

Edit `collection.json` to reorder IDs or remove a work from the gallery. Then run:

```bash
python3 scripts/update_gallery.py
```

This command only reads JSON and the template and writes `index.html`; it uses Python's standard library and does not require Pillow or ImageMagick. Run it after editing alternative text or the page template as well. Edit `index.template.html` instead of the generated `index.html` for page-wide changes.

## Move to a separate repository

Copy this directory's contents to the new repository's root. All display images, information files, styles, and scripts are included, and their URLs are relative. There are no dependencies on the parent site's files or the `/portfolio/` URL prefix.

The originals in `assets/pool/` are not needed for publication. If copying them, add `assets/pool/*` to the new repository's `.gitignore`. Enable GitHub Pages for the new repository and update the parent site's Portfolio link to the published URL. The absolute Home link continues to lead to the personal homepage.
