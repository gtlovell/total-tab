// Total Tab — new tab hub
// Vanilla JS, dependency-free, MV3-compatible.
// State persisted via Chrome storage (falls back to localStorage in dev).

// ─────────────────────────────────────────────────────────────
// Storage adapter
// ─────────────────────────────────────────────────────────────

const store = (() => {
  const hasChromeStorage =
    typeof chrome !== "undefined" && chrome.storage;

  function chromeArea(areaName) {
    return hasChromeStorage ? chrome.storage[areaName] : null;
  }

  function areaForKey(key) {
    // Bookmark collections can quickly exceed chrome.storage.sync's per-item
    // quota, so keep the large mutable payload in local extension storage.
    return key === "bookmarks" ? "local" : "sync";
  }

  function localStorageKey(areaName, key) {
    return `tt_${areaName}_${key}`;
  }

  function getChromeValue(areaName, key, fallback) {
    const area = chromeArea(areaName);
    if (!area) return Promise.resolve(fallback);
    return new Promise((resolve) => {
      area.get([key], (data) => {
        const err = chrome.runtime?.lastError;
        if (err) {
          console.warn(
            `Total Tab could not read ${areaName}.${key}:`,
            err.message,
          );
          resolve(fallback);
          return;
        }
        resolve(data[key] !== undefined ? data[key] : fallback);
      });
    });
  }

  function setChromeValue(areaName, key, value) {
    const area = chromeArea(areaName);
    if (!area) return Promise.resolve(false);
    return new Promise((resolve, reject) => {
      area.set({ [key]: value }, () => {
        const err = chrome.runtime?.lastError;
        if (err) {
          reject(new Error(err.message));
          return;
        }
        resolve(true);
      });
    });
  }

  return {
    async get(key, fallback, areaName = areaForKey(key)) {
      if (hasChromeStorage) {
        return getChromeValue(areaName, key, fallback);
      } else {
        try {
          const raw = localStorage.getItem(localStorageKey(areaName, key));
          return raw ? JSON.parse(raw) : fallback;
        } catch {
          return fallback;
        }
      }
    },
    async set(key, value, areaName = areaForKey(key)) {
      if (hasChromeStorage) {
        return setChromeValue(areaName, key, value);
      } else {
        try {
          localStorage.setItem(
            localStorageKey(areaName, key),
            JSON.stringify(value),
          );
        } catch {}
        return true;
      }
    },
  };
})();

// ─────────────────────────────────────────────────────────────
// Defaults
// ─────────────────────────────────────────────────────────────

const ACCENT_PRESETS = [
  { name: "Slate", color: "#5b6ee0", hue: 270 },
  { name: "Sage", color: "#4f9a6f", hue: 145 },
  { name: "Rust", color: "#c25a30", hue: 40 },
  { name: "Plum", color: "#a55b9c", hue: 320 },
  { name: "Gold", color: "#b88a30", hue: 85 },
  { name: "Ink", color: "#2a2d36", hue: 240 },
];

const CAT_COLORS = [
  "#e07a5b",
  "#5b9a6f",
  "#c89b3c",
  "#5b7da3",
  "#a35bac",
  "#3aa6c4",
  "#d05a8d",
  "#7a7f8a",
];

const DEFAULT_SETTINGS = {
  name: "friend",
  accent: "#5b6ee0",
  accentHue: 270,
  wallpaper: "gradient", // none | gradient | photo
  density: "comfortable", // compact | comfortable | roomy
  dark: false,
};

const DEFAULT_FOLDERS = [
  { id: "work", name: "Work", color: "#e07a5b" },
  { id: "dev", name: "Dev", color: "#00ff51" },
  { id: "reading", name: "Reading", color: "#c89b3c" },
];

const DEFAULT_BOOKMARKS = {
  work: {
    pinned: [
      {
        label: "Gmail",
        letter: "M",
        color: "#ea4335",
        url: "https://mail.google.com",
      },
      {
        label: "Calendar",
        letter: "C",
        color: "#1a73e8",
        url: "https://calendar.google.com",
      },
      {
        label: "Drive",
        letter: "D",
        color: "#fbbc04",
        url: "https://drive.google.com",
      },
    ],
    rest: [
      {
        label: "Notion",
        letter: "N",
        color: "#2a2a2a",
        url: "https://notion.so",
      },
      {
        label: "Slack",
        letter: "S",
        color: "#4a154b",
        url: "https://slack.com",
      },
    ],
  },
  dev: {
    pinned: [
      {
        label: "GitHub",
        letter: "G",
        color: "#24292f",
        url: "https://github.com",
      },
      {
        label: "MDN",
        letter: "M",
        color: "#000000",
        url: "https://developer.mozilla.org",
      },
    ],
    rest: [
      {
        label: "Stack Overflow",
        letter: "S",
        color: "#f48024",
        url: "https://stackoverflow.com",
      },
      { label: "npm", letter: "N", color: "#cb3837", url: "https://npmjs.com" },
    ],
  },
  reading: {
    pinned: [
      {
        label: "Hacker News",
        letter: "H",
        color: "#ff6600",
        url: "https://news.ycombinator.com",
      },
    ],
    rest: [],
  },
};

const WIDGET_META = {
  weather: { icon: "sun", label: "Weather" },
  agenda: { icon: "calendar", label: "Agenda" },
  markets: { icon: "chart-line", label: "Markets" },
  news: { icon: "newspaper", label: "News" },
  sports: { icon: "trophy", label: "Sports" },
  social: { icon: "rss", label: "Feeds" },
};

const WEATHER_API_URL =
  "https://api.open-meteo.com/v1/forecast?latitude=36.03&longitude=-86.78&hourly=temperature_2m&models=gfs_seamless&timezone=America%2FChicago&wind_speed_unit=mph&precipitation_unit=inch&temperature_unit=fahrenheit";

const SPORTS_FEEDS = [
  {
    label: "MLB",
    url: "https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard",
  },
  {
    label: "NBA",
    url: "https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard",
  },
  {
    label: "NHL",
    url: "https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard",
  },
  {
    label: "NFL",
    url: "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard",
  },
];

// ─────────────────────────────────────────────────────────────
// Mutable app state
// ─────────────────────────────────────────────────────────────

const state = {
  settings: { ...DEFAULT_SETTINGS },
  folders: structuredClone(DEFAULT_FOLDERS),
  bookmarks: structuredClone(DEFAULT_BOOKMARKS),
  weather: {
    status: "idle",
    current: null,
    upcoming: [],
    unit: "°F",
    updatedAt: null,
    error: null,
  },
  sports: {
    status: "idle",
    games: [],
    updatedAt: null,
    error: null,
  },
  ui: {
    openFolders: new Set(["work"]),
    search: "",
    searchFocused: false,
    addModalFolderId: null,
    addFolderModal: false,
    editBookmark: null,
    settingsOpen: false,
    importingBookmarks: false,
    folderMenuId: null,
    editingFolderId: null,
    draggingBookmark: null,
    draggingFolderId: null,
    activeWidget: "weather",
    toast: null,
  },
};

