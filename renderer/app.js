(() => {
  'use strict';

  // ---------------- State ----------------
  let state = { tabs: [], activeTabId: null, theme: 'light' };
  let saveTimer = null;

  const tabListEl = document.getElementById('tab-list');
  const sectionListEl = document.getElementById('section-list');
  const statusEl = document.getElementById('statusbar');

  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

  function status(msg, kind) {
    statusEl.textContent = msg;
    statusEl.className = 'statusbar' + (kind ? ' ' + kind : '');
    clearTimeout(status._t);
    status._t = setTimeout(() => {
      statusEl.textContent = 'Ready';
      statusEl.className = 'statusbar';
    }, 3500);
  }

  function makeSection(title, html) {
    return { id: uid(), title: title || 'Section', html: html || '' };
  }

  function makeTab(title) {
    return { id: uid(), title: title || 'Tab', sections: [makeSection('Section 1', '')] };
  }

  function activeTab() {
    return state.tabs.find((t) => t.id === state.activeTabId) || null;
  }

  // ---------------- Persistence ----------------
  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      window.hnote.saveSession(state).catch(() => {});
    }, 400);
  }

  async function loadInitialState() {
    const saved = await window.hnote.getSession();
    if (saved && Array.isArray(saved.tabs) && saved.tabs.length) {
      state = saved;
      if (!state.theme) state.theme = 'light';
      if (!state.tabs.some((t) => t.id === state.activeTabId)) {
        state.activeTabId = state.tabs[0].id;
      }
    } else {
      const t = makeTab('Tab-1');
      state = { tabs: [t], activeTabId: t.id, theme: 'light' };
    }
    applyTheme();
    renderAll();
  }

  function applyTheme() {
    document.documentElement.setAttribute('data-theme', state.theme === 'dark' ? 'dark' : 'light');
    const btn = document.getElementById('btn-theme');
    if (btn) btn.textContent = state.theme === 'dark' ? '☀ Light' : '☾ Dark';
  }

  function toggleTheme() {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    applyTheme();
    scheduleSave();
  }

  // ---------------- Rendering ----------------
  function renderAll() {
    renderTabs();
    renderSections();
  }

  function renderTabs() {
    tabListEl.innerHTML = '';
    state.tabs.forEach((tab) => {
      const item = document.createElement('div');
      item.className = 'tab-item' + (tab.id === state.activeTabId ? ' active' : '');
      item.dataset.tabId = tab.id;

      const title = document.createElement('span');
      title.className = 'tab-title';
      title.textContent = tab.title;
      title.title = 'Double-click to rename';
      title.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        title.contentEditable = 'true';
        title.focus();
        document.execCommand('selectAll', false, null);
      });
      title.addEventListener('blur', () => {
        title.contentEditable = 'false';
        const val = title.textContent.trim() || 'Untitled';
        tab.title = val;
        title.textContent = val;
        scheduleSave();
      });
      title.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); title.blur(); }
      });

      const close = document.createElement('span');
      close.className = 'tab-close';
      close.textContent = '✕';
      close.title = 'Close tab';
      close.addEventListener('click', (e) => {
        e.stopPropagation();
        closeTab(tab.id);
      });

      item.appendChild(title);
      item.appendChild(close);
      item.addEventListener('click', () => {
        if (state.activeTabId !== tab.id) {
          state.activeTabId = tab.id;
          renderAll();
          scheduleSave();
        }
      });

      tabListEl.appendChild(item);
    });
  }

  function renderSections() {
    sectionListEl.innerHTML = '';
    const tab = activeTab();
    if (!tab) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.textContent = 'No tab open — click "+ Tab" to start.';
      sectionListEl.appendChild(empty);
      return;
    }
    tab.sections.forEach((section) => {
      sectionListEl.appendChild(buildSectionCard(tab, section));
    });
  }

  function buildSectionCard(tab, section) {
    const card = document.createElement('div');
    card.className = 'section-card';
    card.dataset.sectionId = section.id;

    // --- toolbar ---
    const toolbar = document.createElement('div');
    toolbar.className = 'section-toolbar';

    const titleInput = document.createElement('input');
    titleInput.className = 'section-title';
    titleInput.value = section.title;
    titleInput.addEventListener('input', () => {
      section.title = titleInput.value;
      scheduleSave();
    });

    const btnUp = mkBtn('↑ Add Up', () => insertSection(tab, section, 'above'));
    const btnDown = mkBtn('↓ Add Below', () => insertSection(tab, section, 'below'));
    const btnNumbers = mkBtn('# Numbers', () => addNumbers(body));
    const btnRenumber = mkBtn('↻ Renumber', () => renumber(body));
    const btnCopy = mkBtn('⧉ Copy', () => copySection(body, btnCopy));
    const btnDelete = mkBtn('✕', () => deleteSection(tab, section), 'btn-icon btn-danger');

    toolbar.append(titleInput, btnUp, btnDown, btnNumbers, btnRenumber, btnCopy, btnDelete);

    // --- body ---
    const body = document.createElement('div');
    body.className = 'section-body';
    body.contentEditable = 'true';
    body.setAttribute('data-placeholder', 'Type or paste here — colors and formatting are preserved…');
    body.innerHTML = section.html || '';
    body.addEventListener('input', () => {
      section.html = body.innerHTML;
      scheduleSave();
    });
    body.addEventListener('paste', (e) => handlePaste(e, body));

    card.appendChild(toolbar);
    card.appendChild(body);
    return card;
  }

  function mkBtn(label, onClick, extraClass) {
    const b = document.createElement('button');
    b.className = 'btn' + (extraClass ? ' ' + extraClass : '');
    b.textContent = label;
    b.addEventListener('click', onClick);
    return b;
  }

  // ---------------- Tab operations ----------------
  function createTab() {
    const n = state.tabs.length + 1;
    const t = makeTab(`Tab-${n}`);
    state.tabs.push(t);
    state.activeTabId = t.id;
    renderAll();
    scheduleSave();
  }

  function closeTab(tabId) {
    const idx = state.tabs.findIndex((t) => t.id === tabId);
    if (idx === -1) return;
    state.tabs.splice(idx, 1);
    if (state.activeTabId === tabId) {
      const fallback = state.tabs[idx] || state.tabs[idx - 1] || state.tabs[0];
      state.activeTabId = fallback ? fallback.id : null;
    }
    renderAll();
    scheduleSave();
  }

  // ---------------- Section operations ----------------
  function insertSection(tab, refSection, position) {
    const idx = tab.sections.findIndex((s) => s.id === refSection.id);
    const newSec = makeSection(`Section ${tab.sections.length + 1}`, '');
    const at = position === 'above' ? idx : idx + 1;
    tab.sections.splice(at, 0, newSec);
    renderSections();
    scheduleSave();
  }

  function deleteSection(tab, section) {
    if (tab.sections.length === 1) {
      status('A tab needs at least one section.', 'error');
      return;
    }
    tab.sections = tab.sections.filter((s) => s.id !== section.id);
    renderSections();
    scheduleSave();
  }

  // ---------------- Numbering (real inserted text, fully selectable/copyable) ----------------
  function getLineBlocks(body) {
    const blocks = Array.from(body.children).filter((el) =>
      ['DIV', 'P', 'LI'].includes(el.tagName)
    );
    return blocks.length ? blocks : null;
  }

  function stripLeadingNumber(el) {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
    const first = walker.nextNode();
    if (first) first.textContent = first.textContent.replace(/^\s*\d+\.\s+/, '');
  }

  function prefixNumber(el, n) {
    const marker = document.createTextNode(`${n}. `);
    if (el.firstChild) el.insertBefore(marker, el.firstChild);
    else el.appendChild(marker);
  }

  function addNumbers(body) {
    let blocks = getLineBlocks(body);
    if (!blocks) {
      // No block-level lines yet (e.g. plain single-line paste) — split by <br> or treat as one line.
      const html = body.innerHTML;
      const parts = html.split(/<br\s*\/?>/i);
      body.innerHTML = parts
        .map((part, i) => `<div>${i + 1}. ${part}</div>`)
        .join('');
    } else {
      blocks.forEach((el, i) => {
        stripLeadingNumber(el);
        prefixNumber(el, i + 1);
      });
    }
    const tab = activeTab();
    const section = tab.sections.find((s) => s.id === body.closest('.section-card').dataset.sectionId);
    if (section) section.html = body.innerHTML;
    scheduleSave();
  }

  function renumber(body) {
    const blocks = getLineBlocks(body);
    if (!blocks) return;
    blocks.forEach((el, i) => {
      stripLeadingNumber(el);
      prefixNumber(el, i + 1);
    });
    const tab = activeTab();
    const section = tab.sections.find((s) => s.id === body.closest('.section-card').dataset.sectionId);
    if (section) section.html = body.innerHTML;
    scheduleSave();
  }

  // ---------------- Copy (keeps color for rich targets, keeps numbers for plain targets) ----------------
  async function copySection(body, btn) {
    const html = body.innerHTML;
    const text = body.innerText;
    try {
      if (window.ClipboardItem) {
        const item = new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([text], { type: 'text/plain' }),
        });
        await navigator.clipboard.write([item]);
      } else {
        await navigator.clipboard.writeText(text);
      }
      const original = btn.textContent;
      btn.textContent = '✓ Copied';
      setTimeout(() => { btn.textContent = original; }, 1200);
    } catch (err) {
      status('Copy failed: ' + err.message, 'error');
    }
  }

  // ---------------- Paste sanitation (keeps color/font/bold, strips scripts) ----------------
  function sanitizeHTML(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    doc.querySelectorAll('script, style, meta, link, title, iframe, object, embed').forEach((n) => n.remove());
    const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_ELEMENT, null);
    const toStrip = [];
    let node = walker.currentNode;
    while (node) {
      if (node.attributes) {
        [...node.attributes].forEach((attr) => {
          const name = attr.name.toLowerCase();
          if (name.startsWith('on')) toStrip.push([node, attr.name]);
          if ((name === 'href' || name === 'src') && /^javascript:/i.test(attr.value)) toStrip.push([node, attr.name]);
        });
      }
      node = walker.nextNode();
    }
    toStrip.forEach(([el, attr]) => el.removeAttribute(attr));
    return doc.body.innerHTML;
  }

  function handlePaste(e, body) {
    e.preventDefault();
    const html = e.clipboardData.getData('text/html');
    const plain = e.clipboardData.getData('text/plain');
    if (html) {
      const clean = sanitizeHTML(html);
      document.execCommand('insertHTML', false, clean);
    } else if (plain) {
      document.execCommand('insertText', false, plain);
    }
    const tab = activeTab();
    const section = tab.sections.find((s) => s.id === body.closest('.section-card').dataset.sectionId);
    if (section) section.html = body.innerHTML;
    scheduleSave();
  }

  // ---------------- Export / Import ----------------
  async function exportActiveTab() {
    const tab = activeTab();
    if (!tab) return;
    const payload = {
      title: tab.title,
      sections: tab.sections.map((s) => {
        const tmp = document.createElement('div');
        tmp.innerHTML = s.html;
        return { title: s.title, html: s.html, text: tmp.innerText };
      }),
    };
    status('Saving…');
    const res = await window.hnote.exportTab(payload);
    if (res && res.ok) {
      status(`Saved → ${res.txtPath}  +  ${res.hnotePath}`, 'flash');
    } else if (res && res.reason === 'cancelled') {
      status('Save cancelled.', 'error');
    } else {
      status('Save failed. Check folder permissions.', 'error');
    }
  }

  async function importHnote() {
    const data = await window.hnote.openHnote();
    if (!data) return;
    const tab = {
      id: uid(),
      title: data.title || 'Imported',
      sections: (data.sections || []).map((s) => makeSection(s.title, s.html)),
    };
    if (!tab.sections.length) tab.sections.push(makeSection('Section 1', ''));
    state.tabs.push(tab);
    state.activeTabId = tab.id;
    renderAll();
    scheduleSave();
    status(`Opened ${tab.title}.hnote`, 'flash');
  }

  async function importTxt() {
    const data = await window.hnote.openTxt();
    if (!data) return;
    const tab = {
      id: uid(),
      title: data.title || 'Imported',
      sections: (data.sections || []).map((s) =>
        makeSection(s.title, escapeHtml(s.text).replace(/\n/g, '<br>'))
      ),
    };
    if (!tab.sections.length) tab.sections.push(makeSection('Section 1', ''));
    state.tabs.push(tab);
    state.activeTabId = tab.id;
    renderAll();
    scheduleSave();
    status(`Imported ${tab.title}.txt`, 'flash');
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ---------------- Settings modal ----------------
  const modal = document.getElementById('settings-modal');
  const txtPathEl = document.getElementById('txt-folder-path');
  const hnotePathEl = document.getElementById('hnote-folder-path');

  async function refreshSettingsView() {
    const s = await window.hnote.getSettings();
    txtPathEl.textContent = s.txtFolder || 'Not set';
    hnotePathEl.textContent = s.hnoteFolder || 'Not set';
  }

  function openSettings() {
    refreshSettingsView();
    modal.classList.remove('hidden');
  }
  function closeSettings() {
    modal.classList.add('hidden');
  }

  document.getElementById('btn-pick-txt').addEventListener('click', async () => {
    const p = await window.hnote.chooseFolder('txt');
    if (p) txtPathEl.textContent = p;
  });
  document.getElementById('btn-pick-hnote').addEventListener('click', async () => {
    const p = await window.hnote.chooseFolder('hnote');
    if (p) hnotePathEl.textContent = p;
  });
  document.getElementById('btn-close-settings').addEventListener('click', closeSettings);

  // ---------------- Wire up top bar ----------------
  document.getElementById('btn-new-tab').addEventListener('click', createTab);
  document.getElementById('btn-save-tab').addEventListener('click', exportActiveTab);
  document.getElementById('btn-open-hnote').addEventListener('click', importHnote);
  document.getElementById('btn-open-txt').addEventListener('click', importTxt);
  document.getElementById('btn-settings').addEventListener('click', openSettings);
  document.getElementById('btn-theme').addEventListener('click', toggleTheme);

  // ---------------- Menu bridge ----------------
  window.hnote.onNewTab(createTab);
  window.hnote.onSaveTab(exportActiveTab);
  window.hnote.onOpenHnote(importHnote);
  window.hnote.onChangeFolders(openSettings);

  // ---------------- Boot ----------------
  loadInitialState();
})();
