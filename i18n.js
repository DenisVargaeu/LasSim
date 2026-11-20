(function (global) {
  'use strict';

  // ── Exact UI Phrase Map (English -> Slovak) ──
  const SK_PHRASES = {
    // Document & Toolbar
    'LasSim — 2D Optical Simulation Playground': 'LasSim — 2D optický simulátor',
    'Projects': 'Projekty',
    'Saved': 'Uložené',
    'Unsaved': 'Neuložené',
    'Save': 'Uložiť',
    'Import': 'Import',
    'Export': 'Export',
    'Presets…': 'Šablóny…',
    'Snap': 'Mriežka',
    'Foci': 'Ohniská',
    'Center': 'Vycentrovať',
    'Clear': 'Vymazať',

    // Presets
    'Converging Lens + Detector': 'Spojná šošovka + Detektor',
    'Diverging Beam': 'Rozbiehavý zväzok',
    'Keplerian Telescope / Expander': 'Keplerov ďalekohľad / Expandér',
    'Galilean Beam Expander': 'Galileiho expandér lúča',
    'Beam Splitter & Mirrors': 'Delič lúča a zrkadlá',
    'Prism Chromatic Dispersion': 'Disperzia svetla na hranole',
    'Diffraction Grating Spectrum': 'Spektrum na difrakčnej mriežke',
    "Malus's Law (3 Polarizers)": 'Malusov zákon (3 polarizátory)',
    'Ball Lens Dispersion & Caustics': 'Guľová šošovka – disperzia a kaustika',
    'Point Source & Double Slit': 'Bodový zdroj a dvojštrbina',

    // Sidebar Section Titles
    'Light Sources': 'Zdroje svetla',
    'Optical Lenses': 'Optické šošovky',
    'Optical Components': 'Optické prvky',

    // Component Names (Sidebar, Outliner, Inspector)
    'Laser Source': 'Laserový zdroj',
    'White LED': 'Biela LED',
    'White LED Source': 'Zdroj bielej LED',
    'RGB LED': 'RGB LED',
    'RGB LED Source': 'Zdroj RGB LED',
    'Point Source': 'Bodový zdroj',
    'Point Light Source': 'Bodový zdroj svetla',
    'Convex Lens': 'Spojná šošovka',
    'Concave Lens': 'Rozptylná šošovka',
    'Ball Lens / Sphere': 'Guľová šošovka',
    'Plane Mirror': 'Rovinné zrkadlo',
    'Concave Mirror': 'Duté zrkadlo',
    'Convex Mirror': 'Vypuklé zrkadlo',
    'Optical Filter': 'Optický filter',
    'Beam Splitter': 'Delič lúča',
    'Prism': 'Optický hranol',
    'Optical Prism': 'Optický hranol',
    'Glass Block': 'Sklenený kváder',
    'Diffraction Grating': 'Difrakčná mriežka',
    'Linear Polarizer': 'Lineárny polarizátor',
    'Aperture / Slit': 'Clona / Štrbina',
    'Beam Blocker': 'Tlmič lúča',
    'Optical Detector': 'Optický detektor',

    // Sidebar Short Descriptions
    'Collimated monochromatic': 'Kolimovaný monochromatický',
    'Broadband white light': 'Širokospektrálne biele svetlo',
    'Trichromatic R·G·B emitter': 'Trojfarebný R·G·B žiarič',
    '360° radial / fan emitter': '360° radiálny / kužeľový žiarič',
    'Converging (+f)': 'Spojka (+f)',
    'Diverging (−f)': 'Rozptylka (−f)',
    'Dielectric caustic sphere': 'Dielektrická guľa s kaustikou',
    'Flat specular reflector': 'Rovinný zrkadlový odraz',
    'Converging curved reflector': 'Zbiehavé zakrivené zrkadlo',
    'Diverging curved reflector': 'Rozbiehavé zakrivené zrkadlo',
    'RGB/CMY wavelength filter': 'RGB/CMY spektrálny filter',
    'Variable R/T splitter cube': 'Kocka s nastaviteľným R/T',
    'Refractive dispersive prism': 'Lomivý disperzný hranol',
    'Refractive dielectric slab': 'Lomivá dielektrická doska',
    'Multi-order spectral grating': 'Viacrádová spektrálna mriežka',
    "Malus's law polarizing film": 'Polarizačný filter (Malusov zákon)',
    '1 / 2 / 3-slit spatial mask': '1 / 2 / 3-štrbinová clona',
    'Matte optical beam dump': 'Matná optická clona / pohlcovač',
    'Live intensity & flux sensor': 'Živý senzor intenzity a toku',

    // Sidebar Tips
    'Place Component': 'Umiestniť prvok',
    'Drag': 'Potiahni',
    'Snap 15° Angle': 'Prichytiť 15° uhol',
    'Shift + Rotate': 'Shift + Otočiť',
    'Step Rotate': 'Krokové otočenie',
    'Delete Selected': 'Zmazať vybrané',
    'Zoom Bench': 'Priblížiť plochu',
    'Scroll': 'Koliesko',

    // Floating Multi-Selection Toolbar
    'Group': 'Zoskupiť',
    'Ungroup': 'Zrušiť skupinu',
    'Align Y': 'Zarovnať Y',
    'Align X': 'Zarovnať X',
    'Duplicate': 'Duplikovať',
    'Delete': 'Zmazať',

    // Status Bar
    'Components:': 'Prvky:',
    'Selected:': 'Vybrané:',
    'Ray Segments:': 'Segmenty lúčov:',
    'Storage:': 'Úložisko:',
    'Engine:': 'Jadro:',
    '2D Geometric Optics & Snell Ray Tracer': '2D geometrická optika a Snellov sledovač lúčov',

    // Modals: Projects Manager
    'INDEXEDDB PROJECT STORAGE · OPTP v1': 'INDEXEDDB ÚLOŽISKO PROJEKTOV · OPTP v1',
    'Optical Projects Manager': 'Správca optických projektov',
    'New Project': 'Nový projekt',
    'Import .optp': 'Importovať .optp',
    'Have a external .optp experiment file?': 'Máš externý súbor experimentu .optp?',
    'Drag & drop a .optp file here or click to import into your browser vault.': 'Pretiahni sem súbor .optp alebo klikni pre import do prehliadača.',
    'Projects auto-save periodically to local IndexedDB (LasSimDB)': 'Projekty sa automaticky ukladajú lokálne do IndexedDB (LasSimDB)',
    'Open': 'Otvoriť',
    'Active': 'Aktívny',
    'ACTIVE SESSION': 'AKTÍVNA RELÁCIA',
    'Loaded': 'Otvorené',
    'Rename': 'Premenovať',
    'No saved projects in browser storage yet.': 'V úložisku prehliadača zatiaľ nie sú žiadne projekty.',

    // Modals: Shortcuts
    'QUICK REFERENCE': 'RÝCHLA NÁPOVEDA',
    'Keyboard Shortcuts': 'Klávesové skratky',
    'Project': 'Projekt',
    'Save Project': 'Uložiť projekt',
    'Export .optp File': 'Exportovať .optp súbor',
    'Import / Open .optp': 'Importovať / Otvoriť .optp',
    'Selection': 'Výber',
    'Toggle Object in Selection': 'Pridať/odobrať z výberu',
    'Extend Selection': 'Rozšíriť výber',
    'Marquee Box Selection': 'Výber rámčekom',
    'Drag Empty Space': 'Ťahaj po prázdnej ploche',
    'Select All Objects': 'Vybrať všetky objekty',
    'Clear Selection': 'Zrušiť výber',
    'Editing': 'Úpravy',
    'Undo': 'Späť',
    'Redo': 'Znova',
    'Copy Selection': 'Kopírovať výber',
    'Cut Selection': 'Vystrihnúť výber',
    'Paste Selection': 'Prilepiť výber',
    'Duplicate Selection': 'Duplikovať výber',
    'Delete Selection': 'Zmazať výber',
    'Workspace': 'Pracovná plocha',
    'Group Selection': 'Zoskupiť výber',
    'Ungroup Selection': 'Zrušiť skupinu',
    'Step Rotate (+15° / −15°)': 'Krokové otočenie (+15° / −15°)',
    'Pan Bench': 'Posun plochy',
    'Space + Drag / Middle Drag': 'Medzerník + ťah / stredné tlačidlo',
    'View': 'Zobrazenie',
    'Zoom In / Out': 'Priblížiť / Oddialiť',
    'Reset Zoom & Center': 'Reset priblíženia a stred',
    'Shortcuts Help': 'Nápoveda skratiek',

    // Modals: Confirm & Info
    'CONFIRMATION REQUIRED': 'VYŽADUJE SA POTVRDENIE',
    'Confirm Action': 'Potvrdiť akciu',
    'Cancel': 'Zrušiť',
    'Confirm': 'Potvrdiť',
    'Close': 'Zavrieť',
    '+ Add to Bench': '+ Pridať na lavicu',
    'Tip: Drag from the left library or click Add to place on bench': 'Tip: Pretiahni prvok z ľavého panela alebo klikni Pridať na lavicu',
    'Physics & Governing Law': 'Fyzika a fyzikálny zákon',
    'Key Controls': 'Kľúčové nastavenia',
    'Try on the bench:': 'Vyskúšaj na lavici:',
    'VERSION & CHANGELOG': 'VERZIA A HISTÓRIA ZMIEN',
    'About LasSim': 'O aplikácii LasSim',
    'Current Version': 'Aktuálna verzia',
    'Release Date': 'Dátum vydania',
    'Release Channel': 'Kanál vydania',
    'Project Format': 'Formát projektu',
    'Release History': 'História vydaní',
    'stable': 'stabilná',

    // Properties Panel: Overview & Multi-Select
    'Select an optical component on the bench to inspect or adjust its parameters.': 'Vyber optický prvok na pracovnej ploche pre zobrazenie alebo úpravu jeho parametrov.',
    'WORKSPACE INSPECTOR': 'INŠPEKTOR PRACOVNEJ PLOCHY',
    'Optical Bench Overview': 'Prehľad optickej lavice',
    'Bench Telemetry': 'Telemetria lavice',
    'Optical Elements': 'Optické prvky',
    'Active Detectors': 'Aktívne detektory',
    'Traced Ray Segments': 'Vykreslené segmenty lúčov',
    'Viewport Display': 'Zobrazenie plochy',
    'Snap to 20px Grid': 'Prichytávať k 20px mriežke',
    "Show Lens Focal Points (F / F')": "Zobraziť ohniská šošoviek (F / F')",
    'Show Principal Optical Axes': 'Zobraziť hlavné optické osi',
    'Scene Outliner': 'Zoznam prvkov scény',
    'Click to inspect': 'Klikni pre výber',
    'LOCKED': 'ZAMKNUTÉ',
    'GROUPED SELECTION': 'ZOSKUPENÝ VÝBER',
    'MULTI-OBJECT SELECTION': 'VIACNÁSOBNÝ VÝBER',
    'Centroid Transform': 'Transformácia ťažiska',
    'Unlocked': 'Odomknuté',
    'Centroid X': 'Ťažisko X',
    'Centroid Y': 'Ťažisko Y',
    'Group Rotation Around Centroid': 'Otočenie skupiny okolo ťažiska',
    'Alignment & Grouping': 'Zarovnanie a zoskupenie',
    'Align Horizontal (Same Y)': 'Zarovnať vodorovne (Y)',
    'Align Vertical (Same X)': 'Zarovnať zvislo (X)',
    'Group Selected': 'Zoskupiť vybrané',
    'Ungroup': 'Rozdeliť skupinu',
    'Selection Actions': 'Akcie pre výber',
    'Copy': 'Kopírovať',
    'Delete All': 'Zmazať všetko',
    'Selected Components': 'Vybrané prvky',

    // Properties Panel: Common & Category Tags
    'Spatial Transform': 'Poloha a orientácia',
    'World (px, deg)': 'Svet (px, °)',
    'Position X': 'Poloha X',
    'Position Y': 'Poloha Y',
    'Orientation': 'Otočenie',
    'MONOCHROMATIC SOURCE': 'MONOCHROMATICKÝ ZDROJ',
    'BROADBAND EMITTER': 'ŠIROKOSPEKTRÁLNY ŽIARIČ',
    'TRICHROMATIC EMITTER': 'TROJFAREBNÝ ŽIARIČ',
    'RADIAL POINT EMITTER': 'RADIÁLNY BODOVÝ ŽIARIČ',
    'CONVERGING OPTIC': 'SPOJNÁ OPTIKA',
    'DIVERGING OPTIC': 'ROZPTYLNÁ OPTIKA',
    'SPHERICAL DIELECTRIC': 'GUĽOVÉ DIELEKTRIKUM',
    'SPECULAR REFLECTOR': 'ZRKADLOVÝ ODRAZ',
    'CONVERGING MIRROR': 'ZBIEHAVÉ ZRKADLO',
    'DIVERGING MIRROR': 'ROZBIEHAVÉ ZRKADLO',
    'DIELECTRIC SPLITTER': 'DIELEKTRICKÝ DELIČ',
    'DISPERSIVE ELEMENT': 'DISPERZNÝ PRVOK',
    'REFRACTIVE SLAB': 'LOMIVÁ DOSKA',
    'PHOTODIODE SENSOR': 'FOTODIÓDOVÝ SENZOR',
    'SPECTRAL BANDPASS': 'SPEKTRÁLNY FILTER',
    'SPATIAL APERTURE': 'PRIESTOROVÁ CLONA',
    'OPTICAL BEAM DUMP': 'OPTICKÝ TLMIČ',
    'DIFFRACTIVE OPTIC': 'DIFRAKČNÁ OPTIKA',
    'DICHROIC POLARIZER': 'DICHROICKÝ POLARIZÁTOR',
    'OPTICAL ELEMENT': 'OPTICKÝ PRVOK',

    // Properties Panel: Laser / LED / Point Source
    'RGB Trichromatic Emitter': 'Trojfarebný RGB žiarič',
    'White LED Emitter': 'Žiarič bielej LED',
    'Laser Emission': 'Laserové žiarenie',
    'Separate R·G·B Rays': 'Samostatné R·G·B lúče',
    'Mixed RGB Beam': 'Zmiešaný RGB lúč',
    'Red Channel (640 nm)': 'Červený kanál (640 nm)',
    'Green Channel (532 nm)': 'Zelený kanál (532 nm)',
    'Blue Channel (460 nm)': 'Modrý kanál (460 nm)',
    'White': 'Biela',
    'Wavelength (λ)': 'Vlnová dĺžka (λ)',
    '0° Collimated': '0° Kolimovaný',
    '12° Narrow': '12° Úzky',
    '35° Flood': '35° Široký',
    'Beam Intensity': 'Intenzita lúča',
    'Ray Count': 'Počet lúčov',
    'Beam Aperture Width': 'Šírka zväzku',
    'Divergence Cone Angle': 'Uhol rozbiehavosti',
    'Photon Energy': 'Energia fotónu',
    'Frequency': 'Frekvencia',
    'Emission Spectrum': 'Emisné spektrum',
    'Polychromatic White': 'Polychromatické biele',
    'Prism Dispersion': 'Disperzia na hranole',
    '7-Band Rainbow': '7-pásmová dúha',
    'Point Emitter Output': 'Výstup bodového zdroja',
    'Broadband': 'Širokospektrálny',
    'White Light': 'Biele svetlo',
    'Monochromatic': 'Monochromatické',
    'Emission Cone Angle': 'Uhol vyžarovania',
    'Ray Density': 'Hustota lúčov',
    'Radiant Intensity': 'Intenzita žiarenia',
    'rays': 'lúčov',

    // Properties Panel: Lenses & Mirrors
    'Optical Prescription': 'Optické parametre',
    'Convex (+f)': 'Spojná (+f)',
    'Concave (−f)': 'Rozptylná (−f)',
    'Focal Length |f|': 'Ohnisková vzdialenosť |f|',
    'Lens Aperture Ø': 'Priemer šošovky Ø',
    'Signed Focal Length': 'Ohnisková vzdialenosť f',
    'Optical Power': 'Optická mohutnosť',
    'Relative Aperture': 'Svetelnosť (f-číslo)',
    "Focus F' Position": "Poloha ohniska F'",
    'Specular Mirror': 'Rovinné zrkadlo',
    'Reflective Aperture': 'Dĺžka odraznej plochy',
    'Reflection Law': 'Zákon odrazu',
    'Surface Normal n̂': 'Normála plochy n̂',
    'Curved Mirror Geometry': 'Geometria zakriveného zrkadla',
    'Concave (+f)': 'Duté (+f)',
    'Convex (−f)': 'Vypuklé (−f)',
    'Radius of Curvature (R)': 'Polomer krivosti (R)',
    'Mirror Aperture Ø': 'Priemer zrkadla Ø',
    'Display Focal Point (F)': 'Zobraziť ohnisko (F)',
    "Display Virtual Focal Point (F')": "Zobraziť zdanlivé ohnisko (F')",
    'Focal Length (R/2)': 'Ohnisková vzdialenosť (R/2)',
    'Real Focus F': 'Skutočné ohnisko F',
    "Virtual Focus F'": "Zdanlivé ohnisko F'",

    // Properties Panel: Filter, Splitter, Prism, Block, Sphere
    'Optical Color Filter': 'Optický farebný filter',
    'Red': 'Červená',
    'Green': 'Zelená',
    'Blue': 'Modrá',
    'Cyan': 'Azúrová',
    'Magenta': 'Purpurová',
    'Yellow': 'Žltá',
    'Transmission Ratio (T)': 'Priepustnosť (T)',
    'Center Pass Wavelength': 'Stredná priepustná vlnová dĺžka',
    'Passband Width (FWHM)': 'Šírka priepustného pásma (FWHM)',
    'Filter Aperture': 'Výška filtra',
    'Filter Mode': 'Režim filtra',
    'Bandpass Peak': 'Maximum priepustnosti',
    'Beam Splitting Ratio': 'Pomer delenia lúča',
    'Reflectance Ratio (R)': 'Odrazivosť (R)',
    'Splitter Cube Size': 'Veľkosť kocky deliča',
    'Prism Material & Geometry': 'Materiál a geometria hranola',
    'Glass Block Material': 'Materiál skleneného kvádra',
    'Refractive Index (n)': 'Index lomu (n)',
    'Chromatic Dispersion (Δn)': 'Chromatická disperzia (Δn)',
    'Disperse Incoming Beam into Spectrum': 'Rozložiť vstupný lúč na spektrum',
    'Side Length': 'Dĺžka strany',
    'Apex Angle': 'Lámavý uhol',
    'Block Width': 'Šírka kvádra',
    'Block Height': 'Výška kvádra',
    'TIR Critical Angle θc': 'Medzný uhol TIR θc',
    "Brewster's Angle θB": 'Brewsterov uhol θB',
    'Ball Lens / Dielectric Sphere': 'Guľová šošovka / Dielektrická guľa',
    'Sphere Radius (R)': 'Polomer gule (R)',
    'Effective Focal Length (EFL)': 'Efektívna ohnisková vzdialenosť (EFL)',
    'Back Focal Length (BFL)': 'Zadná ohnisková vzdialenosť (BFL)',
    'Water': 'Voda',
    'Silica': 'Kremeň',
    'Crown': 'Korunové',
    'Flint': 'Flintové',
    'Sapphire': 'Zafír',
    'Diamond': 'Diamant',

    // Properties Panel: Detector, Slit, Blocker, Grating, Polarizer
    'Photodiode Telemetry': 'Telemetria fotodiódy',
    'LIVE': 'ŽIVO',
    'LIGHT DETECTED': 'SVETLO DETEKOVANÉ',
    'NO SIGNAL': 'ŽIADNY SIGNÁL',
    'Incident Rays': 'Dopadajúce lúče',
    'Integrated Flux': 'Celkový optický tok',
    'Peak Ray Intensity': 'Max. intenzita lúča',
    'Mean Wavelength': 'Priemerná vlnová dĺžka',
    'Mean Photon Energy': 'Priemerná energia fotónu',
    'Active Sensor Aperture': 'Aktívna šírka senzora',
    'Aperture & Slit Geometry': 'Geometria clony a štrbín',
    'Single Slit': '1 štrbina',
    'Double Slit': '2 štrbiny',
    'Triple Slit': '3 štrbiny',
    'Slit Opening Width': 'Šírka štrbiny',
    'Slit Center Spacing (d)': 'Rozstup štrbín (d)',
    'Total Barrier Height': 'Celková výška clony',
    'Optical Beam Dump': 'Optický tlmič lúča',
    '100% Absorb': '100 % pohltenie',
    'Baffle Height': 'Výška clony',
    'Groove Density': 'Hustota čiar mriežky',
    'Max Diffraction Order (±m)': 'Max. rád difrakcie (±m)',
    'Grating Aperture': 'Výška mriežky',
    'Grating Pitch (d)': 'Mriežková konštanta (d)',
    '1st Order (532 nm, θi=0°)': '1. rád (532 nm, θi=0°)',
    'Evanescent': 'Evanescentný',
    "Linear Polarizer (Malus's Law)": 'Lineárny polarizátor (Malusov zákon)',
    'Transmission Axis (θ)': 'Os priepustnosti (θ)',
    'Axis Orientation': 'Orientácia osi',
    'Horizontal (H)': 'Vodorovná (H)',
    'Vertical (V)': 'Zvislá (V)',
    'Diagonal (+45°)': 'Diagonálna (+45°)',
    'Anti-Diag (135°)': 'Antidiagonálna (135°)',
    'Unpolarized Transmission': 'Priepustnosť nepolarizovaného',
    'Polarized Law': 'Zákon pre polarizované',
  };

  // ── Keyed Templates & Dynamic Messages ──
  const MESSAGES = {
    en: {
      pageTitle: 'LasSim — 2D Optical Simulation Playground',
      searchProjectsPlaceholder: 'Filter saved optical experiments by name…',
      defaultProjectName: 'My Optical Experiment',
      untitledProject: 'Untitled Project',
      selectedCount: '{n} selected',
      objectsSelected: '{n} Objects Selected',
      itemsCount: '{n} items',
      slitsCount: '{n} slit',
      slitsCountPlural: '{n} slits',
      raysCount: '{n} ray',
      raysCountPlural: '{n} rays',
      projectsCount: '{n} Project',
      projectsCountPlural: '{n} Projects',
      componentsCount: '{n} Component',
      componentsCountPlural: '{n} Components',
      noProjectsMatching: 'No saved projects matching "{q}"',
      justNow: 'Just now',
      secAgo: '{n}s ago',
      minAgo: '{n}m ago',
      hrAgo: '{n}h ago',
      dayAgo: '{n}d ago',
      emptyOutliner: 'No components on the bench yet.<br>Drag any component from the left sidebar.',
      toastSaved: 'Project "{name}" saved to IndexedDB',
      toastExported: 'Exported "{file}"',
      toastImported: 'Imported "{name}" ({n} components)',
      toastNewProject: 'Created new blank optical project',
      toastThemeDark: 'Switched to Notion Dark theme',
      toastThemeLight: 'Switched to Notion Light theme',
      toastLangSwitched: 'Language switched to English',
      toastAddedToBench: 'Added {name} to bench',
      toastGrouped: 'Grouped {n} components',
      toastUngrouped: 'Ungrouped selection',
      toastCopied: 'Copied {n} component(s)',
      toastCut: 'Cut {n} component(s)',
      toastPasted: 'Pasted {n} component(s)',
      toastDuplicated: 'Duplicated {n} component(s)',
      toastDeleted: 'Deleted {n} component(s)',
      toastOpenedProj: 'Opened "{name}"',
      toastDeletedProj: 'Deleted project "{name}"',
      toastDuplicatedProj: 'Duplicated "{name}"',
      confirmNewTitle: 'Create New Project',
      confirmNewMsg: 'Create a new blank project? Your current project "{name}" will be saved automatically.',
      confirmImportTitle: 'Import .optp Project',
      confirmImportMsg: 'Import "{name}"? Your current project "{current}" will be auto-saved first.',
      confirmDeleteProjTitle: 'Delete Saved Project',
      confirmDeleteProjMsg: 'Permanently delete "{name}" from browser storage? This cannot be undone.',
      lockPosition: 'Lock position',
      unlockPosition: 'Unlock position',
      infoBtnTitle: 'What does {name} do?',
    },
    sk: {
      pageTitle: 'LasSim — 2D optický simulátor',
      searchProjectsPlaceholder: 'Filtrovať uložené optické experimenty podľa názvu…',
      defaultProjectName: 'Môj optický experiment',
      untitledProject: 'Nepomenovaný projekt',
      selectedCount: '{n} vybraných',
      objectsSelected: '{n} vybraných objektov',
      itemsCount: '{n} prvkov',
      slitsCount: '{n} štrbina',
      slitsCountPlural: '{n} štrbiny',
      raysCount: '{n} lúč',
      raysCountPlural: '{n} lúčov',
      projectsCount: '{n} projekt',
      projectsCountPlural: '{n} projektov',
      componentsCount: '{n} prvok',
      componentsCountPlural: '{n} prvkov',
      noProjectsMatching: 'Nenašli sa žiadne projekty pre „{q}“',
      justNow: 'Práve teraz',
      secAgo: 'pred {n} s',
      minAgo: 'pred {n} min',
      hrAgo: 'pred {n} h',
      dayAgo: 'pred {n} d',
      emptyOutliner: 'Na pracovnej ploche zatiaľ nie sú žiadne prvky.<br>Pretiahni ľubovoľný prvok z ľavého panela.',
      toastSaved: 'Projekt „{name}“ uložený do IndexedDB',
      toastExported: 'Exportované ako „{file}“',
      toastImported: 'Importovaný „{name}“ ({n} prvkov)',
      toastNewProject: 'Vytvorený nový prázdny optický projekt',
      toastThemeDark: 'Prepnuté na tmavý režim',
      toastThemeLight: 'Prepnuté na svetlý režim',
      toastLangSwitched: 'Jazyk prepnutý na Slovenčinu',
      toastAddedToBench: 'Pridané na lavicu: {name}',
      toastGrouped: 'Zoskupených {n} prvkov',
      toastUngrouped: 'Skupina bola zrušená',
      toastCopied: 'Skopírovaných {n} prvkov',
      toastCut: 'Vystrihnutých {n} prvkov',
      toastPasted: 'Prilepených {n} prvkov',
      toastDuplicated: 'Duplikovaných {n} prvkov',
      toastDeleted: 'Zmazaných {n} prvkov',
      toastOpenedProj: 'Otvorený projekt „{name}“',
      toastDeletedProj: 'Projekt „{name}“ bol zmazaný',
      toastDuplicatedProj: 'Projekt „{name}“ bol duplikovaný',
      confirmNewTitle: 'Vytvoriť nový projekt',
      confirmNewMsg: 'Vytvoriť nový prázdny projekt? Tvoj aktuálny projekt „{name}“ sa najprv automaticky uloží.',
      confirmImportTitle: 'Importovať .optp projekt',
      confirmImportMsg: 'Importovať „{name}“? Tvoj aktuálny projekt „{current}“ sa najprv automaticky uloží.',
      confirmDeleteProjTitle: 'Zmazať uložený projekt',
      confirmDeleteProjMsg: 'Natrvalo zmazať „{name}“ z úložiska prehliadača? Túto akciu nemožno vrátiť späť.',
      lockPosition: 'Zamknúť polohu',
      unlockPosition: 'Odomknúť polohu',
      infoBtnTitle: 'Čo robí {name}?',
    },
  };

  // ── Optical Component Reference Guide (EN & SK) ──
  const COMPONENT_INFO_I18N = {
    en: {
      'laser': {
        title: 'Laser Source',
        category: 'MONOCHROMATIC LIGHT SOURCE',
        summary:
          'Emits a collimated (parallel) beam of monochromatic light at a single chosen wavelength from 380 nm (violet) to 780 nm (deep red). Ideal for precision ray alignment, focal length measurements, and refraction experiments.',
        formula: 'E = hc / λ   ·   f = c / λ',
        physics:
          'Because all rays share one wavelength, a laser beam bends by a single exact angle in refractive media and produces sharp focal spots without chromatic aberration.',
        controls: [
          ['Wavelength (λ)', 'Tune across the visible spectrum (380–780 nm) or pick standard laser lines (HeNe 633 nm, Nd:YAG 532 nm, etc.).'],
          ['Ray Count & Beam Width', 'Adjust how many parallel rays form the beam and how wide the aperture is.'],
          ['Intensity', 'Controls starting optical power measured by Optical Detectors.'],
        ],
        tip: 'Aim a multi-ray Laser at a Convex Lens to see all parallel rays converge cleanly onto the focal point F′.',
      },
      'white-led': {
        title: 'White LED Source',
        category: 'BROADBAND LIGHT SOURCE',
        summary:
          'Emits broadband white light containing all visible wavelengths (380–780 nm). Essential for demonstrating chromatic dispersion, color filtering, and rainbow spectra.',
        formula: 'White = Σ λ ∈ [380 nm, 780 nm]',
        physics:
          'White light is a mixture of the entire visible spectrum. When it passes through a dispersive prism, ball lens, or diffraction grating, shorter wavelengths (violet/blue) bend differently from longer wavelengths (red), separating into a spectrum.',
        controls: [
          ['Beam Spread Angle', 'Set to 0° for a collimated white beam, or increase up to 60° for a realistic LED cone.'],
          ['Ray Count & Beam Width', 'Control ray density and emitter aperture width.'],
        ],
        tip: 'Point a single-ray White LED (0° spread) into a Prism or Diffraction Grating to fan out a full rainbow spectrum.',
      },
      'rgb-led': {
        title: 'RGB LED Source',
        category: 'TRICHROMATIC LIGHT SOURCE',
        summary:
          'A three-die semiconductor emitter combining Red (640 nm), Green (532 nm), and Blue (460 nm) channels with independent intensity sliders.',
        formula: 'C = r·R(640nm) + g·G(532nm) + b·B(460nm)',
        physics:
          'In Separate mode, each die emits its own monochromatic sub-ray. In Mixed mode, the channels travel as a combined trichromatic beam that splits into R, G, B when passing through prisms, gratings, or color filters.',
        controls: [
          ['R / G / B Channel Sliders', 'Mix custom colors (yellow, cyan, magenta, white) or isolate individual primaries.'],
          ['Separate vs. Mixed Mode', 'Choose between three parallel color rays or a single combined trichromatic beam.'],
        ],
        tip: 'Combine a Mixed RGB LED with Cyan, Magenta, and Yellow Optical Filters to explore subtractive color filtering.',
      },
      'point-source': {
        title: 'Point Light Source',
        category: 'OMNIDIRECTIONAL / FAN EMITTER',
        summary:
          'Radiates rays outward in all directions (up to a full 360° circle) from a single point, behaving like an idealized light bulb, star, or pinhole illuminator.',
        formula: 'θ_k = θ₀ + (k / N) · Δθ',
        physics:
          'Point sources model diverging spherical wavefronts in 2D. Placing a point source at the focal point of a convex lens or concave mirror collimates its diverging rays into a parallel beam.',
        controls: [
          ['White vs. Monochromatic', 'Emit broadband white light or a single selectable wavelength.'],
          ['Emission Cone Angle', 'Switch between 360° omnidirectional illumination or narrower fan angles (60°, 120°, 180°).'],
          ['Ray Density', 'Adjust between 4 and 72 radial rays.'],
        ],
        tip: 'Place a Point Source behind an Aperture / Slit or Beam Blocker to cast sharp geometric shadows and pinhole beams.',
      },
      'convex-lens': {
        title: 'Convex Lens (Converging)',
        category: 'CONVERGING THIN LENS',
        summary:
          'A positive-focal-length (+f) converging thin lens that bends incoming parallel rays inward so they meet at the focal point F′.',
        formula: '1 / f = 1 / d_o + 1 / d_i   ·   P = 1 / f',
        physics:
          'Rays striking the lens at distance h from the optical axis are deflected inward proportionally to h / f. Rays passing through the optical center continue undeflected.',
        controls: [
          ['Focal Length (+f)', 'Shorter focal lengths bend light more strongly (higher optical power in diopters).'],
          ['Lens Aperture', 'Controls the usable diameter of the lens.'],
        ],
        tip: 'Place two Convex Lenses separated by f₁ + f₂ to build a Keplerian beam expander / telescope!',
      },
      'concave-lens': {
        title: 'Concave Lens (Diverging)',
        category: 'DIVERGING THIN LENS',
        summary:
          'A negative-focal-length (−f) diverging thin lens that spreads incoming parallel rays outward as if they originated from the virtual focal point F behind the lens.',
        formula: '1 / (−|f|) = 1 / d_o + 1 / d_i',
        physics:
          'Rays hitting at offset h from the optical axis are bent outward away from the axis. Concave lenses always form upright, reduced virtual images for real objects.',
        controls: [
          ['Focal Length (−f)', 'Controls how strongly parallel beams diverge.'],
          ['Lens Aperture', 'Controls the clear optical diameter.'],
        ],
        tip: 'Pair a Concave Lens followed by a longer-focal-length Convex Lens to build a compact Galilean beam expander.',
      },
      'glass-sphere': {
        title: 'Ball Lens / Dielectric Sphere',
        category: 'SPHERICAL REFRACTIVE OPTIC',
        summary:
          'A solid circular glass sphere (ball lens or raindrop) that refracts rays via exact Snell’s law at both its curved entry and exit surfaces, producing real caustics and dispersion.',
        formula: 'EFL = nR / (2(n − 1))   ·   n₁ sin θ₁ = n₂ sin θ₂',
        physics:
          'Unlike ideal thin lenses, a ball lens exhibits genuine spherical aberration (forming bright caustic curves), chromatic dispersion, and total internal reflection for steep internal rays.',
        controls: [
          ['Material & Refractive Index (n)', 'Choose Water, Silica, Crown, Flint, Sapphire, or Diamond, or dial any n from 1.10 to 2.50.'],
          ['Dispersion & Spectrum Split', 'Fan white light into rainbow rays on entry.'],
          ['Radius (R)', 'Scales the sphere size and effective focal length.'],
        ],
        tip: 'Shine a wide White LED beam into a Crown or Flint Glass Sphere to watch chromatic caustics focus just past the back surface!',
      },
      'plane-mirror': {
        title: 'Plane Mirror',
        category: 'FLAT SPECULAR REFLECTOR',
        summary:
          'A flat reflective surface that bounces incident light rays cleanly according to the Law of Reflection without altering their wavelength or intensity.',
        formula: 'θ_i = θ_r',
        physics:
          'The reflected ray leaves at the exact same angle to the surface normal as the incoming ray. Rotating the mirror by angle α rotates the reflected beam by 2α.',
        controls: [
          ['Orientation', 'Rotate precisely with the dial, handle, or R / Shift+R keys (45° turns a horizontal beam by 90°).'],
          ['Mirror Aperture', 'Adjust the reflective mirror length.'],
        ],
        tip: 'Use two Plane Mirrors facing each other at 45° to build a periscope, or pair with a Beam Splitter to create an interferometer.',
      },
      'concave-mirror': {
        title: 'Concave Mirror',
        category: 'CONVERGING CURVED MIRROR',
        summary:
          'An inward-curving spherical mirror that reflects parallel rays toward a real focal point F in front of the mirror at distance f = R / 2.',
        formula: 'f = R / 2   ·   1 / f = 1 / d_o + 1 / d_i',
        physics:
          'Each ray reflects using the exact local normal of the circular arc. Paraxial rays focus sharply at f = R/2, while wide-aperture outer rays reveal realistic spherical aberration.',
        controls: [
          ['Radius of Curvature (R)', 'Sets the mirror curvature; focal length is always half of R.'],
          ['Aperture & Focal Marker', 'Control mirror height and toggle the F marker.'],
        ],
        tip: 'Put a Point Source right at the focal point F of a Concave Mirror to turn it into a searchlight / collimator!',
      },
      'convex-mirror': {
        title: 'Convex Mirror',
        category: 'DIVERGING CURVED MIRROR',
        summary:
          'An outward-bulging spherical mirror that spreads incoming parallel rays apart as if they diverged from a virtual focal point F′ behind the mirror.',
        formula: 'f = −R / 2',
        physics:
          'Because the surface normal tilts outward away from the axis, parallel beams reflect into a wide diverging fan—the same principle behind wide-angle safety mirrors and Cassegrain secondary mirrors.',
        controls: [
          ['Radius of Curvature (R)', 'Smaller R produces stronger curvature and wider divergence.'],
          ['Aperture', 'Adjusts the height of the curved reflective arc.'],
        ],
        tip: 'Aim a wide multi-ray Laser at a Convex Mirror to see the diverging reflected fan and virtual focal point F′.',
      },
      'optical-filter': {
        title: 'Optical Color Filter',
        category: 'SPECTRAL BANDPASS FILTER',
        summary:
          'Selectively transmits specific wavelengths or RGB/CMY color channels while absorbing incompatible wavelengths.',
        formula: 'I_out(λ) = I_in(λ) · T(λ)',
        physics:
          'Preset RGB (Red, Green, Blue) and CMY (Cyan, Magenta, Yellow) filters act as subtractive spectral gates on white or RGB light. Custom mode provides a tunable narrowband bandpass filter around any wavelength.',
        controls: [
          ['RGB / CMY Presets or Custom λ', 'Pick primary/secondary color filters or dial a custom pass wavelength (380–780 nm) and bandwidth.'],
          ['Peak Transmission', 'Sets maximum transmittance (0–100%).'],
        ],
        tip: 'Place a Yellow filter followed by a Cyan filter in front of a White LED—only Green light survives both!',
      },
      'beam-splitter': {
        title: 'Beam Splitter Cube',
        category: 'DIELECTRIC SPLITTER',
        summary:
          'Splits every incoming light ray into two paths along its 45° internal diagonal: one transmitted straight through and one reflected at 90°.',
        formula: 'I_reflected = R · I₀   ·   I_transmitted = (1 − R) · I₀',
        physics:
          'A partially reflective dielectric coating divides optical power between reflection (R) and transmission (T = 1 − R) while conserving total intensity.',
        controls: [
          ['Reflectance Ratio (R)', 'Adjust smoothly from 0% to 100% or use presets (50/50, 70/30, 30/70, 10/90).'],
          ['Cube Size', 'Resize the splitter footprint on the bench.'],
        ],
        tip: 'Combine a 50/50 Beam Splitter with two Plane Mirrors and two Optical Detectors to build a Michelson-style interferometer layout.',
      },
      'prism': {
        title: 'Optical Prism',
        category: 'DISPERSIVE REFRACTIVE ELEMENT',
        summary:
          'A triangular dielectric prism that bends light twice via Snell’s law and separates white or RGB light into a colorful spectrum through chromatic dispersion.',
        formula: 'n₁ sin θ₁ = n₂(λ) sin θ₂',
        physics:
          'Because glass has a higher refractive index for shorter (blue/violet) wavelengths than longer (red) wavelengths, blue light bends more sharply than red. Steep internal angles also trigger Total Internal Reflection (TIR).',
        controls: [
          ['Material & Refractive Index (n)', 'Switch between Water, Crown, Flint, Diamond, etc.'],
          ['Dispersion (Δn) & Spectrum Split', 'Adjust how widely colors fan apart.'],
          ['Side Length & Apex Angle', 'Change prism geometry (default 60° equilateral).'],
        ],
        tip: 'Rotate a Prism with a single-ray laser until the internal ray hits the back face past θc to observe Total Internal Reflection!',
      },
      'glass-block': {
        title: 'Glass Block (Dielectric Slab)',
        category: 'REFRACTIVE DIELECTRIC SLAB',
        summary:
          'A rectangular block of optical glass with parallel faces. Rays refract inward on entry and back outward on exit, emerging parallel to the original beam with a lateral shift.',
        formula: 'n₁ sin θ₁ = n₂ sin θ₂   ·   θ_c = arcsin(1 / n)',
        physics:
          'At parallel opposite faces, the exit refraction cancels the entry angle change, shifting the beam sideways by an amount depending on thickness, angle of incidence, and n. Grazing internal angles can guide light like a fiber optic via TIR!',
        controls: [
          ['Material & Refractive Index (n)', 'Inspect live TIR Critical Angle θc and Brewster’s Angle θB.'],
          ['Width & Height', 'Resize the slab into a thin glass plate or a long optical waveguide.'],
        ],
        tip: 'Stretch a Glass Block wide and shine a laser steeply into its left edge to trap the beam inside via Total Internal Reflection like an optical fiber!',
      },
      'diffraction-grating': {
        title: 'Diffraction Grating',
        category: 'MULTI-ORDER DIFFRACTIVE OPTIC',
        summary:
          'A finely ruled optical plate that splits incoming light into multiple discrete diffraction orders (m = 0, ±1, ±2, ±3) according to the grating equation.',
        formula: 'd · (sin θ_m − sin θ_i) = m · λ',
        physics:
          'The 0th order (m = 0) passes straight through undispersed, while higher orders bend by angles proportional to wavelength λ and groove density (lines/mm). Red light diffracts at wider angles than violet—the opposite of a prism!',
        controls: [
          ['Groove Density (lines/mm)', 'Higher line density means smaller pitch d and wider spectral spreading (100–1200 l/mm).'],
          ['Max Order (±m)', 'Show ±1, ±2, or ±3 propagating diffraction orders.'],
        ],
        tip: 'Compare a White LED through a Diffraction Grating vs. a Prism: notice how the grating puts violet closer to the center and red on the outside!',
      },
      'polarizer': {
        title: 'Linear Polarizer',
        category: 'DICHROIC POLARIZING FILTER',
        summary:
          'Filters light by its polarization state along a configurable transmission axis (0°–180°), obeying Malus’s Law.',
        formula: 'I = ½ I₀ (unpolarized)   ·   I = I₀ cos²(Δθ) (polarized)',
        physics:
          'Unpolarized light loses 50% of its intensity and exits linearly polarized along the polarizer’s axis. A second polarizer rotated by Δθ transmits cos²(Δθ) of that light—two crossed polarizers (0° and 90°) block 100% of the beam.',
        controls: [
          ['Transmission Axis (θ)', 'Set any polarization angle from 0° to 180°, or click 0° H, 45° D, 90° V, 135°.'],
          ['Filter Aperture', 'Adjust the active filter height.'],
        ],
        tip: 'Try the famous 3-Polarizer Paradox: block a beam with 0° and 90° polarizers, then slip a 45° polarizer between them—light magically reappears at 12.5%!',
      },
      'aperture-slit': {
        title: 'Aperture / Multi-Slit Mask',
        category: 'SPATIAL MASK & SLIT BARRIER',
        summary:
          'An opaque optical barrier with 1, 2, or 3 precisely adjustable open slits that block stray rays and shape beams into narrow pinholes or multiple parallel paths.',
        formula: 'Open Slits: y ∈ [c_k − w/2, c_k + w/2]',
        physics:
          'Rays striking the opaque barrier segments are absorbed, while rays passing through the open slit windows continue unimpeded—essential for pinhole optics, beam collimation, and double-slit setups.',
        controls: [
          ['Slit Count (1 / 2 / 3)', 'Switch between Single Slit (pinhole), Double Slit, and Triple Slit masks.'],
          ['Slit Width & Spacing', 'Control how wide each opening is and how far apart multiple slits sit.'],
          ['Total Barrier Height', 'Adjust the overall height of the blocking screen.'],
        ],
        tip: 'Place a Single Slit in front of a 360° Point Source to create a clean directional light fan, or use a Double Slit to split one wide beam into two.',
      },
      'beam-blocker': {
        title: 'Beam Blocker (Optical Dump)',
        category: 'OPAQUE OPTICAL BAFFLE',
        summary:
          'A matte-black 100%-absorbing optical baffle that completely stops any light rays hitting it, preventing unwanted reflections or stray beams.',
        formula: 'T = 0   ·   R = 0   ·   A = 100%',
        physics:
          'Acts as an ideal optical beam dump or shadow-casting obstacle, absorbing all incident optical power regardless of wavelength or polarization.',
        controls: [
          ['Baffle Height', 'Adjust the length of the blocking barrier (24–360 px).'],
          ['Orientation', 'Rotate to block stray beams at any angle.'],
        ],
        tip: 'Use a Beam Blocker in front of a Point Source to demonstrate umbra shadows, or terminate unused branches from a Beam Splitter.',
      },
      'optical-detector': {
        title: 'Optical Detector (Photodiode)',
        category: 'LIVE INTENSITY & FLUX SENSOR',
        summary:
          'A real-time optical sensor that absorbs incoming rays and reports live hit count, integrated optical flux, peak ray intensity, mean wavelength, and photon energy.',
        formula: 'Φ = Σ I_k   ·   E_photon = 1239.84 / λ (eV)',
        physics:
          'Every ray striking the detector’s active front surface is tallied during ray tracing, allowing quantitative verification of lenses, splitters, color filters, and Malus’s Law.',
        controls: [
          ['Active Sensor Aperture', 'Widen or narrow the photosensitive window (20–260 px).'],
          ['Live Telemetry Panel', 'Select the detector to watch live flux %, ray count, dominant color, and eV update in real time.'],
        ],
        tip: 'Place an Optical Detector behind a pair of Linear Polarizers and sweep the second polarizer’s angle to measure Malus’s Law live!',
      },
    },
    sk: {
      'laser': {
        title: 'Laserový zdroj',
        category: 'MONOCHROMATICKÝ ZDROJ SVETLA',
        summary:
          'Vyžaruje kolimovaný (rovnobežný) zväzok monochromatického svetla jednej zvolenej vlnovej dĺžky od 380 nm (fialová) po 780 nm (tmavočervená). Ideálny na presné zarovnanie, meranie ohniskovej vzdialenosti a pokusy s lomom svetla.',
        formula: 'E = hc / λ   ·   f = c / λ',
        physics:
          'Keďže všetky lúče majú rovnakú vlnovú dĺžku, laserový lúč sa v lomivom prostredí láme pod jediným presným uhlom a vytvára ostré ohnisko bez chromatickej aberácie.',
        controls: [
          ['Vlnová dĺžka (λ)', 'Plynulé ladenie viditeľného spektra (380–780 nm) alebo rýchle predvoľby (HeNe 633 nm, Nd:YAG 532 nm a pod.).'],
          ['Počet lúčov a šírka zväzku', 'Nastav, koľko rovnobežných lúčov tvorí zväzok a aká je jeho šírka.'],
          ['Intenzita', 'Určuje počiatočný optický výkon meraný Optickým detektorom.'],
        ],
        tip: 'Namier viaclúčový laser na Spojnú šošovku a sleduj, ako sa všetky rovnobežné lúče presne zbiehajú v ohnisku F′.',
      },
      'white-led': {
        title: 'Zdroj bielej LED',
        category: 'ŠIROKOSPEKTRÁLNY ZDROJ SVETLA',
        summary:
          'Vyžaruje širokospektrálne biele svetlo obsahujúce všetky viditeľné vlnové dĺžky (380–780 nm). Nevyhnutný na ukážku disperzie svetla, farebného filtrovania a dúhového spektra.',
        formula: 'Biele svetlo = Σ λ ∈ [380 nm, 780 nm]',
        physics:
          'Biele svetlo je zmesou celého viditeľného spektra. Pri prechode cez disperzný hranol, guľovú šošovku alebo difrakčnú mriežku sa kratšie vlnové dĺžky (fialová/modrá) lámu inak ako dlhšie (červená) a rozložia sa na farebné spektrum.',
        controls: [
          ['Uhol rozbiehavosti', 'Nastav 0° pre rovnobežný biely lúč alebo až do 60° pre realistický kužeľ LED.'],
          ['Počet lúčov a šírka zväzku', 'Uprav hustotu lúčov a šírku výstupného otvoru.'],
        ],
        tip: 'Namier jednolúčovú Bielu LED (rozbiehavosť 0°) na Optický hranol alebo Difrakčnú mriežku a získaj krásne dúhové spektrum.',
      },
      'rgb-led': {
        title: 'Zdroj RGB LED',
        category: 'TROJFAREBNÝ ZDROJ SVETLA',
        summary:
          'Trojčipový polovodičový žiarič kombinujúci červený (640 nm), zelený (532 nm) a modrý (460 nm) kanál so samostatným ovládaním intenzity.',
        formula: 'C = r·R(640nm) + g·G(532nm) + b·B(460nm)',
        physics:
          'V samostatnom režime vysiela každý čip vlastný monochromatický lúč. V zmiešanom režime putujú ako jeden trojfarebný lúč, ktorý sa rozdelí na R, G, B pri prechode hranolom, mriežkou alebo farebným filtrom.',
        controls: [
          ['Posuvníky R / G / B', 'Namiešaj vlastné farby (žltá, azúrová, purpurová, biela) alebo zapni len jednu zložku.'],
          ['Samostatné vs. Zmiešaný lúč', 'Prepínaj medzi troma rovnobežnými farebnými lúčmi a jedným zmiešaným zväzkom.'],
        ],
        tip: 'Skombinuj zmiešanú RGB LED s azúrovým, purpurovým a žltým Optickým filtrom na ukážku subtraktívneho filtrovania farieb.',
      },
      'point-source': {
        title: 'Bodový zdroj svetla',
        category: 'VŠESMEROVÝ / KUŽEĽOVÝ ŽIARIČ',
        summary:
          'Vyžaruje lúče do všetkých smerov (až do plných 360°) z jedného bodu – správa sa ako idealizovaná žiarovka, hviezda alebo bodový iluminátor.',
        formula: 'θ_k = θ₀ + (k / N) · Δθ',
        physics:
          'Bodový zdroj modeluje rozbiehavé guľové vlnoplochy v 2D. Ak ho umiestniš presne do ohniska spojnej šošovky alebo dutého zrkadla, jeho rozbiehavé lúče sa zmenia na rovnobežný zväzok.',
        controls: [
          ['Biele vs. Monochromatické', 'Vyžaruj biele svetlo alebo jednu zvolenú vlnovú dĺžku.'],
          ['Uhol vyžarovania', 'Prepínaj medzi 360° všesmerovým svetlom alebo užším vejárom (60°, 120°, 180°).'],
          ['Hustota lúčov', 'Nastav 4 až 72 radiálnych lúčov.'],
        ],
        tip: 'Postav pred Bodový zdroj Clonu / Štrbinu alebo Tlmič lúča a pozoruj ostré geometrické tiene alebo dierkovú komoru.',
      },
      'convex-lens': {
        title: 'Spojná šošovka (Spojka)',
        category: 'SPOJNÁ TENKÁ ŠOŠOVKA',
        summary:
          'Tenká spojná šošovka s kladnou ohniskovou vzdialenosťou (+f), ktorá láme rovnobežné dopadajúce lúče dovnútra tak, aby sa stretli v ohnisku F′.',
        formula: '1 / f = 1 / a + 1 / a′   ·   φ = 1 / f',
        physics:
          'Lúče dopadajúce vo vzdialenosti h od optickej osi sa ohýbajú smerom k osi úmerne pomeru h / f. Lúč prechádzajúci optickým stredom pokračuje bez zmeny smeru.',
        controls: [
          ['Ohnisková vzdialenosť (+f)', 'Kratšia ohnisková vzdialenosť znamená silnejší lom (vyššia optická mohutnosť v dioptriách).'],
          ['Priemer šošovky', 'Nastavuje využiteľnú šírku (apertúru) šošovky.'],
        ],
        tip: 'Umiestni dve Spojné šošovky vo vzdialenosti f₁ + f₂ a zostav si Keplerov ďalekohľad / expandér lúča!',
      },
      'concave-lens': {
        title: 'Rozptylná šošovka (Rozptylka)',
        category: 'ROZPTYLNÁ TENKÁ ŠOŠOVKA',
        summary:
          'Tenká rozptylná šošovka so zápornou ohniskovou vzdialenosťou (−f), ktorá rozptyľuje rovnobežné lúče smerom von, akoby vychádzali zo zdanlivého ohniska F pred šošovkou.',
        formula: '1 / (−|f|) = 1 / a + 1 / a′',
        physics:
          'Lúče dopadajúce vo vzdialenosti h od optickej osi sa lámu smerom od osi. Rozptylka vždy vytvára priamy, zmenšený a zdanlivý obraz skutočných predmetov.',
        controls: [
          ['Ohnisková vzdialenosť (−f)', 'Určuje, ako silno sa rovnobežný zväzok rozbieha.'],
          ['Priemer šošovky', 'Nastavuje svetlú apertúru šošovky.'],
        ],
        tip: 'Skombinuj Rozptylnú šošovku so Spojnou šošovkou s dlhším ohniskom a vytvor kompaktný Galileiho expandér lúča.',
      },
      'glass-sphere': {
        title: 'Guľová šošovka / Dielektrická guľa',
        category: 'GUĽOVÁ LOMIVÁ OPTIKA',
        summary:
          'Plná sklenená guľa (guľová šošovka alebo kvapka vody), ktorá láme svetlo podľa presného Snellovho zákona na vstupnom aj výstupnom zakrivenom povrchu a vytvára skutočné kaustiky aj disperziu.',
        formula: 'EFL = nR / (2(n − 1))   ·   n₁ sin θ₁ = n₂ sin θ₂',
        physics:
          'Na rozdiel od ideálnej tenkej šošovky vykazuje guľová šošovka reálnu sférickú aberáciu (jasné kaustické krivky), farebnú disperziu a pri strmých uhloch aj úplný vnútorný odraz.',
        controls: [
          ['Materiál a index lomu (n)', 'Vyber Vodu, Kremeň, Korunové/Flintové sklo, Zafír alebo Diamant (1,10 – 2,50).'],
          ['Disperzia a rozklad spektra', 'Rozlož biele svetlo po vstupe na dúhové zložky.'],
          ['Polomer (R)', 'Mení veľkosť gule a jej efektívnu ohniskovú vzdialenosť.'],
        ],
        tip: 'Posvieť širokým zväzkom Bielej LED na sklenenú guľu a sleduj chromatické kaustiky tesne za jej zadným okrajom!',
      },
      'plane-mirror': {
        title: 'Rovinné zrkadlo',
        category: 'ROVINNÝ ZRKADLOVÝ ODRAZ',
        summary:
          'Rovná odrazná plocha, ktorá presne odráža dopadajúce lúče podľa zákona odrazu bez zmeny ich vlnovej dĺžky či intenzity.',
        formula: 'θ_i = θ_r',
        physics:
          'Odrazený lúč zviera s kolmicou dopadu presne rovnaký uhol ako dopadajúci lúč. Otočenie zrkadla o uhol α otočí odrazený lúč o 2α.',
        controls: [
          ['Otočenie', 'Otáčaj presne kolieskom, úchytom alebo klávesmi R / Shift+R (45° otočí vodorovný lúč o 90°).'],
          ['Dĺžka zrkadla', 'Nastav dĺžku odraznej plochy.'],
        ],
        tip: 'Postav dve Rovinné zrkadlá pod uhlom 45° a zostav periskop, alebo ich skombinuj s Deličom lúča ako interferometer.',
      },
      'concave-mirror': {
        title: 'Duté zrkadlo',
        category: 'ZBIEHAVÉ ZAKRIVENÉ ZRKADLO',
        summary:
          'Dovnútra prehnuté guľové zrkadlo, ktoré odráža rovnobežné lúče do skutočného ohniska F pred zrkadlom vo vzdialenosti f = R / 2.',
        formula: 'f = R / 2   ·   1 / f = 1 / a + 1 / a′',
        physics:
          'Každý lúč sa odráža podľa presnej lokálnej normály kruhového oblúka. Lúče blízko osi sa zbiehajú presne v f = R/2, zatiaľ čo okrajové lúče ukazujú skutočnú sférickú aberáciu.',
        controls: [
          ['Polomer krivosti (R)', 'Určuje zakrivenie zrkadla; ohnisková vzdialenosť je vždy polovicou R.'],
          ['Priemer a značka ohniska', 'Uprav výšku zrkadla a zapni/vypni zobrazenie ohniska F.'],
        ],
        tip: 'Umiestni Bodový zdroj presne do ohniska F Dutého zrkadla a premeň ho na reflektor s rovnobežným lúčom!',
      },
      'convex-mirror': {
        title: 'Vypuklé zrkadlo',
        category: 'ROZBIEHAVÉ ZAKRIVENÉ ZRKADLO',
        summary:
          'Von vyklenuté guľové zrkadlo, ktoré rozptyľuje rovnobežné lúče tak, akoby vychádzali zo zdanlivého ohniska F′ za zrkadlom.',
        formula: 'f = −R / 2',
        physics:
          'Keďže normála povrchu sa skláňa smerom od osi, rovnobežný zväzok sa odráža do širokého rozbiehavého vejára – rovnaký princíp používajú dopravné bezpečnostné zrkadlá.',
        controls: [
          ['Polomer krivosti (R)', 'Menšie R znamená silnejšie zakrivenie a väčší rozptyl.'],
          ['Priemer zrkadla', 'Nastavuje výšku zakriveného odrazného oblúka.'],
        ],
        tip: 'Namier široký viaclúčový laser na Vypuklé zrkadlo a pozoruj rozbiehavý odraz aj polohu zdanlivého ohniska F′.',
      },
      'optical-filter': {
        title: 'Optický farebný filter',
        category: 'SPEKTRÁLNY PÁSMOVÝ FILTER',
        summary:
          'Selektívne prepúšťa iba určité vlnové dĺžky alebo RGB/CMY farebné kanály, zatiaľ čo nežiaduce vlnové dĺžky pohlcuje.',
        formula: 'I_out(λ) = I_in(λ) · T(λ)',
        physics:
          'Predvoľby RGB (červená, zelená, modrá) a CMY (azúrová, purpurová, žltá) fungujú ako subtraktívne spektrálne filtre. Vlastný režim umožňuje naladiť úzkopásmový filter na ľubovoľnú vlnovú dĺžku.',
        controls: [
          ['Predvoľby RGB / CMY alebo vlastná λ', 'Zvoľ farebný filter alebo nastav vlastnú priepustnú vlnovú dĺžku (380–780 nm) a šírku pásma.'],
          ['Priepustnosť (T)', 'Nastavuje maximálnu priepustnosť filtra (0–100 %).'],
        ],
        tip: 'Postav za Bielu LED najprv Žltý a potom Azúrový filter – cez oba prejde už iba zelené svetlo!',
      },
      'beam-splitter': {
        title: 'Delič lúča (Kocka)',
        category: 'DIELEKTRICKÝ DELIČ LÚČA',
        summary:
          'Rozdeľuje každý dopadajúci lúč pozdĺž vnútornej 45° uhlopriečky na dve vetvy: jednu prechádzajúcu priamo a druhú odrazenú pod uhlom 90°.',
        formula: 'I_odrazené = R · I₀   ·   I_prechádzajúce = (1 − R) · I₀',
        physics:
          'Polopriepustná dielektrická vrstva rozdeľuje optický výkon medzi odraz (R) a priepustnosť (T = 1 − R) pri zachovaní celkovej intenzity.',
        controls: [
          ['Odrazivosť (R)', 'Nastav plynulo od 0 % do 100 % alebo použi predvoľby (50/50, 70/30, 30/70, 10/90).'],
          ['Veľkosť kocky', 'Uprav rozmery deliča na pracovnej ploche.'],
        ],
        tip: 'Skombinuj 50/50 Delič lúča s dvoma Rovinnými zrkadlami a detektormi a vytvor schému Michelsonovho interferometra.',
      },
      'prism': {
        title: 'Optický hranol',
        category: 'DISPERZNÝ LOMIVÝ PRVOK',
        summary:
          'Trojboký dielektrický hranol, ktorý dvakrát láme svetlo podľa Snellovho zákona a chromatickou disperziou rozkladá biele alebo RGB svetlo na dúhové spektrum.',
        formula: 'n₁ sin θ₁ = n₂(λ) sin θ₂',
        physics:
          'Sklo má vyšší index lomu pre kratšie (modré/fialové) vlnové dĺžky než pre dlhšie (červené), preto sa modrá láme silnejšie než červená. Pri strmých vnútorných uhloch nastáva aj úplný vnútorný odraz (TIR).',
        controls: [
          ['Materiál a index lomu (n)', 'Prepínaj medzi Vodou, Korunovým/Flintovým sklom, Diamantom a pod.'],
          ['Disperzia (Δn) a rozklad spektra', 'Nastav, ako široko sa farby rozložia.'],
          ['Dĺžka strany a lámavý uhol', 'Meň geometriu hranola (predvolene 60° rovnostranný).'],
        ],
        tip: 'Otáčaj Hranolom pri jednolúčovom laseri, kým vnútorný lúč neprekročí medzný uhol θc a nezačne sa úplne odrážať!',
      },
      'glass-block': {
        title: 'Sklenený kváder (Planparalelná doska)',
        category: 'LOMIVÁ DIELEKTRICKÁ DOSKA',
        summary:
          'Obdĺžnikový blok optického skla s rovnobežnými stenami. Lúče sa pri vstupe lámu k normále a pri výstupe späť, takže vystupujú rovnobežne s pôvodným smerom, ale bočne posunuté.',
        formula: 'n₁ sin θ₁ = n₂ sin θ₂   ·   θ_c = arcsin(1 / n)',
        physics:
          'Na rovnobežných stenách sa zmena uhla na výstupe vyruší a výsledkom je rovnobežný posuv lúča závislý od hrúbky, uhla dopadu a indexu lomu n. Pri šikmom vstupe do boku dokáže viesť svetlo ako optické vlákno!',
        controls: [
          ['Materiál a index lomu (n)', 'Sleduj živý medzný uhol TIR θc a Brewsterov uhol θB.'],
          ['Šírka a výška', 'Prispôsob kváder na tenkú doštičku alebo dlhý svetlovod.'],
        ],
        tip: 'Natiahni Sklenený kváder do šírky a posvieť laserom šikmo do ľavej hrany – lúč sa vnútri zachytí úplným vnútorným odrazom ako v optickom vlákne!',
      },
      'diffraction-grating': {
        title: 'Difrakčná mriežka',
        category: 'VIACRÁDOVÁ DIFRAKČNÁ OPTIKA',
        summary:
          'Jemne rýhovaná optická doštička, ktorá rozdeľuje prechádzajúce svetlo do viacerých diskrétnych difrakčných rádov (m = 0, ±1, ±2, ±3) podľa mriežkovej rovnice.',
        formula: 'd · (sin θ_m − sin θ_i) = m · λ',
        physics:
          'Nultý rád (m = 0) prechádza priamo bez rozkladu, zatiaľ čo vyššie rády sa ohýbajú pod uhlom úmerným vlnovej dĺžke λ a hustote čiar. Červená sa ohýba viac než fialová – presne opačne ako pri hranole!',
        controls: [
          ['Hustota čiar (čiar/mm)', 'Vyššia hustota znamená menšiu mriežkovú konštantu d a širší rozklad spektra (100–1200 l/mm).'],
          ['Max. rád (±m)', 'Zobraz difrakčné rády ±1, ±2 alebo ±3.'],
        ],
        tip: 'Porovnaj Bielu LED cez Difrakčnú mriežku a cez Hranol: všimni si, že mriežka dáva fialovú bližšie k stredu a červenú na vonkajšiu stranu!',
      },
      'polarizer': {
        title: 'Lineárny polarizátor',
        category: 'DICHROICKÝ POLARIZAČNÝ FILTER',
        summary:
          'Filtruje svetlo podľa jeho polarizácie pozdĺž nastaviteľnej osi priepustnosti (0°–180°) v súlade s Malusovým zákonom.',
        formula: 'I = ½ I₀ (nepolarizované)   ·   I = I₀ cos²(Δθ) (polarizované)',
        physics:
          'Nepolarizované svetlo stratí 50 % intenzity a vystupuje lineárne polarizované. Druhý polarizátor pootočený o Δθ prepustí cos²(Δθ) – dva skrížené polarizátory (0° a 90°) pohltia 100 % svetla.',
        controls: [
          ['Os priepustnosti (θ)', 'Nastav ľubovoľný uhol polarizácie 0°–180° alebo použi tlačidlá 0° H, 45° D, 90° V, 135°.'],
          ['Výška filtra', 'Nastav aktívnu apertúru filtra.'],
        ],
        tip: 'Vyskúšaj slávny paradox 3 polarizátorov: zablokuj lúč 0° a 90° polarizátorom, potom vlož medzi ne 45° polarizátor – svetlo znova prejde (12,5 %)!',
      },
      'aperture-slit': {
        title: 'Clona / Viacštrbinová maska',
        category: 'PRIESTOROVÁ CLONA A ŠTRBINA',
        summary:
          'Nepriehľadná optická clona s 1, 2 alebo 3 nastaviteľnými štrbinami, ktorá blokuje nežiaduce lúče a tvaruje svetlo do úzkych zväzkov alebo viacerých rovnobežných dráh.',
        formula: 'Otvorené štrbiny: y ∈ [c_k − w/2, c_k + w/2]',
        physics:
          'Lúče dopadajúce na nepriehľadné časti clony sa pohltia, zatiaľ čo lúče prechádzajúce otvorenými štrbinami pokračujú bez prekážky – základ pre dierkovú komoru, kolimáciu aj dvojštrbinové usporiadania.',
        controls: [
          ['Počet štrbín (1 / 2 / 3)', 'Prepínaj medzi jednoštrbinou, dvojštrbinou a trojštrbinou.'],
          ['Šírka a rozstup štrbín', 'Nastav šírku otvorov aj vzdialenosť medzi nimi.'],
          ['Celková výška clony', 'Uprav výšku celej nepriehľadnej prekážky.'],
        ],
        tip: 'Postav Jednoštrbinu pred 360° Bodový zdroj na vytvorenie čistého svetelného vejára, alebo Dvojštrbinu na rozdelenie širokého lúča na dva.',
      },
      'beam-blocker': {
        title: 'Tlmič lúča (Optický pohlcovač)',
        category: 'NEPRIEHĽADNÁ OPTICKÁ CLONA',
        summary:
          'Matný čierny pohlcovač so 100 % absorpciou, ktorý úplne zastaví všetky dopadajúce svetelné lúče a bráni nežiaducim odrazom.',
        formula: 'T = 0   ·   R = 0   ·   A = 100 %',
        physics:
          'Funguje ako ideálna nepriehľadná prekážka alebo optický tlmič – pohltí všetok dopadajúci výkon bez ohľadu na vlnovú dĺžku či polarizáciu.',
        controls: [
          ['Výška clony', 'Nastav dĺžku blokovacej prekážky (24–360 px).'],
          ['Otočenie', 'Otoč clonu pod ľubovoľným uhlom pre zachytenie rozptýlených lúčov.'],
        ],
        tip: 'Použi Tlmič lúča pred Bodovým zdrojom na ukážku vrhaného tieňa (umbry) alebo na zastavenie nepoužitej vetvy z Deliča lúča.',
      },
      'optical-detector': {
        title: 'Optický detektor (Fotodióda)',
        category: 'ŽIVÝ SENZOR INTENZITY A TOKU',
        summary:
          'Optický senzor pracujúci v reálnom čase, ktorý pohlcuje dopadajúce lúče a meria ich počet, celkový optický tok, maximálnu intenzitu, priemernú vlnovú dĺžku aj energiu fotónov.',
        formula: 'Φ = Σ I_k   ·   E_fotónu = 1239,84 / λ (eV)',
        physics:
          'Každý lúč dopadajúci na aktívnu prednú plochu senzora sa započíta počas sledovania lúčov, čo umožňuje kvantitatívne overovať šošovky, deliče, farebné filtre aj Malusov zákon.',
        controls: [
          ['Aktívna šírka senzora', 'Rozšír alebo zúž fotocitlivé okno (20–260 px).'],
          ['Živá telemetria', 'Klikni na detektor a sleduj v pravom paneli živý tok v %, počet lúčov, dominantnú farbu a eV.'],
        ],
        tip: 'Umiestni Optický detektor za dvojicu Lineárnych polarizátorov, otáčaj druhým polarizátorom a meraj Malusov zákon naživo!',
      },
    },
  };

  COMPONENT_INFO_I18N.en['color-filter'] = COMPONENT_INFO_I18N.en['optical-filter'];
  COMPONENT_INFO_I18N.sk['color-filter'] = COMPONENT_INFO_I18N.sk['optical-filter'];

  let _lang = 'en';

  function getLang() {
    return _lang;
  }

  function setLang(lang) {
    _lang = lang === 'sk' ? 'sk' : 'en';
    return _lang;
  }

  function t(key, vars = null) {
    const dict = MESSAGES[_lang] || MESSAGES.en;
    let str = dict[key] !== undefined ? dict[key] : MESSAGES.en[key] !== undefined ? MESSAGES.en[key] : key;
    if (vars && typeof vars === 'object') {
      for (const [k, v] of Object.entries(vars)) {
        str = str.replace(new RegExp('\\{' + k + '\\}', 'g'), String(v));
      }
    }
    return str;
  }

  function phrase(enText) {
    if (_lang !== 'sk') return enText;
    const trimmed = String(enText).trim();
    if (SK_PHRASES[trimmed] !== undefined) {
      return String(enText).replace(trimmed, SK_PHRASES[trimmed]);
    }
    return enText;
  }

  function getComponentInfo(type) {
    const map = COMPONENT_INFO_I18N[_lang] || COMPONENT_INFO_I18N.en;
    return map[type] || COMPONENT_INFO_I18N.en[type] || null;
  }

  // Translates text nodes inside a DOM subtree losslessly (caches original EN text on text nodes)
  function translateSubtree(rootEl) {
    if (!rootEl || typeof document === 'undefined' || typeof NodeFilter === 'undefined') return;

    const walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT, null);
    let node;
    while ((node = walker.nextNode())) {
      const parentTag = node.parentElement ? node.parentElement.tagName : '';
      if (parentTag === 'SCRIPT' || parentTag === 'STYLE') continue;
      const orig = node.__i18nEn !== undefined ? node.__i18nEn : node.nodeValue;
      const trimmed = orig.trim();
      if (!trimmed) continue;

      if (SK_PHRASES[trimmed] !== undefined) {
        if (node.__i18nEn === undefined) node.__i18nEn = orig;
        node.nodeValue = _lang === 'sk' ? orig.replace(trimmed, SK_PHRASES[trimmed]) : node.__i18nEn;
      }
    }

    // Also translate <option> labels & common placeholders/titles inside rootEl
    rootEl.querySelectorAll('option').forEach((opt) => {
      const orig = opt.dataset.i18nEn !== undefined ? opt.dataset.i18nEn : opt.textContent;
      const trimmed = orig.trim();
      if (SK_PHRASES[trimmed] !== undefined) {
        if (opt.dataset.i18nEn === undefined) opt.dataset.i18nEn = orig;
        opt.textContent = _lang === 'sk' ? SK_PHRASES[trimmed] : opt.dataset.i18nEn;
      }
    });
  }

  // Translates static DOM elements across the entire document (toolbar, sidebar, statusbar, modals)
  function applyStaticDOM() {
    if (typeof document === 'undefined') return;
    document.documentElement.setAttribute('lang', _lang);
    document.title = t('pageTitle');

    const root = document.getElementById('app') || document.body;
    if (root) translateSubtree(root);

    // Search input placeholder in Projects Modal
    const projSearch = document.getElementById('project-search-input');
    if (projSearch) projSearch.placeholder = t('searchProjectsPlaceholder');

    // Dropzone rich text (contains <code>.optp</code>)
    const dzStrong = document.querySelector('.optp-dropzone-text strong');
    const dzSpan = document.querySelector('.optp-dropzone-text span');
    if (dzStrong) {
      dzStrong.innerHTML =
        _lang === 'sk'
          ? 'Máš externý súbor experimentu <code>.optp</code>?'
          : 'Have an external <code>.optp</code> experiment file?';
    }
    if (dzSpan) {
      dzSpan.innerHTML =
        _lang === 'sk'
          ? 'Pretiahni sem súbor <code>.optp</code> alebo klikni pre import do prehliadača.'
          : 'Drag &amp; drop a <code>.optp</code> file here or click to import into your browser vault.';
    }

    // Modal footer IndexedDB hint (contains <code>LasSimDB</code>)
    const modalHintSpan = document.querySelector('#modal-projects .modal-footer-hint span:last-child');
    if (modalHintSpan) {
      modalHintSpan.innerHTML =
        _lang === 'sk'
          ? 'Projekty sa pravidelne automaticky ukladajú do lokálnej IndexedDB (<code>LasSimDB</code>)'
          : 'Projects auto-save periodically to local IndexedDB (<code>LasSimDB</code>)';
    }

    // Update sidebar i-button tooltips
    document.querySelectorAll('.component-card').forEach((card) => {
      const btn = card.querySelector('.cc-info-btn');
      const titleEl = card.querySelector('.cc-title');
      if (btn && titleEl) {
        btn.title = t('infoBtnTitle', { name: titleEl.textContent.trim() });
      }
    });

    // Update language switcher button active state
    document.querySelectorAll('.lang-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.lang === _lang);
    });
  }

  global.LasSim = global.LasSim || {};
  global.LasSim.I18N = {
    getLang,
    setLang,
    t,
    phrase,
    getComponentInfo,
    translateSubtree,
    applyStaticDOM,
    SK_PHRASES,
    COMPONENT_INFO_I18N,
  };
})(typeof window !== 'undefined' ? window : globalThis);
