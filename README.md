# OptiLab — 2D Geometric Optics Simulation Playground

**OptiLab** is a zero-dependency, real-time **2D geometric optics simulator** built with vanilla HTML, CSS, JavaScript, and HTML5 Canvas — available both as a **static web app** and an **Electron desktop application**.

Design optical benches with lasers, LEDs, point sources, lenses, curved mirrors, prisms, glass blocks, ball lenses, diffraction gratings, linear polarizers, slits, beam blockers, beam splitters, spectral filters, and live photodiode detectors — complete with real-time ray tracing, built-in physics guides, IndexedDB storage, `.optp` project files, and **EN / SK** localization.

---

## Features

- **Real-Time 2D Ray Tracing Engine (`optics.js`)**
  - Snell's Law refraction with automatic **Total Internal Reflection (TIR)**
  - Cauchy chromatic dispersion & 7-band rainbow splitting on prisms and ball lenses
  - Transmission **diffraction grating** equation: $d(\sin\theta_m - \sin\theta_i) = m\lambda$ (orders $m = 0, \pm 1, \pm 2, \pm 3$)
  - **Malus's Law** polarization ($I = I_0 \cos^2\Delta\theta$) including the 3-polarizer paradox
  - Thin-lens refraction, spherical curved mirror reflection ($f = \pm R/2$), variable R/T beam splitting, RGB/CMY & custom bandpass filtering
- **19 Optical Components** — every component includes an interactive **`(i)` Info Guide** explaining what it does, its governing physics law, adjustable controls, and a bench experiment tip.
- **10 Interactive Presets** — launch directly from the toolbar dropdown or via `app.html?preset=<id>` (Converging Lens, Diverging Beam, Keplerian Telescope, Galilean Expander, Beam Splitter & Mirrors, Prism Dispersion, Diffraction Grating Spectrum, Malus's Law 3 Polarizers, Ball Lens Caustics, Point Source & Double Slit).
- **Live Photodiode Telemetry** — real-time incident ray count, integrated optical flux %, peak intensity, mean wavelength (nm), and photon energy (eV).
- **Project Persistence & `.optp` Format** — automatic local IndexedDB storage (`OptiLabDB`), Projects Manager modal, and portable `.optp` v1 JSON export/import with drag-and-drop.
- **Bilingual UI (EN / SK) & Themes** — instant **English / Slovak** language switcher and **Notion Warm Dark / Warm Paper Light** themes synced between the landing page and simulator via `localStorage`.
- **Desktop App (`desktop/`)** — Electron wrapper with native menus, `.optp` file association, and OS Save/Open dialogs for Linux, Windows, and macOS.

---

## Optical Components Library (19)

| Category | Components |
| --- | --- |
| **Light Sources (4)** | Laser Source (380–780 nm), White LED (broadband), RGB LED (separate/mixed R·G·B), Point Source (360° / fan) |
| **Optical Lenses (3)** | Convex Lens (+f), Concave Lens (−f), Ball Lens / Dielectric Sphere |
| **Mirrors & Splitters (4)** | Plane Mirror, Concave Mirror, Convex Mirror, Beam Splitter Cube (variable R/T) |
| **Refractive & Diffractive (3)** | Optical Prism, Glass Block (dielectric slab), Diffraction Grating (100–1200 l/mm) |
| **Filters, Masks & Sensors (5)** | Optical Color Filter (RGB/CMY & bandpass), Linear Polarizer (0°–180°), Aperture / Slit (1–3 slits), Beam Blocker (optical dump), Optical Detector (photodiode) |

---

## Quick Start

### 1. Web App (Zero Build / Zero Dependencies)

Serve the project root over a local HTTP server (recommended over `file://` for full IndexedDB support):

```bash
python3 -m http.server 8000
```

Then open:
- **Landing Page (live previews & screenshots):** `http://localhost:8000/index.html`
- **Simulator App:** `http://localhost:8000/app.html`
- **Direct Preset Link:** `http://localhost:8000/app.html?preset=prism-dispersion`

### 2. Desktop App (Electron)

```bash
cd desktop
npm install
npm start            # launch OptiLab Desktop
npm run dev          # launch with DevTools open
```

Build installers (outputs to `desktop/dist/`):

```bash
cd desktop
npm run build:linux  # AppImage & .deb
npm run build:win    # NSIS installer & portable .exe
npm run build:mac    # .dmg & .zip
```

---

## Project Structure

```text
fyzika/
├── index.html          # Public landing page (live engine hero + screenshots + info)
├── landing.css         # Landing page styles (Warm Dark & Warm Light themes)
├── landing.js          # Live ray-traced hero preview, screenshots & EN/SK switcher
├── app.html            # Main OptiLab 2D optical bench simulator
├── styles.css          # Simulator UI layout & Notion Dark/Light themes
├── optics.js           # Physics engine, 19 component classes, RayTracer & .optp v1
├── renderer.js         # HiDPI HTML5 Canvas 2D renderer + automatic dark-mode palette map
├── i18n.js             # Full EN / SK localization dictionary & component (i) reference guides
├── app.js              # App controller, IndexedDB storage, HistoryManager & PropertiesPanel
├── desktop/            # Electron desktop app wrapper (main.js, preload.js, icons, builder config)
├── upload.py           # FTP deployment helper (reads FTP_HOST / FTP_USER / FTP_PASSWORD env vars)
└── AGENTS.md           # Repository instructions for AI coding assistants
```

---

## Keyboard Shortcuts

| Action | Shortcut |
| --- | --- |
| Save / Export `.optp` / Import `.optp` / New | `Ctrl+S` / `Ctrl+Shift+S` / `Ctrl+O` / `Ctrl+N` |
| Undo / Redo | `Ctrl+Z` / `Ctrl+Y` |
| Copy / Cut / Paste / Duplicate / Delete | `Ctrl+C` / `Ctrl+X` / `Ctrl+V` / `Ctrl+D` / `Del` |
| Group / Ungroup | `Ctrl+G` / `Ctrl+Shift+G` |
| Step Rotate (+15° / −15°) | `R` / `Shift+R` |
| Pan / Zoom / Reset View | `Space+Drag` / `Scroll` or `+`/`−` / `0` |
| Shortcuts Reference | `?` |

---

## Verification & Deployment

Run syntax checks and a headless Node physics/serialization smoke test:

```bash
node --check optics.js renderer.js i18n.js app.js landing.js desktop/main.js desktop/preload.js
node -e "require('./optics.js'); const { createComponent, RayTracer, buildOptpObject, validateAndParseOptp } = globalThis.OptiLab; const comps = [createComponent('laser', -200, 0), createComponent('convex-lens', 0, 0), createComponent('optical-detector', 200, 0)]; const rt = new RayTracer(); rt.trace(comps); console.log('segments:', rt.segments.length, 'hits:', comps[2].hitCount); const parsed = validateAndParseOptp(JSON.stringify(buildOptpObject('Test', comps))); console.log('roundtrip:', parsed.components.length);"
```

Deploy static web files via FTP (credentials read from environment variables `FTP_HOST`, `FTP_USER`, `FTP_PASSWORD`):

```bash
python3 upload.py
```
