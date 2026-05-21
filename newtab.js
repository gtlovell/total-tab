// Total Tab — new tab hub
// Vanilla JS, dependency-free, MV3-compatible.
// State persisted via chrome.storage.sync (falls back to localStorage in dev).

// ─────────────────────────────────────────────────────────────
// Storage adapter
// ─────────────────────────────────────────────────────────────

const store = (() => {
  const hasChrome = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync;
  return {
    async get(key, fallback) {
      if (hasChrome) {
        return new Promise((res) => {
          chrome.storage.sync.get([key], (data) => {
            res(data[key] !== undefined ? data[key] : fallback);
          });
        });
      } else {
        try {
          const raw = localStorage.getItem('tt_' + key);
          return raw ? JSON.parse(raw) : fallback;
        } catch { return fallback; }
      }
    },
    async set(key, value) {
      if (hasChrome) {
        return new Promise((res) => chrome.storage.sync.set({ [key]: value }, res));
      } else {
        try { localStorage.setItem('tt_' + key, JSON.stringify(value)); } catch {}
      }
    },
  };
})();

// ─────────────────────────────────────────────────────────────
// Defaults
// ─────────────────────────────────────────────────────────────

const ACCENT_PRESETS = [
  { name: 'Slate', color: '#5b6ee0', hue: 270 },
  { name: 'Sage',  color: '#4f9a6f', hue: 145 },
  { name: 'Rust',  color: '#c25a30', hue:  40 },
  { name: 'Plum',  color: '#a55b9c', hue: 320 },
  { name: 'Gold',  color: '#b88a30', hue:  85 },
  { name: 'Ink',   color: '#2a2d36', hue: 240 },
];

const CAT_COLORS = ['#e07a5b', '#5b9a6f', '#c89b3c', '#5b7da3', '#a35bac', '#3aa6c4', '#d05a8d', '#7a7f8a'];

const DEFAULT_SETTINGS = {
  name: 'friend',
  accent: '#5b6ee0',
  accentHue: 270,
  wallpaper: 'gradient', // none | gradient | photo
  density: 'comfortable', // compact | comfortable | roomy
  dark: false,
};

const DEFAULT_FOLDERS = [
  { id: 'work',    name: 'Work',    color: '#e07a5b' },
  { id: 'dev',     name: 'Dev',     color: '#5b9a6f' },
  { id: 'reading', name: 'Reading', color: '#c89b3c' },
];

const DEFAULT_BOOKMARKS = {
  work: {
    pinned: [
      { label: 'Gmail',    letter: 'M', color: '#ea4335', url: 'https://mail.google.com' },
      { label: 'Calendar', letter: 'C', color: '#1a73e8', url: 'https://calendar.google.com' },
      { label: 'Drive',    letter: 'D', color: '#fbbc04', url: 'https://drive.google.com' },
    ],
    rest: [
      { label: 'Notion', letter: 'N', color: '#2a2a2a', url: 'https://notion.so' },
      { label: 'Slack',  letter: 'S', color: '#4a154b', url: 'https://slack.com' },
    ],
  },
  dev: {
    pinned: [
      { label: 'GitHub', letter: 'G', color: '#24292f', url: 'https://github.com' },
      { label: 'MDN',    letter: 'M', color: '#000000', url: 'https://developer.mozilla.org' },
    ],
    rest: [
      { label: 'Stack Overflow', letter: 'S', color: '#f48024', url: 'https://stackoverflow.com' },
      { label: 'npm',            letter: 'N', color: '#cb3837', url: 'https://npmjs.com' },
    ],
  },
  reading: {
    pinned: [
      { label: 'Hacker News', letter: 'H', color: '#ff6600', url: 'https://news.ycombinator.com' },
    ],
    rest: [],
  },
};

const WIDGET_META = {
  weather: { icon: '☀', label: 'Weather' },
  agenda:  { icon: '◷', label: 'Agenda' },
  markets: { icon: '◢', label: 'Markets' },
  news:    { icon: '◰', label: 'News' },
  sports:  { icon: '◉', label: 'Sports' },
  social:  { icon: '◎', label: 'Feeds' },
};

// ─────────────────────────────────────────────────────────────
// Mutable app state
// ─────────────────────────────────────────────────────────────

