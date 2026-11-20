(function (global) {
  'use strict';

  // Auto-synced with version.json & desktop/package.json via bump_version.py
  const VERSION_INFO = {
    name: 'LasSim',
    version: '1.0.0',
    major: 1,
    minor: 0,
    patch: 0,
    channel: 'stable',
    releaseDate: '2026-11-20',
    optpFormatVersion: 1,
    changelog: [
      {
        version: '1.0.0',
        date: '2026-11-20',
        notes: {
          en: [
            '19 optical components including Laser, White/RGB LED, Point Source, Lenses, Ball Lens, Mirrors, Prism, Glass Block, Diffraction Grating, Polarizer, Slit Mask, Beam Blocker, Filter, Splitter, and Live Detector',
            '10 interactive optical bench presets with direct ?preset= launch links',
            'Built-in (i) physics guide & formulas for every component',
            'Full English (EN) & Slovak (SK) localization and Notion Warm Dark / Light themes',
            'IndexedDB local vault + portable .optp v1 export/import',
            'Dedicated landing page with live ray-traced previews + Electron desktop app in desktop/',
          ],
          sk: [
            '19 optických prvkov: Laser, Biela/RGB LED, Bodový zdroj, Šošovky, Guľová šošovka, Zrkadlá, Hranol, Sklenený kváder, Difrakčná mriežka, Polarizátor, Štrbina, Tlmič, Filter, Delič lúča a Živý detektor',
            '10 interaktívnych šablón experimentov s podporou priameho odkazu ?preset=',
            'Vstavaný (i) fyzikálny sprievodca a vzorce ku každému prvku',
            'Kompletný prepínač jazyka EN / SK a tmavý / svetlý režim',
            'Lokálne ukladanie projektov v IndexedDB + prenosný export/import .optp v1',
            'Samostatná landing page so živými náhľadmi + Electron desktopová aplikácia v desktop/',
          ],
        },
      },
    ],
  };

  global.LasSim = global.LasSim || {};
  global.LasSim.VERSION = VERSION_INFO.version;
  global.LasSim.VERSION_INFO = VERSION_INFO;
})(typeof window !== 'undefined' ? window : globalThis);
