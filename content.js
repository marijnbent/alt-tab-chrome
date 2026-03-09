(() => {
  const THEME_STORAGE_KEY = 'themeMode';
  const THEME_SYSTEM = 'system';
  const THEME_LIGHT = 'light';
  const THEME_DARK = 'dark';

  // ── State ──────────────────────────────────────────────────────────────────
  let tabs = [];
  let selectedIndex = 0;
  let active = false;
  let overlay = null;
  let themeMode = THEME_SYSTEM;

  // ── Keyboard listeners ─────────────────────────────────────────────────────
  document.addEventListener('keydown', onKeyDown, true);
  document.addEventListener('keyup', onKeyUp, true);

  // Tab cycling is triggered via the commands API (background.js) because
  // Chrome intercepts Tab key events before content scripts can see them.
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'CYCLE_TABS') {
      handleCycle(msg.reverse);
    }
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local' || !changes[THEME_STORAGE_KEY]) return;
    themeMode = normalizeThemeMode(changes[THEME_STORAGE_KEY].newValue);
    applyThemeMode();
  });

  async function handleCycle(reverse) {
    if (!active) {
      // First press: fetch tabs and show switcher
      active = true;
      [tabs, themeMode] = await Promise.all([
        getTabs(),
        getThemeMode(),
      ]);
      if (!active) return; // dismissed while fetching
      selectedIndex = tabs.length > 1 ? 1 : 0;
      showOverlay();
    } else {
      // Subsequent presses: cycle forward or backward
      if (reverse) {
        selectedIndex = (selectedIndex - 1 + tabs.length) % tabs.length;
      } else {
        selectedIndex = (selectedIndex + 1) % tabs.length;
      }
      updateOverlay();
    }
  }

  function onKeyDown(e) {
    if (!active) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      dismiss();
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      moveSelection(-1);
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      moveSelection(1);
    }
  }

  function onKeyUp(e) {
    if (e.key === 'Alt' && active) {
      confirm();
    }
  }

  // ── Tab fetching ───────────────────────────────────────────────────────────
  function getTabs() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'GET_TABS' }, (tabs) => {
        resolve(tabs || []);
      });
    });
  }

  // ── Actions ────────────────────────────────────────────────────────────────
  function confirm() {
    const tab = tabs[selectedIndex];
    dismiss();
    if (tab) {
      chrome.runtime.sendMessage({ type: 'SWITCH_TAB', tabId: tab.id });
    }
  }

  function dismiss() {
    active = false;
    if (overlay) {
      overlay.remove();
      overlay = null;
    }
  }

  // ── Overlay UI ─────────────────────────────────────────────────────────────
  function showOverlay() {
    if (overlay) overlay.remove();

    overlay = document.createElement('div');
    overlay.id = '__tab_switcher_overlay__';
    overlay.innerHTML = buildHTML();
    applyStyles(overlay);
    applyThemeMode();
    document.documentElement.appendChild(overlay);

    // Click outside to dismiss
    overlay.addEventListener('mousedown', (e) => {
      if (e.target === overlay) dismiss();
    });
  }

  function updateOverlay() {
    if (!overlay) return;
    const items = overlay.querySelectorAll('.ts-item');
    items.forEach((el, i) => {
      el.classList.toggle('ts-selected', i === selectedIndex);
      if (i === selectedIndex) el.scrollIntoView({ block: 'nearest' });
    });
  }

  function buildHTML() {
    const items = tabs.map((tab, i) => {
      const favicon = tab.favIconUrl
        ? `<img class="ts-favicon" src="${escHtml(tab.favIconUrl)}" onerror="this.style.display='none'">`
        : `<span class="ts-favicon ts-favicon-fallback">⬜</span>`;
      // Three animated bars replace the 🔊 emoji — each bar gets a staggered
      // animation-delay so they bob independently like a real music visualizer.
      const audible = tab.audible
        ? `<span class="ts-audible" title="Playing audio" aria-label="Playing audio">
             <span class="ts-eq-bar" style="animation-delay:0ms"></span>
             <span class="ts-eq-bar" style="animation-delay:160ms"></span>
             <span class="ts-eq-bar" style="animation-delay:80ms"></span>
           </span>`
        : '';
      const selected = i === selectedIndex ? ' ts-selected' : '';
      const title = escHtml(truncate(tab.title, 52));
      const url = escHtml(truncate(tab.url, 52));
      return `
        <div class="ts-item${selected}" data-index="${i}">
          ${favicon}
          <div class="ts-text">
            <div class="ts-title">${title}</div>
            <div class="ts-url">${url}</div>
          </div>
          ${audible}
        </div>`;
    }).join('');

    return `
      <div class="ts-panel">
        <div class="ts-list">${items}</div>
      </div>`;
  }

  function moveSelection(direction) {
    if (!tabs.length) return;
    selectedIndex = (selectedIndex + direction + tabs.length) % tabs.length;
    updateOverlay();
  }

  function applyThemeMode() {
    if (!overlay) return;
    overlay.dataset.theme = normalizeThemeMode(themeMode);
  }

  function getThemeMode() {
    return new Promise((resolve) => {
      chrome.storage.local.get(THEME_STORAGE_KEY, (result) => {
        resolve(normalizeThemeMode(result[THEME_STORAGE_KEY]));
      });
    });
  }

  function normalizeThemeMode(value) {
    if (value === THEME_LIGHT || value === THEME_DARK) return value;
    return THEME_SYSTEM;
  }

  function applyStyles(el) {
    // Scoped CSS injected once
    if (!document.getElementById('__tab_switcher_style__')) {
      const style = document.createElement('style');
      style.id = '__tab_switcher_style__';
      style.textContent = `
        /* ── Theme tokens ─────────────────────────────────────────────────── */
        #__tab_switcher_overlay__[data-theme="dark"],
        #__tab_switcher_overlay__[data-theme="system"] {
          --ts-scrim:            rgba(0,0,0,0.45);
          --ts-panel-bg:         rgba(28,28,30,0.96);
          --ts-panel-border:     rgba(255,255,255,0.12);
          --ts-panel-shadow:     0 32px 80px rgba(0,0,0,0.6), 0 0 0 0.5px rgba(255,255,255,0.08);
          --ts-item-hover-bg:    rgba(255,255,255,0.06);
          --ts-item-selected-bg: rgba(10,132,255,0.75);
          --ts-title-color:      rgba(255,255,255,0.92);
          --ts-url-color:        rgba(255,255,255,0.38);
          --ts-url-selected:     rgba(255,255,255,0.6);
          --ts-audible-bg:       rgba(255,255,255,0.15);
          --ts-audible-bg-sel:   rgba(255,255,255,0.2);
          --ts-audible-shadow:   none;
          --ts-eq-bar-color:     rgba(255,255,255,0.85);
          --ts-eq-bar-color-sel: rgba(255,255,255,0.9);
        }

        #__tab_switcher_overlay__[data-theme="light"] {
          --ts-scrim:            rgba(0,0,0,0.25);
          --ts-panel-bg:         rgba(255,255,255,0.97);
          --ts-panel-border:     rgba(0,0,0,0.10);
          --ts-panel-shadow:     0 32px 80px rgba(0,0,0,0.18), 0 0 0 0.5px rgba(0,0,0,0.06);
          --ts-item-hover-bg:    rgba(0,0,0,0.04);
          --ts-item-selected-bg: rgba(10,132,255,0.82);
          --ts-title-color:      rgba(0,0,0,0.88);
          --ts-url-color:        rgba(0,0,0,0.38);
          --ts-url-selected:     rgba(255,255,255,0.7);
          --ts-audible-bg:       rgba(0,0,0,0.10);
          --ts-audible-bg-sel:   rgba(255,255,255,0.2);
          --ts-audible-shadow:   none;
          --ts-eq-bar-color:     rgba(0,0,0,0.55);
          --ts-eq-bar-color-sel: rgba(255,255,255,0.9);
        }

        @media (prefers-color-scheme: light) {
          #__tab_switcher_overlay__[data-theme="system"] {
            --ts-scrim:            rgba(0,0,0,0.25);
            --ts-panel-bg:         rgba(255,255,255,0.97);
            --ts-panel-border:     rgba(0,0,0,0.10);
            --ts-panel-shadow:     0 32px 80px rgba(0,0,0,0.18), 0 0 0 0.5px rgba(0,0,0,0.06);
            --ts-item-hover-bg:    rgba(0,0,0,0.04);
            --ts-item-selected-bg: rgba(10,132,255,0.82);
            --ts-title-color:      rgba(0,0,0,0.88);
            --ts-url-color:        rgba(0,0,0,0.38);
            --ts-url-selected:     rgba(255,255,255,0.7);
            --ts-audible-bg:       rgba(0,0,0,0.10);
            --ts-audible-bg-sel:   rgba(255,255,255,0.2);
            --ts-audible-shadow:   none;
            --ts-eq-bar-color:     rgba(0,0,0,0.55);
            --ts-eq-bar-color-sel: rgba(255,255,255,0.9);
          }
        }

        /* ── Overlay backdrop ──────────────────────────────────────────────── */
        #__tab_switcher_overlay__ {
          position: fixed;
          inset: 0;
          z-index: 2147483647;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--ts-scrim);
          backdrop-filter: blur(4px);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }

        /* ── Panel ─────────────────────────────────────────────────────────── */
        .ts-panel {
          background: var(--ts-panel-bg);
          border: 1px solid var(--ts-panel-border);
          border-radius: 14px;
          width: 520px;
          max-width: 90vw;
          max-height: 70vh;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          box-shadow: var(--ts-panel-shadow);
        }
        .ts-list {
          overflow-y: auto;
          padding: 6px;
          scrollbar-width: none;
        }
        .ts-list::-webkit-scrollbar { display: none; }

        /* ── Items ─────────────────────────────────────────────────────────── */
        .ts-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 10px;
          border-radius: 8px;
          cursor: pointer;
          transition: background 0.08s;
        }
        .ts-item:hover { background: var(--ts-item-hover-bg); }
        .ts-item.ts-selected { background: var(--ts-item-selected-bg); }

        /* ── Favicon ───────────────────────────────────────────────────────── */
        .ts-favicon {
          width: 16px;
          height: 16px;
          flex-shrink: 0;
          border-radius: 3px;
        }
        .ts-favicon-fallback { font-size: 14px; }

        /* ── Text ──────────────────────────────────────────────────────────── */
        .ts-text {
          overflow: hidden;
          min-width: 0;
          flex: 1;
        }
        .ts-title {
          font-size: 13px;
          font-weight: 500;
          color: var(--ts-title-color);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .ts-url {
          font-size: 11px;
          color: var(--ts-url-color);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          margin-top: 1px;
        }
        .ts-selected .ts-title { color: #fff; }
        .ts-selected .ts-url   { color: var(--ts-url-selected); }

        /* ── Audible badge ─────────────────────────────────────────────────── */
        .ts-audible {
          display: inline-flex;
          align-items: flex-end;
          justify-content: center;
          gap: 2px;
          width: 28px;
          height: 28px;
          flex-shrink: 0;
          margin-left: auto;
          border-radius: 999px;
          background: var(--ts-audible-bg);
          box-shadow: var(--ts-audible-shadow);
          padding-bottom: 7px;
        }
        .ts-item.ts-selected .ts-audible {
          background: rgba(255,255,255,0.2);
          box-shadow: none;
        }

        /* ── Equalizer bars ────────────────────────────────────────────────── */
        .ts-eq-bar {
          display: block;
          width: 3px;
          border-radius: 2px 2px 1px 1px;
          background: var(--ts-eq-bar-color);
          animation: ts-eq-bounce 600ms ease-in-out infinite alternate;
          transform-origin: bottom center;
        }
        .ts-item.ts-selected .ts-eq-bar {
          background: rgba(255,255,255,0.9);
        }

        /* Each bar has a different natural height range to feel organic */
        .ts-eq-bar:nth-child(1) { height: 5px; animation-duration: 560ms; }
        .ts-eq-bar:nth-child(2) { height: 9px; animation-duration: 480ms; }
        .ts-eq-bar:nth-child(3) { height: 6px; animation-duration: 620ms; }

        @keyframes ts-eq-bounce {
          0%   { transform: scaleY(0.25); }
          30%  { transform: scaleY(0.7);  }
          60%  { transform: scaleY(0.45); }
          100% { transform: scaleY(1);    }
        }

        /* Respect reduced-motion preference */
        @media (prefers-reduced-motion: reduce) {
          .ts-eq-bar { animation: none; transform: scaleY(0.6); }
        }
      `;
      document.documentElement.appendChild(style);
    }

    // Click on item to switch
    el.addEventListener('click', (e) => {
      const item = e.target.closest('.ts-item');
      if (item) {
        selectedIndex = parseInt(item.dataset.index, 10);
        confirm();
      }
    });
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  function truncate(str, max) {
    return str && str.length > max ? str.slice(0, max) + '…' : (str || '');
  }
  function escHtml(str) {
    return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
})();
