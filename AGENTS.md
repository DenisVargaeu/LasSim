# AI Agent Instructions — OptiLab (`fyzika`)

This file provides repository-wide instructions for all AI coding assistants working in this project.

## Project Overview

**OptiLab** is a zero-dependency, client-side **2D geometric optics simulation playground** written in vanilla HTML, CSS, and JavaScript. Users place and manipulate light sources, lenses, mirrors, prisms, glass blocks, beam splitters, spectral filters, and optical detectors on an interactive pan/zoom HTML5 Canvas bench with real-time ray tracing, IndexedDB project persistence, and `.optp` JSON project import/export.

There is **no build system, bundler, framework, or package manager** (`package.json` does not exist). Everything runs directly in the browser as static files.

## File Structure & Script Load Order

Scripts are loaded via classic `<script>` tags in strict dependency order:

### Main Simulator App (`app.html`)
1. `version.js` (synced with `version.json`, `desktop/package.json`, and `CHANGELOG.md` via `python3 bump_version.py patch|minor|major|<X.Y.Z>`) — Exposes `OptiLab.VERSION` (SemVer, e.g. `1.0.0`) and `OptiLab.VERSION_INFO`.
2. `optics.js` — Physics engine, math/vector utilities (`V`), constants (`CFG`), spectral color conversion (`wavelengthToRGB`), all optical component classes, `createComponent` / `cloneComponent`, `.optp` v1 serialization (`serializeComponent`, `deserializeComponent`, `buildOptpObject`, `validateAndParseOptp`), and `RayTracer` (Snell's law, TIR, dispersion, diffraction grating, Malus's law polarization, thin-lens refraction, reflections, filtering, detector flux).
3. `renderer.js` — `Renderer` class for HiDPI HTML5 Canvas 2D drawing: grid, rays, optical components, focal markers, selection frames, rotation handles, group bounds, marquee, and drag previews.
4. `i18n.js` — EN/SK localization dictionary (`OptiLab.I18N`), DOM subtree translator, and bilingual component reference guides (`COMPONENT_INFO_I18N`).
5. `app.js` — Application controller and UI: `ProjectStorage` (IndexedDB `OptiLabDB` with in-memory fallback), `HistoryManager` (undo/redo snapshots), `PropertiesPanel` (right-hand inspector & bench overview), and `OptiLabApp` (pointer/keyboard interactions, hit-testing, presets + `?preset=` URL param, modals, toasts, theme & EN/SK switching, auto-save, `requestAnimationFrame` render loop).
6. `app.html` — Complete simulator DOM shell: top toolbar, left component library sidebar, main `<canvas>`, floating multi-selection toolbar, right properties inspector, status bar, and modals (Projects Manager, Shortcuts, Component Info, Version & Changelog, Confirm).
7. `styles.css` — Full simulator layout and Notion-inspired Warm Dark (default) & Warm Light themes via CSS custom properties.

### Landing Page (`index.html`)
- `index.html`, `landing.css`, `landing.js` — Public landing page with Start App links (`app.html` and `app.html?preset=...`), interactive live ray-traced hero preview & screenshot gallery (using `optics.js` + `renderer.js`), component overview, physics formulas, and synced Dark/Light theme + EN/SK language switcher.

### Unwired / Auxiliary Files

- `logic.js` & `logic-editor.js` — Standalone work-in-progress node-based visual logic system (`LogicEngine`, `LogicEditor`) expecting a `#logic-workspace` DOM element. **Not currently loaded in `index.html` or wired into `app.js`.** Do not hook them into the main app unless explicitly asked.
- `upload.py` — Simple FTP deployment script (`REMOTE_DIR = "/public_html/fyz"`). Reads `FTP_HOST`, `FTP_USER`, `FTP_PASSWORD` from environment variables. **Important:** it uploads every file/folder in the project root not listed in its `EXCLUDED` set. Never hardcode real credentials in this file.

## Architecture & Coding Conventions

### Module Pattern & Namespace
- Every JS file uses `'use strict';` inside an IIFE:
  ```js
  (function (global) {
    'use strict';
    // ...
  })(typeof window !== 'undefined' ? window : globalThis);
  ```
- Shared exports live on `global.OptiLab`.
- **Do not** convert files to ES modules (`import`/`export`) or introduce npm dependencies/build tools unless explicitly requested.

### Coordinate System & Physics Conventions
- World coordinates are 2D Cartesian (`x`, `y`), with viewport transform managed by `panX`, `panY`, and `zoom` (`screenToWorld` in `OptiLabApp`).
- Component `rotation` is stored in **degrees**, normalized via `normAngle()`. Convert to radians with `rad()` before trig calls.
- Grid snapping uses `CFG.GRID_SIZE` (`20` world units).
- Keep ray-tracing guards intact (`CFG.MAX_REFRACTIONS`, `CFG.MAX_TOTAL_SEGMENTS`, `CFG.RAY_EPSILON`) to prevent infinite reflection/refraction loops.