async function loadState() {
  state.settings = {
    ...DEFAULT_SETTINGS,
    ...(await store.get("settings", {})),
  };
  state.folders = await store.get("folders", DEFAULT_FOLDERS);

  let bookmarks = await store.get("bookmarks", null, "local");
  if (!bookmarks) {
    const syncedBookmarks = await store.get("bookmarks", null, "sync");
    bookmarks = syncedBookmarks || DEFAULT_BOOKMARKS;
    if (syncedBookmarks) {
      try {
        await store.set("bookmarks", syncedBookmarks, "local");
      } catch (err) {
        console.warn(
          "Total Tab could not migrate bookmarks to local storage:",
          err?.message || err,
        );
      }
    }
  }
  state.bookmarks = bookmarks;
}
async function saveStateKey(key, value, areaName, label) {
  try {
    await store.set(key, value, areaName);
    return true;
  } catch (err) {
    console.warn(
      `Total Tab could not save ${areaName}.${key}:`,
      err.message,
    );
    showToast(`Could not save ${label}.`);
    return false;
  }
}
async function saveSettings() {
  return saveStateKey("settings", state.settings, "sync", "settings");
}
async function saveFolders() {
  return saveStateKey("folders", state.folders, "sync", "folders");
}
async function saveBookmarks() {
  return saveStateKey("bookmarks", state.bookmarks, "local", "bookmarks");
}

// ─────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────

function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
    else if (k === "html") el.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") {
      el.addEventListener(k.slice(2).toLowerCase(), v);
    } else if (k === "contentEditable") {
      el.setAttribute("contenteditable", v ? "true" : "false");
    } else el.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return el;
}

function phIcon(name, attrs = {}) {
  const cls = ["ph", `ph-${name}`, attrs.class].filter(Boolean).join(" ");
  return h("i", { ...attrs, class: cls, "aria-hidden": "true" });
}

function pickColor(seed) {
  const palette = [
    "#e07a5b",
    "#5b9a6f",
    "#c89b3c",
    "#5b7da3",
    "#a35bac",
    "#3aa6c4",
    "#d05a8d",
    "#7a7f8a",
    "#5b6ee0",
  ];
  let hash = 0;
  for (let i = 0; i < seed.length; i++)
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return palette[Math.abs(hash) % palette.length];
}

