const THEME_STORAGE_KEY = 'themeMode';
const THEME_SYSTEM = 'system';
const THEME_LIGHT = 'light';
const THEME_DARK = 'dark';
const openShortcutsButton = document.getElementById('open-shortcuts');
const themeInputs = Array.from(document.querySelectorAll('input[name="theme-mode"]'));

initThemePicker();

openShortcutsButton?.addEventListener('click', async () => {
  try {
    await chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
    window.close();
  } catch {
    openShortcutsButton.disabled = true;
    openShortcutsButton.textContent = 'Shortcut page unavailable';
  }
});

async function initThemePicker() {
  const themeMode = await getThemeMode();
  applyPopupTheme(themeMode);

  const selectedInput = themeInputs.find((input) => input.value === themeMode);
  if (selectedInput) selectedInput.checked = true;

  themeInputs.forEach((input) => {
    input.addEventListener('change', async () => {
      if (!input.checked) return;
      const nextThemeMode = normalizeThemeMode(input.value);
      applyPopupTheme(nextThemeMode);
      await chrome.storage.local.set({ [THEME_STORAGE_KEY]: nextThemeMode });
    });
  });
}

function applyPopupTheme(themeMode) {
  document.documentElement.dataset.theme = resolveThemeMode(themeMode);
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

function resolveThemeMode(themeMode) {
  if (themeMode === THEME_LIGHT || themeMode === THEME_DARK) return themeMode;
  return window.matchMedia('(prefers-color-scheme: light)').matches ? THEME_LIGHT : THEME_DARK;
}
