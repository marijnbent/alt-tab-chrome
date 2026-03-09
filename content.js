(() => {
  // ── State ──────────────────────────────────────────────────────────────────
  let tabs = [];
  let selectedIndex = 0;
  let active = false;
  let overlay = null;

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

  async function handleCycle(reverse) {
    if (!active) {
      // First press: fetch tabs and show switcher
      active = true;
      tabs = await getTabs();
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
    if (e.key === 'Escape' && active) {
      e.preventDefault();
      dismiss();
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
        </div>`;
    }).join('');

    return `
      <div class="ts-panel">
        <div class="ts-header">Tabs</div>
        <div class="ts-list">${items}</div>
        <div class="ts-hint">
          <kbd>⌥ Tab</kbd> cycle &nbsp;·&nbsp; <kbd>⌥ ⇧ Tab</kbd> back &nbsp;·&nbsp; release <kbd>⌥</kbd> to switch &nbsp;·&nbsp; <kbd>Esc</kbd> cancel
        </div>
      </div>`;
  }

  function applyStyles(el) {
    // Scoped CSS injected once
    if (!document.getElementById('__tab_switcher_style__')) {
      const style = document.createElement('style');
      style.id = '__tab_switcher_style__';
      style.textContent = `
        #__tab_switcher_overlay__ {
          position: fixed;
          inset: 0;
          z-index: 2147483647;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(0,0,0,0.45);
          backdrop-filter: blur(4px);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }
        .ts-panel {
          background: rgba(28,28,30,0.96);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 14px;
          width: 520px;
          max-width: 90vw;
          max-height: 70vh;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          box-shadow: 0 32px 80px rgba(0,0,0,0.6), 0 0 0 0.5px rgba(255,255,255,0.08);
        }
        .ts-header {
          padding: 12px 16px 8px;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.35);
        }
        .ts-list {
          overflow-y: auto;
          padding: 0 6px 6px;
          scrollbar-width: none;
        }
        .ts-list::-webkit-scrollbar { display: none; }
        .ts-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 10px;
          border-radius: 8px;
          cursor: pointer;
          transition: background 0.08s;
        }
        .ts-item:hover { background: rgba(255,255,255,0.06); }
        .ts-item.ts-selected { background: rgba(10,132,255,0.75); }
        .ts-favicon {
          width: 16px;
          height: 16px;
          flex-shrink: 0;
          border-radius: 3px;
        }
        .ts-favicon-fallback { font-size: 14px; }
        .ts-text {
          overflow: hidden;
          min-width: 0;
        }
        .ts-title {
          font-size: 13px;
          font-weight: 500;
          color: rgba(255,255,255,0.92);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .ts-url {
          font-size: 11px;
          color: rgba(255,255,255,0.38);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          margin-top: 1px;
        }
        .ts-selected .ts-url { color: rgba(255,255,255,0.6); }
        .ts-hint {
          padding: 8px 16px 10px;
          font-size: 11px;
          color: rgba(255,255,255,0.25);
          border-top: 1px solid rgba(255,255,255,0.07);
        }
        .ts-hint kbd {
          background: rgba(255,255,255,0.1);
          border-radius: 4px;
          padding: 1px 5px;
          font-family: inherit;
          font-size: 11px;
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