function normalizeUrl(u) {
  u = u.trim();
  if (!u) return "";
  if (!/^https?:\/\//i.test(u)) u = "https://" + u;
  return u;
}
function displayUrl(u) {
  return (u || "").replace(/^https?:\/\//i, "").replace(/\/$/, "");
}

function bookmarkUrlKey(url) {
  try {
    return new URL(url).href.replace(/\/$/, "").toLowerCase();
  } catch {
    return (url || "").trim().replace(/\/$/, "").toLowerCase();
  }
}

function bookmarkLabel(title, url) {
  const trimmed = (title || "").trim();
  if (trimmed) return trimmed;
  return displayUrl(url) || "Untitled bookmark";
}

function slugifyName(name) {
  return (
    (name || "folder")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "folder"
  );
}

function createFolderId(name) {
  let id;
  do {
    id = `${slugifyName(name)}-${Date.now().toString(36).slice(-4)}-${Math.random().toString(36).slice(2, 5)}`;
  } while (state.folders.some((f) => f.id === id));
  return id;
}

function listName(pinned) {
  return pinned ? "pinned" : "rest";
}

function getBookmarkList(folderId, pinned) {
  state.bookmarks[folderId] = state.bookmarks[folderId] || {
    pinned: [],
    rest: [],
  };
  const key = listName(pinned);
  state.bookmarks[folderId][key] = state.bookmarks[folderId][key] || [];
  return state.bookmarks[folderId][key];
}

function getBookmarkAt(folderId, pinned, index) {
  return getBookmarkList(folderId, pinned)[index];
}

function bookmarkPayload(folderId, pinned, index) {
  return JSON.stringify({ type: "bookmark", folderId, pinned, index });
}

function folderPayload(folderId) {
  return JSON.stringify({ type: "folder", folderId });
}

function readDragPayload(e) {
  try {
    const raw = e.dataTransfer?.getData("application/json") || "";
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function currentDragPayload(e) {
  const payload = readDragPayload(e);
  if (payload) return payload;
  if (state.ui.draggingBookmark) return state.ui.draggingBookmark;
  if (state.ui.draggingFolderId) {
    return { type: "folder", folderId: state.ui.draggingFolderId };
  }
  return null;
}

function faviconUrl(rawUrl, size = 32) {
  if (!rawUrl) return "";
  try {
    const pageUrl = new URL(normalizeUrl(rawUrl));
    if (!/^https?:$/i.test(pageUrl.protocol)) return "";
    if (typeof chrome !== "undefined" && chrome.runtime?.getURL) {
      const url = new URL(chrome.runtime.getURL("/_favicon/"));
      url.searchParams.set("pageUrl", pageUrl.href);
      url.searchParams.set("size", String(size));
      return url.toString();
    }
    return `${pageUrl.origin}/favicon.ico`;
  } catch {
    return "";
  }
}

function timeOfDayGreeting() {
  const h = new Date().getHours();
  if (h < 5) return "Good evening";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 21) return "Good evening";
  return "Good night";
}
function nowTime() {
  return new Date().toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatHourLabel(value) {
  return new Date(value).toLocaleTimeString([], {
    hour: "numeric",
  });
}

function formatTemp(value) {
  return Math.round(Number(value));
}

function parseWeatherForecast(data) {
  const times = data?.hourly?.time || [];
  const temps = data?.hourly?.temperature_2m || [];
  const unit = data?.hourly_units?.temperature_2m || "°F";
  if (!times.length || !temps.length) {
    throw new Error("Weather data was empty.");
  }

  const now = Date.now();
  let currentIndex = times.findIndex((time) => new Date(time).getTime() > now) - 1;
  if (currentIndex < 0) currentIndex = 0;
  if (currentIndex >= temps.length) currentIndex = temps.length - 1;

  const entryAt = (index) => ({
    time: times[index],
    label: formatHourLabel(times[index]),
    temp: formatTemp(temps[index]),
  });

  return {
    current: entryAt(currentIndex),
    upcoming: times
      .slice(currentIndex + 1, currentIndex + 7)
      .map((_, offset) => entryAt(currentIndex + 1 + offset)),
    unit,
  };
}

async function loadWeatherForecast() {
  if (state.weather.status === "loading") return;
  state.weather.status = "loading";
  state.weather.error = null;
  if (state.ui.activeWidget === "weather") render();

  try {
    const res = await fetch(WEATHER_API_URL);
    if (!res.ok) throw new Error(`Weather request failed (${res.status})`);
    const parsed = parseWeatherForecast(await res.json());
    state.weather = {
      status: "ready",
      current: parsed.current,
      upcoming: parsed.upcoming,
      unit: parsed.unit,
      updatedAt: Date.now(),
      error: null,
    };
  } catch (err) {
    state.weather.status = "error";
    state.weather.error = err?.message || "Weather request failed.";
  }

  if (state.ui.activeWidget === "weather") render();
}

function gamePriority(game) {
  if (game.state === "in") return 0;
  if (game.state === "pre") return 1;
  return 2;
}

function isRelevantSportsGame(game) {
  const diffMs = new Date(game.date).getTime() - Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  if (game.state === "in") return true;
  if (game.state === "pre") return diffMs > -dayMs && diffMs < 7 * dayMs;
  return diffMs < dayMs && diffMs > -3 * dayMs;
}

function compareSportsGames(a, b) {
  const priority = gamePriority(a) - gamePriority(b);
  if (priority) return priority;
  const aTime = new Date(a.date).getTime();
  const bTime = new Date(b.date).getTime();
  if (a.state === "post" && b.state === "post") return bTime - aTime;
  return aTime - bTime;
}

function formatGameTime(dateValue) {
  return new Date(dateValue).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function parseEspnGame(event, leagueLabel) {
  const competition = event?.competitions?.[0];
  const competitors = competition?.competitors || [];
  const away = competitors.find((team) => team.homeAway === "away") || competitors[0];
  const home = competitors.find((team) => team.homeAway === "home") || competitors[1];
  if (!away || !home) return null;

  const status = competition?.status || event?.status || {};
  const type = status.type || {};
  const stateName = type.state || (type.completed ? "post" : "pre");
  const state = type.completed ? "post" : stateName;
  const gameDate = event.date || competition.date;
  const score =
    state === "pre"
      ? formatGameTime(gameDate)
      : `${away.score || "0"}-${home.score || "0"}`;

  return {
    id: `${leagueLabel}-${event.id}`,
    league: leagueLabel,
    date: gameDate,
    state,
    status: type.shortDetail || type.detail || type.description || "",
    away: away.team?.abbreviation || away.team?.shortDisplayName || "Away",
    home: home.team?.abbreviation || home.team?.shortDisplayName || "Home",
    score,
  };
}

function parseEspnScoreboard(data, leagueLabel) {
  return (data?.events || [])
    .map((event) => parseEspnGame(event, leagueLabel))
    .filter(Boolean);
}

async function loadSportsScores() {
  if (state.sports.status === "loading") return;
  state.sports.status = "loading";
  state.sports.error = null;
  if (state.ui.activeWidget === "sports") render();

  try {
    const results = await Promise.allSettled(
      SPORTS_FEEDS.map(async (feed) => {
        const res = await fetch(feed.url);
        if (!res.ok) throw new Error(`${feed.label} failed (${res.status})`);
        return parseEspnScoreboard(await res.json(), feed.label);
      }),
    );
    const allGames = results
      .flatMap((result) => (result.status === "fulfilled" ? result.value : []))
      .sort(compareSportsGames);
    const games = (allGames.filter(isRelevantSportsGame).length
      ? allGames.filter(isRelevantSportsGame)
      : allGames)
      .sort(compareSportsGames)
      .slice(0, 8);

    state.sports = {
      status: "ready",
      games,
      updatedAt: Date.now(),
      error: games.length ? null : "No games found in the ESPN feeds.",
    };
  } catch (err) {
    state.sports.status = "error";
    state.sports.error = err?.message || "ESPN scores unavailable.";
  }

  if (state.ui.activeWidget === "sports") render();
}

function showToast(msg) {
  state.ui.toast = msg;
  render();
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => {
    state.ui.toast = null;
    render();
  }, 2400);
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

function favTile(link, cls = "fav-tile", extraStyle = {}) {
  const fallback = link.letter || (link.label || "?")[0].toUpperCase();
  const tile = h(
    "span",
    {
      class: cls,
      style: { background: link.color, ...extraStyle },
    },
    h("span", { class: "fav-letter" }, fallback),
  );
  const src = faviconUrl(link.url, cls === "fav-tile" ? 64 : 32);
  if (src) {
    tile.prepend(
      h("img", {
        class: "favicon",
        src,
        alt: "",
        loading: "lazy",
        onLoad: () => {
          tile.classList.add("has-favicon");
        },
        onError: (e) => {
          e.currentTarget.remove();
        },
      }),
    );
  }
  return tile;
}

function renderHeader() {
  const { settings, ui } = state;
  const searchEl = h("input", {
    type: "text",
    placeholder: "Search bookmarks or the web…",
    value: ui.search,
    onInput: (e) => {
      state.ui.search = e.target.value;
      renderSearchResults();
    },
    onFocus: () => {
      state.ui.searchFocused = true;
      renderSearchResults();
    },
    onBlur: () => {
      setTimeout(() => {
        state.ui.searchFocused = false;
        renderSearchResults();
      }, 150);
    },
    onKeydown: (e) => {
      if (e.key === "Enter") {
        const q = state.ui.search.trim();
        if (q) {
          // If first result match, go there; else web search
          const idx = buildSearchIndex();
          const match = idx.find((l) =>
            (l.label + " " + (l.url || ""))
              .toLowerCase()
              .includes(q.toLowerCase()),
          );
          if (match) window.location.href = match.url;
          else
            window.location.href =
              "https://www.google.com/search?q=" + encodeURIComponent(q);
        }
      }
      if (e.key === "Escape") {
        e.target.blur();
        state.ui.search = "";
        renderSearchResults();
      }
    },
  });

  const searchBox = h(
    "div",
    { class: "search" },
    phIcon("magnifying-glass", { class: "glyph" }),
    searchEl,
    h("span", { class: "kbd" }, "⌘ K"),
  );

  const wrap = h("div", { class: "search-wrap" }, searchBox);
  const resultsContainer = h("div", { id: "search-results-host" });
  wrap.append(resultsContainer);

  // Cache the input for ⌘K focus
  setTimeout(() => {
    window.__searchInput = searchEl;
  }, 0);

  return h(
    "div",
    { class: "header" },
    h(
      "div",
      { class: "greet" },
      `${timeOfDayGreeting()}, `,
      h("span", { class: "accent", id: "greeting-name" }, settings.name),
      ".",
      h("span", { class: "time" }, "· " + nowTime()),
    ),
    wrap,
    h(
      "button",
      {
        class: "icon-btn",
        title: settings.dark ? "Light mode" : "Dark mode",
        onClick: () => {
          state.settings.dark = !state.settings.dark;
          saveSettings();
          render();
        },
      },
      phIcon(settings.dark ? "sun" : "moon"),
    ),
    h(
      "button",
      {
        class: "icon-btn",
        title: "Customize",
        onClick: () => {
          state.ui.settingsOpen = true;
          render();
        },
      },
      phIcon("gear"),
    ),
  );
}

function renderSearchResults() {
  const host = document.getElementById("search-results-host");
  if (!host) return;
  host.textContent = "";
  const q = state.ui.search.trim().toLowerCase();
  if (!state.ui.searchFocused || !q) {
    // Update search box border state
    const sb =
      host.previousElementSibling ||
      host.parentElement.querySelector(".search");
    return;
  }
  const matches = buildSearchIndex()
    .filter(
      (l) =>
        l.label.toLowerCase().includes(q) ||
        (l.url || "").toLowerCase().includes(q),
    )
    .slice(0, 8);

  const items = [];
  if (matches.length) {
    items.push(h("div", { class: "sr-group" }, "Bookmarks"));
    for (const m of matches) {
      items.push(
        h(
          "a",
          {
            class: "sr-item",
            href: m.url || "#",
            onMousedown: (e) => e.preventDefault(),
          },
          favTile(m, "sr-fav"),
          h(
            "div",
            { style: { flex: 1, minWidth: 0 } },
            h(
              "div",
              { style: { fontSize: "14px", color: "var(--ink)" } },
              m.label,
            ),
            h(
              "div",
              {
                style: {
                  fontSize: "11px",
                  color: "var(--ink-3)",
                  fontFamily: "JetBrains Mono, monospace",
                },
              },
              displayUrl(m.url) || `in ${m.folder.toLowerCase()}`,
            ),
          ),
          h("span", { class: "sr-folder" }, m.folder),
        ),
      );
    }
    items.push(h("div", { class: "popmenu-sep" }));
  } else {
    items.push(
      h(
        "div",
        { class: "sr-empty" },
        'No bookmarks match "',
        h("b", {}, state.ui.search.trim()),
        '".',
      ),
    );
    items.push(h("div", { class: "popmenu-sep" }));
  }

  items.push(
    h(
      "a",
      {
        class: "sr-item",
        href:
          "https://www.google.com/search?q=" +
          encodeURIComponent(state.ui.search.trim()),
        onMousedown: (e) => e.preventDefault(),
      },
      h(
        "span",
        { class: "sr-fav", style: { background: state.settings.accent } },
        "G",
      ),
      h(
        "div",
        { style: { flex: 1 } },
        h(
          "div",
          { style: { fontSize: "14px" } },
          'Search the web for "',
          h("b", {}, state.ui.search.trim()),
          '"',
        ),
        h(
          "div",
          {
            style: {
              fontSize: "11px",
              color: "var(--ink-3)",
              fontFamily: "JetBrains Mono, monospace",
            },
          },
          "google.com",
        ),
      ),
      h(
        "span",
        {
          style: {
            fontSize: "11px",
            color: "var(--ink-3)",
            fontFamily: "JetBrains Mono, monospace",
          },
        },
        "↵",
      ),
    ),
  );

  host.append(h("div", { class: "search-results" }, ...items));
}

function bookmarkDropZoneAttrs(folderId, pinned, index = null) {
  return {
    onDragover: (e) => {
      const payload = currentDragPayload(e);
      if (payload?.type !== "bookmark") return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      e.currentTarget.classList.add("drag-over");
    },
    onDragleave: (e) => {
      e.currentTarget.classList.remove("drag-over");
    },
    onDrop: (e) => {
      const payload = currentDragPayload(e);
      if (payload?.type !== "bookmark") return;
      e.preventDefault();
      e.stopPropagation();
      e.currentTarget.classList.remove("drag-over");
      let targetIndex = index;
      if (targetIndex !== null) {
        const rect = e.currentTarget.getBoundingClientRect();
        const after = pinned
          ? e.clientX > rect.left + rect.width / 2
          : e.clientY > rect.top + rect.height / 2;
        if (after) targetIndex++;
      }
      moveBookmark(payload, folderId, pinned, targetIndex);
    },
  };
}

function renderBookmarkItem(link, folderId, pinned, index) {
  const cls = pinned ? "pin bookmark-item" : "link bookmark-item";
  const openCls = pinned ? "pin-open" : "link-open";
  return h(
    "div",
    {
      class: cls,
      draggable: "true",
      title: displayUrl(link.url) || link.label,
      onDragstart: (e) => {
        e.stopPropagation();
        state.ui.draggingBookmark = { type: "bookmark", folderId, pinned, index };
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData(
          "application/json",
          bookmarkPayload(folderId, pinned, index),
        );
      },
      onDragend: () => {
        state.ui.draggingBookmark = null;
        document
          .querySelectorAll(".drag-over")
          .forEach((el) => el.classList.remove("drag-over"));
      },
      ...bookmarkDropZoneAttrs(folderId, pinned, index),
    },
    h(
      "a",
      {
        class: openCls,
        href: link.url || "#",
        onClick: (e) => {
          if (!link.url) e.preventDefault();
        },
      },
      favTile(link),
      h("span", { class: pinned ? "pin-label" : "link-name" }, link.label),
    ),
    h(
      "span",
      { class: "bookmark-actions" },
      h(
        "button",
        {
          class: "bookmark-action",
          title: "Edit bookmark",
          onClick: (e) => {
            e.preventDefault();
            e.stopPropagation();
            openEditBookmark(folderId, pinned, index);
          },
        },
        phIcon("pencil"),
      ),
      h(
        "button",
        {
          class: "bookmark-action",
          title: pinned ? "Unpin bookmark" : "Pin bookmark",
          onClick: (e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleBookmarkPinned(folderId, pinned, index);
          },
        },
        phIcon("star"),
      ),
      h(
        "button",
        {
          class: "bookmark-action danger",
          title: "Remove",
          onClick: (e) => {
            e.preventDefault();
            e.stopPropagation();
            deleteBookmark(folderId, pinned, index);
          },
        },
        phIcon("x"),
      ),
    ),
  );
}

function folderDropAttrs(folderId) {
  return {
    onDragover: (e) => {
      const payload = currentDragPayload(e);
      if (payload?.type !== "folder" || payload.folderId === folderId) return;
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = "move";
      e.currentTarget.closest(".folder")?.classList.add("drag-over");
    },
    onDragleave: (e) => {
      e.currentTarget.closest(".folder")?.classList.remove("drag-over");
    },
    onDrop: (e) => {
      const payload = currentDragPayload(e);
      if (payload?.type !== "folder") return;
      e.preventDefault();
      e.stopPropagation();
      e.currentTarget.closest(".folder")?.classList.remove("drag-over");
      const rect = e.currentTarget.getBoundingClientRect();
      moveFolder(payload.folderId, folderId, e.clientY > rect.top + rect.height / 2);
    },
  };
}

function renderFolder(folder) {
  const { ui, bookmarks } = state;
  const fb = bookmarks[folder.id] || { pinned: [], rest: [] };
  const isOpen = ui.openFolders.has(folder.id);
  const isEditing = ui.editingFolderId === folder.id;
  const menuOpen = ui.folderMenuId === folder.id;

  const nameEl = h(
    "span",
    {
      class: "folder-name",
      contentEditable: isEditing,
      onDblclick: (e) => {
        e.stopPropagation();
        startEditFolder(folder.id);
      },
      onBlur: (e) => commitEditFolder(folder.id, e.target.textContent),
      onKeydown: (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          e.target.blur();
        }
        if (e.key === "Escape") {
          e.target.textContent = folder.name;
          state.ui.editingFolderId = null;
          render();
        }
      },
    },
    folder.name,
  );

  const head = h(
    "div",
    {
      class: "folder-head",
      draggable: "true",
      onClick: () => {
        if (!isEditing) toggleFolder(folder.id);
      },
      onDragstart: (e) => {
        e.stopPropagation();
        state.ui.draggingFolderId = folder.id;
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("application/json", folderPayload(folder.id));
      },
      onDragend: () => {
        state.ui.draggingFolderId = null;
        document
          .querySelectorAll(".drag-over")
          .forEach((el) => el.classList.remove("drag-over"));
      },
      ...folderDropAttrs(folder.id),
    },
    h("span", {
      class: "folder-dot",
      style: { background: folder.color },
      onClick: (e) => {
        e.stopPropagation();
        toggleFolderMenu(folder.id);
      },
      title: "Folder options",
    }),
    nameEl,
    h(
      "span",
      { class: "folder-count" },
      String(fb.pinned.length + fb.rest.length),
    ),
    h("span", { class: "folder-spacer" }),
    h(
      "button",
      {
        class: "folder-menu-btn",
        onClick: (e) => {
          e.stopPropagation();
          toggleFolderMenu(folder.id);
        },
        title: "Options",
      },
      phIcon("dots-three"),
    ),
    phIcon("caret-down", { class: "chev" }),
  );

  const body = isOpen
    ? h(
        "div",
        { class: "folder-body" },
        ...(fb.pinned.length
          ? [
              h("div", { class: "section-label" }, phIcon("star"), "Pinned"),
              h(
                "div",
                {
                  class: "pinned-row drop-zone",
                  ...bookmarkDropZoneAttrs(folder.id, true),
                },
                ...fb.pinned.map((l, i) =>
                  renderBookmarkItem(l, folder.id, true, i),
                ),
              ),
            ]
          : []),
        h("div", { class: "section-label" }, "All"),
        h(
          "div",
          { class: "all-grid drop-zone", ...bookmarkDropZoneAttrs(folder.id, false) },
          ...fb.rest.map((l, i) =>
            renderBookmarkItem(l, folder.id, false, i),
          ),
          h(
            "button",
            {
              class: "add-link",
              onClick: () => openAddBookmark(folder.id),
            },
            phIcon("plus", { class: "add-icon" }),
            h("span", { style: { color: "var(--ink-3)" } }, "Add bookmark"),
          ),
        ),
      )
    : null;

  const menu = menuOpen
    ? h(
        "div",
        { class: "popmenu" },
        h(
          "div",
          {
            class: "popmenu-item",
            onClick: () => {
              startEditFolder(folder.id);
              state.ui.folderMenuId = null;
              render();
            },
          },
          phIcon("pencil", { class: "menu-icon" }),
          " Rename",
        ),
        h(
          "div",
          { class: "color-row" },
          ...CAT_COLORS.map((c) =>
            h("div", {
              class: "color-sw" + (c === folder.color ? " active" : ""),
              style: { background: c },
              title: c,
              onClick: () => {
                recolorFolder(folder.id, c);
                state.ui.folderMenuId = null;
                render();
              },
            }),
          ),
        ),
        h("div", { class: "popmenu-sep" }),
        h(
          "div",
          {
            class: "popmenu-item danger",
            onClick: () => {
              deleteFolder(folder.id);
              state.ui.folderMenuId = null;
              render();
            },
          },
          phIcon("trash", { class: "menu-icon" }),
          " Delete folder",
        ),
      )
    : null;

  return h(
    "div",
    { class: "folder" + (isOpen ? " open" : "") },
    head,
    menu,
    body,
  );
}

function renderMain() {
  const folders = state.folders;
  return h(
    "div",
    { class: "main" },
    ...folders.map(renderFolder),
    h(
      "button",
      { class: "add-folder-row", onClick: openAddFolder },
      phIcon("plus"),
      h("span", {}, "New folder"),
    ),
    folders.length === 0
      ? h(
          "div",
          { class: "empty" },
          'No folders yet. Click "New folder" above to start organizing.',
        )
      : null,
  );
}

// ─── Widgets ────────────────────────────────────────────────

function widgetRow(left, right, opts = {}) {
  return h(
    "div",
    { class: "widget-row" },
    h("span", { style: { flex: 1, ...opts.leftStyle } }, left),
    h("span", { style: { ...opts.rightStyle } }, right),
  );
}

function renderWidgetBody(kind) {
  switch (kind) {
    case "weather":
      if (state.weather.status === "loading" || state.weather.status === "idle") {
        return [
          h("div", { class: "rail-title" }, "Weather · Local"),
          h("div", { class: "weather-loading" }, "Loading forecast..."),
        ];
      }

      if (state.weather.status === "error") {
        return [
          h("div", { class: "rail-title" }, "Weather · Local"),
          h("div", { class: "weather-error" }, state.weather.error || "Weather unavailable."),
          h(
            "button",
            { class: "btn weather-retry", onClick: () => loadWeatherForecast() },
            "Retry",
          ),
        ];
      }

      return [
        h("div", { class: "rail-title" }, "Weather · Local"),
        h(
          "div",
          { class: "weather-current" },
          h(
            "div",
            { class: "weather-temp" },
            `${state.weather.current.temp}°`,
          ),
          h(
            "div",
            { class: "weather-meta" },
            "Now",
            h("div", {}, `Open-Meteo · ${state.weather.unit}`),
          ),
        ),
        h("div", {
          style: {
            height: "1px",
            background: "var(--border)",
            margin: "12px 0",
          },
        }),
        h("div", { class: "weather-hours" },
          ...state.weather.upcoming.map((hour) =>
            h(
              "div",
              { class: "weather-hour" },
              h("span", {}, hour.label),
              h("b", {}, `${hour.temp}°`),
            ),
          ),
        ),
      ];
    case "agenda":
      return [
        h("div", { class: "rail-title" }, "Today"),
        ...[
          ["3:00", "Design review", "var(--cat-1)"],
          ["4:30", "1:1 with Sam", "var(--cat-1)"],
          ["6:15", "Gym", "var(--cat-5)"],
        ].map(([t, l, c]) =>
          h(
            "div",
            {
              style: {
                display: "flex",
                gap: "14px",
                padding: "10px 0",
                borderBottom: "1px solid var(--border)",
              },
            },
            h(
              "div",
              {
                style: {
                  fontFamily: "JetBrains Mono, monospace",
                  fontSize: "12px",
                  color: "var(--ink-3)",
                  width: "44px",
                },
              },
              t,
            ),
            h("div", { style: { flex: 1, fontSize: "14px" } }, l),
            h("div", {
              style: { width: "4px", background: c, borderRadius: "2px" },
            }),
          ),
        ),
        h(
          "div",
          {
            style: {
              fontSize: "12px",
              color: "var(--ink-3)",
              marginTop: "14px",
            },
          },
          "Sample data — connect Google Calendar for real events.",
        ),
      ];
    case "markets":
      return [
        h("div", { class: "rail-title" }, "Watchlist"),
        ...[
          ["AAPL", "192.41", "+0.22%", "up"],
          ["NVDA", "1,180.20", "-1.19%", "down"],
          ["TSLA", "246.88", "+2.10%", "up"],
        ].map(([t, p, pct, d]) =>
          h(
            "div",
            { class: "widget-row" },
            h(
              "span",
              {
                style: {
                  width: "60px",
                  fontFamily: "JetBrains Mono, monospace",
                  fontSize: "13px",
                  fontWeight: 600,
                },
              },
              t,
            ),
            h(
              "span",
              {
                style: {
                  flex: 1,
                  fontFamily: "JetBrains Mono, monospace",
                  fontSize: "13px",
                  color: "var(--ink-2)",
                },
              },
              p,
            ),
            h(
              "span",
              {
                class: d,
                style: {
                  fontFamily: "JetBrains Mono, monospace",
                  fontSize: "12px",
                },
              },
              pct,
            ),
          ),
        ),
        h(
          "div",
          {
            style: {
              fontSize: "12px",
              color: "var(--ink-3)",
              marginTop: "14px",
            },
          },
          "Sample data — plug in your preferred finance API.",
        ),
      ];
    case "news":
      return [
        h("div", { class: "rail-title" }, "Top stories"),
        ...[
          ["Tech", "Headline placeholder — wire up your RSS feed"],
          ["World", "Headline placeholder — see widgets.js"],
          ["Science", "Headline placeholder"],
        ].map(([k, t]) =>
          h(
            "div",
            {
              style: {
                padding: "12px 0",
                borderBottom: "1px solid var(--border)",
              },
            },
            h(
              "div",
              {
                style: {
                  fontSize: "10px",
                  color: "var(--ink-3)",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  marginBottom: "4px",
                },
              },
              k,
            ),
            h(
              "div",
              {
                style: {
                  fontSize: "14px",
                  color: "var(--ink)",
                  lineHeight: 1.4,
                },
              },
              t,
            ),
          ),
        ),
      ];
    case "sports":
      if (state.sports.status === "loading" || state.sports.status === "idle") {
        return [
          h("div", { class: "rail-title" }, "Scores · ESPN"),
          h("div", { class: "sports-loading" }, "Loading scores..."),
        ];
      }

      if (state.sports.status === "error" || !state.sports.games.length) {
        return [
          h("div", { class: "rail-title" }, "Scores · ESPN"),
          h(
            "div",
            { class: "sports-error" },
            state.sports.error || "ESPN scores unavailable.",
          ),
          h(
            "button",
            { class: "btn sports-retry", onClick: () => loadSportsScores() },
            "Retry",
          ),
        ];
      }

      return [
        h("div", { class: "rail-title" }, "Scores · ESPN"),
        h("div", { class: "sports-list" },
          ...state.sports.games.map((game) =>
            h(
              "div",
              { class: `sports-game ${game.state}` },
              h(
                "div",
                { class: "sports-game-head" },
                h("span", { class: "sports-league" }, game.league),
                h("span", { class: "sports-status" }, game.status || game.score),
              ),
              h(
                "div",
                { class: "sports-matchup" },
                h("span", {}, `${game.away} @ ${game.home}`),
                h("b", {}, game.score),
              ),
            ),
          ),
        ),
      ];
    case "social":
      return [
        h("div", { class: "rail-title" }, "Feeds"),
        h(
          "div",
          {
            style: {
              fontSize: "14px",
              color: "var(--ink-3)",
              padding: "20px 0",
              textAlign: "center",
            },
          },
          "Connect X, Reddit, Mastodon, or RSS",
        ),
      ];
  }
}

function renderRail() {
  const tabs = h(
    "div",
    { class: "rail-tabs" },
    ...Object.keys(WIDGET_META).map((k) =>
      h(
        "button",
        {
          class: "rail-tab" + (state.ui.activeWidget === k ? " on" : ""),
          title: WIDGET_META[k].label,
          onClick: () => {
            state.ui.activeWidget = k;
            render();
          },
        },
        phIcon(WIDGET_META[k].icon),
      ),
    ),
  );
  const card = h(
    "div",
    { class: "rail-card" },
    ...renderWidgetBody(state.ui.activeWidget),
  );
  return h("div", { class: "rail" }, tabs, card);
}

// ─────────────────────────────────────────────────────────────
// Modals
// ─────────────────────────────────────────────────────────────

function modal(content, onClose) {
  return h(
    "div",
    { class: "modal-backdrop", onClick: onClose },
    h("div", { class: "modal", onClick: (e) => e.stopPropagation() }, content),
  );
}

function renderAddBookmarkModal() {
  const id = state.ui.addModalFolderId;
  if (!id) return null;
  const folders = state.folders;

  const tmp = { name: "", url: "", folderId: id, pinned: false };
  const save = () => {
    if (!tmp.name.trim() || !tmp.url.trim()) return;
    addBookmark(
      tmp.folderId,
      {
        label: tmp.name.trim(),
        letter: tmp.name.trim()[0].toUpperCase(),
        color: pickColor(tmp.name.trim()),
        url: normalizeUrl(tmp.url),
      },
      tmp.pinned,
    );
    closeAddBookmark();
  };

  const nameInput = h("input", {
    type: "text",
    placeholder: "e.g. Hacker News",
    autofocus: "true",
    onInput: (e) => {
      tmp.name = e.target.value;
      saveBtn.disabled = !tmp.name.trim() || !tmp.url.trim();
    },
    onKeydown: (e) => {
      if (e.key === "Enter") save();
    },
  });
  const urlInput = h("input", {
    type: "text",
    placeholder: "news.ycombinator.com",
    onInput: (e) => {
      tmp.url = e.target.value;
      saveBtn.disabled = !tmp.name.trim() || !tmp.url.trim();
    },
    onKeydown: (e) => {
      if (e.key === "Enter") save();
    },
  });
  const folderSelect = h(
    "select",
    {
      onChange: (e) => {
        tmp.folderId = e.target.value;
      },
    },
    ...folders.map((f) =>
      h(
        "option",
        { value: f.id, selected: f.id === id ? "selected" : null },
        f.name,
      ),
    ),
  );
  const pinCheck = h("input", {
    type: "checkbox",
    onChange: (e) => {
      tmp.pinned = e.target.checked;
    },
  });
  const saveBtn = h(
    "button",
    { class: "btn btn-primary", disabled: "disabled", onClick: save },
    "Add bookmark",
  );

  return modal(
    [
      h("h3", {}, "Add bookmark"),
      h(
        "div",
        { class: "desc" },
        "Drop it in a folder. Pin it if it's a favorite.",
      ),
      h("label", {}, "Name"),
      nameInput,
      h("label", {}, "URL"),
      urlInput,
      h("label", {}, "Folder"),
      folderSelect,
      h("label", { class: "check" }, pinCheck, " Pin to top of folder"),
      h(
        "div",
        { class: "actions" },
        h("button", { class: "btn", onClick: closeAddBookmark }, "Cancel"),
        saveBtn,
      ),
    ],
    closeAddBookmark,
  );
}

function renderEditBookmarkModal() {
  const ref = state.ui.editBookmark;
  if (!ref) return null;
  const link = getBookmarkAt(ref.folderId, ref.pinned, ref.index);
  if (!link) {
    state.ui.editBookmark = null;
    return null;
  }

  const tmp = {
    name: link.label || "",
    url: link.url || "",
    folderId: ref.folderId,
    pinned: ref.pinned,
  };
  const save = () => {
    if (!tmp.name.trim() || !tmp.url.trim()) return;
    updateBookmark(ref, {
      label: tmp.name.trim(),
      letter: tmp.name.trim()[0].toUpperCase(),
      color: link.color || pickColor(tmp.name.trim()),
      url: normalizeUrl(tmp.url),
      folderId: tmp.folderId,
      pinned: tmp.pinned,
    });
    closeEditBookmark();
  };

  const nameInput = h("input", {
    type: "text",
    value: tmp.name,
    autofocus: "true",
    onInput: (e) => {
      tmp.name = e.target.value;
      saveBtn.disabled = !tmp.name.trim() || !tmp.url.trim();
    },
    onKeydown: (e) => {
      if (e.key === "Enter") save();
    },
  });
  const urlInput = h("input", {
    type: "text",
    value: tmp.url,
    onInput: (e) => {
      tmp.url = e.target.value;
      saveBtn.disabled = !tmp.name.trim() || !tmp.url.trim();
    },
    onKeydown: (e) => {
      if (e.key === "Enter") save();
    },
  });
  const folderSelect = h(
    "select",
    {
      onChange: (e) => {
        tmp.folderId = e.target.value;
      },
    },
    ...state.folders.map((f) =>
      h(
        "option",
        { value: f.id, selected: f.id === ref.folderId ? "selected" : null },
        f.name,
      ),
    ),
  );
  const pinCheck = h("input", {
    type: "checkbox",
    checked: tmp.pinned ? "checked" : null,
    onChange: (e) => {
      tmp.pinned = e.target.checked;
    },
  });
  const saveBtn = h(
    "button",
    { class: "btn btn-primary", onClick: save },
    "Save changes",
  );

  return modal(
    [
      h("h3", {}, "Edit bookmark"),
      h(
        "div",
        { class: "desc" },
        "Update the label, URL, folder, or pinned state.",
      ),
      h("label", {}, "Name"),
      nameInput,
      h("label", {}, "URL"),
      urlInput,
      h("label", {}, "Folder"),
      folderSelect,
      h("label", { class: "check" }, pinCheck, " Pin to top of folder"),
      h(
        "div",
        { class: "actions split-actions" },
        h(
          "button",
          {
            class: "btn btn-danger",
            onClick: () => {
              deleteBookmark(ref.folderId, ref.pinned, ref.index);
              closeEditBookmark();
            },
          },
          "Delete",
        ),
        h("span", { class: "actions-spacer" }),
        h("button", { class: "btn", onClick: closeEditBookmark }, "Cancel"),
        saveBtn,
      ),
    ],
    closeEditBookmark,
  );
}

function renderAddFolderModal() {
  if (!state.ui.addFolderModal) return null;
  const tmp = { name: "", color: CAT_COLORS[0] };
  const save = () => {
    if (!tmp.name.trim()) return;
    addFolder(tmp.name.trim(), tmp.color);
    closeAddFolder();
  };

  const nameInput = h("input", {
    type: "text",
    placeholder: "e.g. Recipes",
    autofocus: "true",
    onInput: (e) => {
      tmp.name = e.target.value;
      saveBtn.disabled = !tmp.name.trim();
    },
    onKeydown: (e) => {
      if (e.key === "Enter") save();
    },
  });
  let activeSwatch;
  const colorRow = h(
    "div",
    { class: "swatches" },
    ...CAT_COLORS.map((c, i) => {
      const sw = h("div", {
        class: "swatch" + (i === 0 ? " active" : ""),
        style: { background: c, width: "32px", height: "32px" },
        onClick: () => {
          tmp.color = c;
          activeSwatch?.classList.remove("active");
          sw.classList.add("active");
          activeSwatch = sw;
        },
      });
      if (i === 0) activeSwatch = sw;
      return sw;
    }),
  );
  const saveBtn = h(
    "button",
    { class: "btn btn-primary", disabled: "disabled", onClick: save },
    "Create folder",
  );

  return modal(
    [
      h("h3", {}, "New folder"),
      h("div", { class: "desc" }, "Name it and pick a color."),
      h("label", {}, "Name"),
      nameInput,
      h("label", {}, "Color"),
      colorRow,
      h(
        "div",
        { class: "actions" },
        h("button", { class: "btn", onClick: closeAddFolder }, "Cancel"),
        saveBtn,
      ),
    ],
    closeAddFolder,
  );
}

function renderSettingsSheet() {
  if (!state.ui.settingsOpen) return null;
  const s = state.settings;
  const update = (patch) => {
    Object.assign(s, patch);
    saveSettings();
    render();
  };
  const updateGreetingName = (name) => {
    s.name = name;
    saveSettings();
    const greetingName = document.getElementById("greeting-name");
    if (greetingName) greetingName.textContent = name;
  };
  return modal(
    [
      h("h3", {}, "Customize"),
      h(
        "div",
        { class: "desc" },
        "Make the page yours. Saved across all your devices.",
      ),

      h("label", {}, "Greeting name"),
      h("input", {
        type: "text",
        value: s.name,
        onInput: (e) => updateGreetingName(e.target.value),
      }),

      h("label", {}, "Accent"),
      h(
        "div",
        { class: "swatches" },
        ...ACCENT_PRESETS.map((p) =>
          h("div", {
            class: "swatch" + (s.accent === p.color ? " active" : ""),
            style: { background: p.color },
            title: p.name,
            onClick: () => update({ accent: p.color, accentHue: p.hue }),
          }),
        ),
      ),

      h("label", {}, "Wallpaper"),
      h(
        "div",
        { class: "wp-options" },
        ...[
          ["none", "Clean", "clean"],
          ["gradient", "Tinted", "tinted"],
          ["photo", "Photo", "photo"],
        ].map(([v, lbl, cls]) =>
          h(
            "div",
            {
              class: "wp-opt " + cls + (s.wallpaper === v ? " active" : ""),
              onClick: () => update({ wallpaper: v }),
            },
            h("span", {}, lbl),
          ),
        ),
      ),

      h("label", {}, "Density"),
      h(
        "div",
        { class: "density-row" },
        ...["compact", "comfortable", "roomy"].map((d) =>
          h(
            "div",
            {
              class: "density-opt" + (s.density === d ? " active" : ""),
              onClick: () => update({ density: d }),
            },
            d,
          ),
        ),
      ),

      h(
        "label",
        { class: "check" },
        h("input", {
          type: "checkbox",
          checked: s.dark ? "checked" : null,
          onChange: (e) => update({ dark: e.target.checked }),
        }),
        " Dark mode",
      ),

      h("label", {}, "Bookmarks"),
      h(
        "div",
        { class: "setting-row" },
        h(
          "div",
          { class: "setting-copy" },
          h("div", { class: "setting-title" }, "Chrome bookmarks"),
          h(
            "div",
            { class: "setting-note" },
            canImportChromeBookmarks()
              ? "Adds new links without duplicates."
              : "Available when loaded as a Chrome extension.",
          ),
        ),
        h(
          "button",
          {
            class: "btn",
            disabled:
              !canImportChromeBookmarks() || state.ui.importingBookmarks
                ? "disabled"
                : null,
            onClick: importChromeBookmarks,
          },
          state.ui.importingBookmarks ? "Importing..." : "Import",
        ),
      ),

      h(
        "div",
        { class: "actions" },
        h(
          "button",
          {
            class: "btn btn-primary",
            onClick: () => {
              state.ui.settingsOpen = false;
              render();
            },
          },
          "Done",
        ),
      ),
    ],
    () => {
      state.ui.settingsOpen = false;
      render();
    },
  );
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
    const el =
      document.querySelector('.folder.open [contenteditable="true"]') ||
      document.querySelector('[contenteditable="true"]');
    if (el) {
      el.focus();
      const r = document.createRange();
      r.selectNodeContents(el);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(r);
    }
  }, 10);
}
function commitEditFolder(id, newName) {
  const trimmed = (newName || "").trim();
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
  saveFolders();
  saveBookmarks();
  showToast(`Deleted folder "${f.name}"`);
  render();
}
function addFolder(name, color) {
  const id = createFolderId(name);
  state.folders.push({ id, name, color });
  state.bookmarks[id] = { pinned: [], rest: [] };
  state.ui.openFolders.add(id);
  saveFolders();
  saveBookmarks();
  showToast(`Created "${name}"`);
  render();
}
function openAddFolder() {
  state.ui.addFolderModal = true;
  render();
}
function closeAddFolder() {
  state.ui.addFolderModal = false;
  render();
}

function openAddBookmark(folderId) {
  state.ui.addModalFolderId = folderId;
  render();
}
function closeAddBookmark() {
  state.ui.addModalFolderId = null;
  render();
}
function openEditBookmark(folderId, pinned, index) {
  state.ui.editBookmark = { folderId, pinned, index };
  render();
}
function closeEditBookmark() {
  state.ui.editBookmark = null;
  render();
}
function addBookmark(folderId, link, pinned) {
  state.bookmarks[folderId] = state.bookmarks[folderId] || {
    pinned: [],
    rest: [],
  };
  if (pinned) state.bookmarks[folderId].pinned.push(link);
  else state.bookmarks[folderId].rest.push(link);
  saveBookmarks();
  showToast(`Added "${link.label}"`);
  render();
}
function updateBookmark(ref, next) {
  const source = getBookmarkList(ref.folderId, ref.pinned);
  const [current] = source.splice(ref.index, 1);
  if (!current) return;

  const updated = {
    ...current,
    label: next.label,
    letter: next.letter,
    color: next.color,
    url: next.url,
  };
  const targetFolderId = next.folderId || ref.folderId;
  const targetPinned = Boolean(next.pinned);
  const target = getBookmarkList(targetFolderId, targetPinned);
  if (targetFolderId === ref.folderId && targetPinned === ref.pinned) {
    source.splice(ref.index, 0, updated);
  } else {
    target.push(updated);
    state.ui.openFolders.add(targetFolderId);
  }

  saveBookmarks();
  showToast(`Updated "${updated.label}"`);
  render();
}
function toggleBookmarkPinned(folderId, pinned, index) {
  const source = getBookmarkList(folderId, pinned);
  const [link] = source.splice(index, 1);
  if (!link) return;
  getBookmarkList(folderId, !pinned).push(link);
  saveBookmarks();
  showToast(`${pinned ? "Unpinned" : "Pinned"} "${link.label}"`);
  render();
}
function deleteBookmark(folderId, isPinned, index) {
  const fb = state.bookmarks[folderId];
  if (!fb) return;
  const list = isPinned ? fb.pinned : fb.rest;
  const [removed] = list.splice(index, 1);
  saveBookmarks();
  showToast(`Removed "${removed?.label || "bookmark"}"`);
  render();
}
function moveBookmark(payload, targetFolderId, targetPinned, targetIndex = null) {
  const sourcePinned = Boolean(payload.pinned);
  const source = getBookmarkList(payload.folderId, sourcePinned);
  const sourceIndex = Number(payload.index);
  if (!Number.isInteger(sourceIndex) || sourceIndex < 0 || sourceIndex >= source.length) return;

  const [link] = source.splice(sourceIndex, 1);
  if (!link) return;

  const target = getBookmarkList(targetFolderId, targetPinned);
  let insertAt = targetIndex;
  if (
    payload.folderId === targetFolderId &&
    sourcePinned === targetPinned &&
    insertAt !== null &&
    sourceIndex < insertAt
  ) {
    insertAt--;
  }
  if (insertAt === null || insertAt < 0 || insertAt > target.length) {
    insertAt = target.length;
  }

  target.splice(insertAt, 0, link);
  state.ui.openFolders.add(targetFolderId);
  state.ui.draggingBookmark = null;
  saveBookmarks();
  render();
}
function moveFolder(sourceId, targetId, placeAfter = false) {
  if (!sourceId || !targetId || sourceId === targetId) return;
  const sourceIndex = state.folders.findIndex((f) => f.id === sourceId);
  const targetIndex = state.folders.findIndex((f) => f.id === targetId);
  if (sourceIndex < 0 || targetIndex < 0) return;

  const [folder] = state.folders.splice(sourceIndex, 1);
  let insertAt = targetIndex + (placeAfter ? 1 : 0);
  if (sourceIndex < insertAt) insertAt--;
  state.folders.splice(insertAt, 0, folder);
  state.ui.draggingFolderId = null;
  saveFolders();
  render();
}

function canImportChromeBookmarks() {
  return typeof chrome !== "undefined" && Boolean(chrome.bookmarks?.getTree);
}

function getChromeBookmarkTree() {
  return new Promise((resolve, reject) => {
    if (!canImportChromeBookmarks()) {
      reject(new Error("Chrome bookmark import is unavailable."));
      return;
    }
    chrome.bookmarks.getTree((tree) => {
      const err = chrome.runtime?.lastError;
      if (err) reject(new Error(err.message));
      else resolve(tree || []);
    });
  });
}

function collectBookmarkGroups(nodes, path = [], groups = new Map()) {
  for (const node of nodes || []) {
    if (node.url) {
      const url = node.url.trim();
      if (!url) continue;
      const name = path.filter(Boolean).join(" / ") || "Imported Bookmarks";
      if (!groups.has(name)) groups.set(name, []);
      groups.get(name).push({ title: node.title, url });
      continue;
    }
    if (node.children?.length) {
      const title = (node.title || "").trim();
      collectBookmarkGroups(
        node.children,
        title ? [...path, title] : path,
        groups,
      );
    }
  }
  return groups;
}

async function importChromeBookmarks() {
  if (state.ui.importingBookmarks) return;
  if (!canImportChromeBookmarks()) {
    showToast("Chrome bookmark import is unavailable.");
    return;
  }

  state.ui.importingBookmarks = true;
  render();

  try {
    const tree = await getChromeBookmarkTree();
    const groups = collectBookmarkGroups(tree);
    const existingUrls = new Set();

    for (const fb of Object.values(state.bookmarks)) {
      for (const link of [...(fb?.pinned || []), ...(fb?.rest || [])]) {
        if (link.url) existingUrls.add(bookmarkUrlKey(link.url));
      }
    }

    let added = 0;
    let createdFolders = 0;

    for (const [folderName, bookmarks] of groups) {
      const links = [];
      for (const bm of bookmarks) {
        const key = bookmarkUrlKey(bm.url);
        if (!key || existingUrls.has(key)) continue;
        existingUrls.add(key);
        const label = bookmarkLabel(bm.title, bm.url);
        links.push({
          label,
          letter: label[0].toUpperCase(),
          color: pickColor(label),
          url: bm.url,
        });
      }

      if (!links.length) continue;

      let folder = state.folders.find((f) => f.name === folderName);
      if (!folder) {
        folder = {
          id: createFolderId(folderName),
          name: folderName,
          color:
            CAT_COLORS[state.folders.length % CAT_COLORS.length] ||
            pickColor(folderName),
        };
        state.folders.push(folder);
        state.bookmarks[folder.id] = { pinned: [], rest: [] };
        state.ui.openFolders.add(folder.id);
        createdFolders++;
      }

      state.bookmarks[folder.id] = state.bookmarks[folder.id] || {
        pinned: [],
        rest: [],
      };
      state.bookmarks[folder.id].rest.push(...links);
      added += links.length;
    }

    if (added > 0) {
      await saveFolders();
      await saveBookmarks();
      showToast(
        `Imported ${added} bookmark${added === 1 ? "" : "s"}${createdFolders ? ` into ${createdFolders} folder${createdFolders === 1 ? "" : "s"}` : ""}`,
      );
    } else {
      showToast("No new bookmarks to import.");
    }
  } catch (err) {
    showToast(
      err?.message ? `Import failed: ${err.message}` : "Import failed.",
    );
  } finally {
    state.ui.importingBookmarks = false;
    render();
  }
}

// ─────────────────────────────────────────────────────────────
// Render
// ─────────────────────────────────────────────────────────────

function render() {
  const s = state.settings;
  const body = document.body;

  // Body classes for theme/wp/density
  body.className = "";
  if (s.dark) body.classList.add("dark");
  body.classList.add("wp-" + s.wallpaper);
  body.classList.add("density-" + s.density);

  // Set accent custom properties
  document.documentElement.style.setProperty("--accent", s.accent);
  document.documentElement.style.setProperty("--accent-h", s.accentHue);

  const app = document.getElementById("app");
  app.textContent = "";
  app.append(
    h(
      "div",
      { class: "app" },
      renderHeader(),
      h("div", { class: "body" }, renderMain(), renderRail()),
    ),
    renderAddBookmarkModal(),
    renderEditBookmarkModal(),
    renderAddFolderModal(),
    renderSettingsSheet(),
    state.ui.toast ? h("div", { class: "toast" }, state.ui.toast) : null,
  );

  renderSearchResults();
}

// ─────────────────────────────────────────────────────────────
// Boot
// ─────────────────────────────────────────────────────────────

// Click-anywhere closes any open folder menu
document.addEventListener("mousedown", (e) => {
  if (
    state.ui.folderMenuId &&
    !e.target.closest(".popmenu") &&
    !e.target.closest(".folder-menu-btn") &&
    !e.target.closest(".folder-dot")
  ) {
    state.ui.folderMenuId = null;
    render();
  }
});

// ⌘K focus
document.addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
    e.preventDefault();
    window.__searchInput?.focus();
  }
});

// Live clock — re-render every 30s for accurate time
setInterval(() => {
  if (!state.ui.search && !state.ui.editingFolderId) render();
}, 30000);

(async () => {
  await loadState();
  render();
  loadWeatherForecast();
  loadSportsScores();
})();