const state = {
  settings: { ...DEFAULT_SETTINGS },
  folders: structuredClone(DEFAULT_FOLDERS),
  bookmarks: structuredClone(DEFAULT_BOOKMARKS),
  ui: {
    openFolders: new Set(['work']),
    search: '',
    searchFocused: false,
    addModalFolderId: null,
    addFolderModal: false,
    settingsOpen: false,
    folderMenuId: null,
    editingFolderId: null,
    activeWidget: 'weather',
    toast: null,
  },
};

async function loadState() {
  state.settings = { ...DEFAULT_SETTINGS, ...(await store.get('settings', {})) };
  state.folders  = await store.get('folders', DEFAULT_FOLDERS);
  state.bookmarks = await store.get('bookmarks', DEFAULT_BOOKMARKS);
}
async function saveSettings() { await store.set('settings', state.settings); }
async function saveFolders()  { await store.set('folders',  state.folders); }
async function saveBookmarks(){ await store.set('bookmarks', state.bookmarks); }

// ─────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────

function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') {
      el.addEventListener(k.slice(2).toLowerCase(), v);
    } else if (k === 'contentEditable') {
      el.setAttribute('contenteditable', v ? 'true' : 'false');
    } else el.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return el;
}

function pickColor(seed) {
  const palette = ['#e07a5b', '#5b9a6f', '#c89b3c', '#5b7da3', '#a35bac', '#3aa6c4', '#d05a8d', '#7a7f8a', '#5b6ee0'];
  let hash = 0; for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return palette[Math.abs(hash) % palette.length];
}

