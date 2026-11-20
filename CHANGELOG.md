# Changelog

All notable changes to **LasSim** are documented in this file.
Versioning follows [Semantic Versioning (SemVer)](https://semver.org/): `MAJOR.MINOR.PATCH`.

To bump the version consistently across `version.json`, `version.js`, `desktop/package.json`, and `CHANGELOG.md`:

```bash
python3 bump_version.py patch --note "Short description of change"
python3 bump_version.py minor --note "New feature"
python3 bump_version.py major --note "Breaking change"
python3 bump_version.py 1.2.0 --note "Explicit version"
```

---

## [1.0.0] - 2026-11-20

### Added
- 19 optical components: Laser Source, White LED, RGB LED, Point Source, Convex/Concave Lenses, Ball Lens / Sphere, Plane/Concave/Convex Mirrors, Beam Splitter, Optical Prism, Glass Block, Diffraction Grating, Linear Polarizer, Aperture / Multi-Slit Mask, Beam Blocker, Optical Color Filter, and Optical Detector.
- 10 interactive optical bench presets with `?preset=` direct launch URL support.
- Built-in `(i)` physics guide modal for every optical component with formulas, controls, and experiment tips.
- Full English (`EN`) and Slovak (`SK`) language switcher synced across the landing page and simulator.
- Dedicated landing page (`index.html`) with live ray-traced hero preview and 6 live-rendered screenshot cards, plus main simulator in `app.html`.
- Electron desktop application wrapper in `desktop/` with native menus, `.optp` file associations, and OS Save/Open dialogs.
- Unified Semantic Versioning system (`version.json`, `version.js`, `bump_version.py`, `CHANGELOG.md`, and live UI version badges).
