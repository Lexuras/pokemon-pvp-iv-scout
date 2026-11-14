import { initializeCacheControls } from './modules/cache-controls.js';
import { initializeCollection } from './modules/collection.js';
import { initializeNavigation } from './modules/navigation.js';
import { initializeScanner } from './modules/scanner.js';
import { initializeSettings } from './modules/settings.js';

const collection = initializeCollection();
let refreshScannerNickname = () => {};

const settings = initializeSettings({
  onChange: () => refreshScannerNickname(),
});

const scanner = initializeScanner({
  getSettings: settings.getSettings,
  renderCollection: collection.render,
});
refreshScannerNickname = scanner.refreshNickname;

initializeNavigation({
  renderCollection: collection.render,
  syncSettingsUI: settings.syncSettingsUI,
});
initializeCacheControls();

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