function normalizeUrl(u) {
  u = u.trim();
  if (!u) return '';
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
  return u;
}
function displayUrl(u) {
  return (u || '').replace(/^https?:\/\//i, '').replace(/\/$/, '');
}

function faviconUrl(rawUrl, size = 32) {
  if (!rawUrl) return '';
  try {
    const pageUrl = new URL(normalizeUrl(rawUrl));
    if (!/^https?:$/i.test(pageUrl.protocol)) return '';
    if (typeof chrome !== 'undefined' && chrome.runtime?.getURL) {
      const url = new URL(chrome.runtime.getURL('/_favicon/'));
      url.searchParams.set('pageUrl', pageUrl.href);
      url.searchParams.set('size', String(size));
      return url.toString();
    }
    return `${pageUrl.origin}/favicon.ico`;
  } catch {
    return '';
  }
}

function timeOfDayGreeting() {
  const h = new Date().getHours();
  if (h < 5) return 'Good evening';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  if (h < 21) return 'Good evening';
  return 'Good night';
}
function nowTime() {
  return new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function showToast(msg) {
  state.ui.toast = msg;
  render();
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => { state.ui.toast = null; render(); }, 2400);
}

function buildSearchIndex() {
  const out = [];
  for (const f of state.folders) {
    const fb = state.bookmarks[f.id];
    if (!fb) continue;
    for (const l of [...(fb.pinned || []), ...(fb.rest || [])]) {
      out.push({ ...l, folder: f.name, folderId: f.id });
    }
  }
  return out;
}

// ─────────────────────────────────────────────────────────────
// Renderers
// ─────────────────────────────────────────────────────────────

function favTile(link, cls = 'fav-tile', extraStyle = {}) {
  const fallback = link.letter || (link.label || '?')[0].toUpperCase();
  const tile = h('span', {
    class: cls,
    style: { background: link.color, ...extraStyle },
  }, h('span', { class: 'fav-letter' }, fallback));
  const src = faviconUrl(link.url, cls === 'fav-tile' ? 64 : 32);
  if (src) {
    tile.prepend(h('img', {
      class: 'favicon',
      src,
      alt: '',
      loading: 'lazy',
      onLoad: () => { tile.classList.add('has-favicon'); },
      onError: (e) => { e.currentTarget.remove(); },
    }));
  }
  return tile;
}

function renderHeader() {
  const { settings, ui } = state;
  const searchEl = h('input', {
    type: 'text',
    placeholder: 'Search bookmarks or the web…',
    value: ui.search,
    onInput: (e) => { state.ui.search = e.target.value; renderSearchResults(); },
    onFocus: () => { state.ui.searchFocused = true; renderSearchResults(); },
    onBlur: () => { setTimeout(() => { state.ui.searchFocused = false; renderSearchResults(); }, 150); },
    onKeydown: (e) => {
      if (e.key === 'Enter') {
        const q = state.ui.search.trim();
        if (q) {
          // If first result match, go there; else web search
          const idx = buildSearchIndex();
          const match = idx.find((l) => (l.label + ' ' + (l.url || '')).toLowerCase().includes(q.toLowerCase()));
          if (match) window.location.href = match.url;
          else window.location.href = 'https://www.google.com/search?q=' + encodeURIComponent(q);
        }
      }
      if (e.key === 'Escape') { e.target.blur(); state.ui.search = ''; renderSearchResults(); }
    },
  });

  const searchBox = h('div', { class: 'search' },
    h('span', { class: 'glyph' }, '⌕'),
    searchEl,
    h('span', { class: 'kbd' }, '⌘ K')
  );

  const wrap = h('div', { class: 'search-wrap' }, searchBox);
  const resultsContainer = h('div', { id: 'search-results-host' });
  wrap.append(resultsContainer);

  // Cache the input for ⌘K focus
  setTimeout(() => { window.__searchInput = searchEl; }, 0);

  return h('div', { class: 'header' },
    h('div', { class: 'greet' },
      `${timeOfDayGreeting()}, `,
      h('span', { class: 'accent', id: 'greeting-name' }, settings.name),
      '.',
      h('span', { class: 'time' }, '· ' + nowTime()),
    ),
    wrap,
    h('button', {
      class: 'icon-btn',
      title: settings.dark ? 'Light mode' : 'Dark mode',
      onClick: () => { state.settings.dark = !state.settings.dark; saveSettings(); render(); },
    }, settings.dark ? '☀' : '☾'),
    h('button', {
      class: 'icon-btn',
      title: 'Customize',
      onClick: () => { state.ui.settingsOpen = true; render(); },
    }, '⚙'),
  );
}

function renderSearchResults() {
  const host = document.getElementById('search-results-host');
  if (!host) return;
  host.textContent = '';
  const q = state.ui.search.trim().toLowerCase();
  if (!state.ui.searchFocused || !q) {
    // Update search box border state
    const sb = host.previousElementSibling || host.parentElement.querySelector('.search');
    return;
  }
  const matches = buildSearchIndex()
    .filter((l) => l.label.toLowerCase().includes(q) || (l.url || '').toLowerCase().includes(q))
    .slice(0, 8);

  const items = [];
  if (matches.length) {
    items.push(h('div', { class: 'sr-group' }, 'Bookmarks'));
    for (const m of matches) {
      items.push(h('a', {
        class: 'sr-item', href: m.url || '#',
        onMousedown: (e) => e.preventDefault(),
      },
        favTile(m, 'sr-fav'),
        h('div', { style: { flex: 1, minWidth: 0 } },
          h('div', { style: { fontSize: '14px', color: 'var(--ink)' } }, m.label),
          h('div', { style: { fontSize: '11px', color: 'var(--ink-3)', fontFamily: 'JetBrains Mono, monospace' } }, displayUrl(m.url) || `in ${m.folder.toLowerCase()}`),
        ),
        h('span', { class: 'sr-folder' }, m.folder),
      ));
    }
    items.push(h('div', { class: 'popmenu-sep' }));
  } else {
    items.push(h('div', { class: 'sr-empty' },
      'No bookmarks match "', h('b', {}, state.ui.search.trim()), '".'));
    items.push(h('div', { class: 'popmenu-sep' }));
  }

  items.push(h('a', {
    class: 'sr-item',
    href: 'https://www.google.com/search?q=' + encodeURIComponent(state.ui.search.trim()),
    onMousedown: (e) => e.preventDefault(),
  },
    h('span', { class: 'sr-fav', style: { background: state.settings.accent } }, 'G'),
    h('div', { style: { flex: 1 } },
      h('div', { style: { fontSize: '14px' } },
        'Search the web for "',
        h('b', {}, state.ui.search.trim()),
        '"'),
      h('div', { style: { fontSize: '11px', color: 'var(--ink-3)', fontFamily: 'JetBrains Mono, monospace' } }, 'google.com'),
    ),
    h('span', { style: { fontSize: '11px', color: 'var(--ink-3)', fontFamily: 'JetBrains Mono, monospace' } }, '↵'),
  ));

  host.append(h('div', { class: 'search-results' }, ...items));
}

function renderFolder(folder) {
  const { ui, bookmarks } = state;
  const fb = bookmarks[folder.id] || { pinned: [], rest: [] };
  const isOpen = ui.openFolders.has(folder.id);
  const isEditing = ui.editingFolderId === folder.id;
  const menuOpen = ui.folderMenuId === folder.id;

  const nameEl = h('span', {
    class: 'folder-name',
    contentEditable: isEditing,
    onDblclick: (e) => { e.stopPropagation(); startEditFolder(folder.id); },
    onBlur: (e) => commitEditFolder(folder.id, e.target.textContent),
    onKeydown: (e) => {
      if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); }
      if (e.key === 'Escape') { e.target.textContent = folder.name; state.ui.editingFolderId = null; render(); }
    },
  }, folder.name);

  const head = h('div', {
    class: 'folder-head',
    onClick: () => { if (!isEditing) toggleFolder(folder.id); },
  },
    h('span', {
      class: 'folder-dot',
      style: { background: folder.color },
      onClick: (e) => { e.stopPropagation(); toggleFolderMenu(folder.id); },
      title: 'Folder options',
    }),
    nameEl,
    h('span', { class: 'folder-count' }, String(fb.pinned.length + fb.rest.length)),
    h('span', { class: 'folder-spacer' }),
    h('button', { class: 'folder-menu-btn', onClick: (e) => { e.stopPropagation(); toggleFolderMenu(folder.id); }, title: 'Options' }, '⋯'),
    h('span', { class: 'chev' }, '▾'),
  );

  const body = isOpen ? h('div', { class: 'folder-body' },
    fb.pinned.length > 0 ? h('div', { class: 'section-label' }, '★ Pinned') : null,
    fb.pinned.length > 0 ? h('div', { class: 'pinned-row' },
      ...fb.pinned.map((l, i) => h('a', {
        class: 'pin', href: l.url || '#', title: displayUrl(l.url) || l.label,
      },
        favTile(l),
        h('span', { class: 'pin-label' }, l.label),
      ))
    ) : null,
    h('div', { class: 'section-label' }, 'All'),
    h('div', { class: 'all-grid' },
      ...fb.rest.map((l, i) => h('a', {
        class: 'link', href: l.url || '#', title: displayUrl(l.url),
      },
        favTile(l),
        h('span', { class: 'link-name' }, l.label),
        h('span', {
          class: 'link-x',
          title: 'Remove',
          onClick: (e) => { e.preventDefault(); e.stopPropagation(); deleteBookmark(folder.id, false, i); },
        }, '×'),
      )),
      h('button', {
        class: 'add-link',
        onClick: () => openAddBookmark(folder.id),
      },
        h('span', { class: 'ph' }, '＋'),
        h('span', { style: { color: 'var(--ink-3)' } }, 'Add bookmark'),
      ),
    ),
  ) : null;

  const menu = menuOpen ? h('div', { class: 'popmenu' },
    h('div', {
      class: 'popmenu-item',
      onClick: () => { startEditFolder(folder.id); state.ui.folderMenuId = null; render(); },
    }, h('span', { style: { width: '18px', opacity: 0.6 } }, '✎'), ' Rename'),
    h('div', { class: 'color-row' },
      ...CAT_COLORS.map((c) => h('div', {
        class: 'color-sw' + (c === folder.color ? ' active' : ''),
        style: { background: c },
        title: c,
        onClick: () => { recolorFolder(folder.id, c); state.ui.folderMenuId = null; render(); },
      }))
    ),
    h('div', { class: 'popmenu-sep' }),
    h('div', {
      class: 'popmenu-item danger',
      onClick: () => { deleteFolder(folder.id); state.ui.folderMenuId = null; render(); },
    }, h('span', { style: { width: '18px', opacity: 0.7 } }, '🗑'), ' Delete folder'),
  ) : null;

  return h('div', { class: 'folder' + (isOpen ? ' open' : '') }, head, menu, body);
}

