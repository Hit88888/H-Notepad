# H-Notepad

A tabbed notepad that preserves colored/rich-text formatting on paste, keeps
each tab's tabs+sections open across restarts (like native Notepad), and
saves in a dual-file format: a portable plain `.txt` and a full-fidelity
`.hnote` sidecar.

#Link - https://github.com/Hit88888/H-Notepad/releases/download/v1.1.2/H-Notepad.Setup.1.1.2.exe

#Link - https://github.com/Hit88888/H-Notepad/releases/download/v1.0.8/H-Notepad.Setup.1.0.8.exe

#Link - https://github.com/Hit88888/H-Notepad/releases/download/v1.0.1/H-Notepad.Setup.1.0.1.exe


#Link - https://github.com/Hit88888/H-Notepad/releases/download/v1.0.0/H-Notepad.Setup.1.0.0.exe

## What's inside

```
h-notepad/
├── package.json
├── main.js          ← Electron main process (window, menus, file I/O)
├── preload.js        ← safe bridge between main process and the UI
├── renderer/
│   ├── index.html
│   ├── style.css
│   └── app.js         ← all UI logic: tabs, sections, paste, numbering, copy
└── assets/
    ├── icon.svg        ← placeholder icon source
    └── icon.png         ← rendered placeholder (swap for your own art)
```

## Quickest path (no typing commands)

Two double-click files are included in this folder:

- **START-APP.bat** — installs what's needed (first run only) and opens the app. Use this to try it out.
- **BUILD-INSTALLER.bat** — builds the final `.exe` installer you can share with anyone. Use this once you're happy with the app.

See the numbered steps below if you'd rather understand what each one does.

## Light / dark mode

The app now opens in **light mode by default** — this matters because most
pasted content (emails, Word docs) assumes a white page behind it, so its
colors and highlights display correctly. Click **☾ Dark** in the top bar
to switch to a dark theme if you prefer it for plain typing; just know
that colored pastes may look off against a dark background, since the
color was designed for white. Your choice is remembered across restarts.

## Desktop and taskbar icon

The installer (built via `BUILD-INSTALLER.bat`) automatically creates:
- A **desktop shortcut** — the H-Notepad icon appears on your desktop
  right after install.
- A **Start Menu entry** — searchable by typing "H-Notepad".

To also get it on your **taskbar**: open the app once (from the desktop
icon or Start Menu), then right-click its icon in the taskbar while it's
running and choose **"Pin to taskbar."** Windows doesn't allow installers
to do this step automatically — it always has to be a user action.

## Running it locally (development)

You'll need [Node.js](https://nodejs.org) (LTS) installed.

```bash
cd h-notepad
npm install
npm start
```

This opens the app in a normal window with the native Windows title bar,
as you asked for.

## How the save format works

- **Save** writes two files per tab:
  - `YourTabName.txt` → plain text, human-readable anywhere, with
    `===== SECTION: Title =====` markers between sections so structure
    survives even in Notepad/VS Code.
  - `YourTabName.hnote` → JSON containing each section's full HTML
    (colors, bold, fonts, everything from your paste), used only by
    H-Notepad itself.
- The **first time** you hit Save, it asks you to pick a folder for `.txt`
  files and a folder for `.hnote` files — after that it reuses both
  silently. You can change them any time via **⚙ Folders** in the top bar
  or **File → Change Save Folders…**.
- **Open .hnote** brings back a tab exactly as it looked, colors included.
- **Import .txt** re-sections a plain `.txt` (including ones from Notepad
  or elsewhere) by splitting on blank-line/section boundaries — no colors,
  since plain text can't carry them, but structure is preserved.

## Session restore (like Notepad's "remember my tabs")

Every change — new tab, new section, typing, renaming — is auto-saved
(debounced ~400ms) to a local session file in Electron's per-user app-data
folder. On next launch, all open tabs and sections come back exactly as
you left them, independent of any manual Save you did.

## Numbering behaviour

"Add Numbers" inserts real `1. `, `2. `, `3. ` text at the start of each
line — not a cosmetic gutter — so it survives copy/paste into WhatsApp,
Gmail, anywhere. "Renumber" strips existing numbers and reapplies them in
order, useful after you delete or reorder lines.

## Copy button

Copies both the rich HTML (so pasting into Gmail/Word keeps colors) and
the plain text (so pasting into WhatsApp/Notepad gives clean numbered
text) in a single clipboard write — the receiving app picks whichever
format it understands.

---

## Packaging it as a downloadable desktop app

This uses [electron-builder](https://www.electron.build/), which is
already wired into `package.json`.

### 1. Make a real icon

Right now `assets/icon.png` is a plain placeholder. Before building an
installer, generate the proper icon formats:

- **Windows** needs `assets/icon.ico` (multi-resolution: 16/32/48/256px)
- **macOS** needs `assets/icon.icns`
- **Linux** just uses `assets/icon.png`

Easiest path: design or generate a 1024×1024 PNG, then convert it at
[icoconvert.com](https://icoconvert.com) or with the `electron-icon-builder`
CLI:

```bash
npx electron-icon-builder --input=./assets/icon.png --output=./assets --flatten
```

That produces `icon.ico` and `icon.icns` automatically from one PNG.

### 2. Build the Windows installer

On a Windows machine (or Linux/macOS with Wine installed for cross-build):

```bash
npm install
npm run dist:win
```

This produces a `.exe` installer in `dist/` — e.g.
`H-Notepad Setup 1.0.0.exe`. Anyone can double-click it to install
H-Notepad like a normal Windows app, with a Start Menu entry and desktop
shortcut (already configured in `package.json`'s `nsis` block).

### 3. (Optional) Build for macOS or Linux too

```bash
npm run dist        # builds for your current OS
```

Cross-building macOS `.dmg` files requires running the build **on a Mac**
(Apple's tooling isn't licensed for cross-compilation from other OSes).

### 4. Distributing it

The finished installer in `dist/` is a standalone file — email it, put it
on Google Drive, host it anywhere. No code signing is required for it to
run, though unsigned installers will show a Windows SmartScreen warning
the first time (clicking "More info → Run anyway" bypasses it). Code
signing removes that warning but requires a paid certificate.

---

## Known limitations / things worth knowing

- **Rich paste fidelity** depends on what the source app puts on the
  clipboard. Gmail, Outlook, and Word all provide real HTML with inline
  colors, so those paste perfectly. Some apps only offer plain text, in
  which case there's nothing to preserve — H-Notepad falls back to
  plain text automatically.
- **"Add Numbers"** numbers each *line* (paragraph/`<div>`) inside a
  section. If a paste doesn't create separate lines (e.g. it's one giant
  block of text with manual line breaks inside a single paragraph), it
  falls back to numbering the whole block as line 1 — click into the text
  and press Enter to split it into real lines first, then number it.
- Nothing here uploads anywhere — all files are local to your machine.
