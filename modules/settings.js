import { byId } from './dom.js';
import { readSettings, writeSettings } from './storage.js';

const VALID_LAYOUT_MODES = new Set(['auto', 'phone', 'website']);

function detectAutoLayout() {
  const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
  const shortScreenEdge = Math.min(
    window.screen?.width || viewportWidth,
    window.screen?.height || viewportWidth,
  );
  const phoneLike = window.matchMedia('(pointer: coarse)').matches
    && navigator.maxTouchPoints > 0
    && shortScreenEdge <= 600;

  return viewportWidth < 800 || phoneLike ? 'phone' : 'website';
}

export function initializeSettings({ onChange = () => {} } = {}) {
  const settings = readSettings();

  function save() {
    writeSettings(settings);
  }

  function applyTheme(theme) {
    settings.theme = theme === 'light' ? 'light' : 'dark';
    document.documentElement.dataset.theme = settings.theme;
    byId('themeColor').content = settings.theme === 'light' ? '#f4f8f6' : '#101923';
  }

  function applyLayoutMode() {
    const mode = settings.layoutMode || 'auto';
    const layout = mode === 'auto' ? detectAutoLayout() : mode;

    document.documentElement.dataset.layout = layout;
    document.documentElement.dataset.layoutMode = mode;
    byId('layoutStatus').textContent = mode === 'auto'
      ? `Layout: Auto → ${layout === 'phone' ? 'Phone' : 'Website'}`
      : `Layout: ${layout === 'phone' ? 'Phone' : 'Website'} (manual)`;
    byId('layoutQuickControl').value = mode;

    document.querySelectorAll('input[name="layoutMode"]').forEach((input) => {
      input.checked = input.value === mode;
    });
  }

  function syncSettingsUI() {
    byId('nicknamePreset').value = settings.nicknamePreset;
    byId('customTemplate').value = settings.customTemplate;
    byId('customTemplateWrap').classList.toggle(
      'hidden',
      settings.nicknamePreset !== 'custom',
    );
    document.querySelector(`input[name="theme"][value="${settings.theme}"]`).checked = true;

    applyTheme(settings.theme);
    applyLayoutMode();
    onChange();
  }

  function updateNicknameSettings() {
    settings.nicknamePreset = byId('nicknamePreset').value;
    if (settings.nicknamePreset === 'custom') {
      settings.customTemplate = byId('customTemplate').value;
    }

    save();
    byId('customTemplateWrap').classList.toggle(
      'hidden',
      settings.nicknamePreset !== 'custom',
    );
    onChange();
  }

  function setLayoutMode(mode) {
    if (!VALID_LAYOUT_MODES.has(mode)) return;

    settings.layoutMode = mode;
    save();
    applyLayoutMode();
  }

  byId('nicknamePreset').addEventListener('change', updateNicknameSettings);
  byId('customTemplate').addEventListener('input', updateNicknameSettings);

  document.querySelectorAll('input[name="theme"]').forEach((input) => {
    input.addEventListener('change', () => {
      applyTheme(input.value);
      save();
    });
  });

  document.querySelectorAll('input[name="layoutMode"]').forEach((input) => {
    input.addEventListener('change', () => setLayoutMode(input.value));
  });
  byId('layoutQuickControl').addEventListener('change', (event) => {
    setLayoutMode(event.target.value);
  });

  const refreshAutoLayout = () => {
    if (settings.layoutMode === 'auto') applyLayoutMode();
  };
  window.addEventListener('resize', refreshAutoLayout);
  window.addEventListener('orientationchange', refreshAutoLayout);
  window.visualViewport?.addEventListener('resize', refreshAutoLayout);

  syncSettingsUI();

  return {
    getSettings: () => settings,
    syncSettingsUI,
  };
}
