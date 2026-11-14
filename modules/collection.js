import { byId, escapeHtml, showToast } from './dom.js';
import {
  COLLECTION_STORAGE_KEY,
  readCollection,
  writeCollection,
} from './storage.js';

function collectionName(record) {
  return String(record?.name ?? record?.form ?? record?.species ?? 'Unknown Pokémon');
}

function normalizeCollectionText(value) {
  return String(value ?? '')
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function collectionLeagueCode(record) {
  const league = String(record?.league ?? '').trim().toLocaleUpperCase();

  if (league === 'GL' || league.includes('GREAT')) return 'GL';
  if (league === 'UL' || league.includes('ULTRA')) return 'UL';
  if (league === 'ML' || league.includes('MASTER')) return 'ML';
  return league;
}

function collectionTimestamp(record) {
  const value = record?.addedAt;
  if (value === undefined || value === null || value === '') return 0;

  const numeric = Number(value);
  if (Number.isFinite(numeric)) return numeric;

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function collectionRank(record) {
  const value = record?.rank;
  if (value === undefined || value === null || value === '') return Infinity;

  const rank = Number(String(value).replace(/^#/, ''));
  return Number.isFinite(rank) ? rank : Infinity;
}

function sortEntries(entries, sort) {
  entries.sort((left, right) => {
    if (sort === 'rank') {
      return collectionRank(left.record) - collectionRank(right.record)
        || collectionTimestamp(right.record) - collectionTimestamp(left.record)
        || left.index - right.index;
    }

    return collectionTimestamp(right.record) - collectionTimestamp(left.record)
      || left.index - right.index;
  });
}

function getCollectionDetails(record) {
  const ivText = Array.isArray(record?.iv) ? record.iv.join(' / ') : '—';
  const cpText = record?.cp === undefined || record?.cp === null || record?.cp === ''
    ? ''
    : `CP ${record.cp}`;
  const maxHp = record?.maxHp;
  const currentHp = record?.currentHp;
  const hpText = maxHp === undefined || maxHp === null || maxHp === ''
    ? ''
    : `HP ${currentHp === undefined || currentHp === null || currentHp === '' ? maxHp : currentHp}/${maxHp}`;
  const timestamp = collectionTimestamp(record);
  const dateText = timestamp
    ? new Date(timestamp).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
    : '';

  return [`IV ${ivText}`, cpText, hpText, dateText ? `Added ${dateText}` : '']
    .filter(Boolean);
}

function createCollectionItem(record, index) {
  const name = collectionName(record);
  const league = String(record?.league ?? '').trim();
  const rank = record?.rank;
  const rankText = rank === undefined || rank === null || rank === ''
    ? 'Rank unavailable'
    : `#${rank}`;
  const details = getCollectionDetails(record)
    .map((detail) => `<span>${escapeHtml(detail)}</span>`)
    .join('');
  const item = document.createElement('article');

  item.className = 'collection-item';
  item.innerHTML = `
    <div class="collection-item-main">
      <div class="collection-item-top">
        <strong class="collection-item-name">${escapeHtml(name)}</strong>
        <span class="collection-rank">${escapeHtml(rankText)}${league ? ` ${escapeHtml(league)}` : ''}</span>
      </div>
      <div class="collection-item-details">${details}</div>
    </div>
    <button
      class="collection-delete"
      type="button"
      data-delete-index="${index}"
      aria-label="Remove ${escapeHtml(name)} from collection"
    >×</button>
  `;

  return item;
}

function updateCollectionSummary(items) {
  byId('count').textContent = items.length.toLocaleString();
  byId('collectionSummary').textContent = `${items.length.toLocaleString()} saved ${items.length === 1 ? 'scan' : 'scans'}`;
  byId('clearCollectionBtn').disabled = items.length === 0;
}

export function initializeCollection() {
  function renderCollection(items = readCollection()) {
    const root = byId('collection');
    const query = normalizeCollectionText(byId('collectionSearch').value.trim());
    const league = byId('collectionLeague').value;
    const sort = byId('collectionSort').value;

    updateCollectionSummary(items);
    root.innerHTML = '';

    if (!items.length) {
      root.className = 'collection-list empty-state';
      root.textContent = 'Your confirmed scans will stay here on this device. Add one from a scan result to get started.';
      return;
    }

    const entries = items
      .map((record, index) => ({ record, index }))
      .filter(({ record }) => {
        const searchText = normalizeCollectionText(
          [collectionName(record), record?.form, record?.id].filter(Boolean).join(' '),
        );
        const matchesQuery = !query || searchText.includes(query);
        const matchesLeague = league === 'all' || collectionLeagueCode(record) === league;
        return matchesQuery && matchesLeague;
      });

    sortEntries(entries, sort);

    if (!entries.length) {
      root.className = 'collection-list empty-state';
      root.textContent = 'No scans match this search and league filter.';
      return;
    }

    root.className = 'collection-list';
    const fragment = document.createDocumentFragment();

    for (const { record, index } of entries) {
      fragment.append(createCollectionItem(record, index));
    }

    root.append(fragment);
  }

  byId('collectionSearch').addEventListener('input', () => renderCollection());
  for (const controlId of ['collectionLeague', 'collectionSort']) {
    byId(controlId).addEventListener('change', () => renderCollection());
  }

  byId('collection').addEventListener('click', (event) => {
    const button = event.target.closest('button[data-delete-index]');
    if (!button) return;

    const index = Number(button.dataset.deleteIndex);
    const saved = readCollection();
    if (!Number.isInteger(index) || index < 0 || index >= saved.length) return;

    saved.splice(index, 1);
    if (!writeCollection(saved)) {
      showToast('Could not update your collection on this device');
      return;
    }

    renderCollection();
    showToast('Removed from your collection');
  });

  byId('clearCollectionBtn').addEventListener('click', () => {
    if (readCollection().length) byId('clearCollectionDialog').showModal();
  });

  byId('cancelClear').addEventListener('click', () => {
    byId('clearCollectionDialog').close();
  });

  byId('confirmClear').addEventListener('click', () => {
    if (!writeCollection([])) {
      showToast('Could not clear your collection on this device');
      return;
    }

    byId('clearCollectionDialog').close();
    renderCollection();
    showToast('Collection cleared');
  });

  byId('clearCollectionDialog').addEventListener('click', (event) => {
    if (event.target === byId('clearCollectionDialog')) {
      byId('clearCollectionDialog').close();
    }
  });

  window.addEventListener('storage', (event) => {
    if (event.key === COLLECTION_STORAGE_KEY) renderCollection();
  });

  renderCollection();
  return { render: renderCollection };
}
