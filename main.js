const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');

const USER_DATA = () => app.getPath('userData');
const SESSION_FILE = () => path.join(USER_DATA(), 'session.json');
const SETTINGS_FILE = () => path.join(USER_DATA(), 'settings.json');

let mainWindow;

function readJSON(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    const raw = fs.readFileSync(file, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed reading', file, err);
    return fallback;
  }
}

function writeJSON(file, data) {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('Failed writing', file, err);
    return false;
  }
}

function sanitizeFilename(name) {
  return (name || 'Untitled').replace(/[\\/:*?"<>|]/g, '-').trim() || 'Untitled';
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 860,
    minHeight: 560,
    title: 'H-Notepad',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    backgroundColor: '#171a1f',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: true,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  const menu = Menu.buildFromTemplate([
    {
      label: 'File',
      submenu: [
        { label: 'New Tab', accelerator: 'CmdOrCtrl+T', click: () => mainWindow.webContents.send('menu:new-tab') },
        { label: 'Save Tab (.txt + .hnote)', accelerator: 'CmdOrCtrl+S', click: () => mainWindow.webContents.send('menu:save-tab') },
        { label: 'Open .hnote…', accelerator: 'CmdOrCtrl+O', click: () => mainWindow.webContents.send('menu:open-hnote') },
        { type: 'separator' },
        { label: 'Change Save Folders…', click: () => mainWindow.webContents.send('menu:change-folders') },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' }, { role: 'redo' }, { type: 'separator' },
        { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' }, { role: 'toggleDevTools' }, { type: 'separator' },
        { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
  ]);
  Menu.setApplicationMenu(menu);

  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(() => {
  const { session } = require('electron');
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    const allowed = ['clipboard-read', 'clipboard-sanitized-write', 'clipboard-write'];
    callback(allowed.includes(permission));
  });
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// ---------- IPC: session persistence (auto-restore tabs like Notepad) ----------
ipcMain.handle('session:get', () => readJSON(SESSION_FILE(), null));
ipcMain.handle('session:save', (_evt, data) => writeJSON(SESSION_FILE(), data));

// ---------- IPC: settings (remembered save folders) ----------
ipcMain.handle('settings:get', () => readJSON(SETTINGS_FILE(), {}));

ipcMain.handle('folder:choose', async (_evt, kind) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: kind === 'hnote' ? 'Choose folder for .hnote files' : 'Choose folder for .txt files',
    properties: ['openDirectory', 'createDirectory'],
  });
  if (result.canceled || !result.filePaths[0]) return null;
  const settings = readJSON(SETTINGS_FILE(), {});
  if (kind === 'hnote') settings.hnoteFolder = result.filePaths[0];
  else settings.txtFolder = result.filePaths[0];
  writeJSON(SETTINGS_FILE(), settings);
  return result.filePaths[0];
});

// ---------- IPC: export a tab to plain .txt + rich .hnote sidecar ----------
ipcMain.handle('export:tab', async (_evt, tab) => {
  const settings = readJSON(SETTINGS_FILE(), {});
  let { txtFolder, hnoteFolder } = settings;

  if (!txtFolder) {
    const res = await dialog.showOpenDialog(mainWindow, {
      title: 'Choose folder for .txt files',
      properties: ['openDirectory', 'createDirectory'],
    });
    if (res.canceled || !res.filePaths[0]) return { ok: false, reason: 'cancelled' };
    txtFolder = res.filePaths[0];
    settings.txtFolder = txtFolder;
    writeJSON(SETTINGS_FILE(), settings);
  }
  if (!hnoteFolder) {
    const res = await dialog.showOpenDialog(mainWindow, {
      title: 'Choose folder for .hnote files',
      properties: ['openDirectory', 'createDirectory'],
    });
    if (res.canceled || !res.filePaths[0]) return { ok: false, reason: 'cancelled' };
    hnoteFolder = res.filePaths[0];
    settings.hnoteFolder = hnoteFolder;
    writeJSON(SETTINGS_FILE(), settings);
  }

  const filename = sanitizeFilename(tab.title);
  const txtPath = path.join(txtFolder, `${filename}.txt`);
  const hnotePath = path.join(hnoteFolder, `${filename}.hnote`);

  // Plain .txt: structured with plain-text section markers, so it stays readable
  // anywhere AND can be re-sectioned if reopened via "Import .txt".
  const plainParts = tab.sections.map((s, i) => {
    const header = `===== SECTION: ${s.title || 'Untitled ' + (i + 1)} =====`;
    return `${header}\n${s.text || ''}`;
  });
  const plainContent = plainParts.join('\n\n');

  // .hnote: full-fidelity JSON (titles + rich HTML per section) for H-Notepad itself.
  const hnoteContent = {
    format: 'h-notepad',
    version: 1,
    title: tab.title,
    linkedTxt: path.basename(txtPath),
    sections: tab.sections.map((s) => ({ title: s.title, html: s.html })),
  };

  const okTxt = writeJSONText(txtPath, plainContent);
  const okHnote = writeJSON(hnotePath, hnoteContent);

  return { ok: okTxt && okHnote, txtPath, hnotePath };
});

function writeJSONText(file, text) {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text, 'utf-8');
    return true;
  } catch (err) {
    console.error('Failed writing text file', file, err);
    return false;
  }
}

// ---------- IPC: open a .hnote file back into a tab ----------
ipcMain.handle('hnote:open', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Open H-Notepad file',
    properties: ['openFile'],
    filters: [{ name: 'H-Notepad files', extensions: ['hnote'] }],
  });
  if (result.canceled || !result.filePaths[0]) return null;
  const data = readJSON(result.filePaths[0], null);
  if (!data || data.format !== 'h-notepad') {
    dialog.showErrorBox('Not a valid H-Notepad file', 'This file was not recognized as an H-Notepad (.hnote) file.');
    return null;
  }
  return data;
});

// ---------- IPC: import a plain .txt (re-sectioned by its ===== SECTION ===== markers) ----------
ipcMain.handle('txt:open', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Open text file',
    properties: ['openFile'],
    filters: [{ name: 'Text files', extensions: ['txt'] }],
  });
  if (result.canceled || !result.filePaths[0]) return null;
  const raw = fs.readFileSync(result.filePaths[0], 'utf-8');
  const title = path.basename(result.filePaths[0], '.txt');
  const chunks = raw.split(/^={5} SECTION: (.*?) ={5}$/m);
  const sections = [];
  if (chunks.length > 1) {
    for (let i = 1; i < chunks.length; i += 2) {
      sections.push({ title: chunks[i].trim(), text: (chunks[i + 1] || '').trim() });
    }
  } else {
    sections.push({ title: 'Untitled 1', text: raw.trim() });
  }
  return { title, sections };
});