function renderMain() {
  const folders = state.folders;
  return h('div', { class: 'main' },
    ...folders.map(renderFolder),
    h('button', { class: 'add-folder-row', onClick: openAddFolder },
      h('span', {}, '＋'),
      h('span', {}, 'New folder'),
    ),
    folders.length === 0 ? h('div', { class: 'empty' },
      'No folders yet. Click "New folder" above to start organizing.') : null,
  );
}

// ─── Widgets ────────────────────────────────────────────────

function widgetRow(left, right, opts = {}) {
  return h('div', { class: 'widget-row' },
    h('span', { style: { flex: 1, ...opts.leftStyle } }, left),
    h('span', { style: { ...opts.rightStyle } }, right),
  );
}

function renderWidgetBody(kind) {
  switch (kind) {
    case 'weather': return [
      h('div', { class: 'rail-title' }, 'Weather · Local'),
      h('div', { style: { display: 'flex', alignItems: 'baseline', gap: '14px', marginBottom: '12px' } },
        h('div', { style: { fontSize: '64px', fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1 } }, '—°'),
        h('div', { style: { fontSize: '14px', color: 'var(--ink-2)' } },
          'Connect a weather provider',
          h('div', { style: { color: 'var(--ink-3)', fontSize: '12px' } }, 'See README for setup'),
        ),
      ),
      h('div', { style: { height: '1px', background: 'var(--border)', margin: '12px 0' } }),
      h('div', { style: { fontSize: '12px', color: 'var(--ink-3)', lineHeight: 1.6 } },
        'Plug in OpenWeather, Open-Meteo, or another API in widgets.js to fill this card with live data.'),
    ];
    case 'agenda': return [
      h('div', { class: 'rail-title' }, 'Today'),
      ...[
        ['3:00', 'Design review', 'var(--cat-1)'],
        ['4:30', '1:1 with Sam', 'var(--cat-1)'],
        ['6:15', 'Gym', 'var(--cat-5)'],
      ].map(([t, l, c]) => h('div', { style: { display: 'flex', gap: '14px', padding: '10px 0', borderBottom: '1px solid var(--border)' } },
        h('div', { style: { fontFamily: 'JetBrains Mono, monospace', fontSize: '12px', color: 'var(--ink-3)', width: '44px' } }, t),
        h('div', { style: { flex: 1, fontSize: '14px' } }, l),
        h('div', { style: { width: '4px', background: c, borderRadius: '2px' } }),
      )),
      h('div', { style: { fontSize: '12px', color: 'var(--ink-3)', marginTop: '14px' } }, 'Sample data — connect Google Calendar for real events.'),
    ];
    case 'markets': return [
      h('div', { class: 'rail-title' }, 'Watchlist'),
      ...[
        ['AAPL', '192.41', '+0.22%', 'up'],
        ['NVDA', '1,180.20', '-1.19%', 'down'],
        ['TSLA', '246.88', '+2.10%', 'up'],
      ].map(([t, p, pct, d]) => h('div', { class: 'widget-row' },
        h('span', { style: { width: '60px', fontFamily: 'JetBrains Mono, monospace', fontSize: '13px', fontWeight: 600 } }, t),
        h('span', { style: { flex: 1, fontFamily: 'JetBrains Mono, monospace', fontSize: '13px', color: 'var(--ink-2)' } }, p),
        h('span', { class: d, style: { fontFamily: 'JetBrains Mono, monospace', fontSize: '12px' } }, pct),
      )),
      h('div', { style: { fontSize: '12px', color: 'var(--ink-3)', marginTop: '14px' } }, 'Sample data — plug in your preferred finance API.'),
    ];
    case 'news': return [
      h('div', { class: 'rail-title' }, 'Top stories'),
      ...[
        ['Tech', 'Headline placeholder — wire up your RSS feed'],
        ['World', 'Headline placeholder — see widgets.js'],
        ['Science', 'Headline placeholder'],
      ].map(([k, t]) => h('div', { style: { padding: '12px 0', borderBottom: '1px solid var(--border)' } },
        h('div', { style: { fontSize: '10px', color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' } }, k),
        h('div', { style: { fontSize: '14px', color: 'var(--ink)', lineHeight: 1.4 } }, t),
      )),
    ];
    case 'sports': return [
      h('div', { class: 'rail-title' }, 'Scores'),
      h('div', { style: { fontSize: '14px', color: 'var(--ink-3)', padding: '20px 0', textAlign: 'center' } },
        'Connect a sports data provider'),
      h('div', { style: { fontSize: '12px', color: 'var(--ink-3)', marginTop: '14px' } },
        'ESPN public feeds work well — see README.'),
    ];
    case 'social': return [
      h('div', { class: 'rail-title' }, 'Feeds'),
      h('div', { style: { fontSize: '14px', color: 'var(--ink-3)', padding: '20px 0', textAlign: 'center' } },
        'Connect X, Reddit, Mastodon, or RSS'),
    ];
  }
}

function renderRail() {
  const tabs = h('div', { class: 'rail-tabs' },
    ...Object.keys(WIDGET_META).map((k) => h('button', {
      class: 'rail-tab' + (state.ui.activeWidget === k ? ' on' : ''),
      title: WIDGET_META[k].label,
      onClick: () => { state.ui.activeWidget = k; render(); },
    }, WIDGET_META[k].icon)),
  );
  const card = h('div', { class: 'rail-card' }, ...renderWidgetBody(state.ui.activeWidget));
  return h('div', { class: 'rail' }, tabs, card);
}

// ─────────────────────────────────────────────────────────────
// Modals
// ─────────────────────────────────────────────────────────────

function modal(content, onClose) {
  return h('div', { class: 'modal-backdrop', onClick: onClose },
    h('div', { class: 'modal', onClick: (e) => e.stopPropagation() }, content));
}

function renderAddBookmarkModal() {
  const id = state.ui.addModalFolderId;
  if (!id) return null;
  const folders = state.folders;

  const tmp = { name: '', url: '', folderId: id, pinned: false };
  const save = () => {
    if (!tmp.name.trim() || !tmp.url.trim()) return;
    addBookmark(tmp.folderId, {
      label: tmp.name.trim(),
      letter: tmp.name.trim()[0].toUpperCase(),
      color: pickColor(tmp.name.trim()),
      url: normalizeUrl(tmp.url),
    }, tmp.pinned);
    closeAddBookmark();
  };

  const nameInput = h('input', {
    type: 'text', placeholder: 'e.g. Hacker News', autofocus: 'true',
    onInput: (e) => { tmp.name = e.target.value; saveBtn.disabled = !tmp.name.trim() || !tmp.url.trim(); },
    onKeydown: (e) => { if (e.key === 'Enter') save(); },
  });
  const urlInput = h('input', {
    type: 'text', placeholder: 'news.ycombinator.com',
    onInput: (e) => { tmp.url = e.target.value; saveBtn.disabled = !tmp.name.trim() || !tmp.url.trim(); },
    onKeydown: (e) => { if (e.key === 'Enter') save(); },
  });
  const folderSelect = h('select', {
    onChange: (e) => { tmp.folderId = e.target.value; },
  }, ...folders.map((f) => h('option', { value: f.id, selected: f.id === id ? 'selected' : null }, f.name)));
  const pinCheck = h('input', { type: 'checkbox', onChange: (e) => { tmp.pinned = e.target.checked; } });
  const saveBtn = h('button', { class: 'btn btn-primary', disabled: 'disabled', onClick: save }, 'Add bookmark');

  return modal([
    h('h3', {}, 'Add bookmark'),
    h('div', { class: 'desc' }, 'Drop it in a folder. Pin it if it\'s a favorite.'),
    h('label', {}, 'Name'), nameInput,
    h('label', {}, 'URL'), urlInput,
    h('label', {}, 'Folder'), folderSelect,
    h('label', { class: 'check' }, pinCheck, ' Pin to top of folder'),
    h('div', { class: 'actions' },
      h('button', { class: 'btn', onClick: closeAddBookmark }, 'Cancel'),
      saveBtn,
    ),
  ], closeAddBookmark);
}

function renderAddFolderModal() {
  if (!state.ui.addFolderModal) return null;
  const tmp = { name: '', color: CAT_COLORS[0] };
  const save = () => {
    if (!tmp.name.trim()) return;
    addFolder(tmp.name.trim(), tmp.color);
    closeAddFolder();
  };

  const nameInput = h('input', {
    type: 'text', placeholder: 'e.g. Recipes', autofocus: 'true',
    onInput: (e) => { tmp.name = e.target.value; saveBtn.disabled = !tmp.name.trim(); },
    onKeydown: (e) => { if (e.key === 'Enter') save(); },
  });
  let activeSwatch;
  const colorRow = h('div', { class: 'swatches' },
    ...CAT_COLORS.map((c, i) => {
      const sw = h('div', {
        class: 'swatch' + (i === 0 ? ' active' : ''),
        style: { background: c, width: '32px', height: '32px' },
        onClick: () => {
          tmp.color = c;
          activeSwatch?.classList.remove('active');
          sw.classList.add('active');
          activeSwatch = sw;
        },
      });
      if (i === 0) activeSwatch = sw;
      return sw;
    })
  );
  const saveBtn = h('button', { class: 'btn btn-primary', disabled: 'disabled', onClick: save }, 'Create folder');

  return modal([
    h('h3', {}, 'New folder'),
    h('div', { class: 'desc' }, 'Name it and pick a color.'),
    h('label', {}, 'Name'), nameInput,
    h('label', {}, 'Color'), colorRow,
    h('div', { class: 'actions' },
      h('button', { class: 'btn', onClick: closeAddFolder }, 'Cancel'),
      saveBtn,
    ),
  ], closeAddFolder);
}

function renderSettingsSheet() {
  if (!state.ui.settingsOpen) return null;
  const s = state.settings;
  const update = (patch) => { Object.assign(s, patch); saveSettings(); render(); };
  const updateGreetingName = (name) => {
    s.name = name;
    saveSettings();
    const greetingName = document.getElementById('greeting-name');
    if (greetingName) greetingName.textContent = name;
  };
  return modal([
    h('h3', {}, 'Customize'),
    h('div', { class: 'desc' }, 'Make the page yours. Saved across all your devices.'),

    h('label', {}, 'Greeting name'),
    h('input', { type: 'text', value: s.name, onInput: (e) => updateGreetingName(e.target.value) }),

    h('label', {}, 'Accent'),
    h('div', { class: 'swatches' },
      ...ACCENT_PRESETS.map((p) => h('div', {
        class: 'swatch' + (s.accent === p.color ? ' active' : ''),
        style: { background: p.color },
        title: p.name,
        onClick: () => update({ accent: p.color, accentHue: p.hue }),
      }))
    ),

    h('label', {}, 'Wallpaper'),
    h('div', { class: 'wp-options' },
      ...[
        ['none',     'Clean',  'clean'],
        ['gradient', 'Tinted', 'tinted'],
        ['photo',    'Photo',  'photo'],
      ].map(([v, lbl, cls]) => h('div', {
        class: 'wp-opt ' + cls + (s.wallpaper === v ? ' active' : ''),
        onClick: () => update({ wallpaper: v }),
      }, h('span', {}, lbl))),
    ),

    h('label', {}, 'Density'),
    h('div', { class: 'density-row' },
      ...['compact', 'comfortable', 'roomy'].map((d) => h('div', {
        class: 'density-opt' + (s.density === d ? ' active' : ''),
        onClick: () => update({ density: d }),
      }, d)),
    ),

    h('label', { class: 'check' },
      h('input', {
        type: 'checkbox',
        checked: s.dark ? 'checked' : null,
        onChange: (e) => update({ dark: e.target.checked }),
      }),
      ' Dark mode',
    ),

    h('div', { class: 'actions' },
      h('button', { class: 'btn btn-primary', onClick: () => { state.ui.settingsOpen = false; render(); } }, 'Done'),
    ),
  ], () => { state.ui.settingsOpen = false; render(); });
}

// ─────────────────────────────────────────────────────────────
// Actions
// ─────────────────────────────────────────────────────────────

function toggleFolder(id) {
  if (state.ui.openFolders.has(id)) state.ui.openFolders.delete(id);
  else state.ui.openFolders.add(id);
  render();
}
function toggleFolderMenu(id) {
  state.ui.folderMenuId = state.ui.folderMenuId === id ? null : id;
  render();
}
function startEditFolder(id) {
  state.ui.editingFolderId = id;
  state.ui.folderMenuId = null;
  render();
  setTimeout(() => {
    const el = document.querySelector('.folder.open [contenteditable="true"]')
            || document.querySelector('[contenteditable="true"]');
    if (el) {
      el.focus();
      const r = document.createRange();
      r.selectNodeContents(el);
      const sel = window.getSelection();
      sel.removeAllRanges(); sel.addRange(r);
    }
  }, 10);
}
function commitEditFolder(id, newName) {
  const trimmed = (newName || '').trim();
  const f = state.folders.find((f) => f.id === id);
  if (!f) return;
  if (trimmed && trimmed !== f.name) {
    f.name = trimmed;
    saveFolders();
    showToast(`Renamed to "${trimmed}"`);
  }
  state.ui.editingFolderId = null;
  render();
}
function recolorFolder(id, color) {
  const f = state.folders.find((f) => f.id === id);
  if (!f) return;
  f.color = color;
  saveFolders();
  render();
}
function deleteFolder(id) {
  const f = state.folders.find((f) => f.id === id);
  if (!f) return;
  if (!confirm(`Delete folder "${f.name}" and all its bookmarks?`)) return;
  state.folders = state.folders.filter((f) => f.id !== id);
  delete state.bookmarks[id];
  state.ui.openFolders.delete(id);
  saveFolders(); saveBookmarks();
  showToast(`Deleted folder "${f.name}"`);
  render();
}
function addFolder(name, color) {
  const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Date.now().toString(36).slice(-4);
  state.folders.push({ id, name, color });
  state.bookmarks[id] = { pinned: [], rest: [] };
  state.ui.openFolders.add(id);
  saveFolders(); saveBookmarks();
  showToast(`Created "${name}"`);
  render();
}
function openAddFolder() { state.ui.addFolderModal = true; render(); }
function closeAddFolder() { state.ui.addFolderModal = false; render(); }

function openAddBookmark(folderId) { state.ui.addModalFolderId = folderId; render(); }
function closeAddBookmark() { state.ui.addModalFolderId = null; render(); }
function addBookmark(folderId, link, pinned) {
  state.bookmarks[folderId] = state.bookmarks[folderId] || { pinned: [], rest: [] };
  if (pinned) state.bookmarks[folderId].pinned.push(link);
  else state.bookmarks[folderId].rest.push(link);
  saveBookmarks();
  showToast(`Added "${link.label}"`);
  render();
}
function deleteBookmark(folderId, isPinned, index) {
  const fb = state.bookmarks[folderId];
  if (!fb) return;
  const list = isPinned ? fb.pinned : fb.rest;
  const [removed] = list.splice(index, 1);
  saveBookmarks();
  showToast(`Removed "${removed?.label || 'bookmark'}"`);
  render();
}

// ─────────────────────────────────────────────────────────────
// Render
// ─────────────────────────────────────────────────────────────

function render() {
  const s = state.settings;
  const body = document.body;

  // Body classes for theme/wp/density
  body.className = '';
  if (s.dark) body.classList.add('dark');
  body.classList.add('wp-' + s.wallpaper);
  body.classList.add('density-' + s.density);

  // Set accent custom properties
  document.documentElement.style.setProperty('--accent', s.accent);
  document.documentElement.style.setProperty('--accent-h', s.accentHue);

  const app = document.getElementById('app');
  app.textContent = '';
  app.append(
    h('div', { class: 'app' },
      renderHeader(),
      h('div', { class: 'body' },
        renderMain(),
        renderRail(),
      ),
    ),
    renderAddBookmarkModal(),
    renderAddFolderModal(),
    renderSettingsSheet(),
    state.ui.toast ? h('div', { class: 'toast' }, state.ui.toast) : null,
  );

  renderSearchResults();
}

// ─────────────────────────────────────────────────────────────
// Boot
// ─────────────────────────────────────────────────────────────

// Click-anywhere closes any open folder menu
document.addEventListener('mousedown', (e) => {
  if (state.ui.folderMenuId && !e.target.closest('.popmenu') && !e.target.closest('.folder-menu-btn') && !e.target.closest('.folder-dot')) {
    state.ui.folderMenuId = null;
    render();
  }
});

// ⌘K focus
document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    window.__searchInput?.focus();
  }
});

// Live clock — re-render every 30s for accurate time
setInterval(() => { if (!state.ui.search && !state.ui.editingFolderId) render(); }, 30000);

(async () => {
  await loadState();
  render();
})();
