# LasSim Desktop (Electron)

Desktopová aplikácia **LasSim** zabalená cez Electron. Načítava priamo webové súbory z koreňa projektu (`../app.html`, `../optics.js`, `../renderer.js`, `../i18n.js`, `../app.js`) bez duplikácie kódu a pridáva natívne menu, asociáciu súborov `.optp` aj natívne dialógy Otvoriť / Uložiť.

## Spustenie (Development)

```bash
cd desktop
npm install
npm start
```

S automaticky otvorenými DevTools:

```bash
npm run dev
```

## Build inštalátorov (Linux / Windows / macOS)

```bash
cd desktop
npm run build:linux   # AppImage + .deb -> desktop/dist/
npm run build:win     # NSIS installer + portable .exe -> desktop/dist/
npm run build:mac     # .dmg + .zip -> desktop/dist/
```