### Theme System (Important Canvas Quirk)
- `styles.css` defines dark mode as `:root` (default) and light mode via `[data-theme="light"], body.light-mode`. Theme choice is persisted in `localStorage` under `'optilab-theme'`.
- **Canvas theming in `renderer.js`:** Drawing code in `Renderer` is authored using **light-theme color literals** (e.g. `#fbf9f5`, `#37352f`, `rgba(159, 107, 83, ...)`). `Renderer._installThemeMapping()` wraps `ctx.fillStyle` and `ctx.strokeStyle` setters to remap those exact strings/prefixes into the dark palette when `this.theme === 'dark'`.
  - When adding new canvas strokes/fills, prefer reusing existing mapped light-theme colors or add their dark-mode counterparts to `EXACT` / `PREFIX` in `_installThemeMapping()`.

### State, Undo/Redo, & Render Loop
- Rendering is **dirty-flag driven** (`this._needsUpdate`), not unconditionally re-traced every animation frame.
- After mutating components or view state in `OptiLabApp`:
  - Call `this.requestUpdate()` to trigger ray tracing and canvas redraw.
  - Call `this.recordHistory()` when completing a user-undoable action (avoid calling on every `pointermove`; commit on `pointerup` or discrete changes).
  - Call `this.markUnsaved()` when project contents/settings change so the Save badge and auto-save stay accurate.

### Serialization & `.optp` Compatibility
- Project files use JSON format `OPTP` v1 (`format: 'OPTP'`, `version: 1`, `application: 'OptiLab'`).
- Keep `serializeComponent()` and `deserializeComponent()` backward-compatible: always provide safe defaults and clamp numeric values when deserializing older `.optp` files or IndexedDB records.

## Checklist: Adding a New Optical Component

Optical components span all four core runtime files. When adding a new component type, update every place in this checklist:

1. **`optics.js`**
   - Create the component subclass extending `Component`.
   - Add a case in `createComponent(type, x, y)`.
   - Copy all properties in `cloneComponent(src, dx, dy)`.
   - Persist and restore all properties in `serializeComponent(comp)` and `deserializeComponent(data, preserveId)`.
   - Handle ray intersections and physics in `RayTracer`.
   - Export the class on `global.OptiLab`.
2. **`renderer.js`**
   - Destructure the new class from `global.OptiLab`.
   - Dispatch to a new `_draw<Component>()` method inside `drawComponents()`.
   - Ensure `drawDragPreview()` renders it properly.
3. **`app.js`**
   - Destructure the new class from `global.OptiLab`.
   - Add hit-testing geometry in `OptiLabApp._hitComponent(wp, comp)`.
   - Add rotation handle placement in `OptiLabApp._getLocalHandlePos(comp)` (if non-default).
   - Add icon, controls, live value refresh, and event bindings in `PropertiesPanel` (`_getComponentIconSvg`, `_build`, `_bindEvents`, `refreshValues`).
4. **`index.html`**
   - Add a `.component-card` with matching `data-type="..."` in the left `#sidebar`.
   - Optionally add or update a preset in `OptiLabApp.loadPreset()` and `#preset-select`.

## Verification, Testing & Deployment

There is no automated test runner configured yet. After making changes:

1. **Syntax check** all modified JS files with Node:
   ```bash
   node --check optics.js
   node --check renderer.js
   node --check app.js
   ```
   (Also check `logic.js` / `logic-editor.js` if you modified them.)
2. **Physics & serialization smoke test** (runs directly in Node since `optics.js` targets `globalThis`):
   ```bash
   node -e "require('./optics.js'); const { createComponent, RayTracer, buildOptpObject, validateAndParseOptp } = globalThis.OptiLab; const comps = [createComponent('laser', -200, 0), createComponent('convex-lens', 0, 0), createComponent('optical-detector', 200, 0)]; const rt = new RayTracer(); rt.trace(comps); console.log('segments:', rt.segments.length, 'hits:', comps[2].hitCount); const parsed = validateAndParseOptp(JSON.stringify(buildOptpObject('Test', comps))); console.log('roundtrip:', parsed.components.length);"
   ```
3. **Manual browser check** (when applicable): Serve locally via static HTTP server (prefer HTTP over `file://` for consistent IndexedDB behavior):
   ```bash
   python3 -m http.server 8000
   ```
   Verify both **dark and light themes**, drag-and-drop placement, rotation, undo/redo, and `.optp` export/import.
4. **Always upload after tests pass:** Once verification/tests succeed, always deploy the updated files by running:
   ```bash
   python3 upload.py
   ```
   - Do not upload if syntax checks or tests fail.
   - If the upload fails (e.g., missing `FTP_HOST` / `FTP_USER` / `FTP_PASSWORD` environment variables or network restriction), report the exact error to the user rather than hardcoding credentials.

## Guidelines for AI Assistants

- Keep changes focused, minimal, and consistent with existing vanilla JS/CSS style.
- Do not add external CDN scripts, npm packages, or build tooling unless asked.
- Verify any new physics/math changes with a quick Node smoke script against `optics.js`.
- Always run `python3 upload.py` after tests pass to deploy changes.
- Never commit secrets or modify `.git/` metadata.
