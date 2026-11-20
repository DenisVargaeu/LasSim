'use strict';

const fs = require('fs');
const path = require('path');
const { app, BrowserWindow, Menu, dialog, ipcMain, shell } = require('electron');

let mainWindow = null;
let pendingOptpPath = null;

// Locate web root: parent folder in dev, resources/web when packaged via electron-builder
function getWebRoot() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'web');
  }
  return path.resolve(__dirname, '..');
}

function getIconPath() {
  const pngPath = path.join(__dirname, 'icon.png');
  return fs.existsSync(pngPath) ? pngPath : undefined;
}

function findOptpArg(argv) {
  for (const arg of argv || []) {
    if (typeof arg === 'string' && arg.toLowerCase().endsWith('.optp') && fs.existsSync(arg)) {
      return arg;
    }
  }
  return null;
}

function sendOptpFileToRenderer(filePath) {
  if (!filePath || !mainWindow || mainWindow.isDestroyed()) return;
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    mainWindow.webContents.send('lassim:open-optp-content', {
      filePath,
      fileName: path.basename(filePath),
      content,
    });
  } catch (err) {
    dialog.showErrorBox('Failed to Open .optp File', err.message || String(err));
  }
}

function sendMenuAction(action, payload = null) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send('lassim:menu-action', { action, payload });
}

async function openOptpWithDialog() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Open LasSim Project (.optp)',
    properties: ['openFile'],
    filters: [
      { name: 'LasSim Project', extensions: ['optp'] },
      { name: 'JSON Files', extensions: ['json'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });
  if (!result.canceled && result.filePaths && result.filePaths[0]) {
    sendOptpFileToRenderer(result.filePaths[0]);
  }
}

function buildAppMenu() {
  const isMac = process.platform === 'darwin';

  const presetItems = [
    { label: 'Converging Lens + Detector', preset: 'converging' },
    { label: 'Diverging Beam', preset: 'diverging' },
    { label: 'Keplerian Telescope / Expander', preset: 'keplerian' },
    { label: 'Galilean Beam Expander', preset: 'galilean' },
    { label: 'Beam Splitter & Mirrors', preset: 'interferometer' },
    { label: 'Prism Chromatic Dispersion', preset: 'prism-dispersion' },
    { label: 'Diffraction Grating Spectrum', preset: 'diffraction-grating' },
    { label: "Malus's Law (3 Polarizers)", preset: 'polarizer-malus' },
    { label: 'Ball Lens Dispersion & Caustics', preset: 'ball-lens' },
    { label: 'Point Source & Double Slit', preset: 'pinhole-slit' },
  ].map((item) => ({
    label: item.label,
    click: () => sendMenuAction('load-preset', item.preset),
  }));

  const template = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' },
              { type: 'separator' },
              { role: 'hide' },
              { role: 'hideOthers' },
              { role: 'unhide' },
              { type: 'separator' },
              { role: 'quit' },
            ],
          },
        ]
      : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'New Project',
          accelerator: 'CmdOrCtrl+N',
          click: () => sendMenuAction('new-project'),
        },
        {
          label: 'Open .optp File…',
          accelerator: 'CmdOrCtrl+O',
          click: () => openOptpWithDialog(),
        },
        {
          label: 'Projects Manager',
          click: () => sendMenuAction('open-projects'),
        },
        { type: 'separator' },
        {
          label: 'Save Project',
          accelerator: 'CmdOrCtrl+S',
          click: () => sendMenuAction('save-project'),
        },
        {
          label: 'Export .optp File…',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => sendMenuAction('export-optp'),
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { label: 'Undo', accelerator: 'CmdOrCtrl+Z', click: () => sendMenuAction('undo') },
        { label: 'Redo', accelerator: 'CmdOrCtrl+Y', click: () => sendMenuAction('redo') },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'Presets',
      submenu: presetItems,
    },
    {
      label: 'View',
      submenu: [
        { label: 'Toggle Dark / Light Theme', click: () => sendMenuAction('toggle-theme') },
        {
          label: 'Language',
          submenu: [
            { label: 'English (EN)', click: () => sendMenuAction('set-lang', 'en') },
            { label: 'Slovenčina (SK)', click: () => sendMenuAction('set-lang', 'sk') },
          ],
        },
        { type: 'separator' },
        { label: 'Open Simulator Bench', click: () => loadPage('app.html') },
        { label: 'Open Welcome / Overview Page', click: () => loadPage('index.html') },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Keyboard Shortcuts',
          accelerator: 'Shift+/',
          click: () => sendMenuAction('open-shortcuts'),
        },
        { type: 'separator' },
        {
          label: `About LasSim (v${app.getVersion()})`,
          click: () => sendMenuAction('open-version'),
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function loadPage(fileName) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const targetPath = path.join(getWebRoot(), fileName);
  mainWindow.loadFile(targetPath);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1380,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#191816',
    title: 'LasSim — 2D Optical Simulation Playground',
    icon: getIconPath(),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (process.env.LASSIM_DEV === '1') {
      mainWindow.webContents.openDevTools({ mode: 'detach' });
    }
  });

  mainWindow.webContents.on('did-finish-load', () => {
    if (pendingOptpPath) {
      const toOpen = pendingOptpPath;
      pendingOptpPath = null;
      sendOptpFileToRenderer(toOpen);
    }
  });

  // Open external links in the user's default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Start directly in the interactive simulator bench
  loadPage('app.html');
}

// Native Save dialog IPC for exporting .optp directly to disk
ipcMain.handle('lassim:save-optp', async (_event, { defaultFileName, content }) => {
  if (!mainWindow || mainWindow.isDestroyed()) return { canceled: true };
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Export LasSim Project (.optp)',
    defaultPath: defaultFileName || 'optical-experiment.optp',
    filters: [
      { name: 'LasSim Project', extensions: ['optp'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });
  if (result.canceled || !result.filePath) {
    return { canceled: true };
  }
  fs.writeFileSync(result.filePath, String(content || ''), 'utf8');
  return { canceled: false, filePath: result.filePath, fileName: path.basename(result.filePath) };
});

ipcMain.handle('lassim:open-optp-dialog', async () => {
  await openOptpWithDialog();
  return { ok: true };
});

// Single-instance lock so double-clicking .optp files reuses the existing window
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    const filePath = findOptpArg(argv);
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
      if (filePath) sendOptpFileToRenderer(filePath);
    }
  });

  app.on('open-file', (event, filePath) => {
    event.preventDefault();
    if (mainWindow && !mainWindow.isDestroyed()) {
      sendOptpFileToRenderer(filePath);
    } else {
      pendingOptpPath = filePath;
    }
  });

  pendingOptpPath = findOptpArg(process.argv);

  app.whenReady().then(() => {
    buildAppMenu();
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}
