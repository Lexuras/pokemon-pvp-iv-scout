import { byId, scrollBehavior } from './dom.js';

export function initializeNavigation({ renderCollection, syncSettingsUI }) {
  function setScreen(screen) {
    const collection = screen === 'collection';

    byId('scannerScreen').classList.toggle('hidden', collection);
    byId('collectionScreen').classList.toggle('hidden', !collection);
    byId('settingsScreen').classList.add('hidden');
    byId('navScanner').classList.toggle('active', !collection);
    byId('navCollection').classList.toggle('active', collection);
    byId('navSettings').classList.remove('active');

    if (collection) {
      byId('navCollection').setAttribute('aria-current', 'page');
      byId('navScanner').removeAttribute('aria-current');
    } else {
      byId('navScanner').setAttribute('aria-current', 'page');
      byId('navCollection').removeAttribute('aria-current');
    }

    byId('navSettings').removeAttribute('aria-current');
    window.scrollTo({ top: 0, behavior: scrollBehavior() });
  }

  function showScreen(screen, section = 'scanner') {
    if (screen === 'settings') {
      byId('scannerScreen').classList.add('hidden');
      byId('collectionScreen').classList.add('hidden');
      byId('settingsScreen').classList.remove('hidden');
      byId('navScanner').classList.remove('active');
      byId('navCollection').classList.remove('active');
      byId('navSettings').classList.add('active');
      byId('navScanner').removeAttribute('aria-current');
      byId('navCollection').removeAttribute('aria-current');
      byId('navSettings').setAttribute('aria-current', 'page');
      syncSettingsUI();
      window.scrollTo({ top: 0, behavior: scrollBehavior() });
      return;
    }

    const destination = section === 'collection' ? 'collection' : 'scanner';
    if (destination === 'collection') renderCollection();
    setScreen(destination);
  }

  byId('settingsBtn').addEventListener('click', () => showScreen('settings'));
  byId('navSettings').addEventListener('click', () => showScreen('settings'));
  byId('settingsBack').addEventListener('click', () => showScreen('scanner'));

  byId('navScanner').addEventListener('click', (event) => {
    event.preventDefault();
    showScreen('scanner');
  });
  byId('brandHome').addEventListener('click', (event) => {
    event.preventDefault();
    showScreen('scanner');
  });
  byId('navCollection').addEventListener('click', (event) => {
    event.preventDefault();
    showScreen('scanner', 'collection');
  });
  byId('collectionTopNav').addEventListener('click', () => {
    showScreen('scanner', 'collection');
  });
}
