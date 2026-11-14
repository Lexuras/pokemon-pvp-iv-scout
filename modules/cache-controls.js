import { byId, showToast } from './dom.js';

const OWN_CACHE_PREFIX = 'iv-scout-';
const POKEMON_DATABASE_NAME = 'iv-scout-data';

function deleteDatabase(name) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error || new Error('Could not delete the Pokémon data cache'));
    request.onblocked = () => {
      byId('resetCache').textContent = 'Waiting for other tabs…';
      showToast('Waiting for other IV Scout tabs to release the data cache…');
    };
  });
}

export function initializeCacheControls() {
  byId('resetCache').addEventListener('click', async () => {
    const shouldReset = window.confirm(
      'Clear IV Scout’s cached app files and Pokémon data? Your collection and Settings will be kept. The app will reload and fetch fresh data. The browser’s general cache is not affected.',
    );
    if (!shouldReset) return;

    const button = byId('resetCache');
    button.disabled = true;
    button.textContent = 'Resetting…';

    try {
      if (!('caches' in window) || !('indexedDB' in window)) {
        throw new Error('This browser does not support app cache reset');
      }

      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter((name) => name.startsWith(OWN_CACHE_PREFIX))
          .map((name) => caches.delete(name)),
      );
      await deleteDatabase(POKEMON_DATABASE_NAME);

      showToast('App cache reset. Reloading…');
      window.setTimeout(() => location.reload(), 500);
    } catch {
      button.disabled = false;
      button.textContent = 'Reset app cache';
      showToast('Could not reset the app cache. Close other IV Scout tabs and try again.');
    }
  });
}
