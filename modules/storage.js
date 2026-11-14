export const SETTINGS_STORAGE_KEY = 'iv-scout-settings';
export const COLLECTION_STORAGE_KEY = 'iv-scout-collection';

export const NICKNAME_TEMPLATES = {
  rank: 'R{rank} {league}',
  percent: '{ivPercent}%',
  exact: '{attack}/{defense}/{hp}',
  'rank-iv': 'R{rank} {league} {attack}/{defense}/{hp}',
};

const VALID_NICKNAME_PRESETS = new Set([
  ...Object.keys(NICKNAME_TEMPLATES),
  'custom',
]);

const DEFAULT_SETTINGS = {
  nicknamePreset: 'rank',
  customTemplate: 'R{rank} {league}',
  theme: 'dark',
  layoutMode: 'auto',
};

export function readSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) || '{}');

    return {
      nicknamePreset: VALID_NICKNAME_PRESETS.has(saved.nicknamePreset)
        ? saved.nicknamePreset
        : DEFAULT_SETTINGS.nicknamePreset,
      customTemplate: typeof saved.customTemplate === 'string'
        ? saved.customTemplate
        : DEFAULT_SETTINGS.customTemplate,
      theme: saved.theme === 'light' ? 'light' : 'dark',
      layoutMode: ['auto', 'phone', 'website'].includes(saved.layoutMode)
        ? saved.layoutMode
        : 'auto',
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function writeSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Settings remain usable for this session when storage is unavailable.
  }
}

export function readCollection() {
  try {
    const saved = JSON.parse(localStorage.getItem(COLLECTION_STORAGE_KEY) || '[]');
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

export function writeCollection(items) {
  try {
    localStorage.setItem(COLLECTION_STORAGE_KEY, JSON.stringify(items));
    return true;
  } catch {
    return false;
  }
}
