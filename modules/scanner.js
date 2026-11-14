import { calculateRank, cpAt, loadPokemonData } from './pokemon-data.js';
import { scanScreenshot } from './ocr.js';
import { buildNicknameValues, formatNickname } from './nickname.js';
import { byId, escapeHtml, scrollBehavior, showToast } from './dom.js';
import { readCollection, writeCollection } from './storage.js';

const LEAGUES = [
  { name: 'Great League', cap: 1500, slug: 'GL' },
  { name: 'Ultra League', cap: 2500, slug: 'UL' },
  { name: 'Master League', cap: null, slug: 'ML' },
];

const IV_STATS = ['attack', 'defense', 'hp'];

export function initializeScanner({ getSettings, renderCollection }) {
  let pokemonData = null;
  let selectedPokemon = null;
  let lastResults = [];
  let cameraStream = null;
  let cameraFacing = 'environment';
  let activePreviewUrl = null;

  function readIVs() {
    return IV_STATS.map((stat) => Number(byId(stat).value));
  }

  function hideResults() {
    byId('results').classList.add('hidden');
  }

  function findSelectedPokemon() {
    const name = byId('pokemon').value.trim();

    return pokemonData?.pokemon.find((pokemon) => (
      pokemon.name.toLocaleLowerCase() === name.toLocaleLowerCase()
    )) || null;
  }

  function updateNickname(best, includeRank) {
    const hasEligibleLeague = includeRank && Boolean(best);
    const nickname = byId('nickname');
    const help = byId('nicknameHelp');

    nickname.textContent = hasEligibleLeague
      ? formatNickname(getSettings(), buildNicknameValues({
        best,
        includeRank: true,
        pokemon: selectedPokemon,
        ivs: readIVs(),
      }))
      : 'No league nickname';
    help.textContent = hasEligibleLeague
      ? `Uses the highest eligible league: ${best.league.name}.`
      : 'This Pokémon is currently above all shown league caps.';
  }

  function updateNicknamePreview() {
    const resultsVisible = !byId('results').classList.contains('hidden');
    const best = resultsVisible ? lastResults.find((result) => result.eligible) : null;
    const values = buildNicknameValues({
      best,
      includeRank: resultsVisible && Boolean(best),
      pokemon: selectedPokemon,
      ivs: readIVs(),
    });

    byId('nicknamePreview').textContent = formatNickname(getSettings(), values);
  }

  function refreshNickname() {
    const resultsVisible = !byId('results').classList.contains('hidden');
    const best = lastResults.find((result) => result.eligible);

    updateNickname(best, resultsVisible && Boolean(best));
    updateNicknamePreview();
  }

  function updateSelectedPokemon() {
    selectedPokemon = findSelectedPokemon();
    byId('analyze').disabled = !selectedPokemon;
  }

  async function enableCamera() {
    try {
      if (cameraStream) cameraStream.getTracks().forEach((track) => track.stop());

      cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: cameraFacing },
        audio: false,
      });
      byId('video').srcObject = cameraStream;
      byId('video').style.display = 'block';
      byId('cameraPlaceholder').style.display = 'none';
      document.querySelector('.scan-frame').style.display = 'block';
      byId('cameraStatus').textContent = 'LIVE';
      document.querySelector('.view-hint').style.display = 'block';
    } catch {
      showToast('Camera unavailable. Allow camera access in Safari settings.');
    }
  }

  async function initializePokemonData() {
    try {
      pokemonData = await loadPokemonData((status) => {
        byId('dataStatus').textContent = status;
      });

      const options = document.createDocumentFragment();
      pokemonData.pokemon
        .sort((left, right) => left.name.localeCompare(right.name))
        .forEach((pokemon) => {
          const option = document.createElement('option');
          option.value = pokemon.name;
          options.append(option);
        });

      byId('pokemonList').append(options);
      byId('dataStatus').textContent = `${pokemonData.pokemon.length.toLocaleString()} Pokémon and forms ready · updated ${pokemonData.timestamp}`;
      byId('dataStatus').classList.add('ready');
      byId('analyze').disabled = true;
    } catch {
      byId('dataStatus').textContent = 'Could not load Pokémon data. Open this app on an HTTPS connection with internet, then try again.';
      byId('dataStatus').classList.add('error');
    }
  }

  function createUnavailableLeagueRow(league, cp) {
    const row = document.createElement('div');
    row.className = 'league-row league-unavailable';
    row.innerHTML = `
      <div class="league-name">
        <span class="league-icon">⊘</span>
        <div>
          <strong>${league.name}</strong>
          <small>Current CP ${cp} is above the ${league.cap.toLocaleString()} cap</small>
        </div>
      </div>
      <div class="rank unavailable">
        INELIGIBLE
        <small>Cannot power down CP</small>
      </div>
    `;
    return row;
  }

  function createNoBuildLeagueRow(league) {
    const row = document.createElement('div');
    row.className = 'league-row';
    row.innerHTML = `
      <div class="league-name">
        <span class="league-icon">⊘</span>
        <div>
          <strong>${league.name}</strong>
          <small>No valid build under the CP cap</small>
        </div>
      </div>
      <div class="rank unavailable">—</div>
    `;
    return row;
  }

  function createRankedLeagueRow(league, result) {
    const row = document.createElement('div');
    const leagueIcon = ['◉', '◈', '✦'][LEAGUES.indexOf(league)];
    row.className = 'league-row';
    row.innerHTML = `
      <div class="league-name">
        <span class="league-icon">${leagueIcon}</span>
        <div>
          <strong>${league.name}</strong>
          <small>Rank among ${result.total.toLocaleString()} IV spreads · Lv ${result.level} · ${result.cp} CP</small>
        </div>
      </div>
      <div class="rank">
        #${result.rank}
        <small>${result.percent.toFixed(1)}% stat product</small>
      </div>
    `;
    return row;
  }

  function renderResults() {
    selectedPokemon = findSelectedPokemon();

    if (!selectedPokemon) {
      showToast('Choose a Pokémon from the list');
      byId('pokemon').focus();
      return;
    }

    const cp = Number(byId('currentCp').value);
    if (!Number.isFinite(cp) || cp < 10) {
      showToast('Enter the Pokémon’s current CP first');
      byId('currentCp').focus();
      return;
    }

    const ivs = readIVs();
    const name = selectedPokemon.name;
    const maxPossibleCp = cpAt(selectedPokemon, ivs, selectedPokemon.levelCap);

    if (cp > maxPossibleCp) {
      showToast(`That CP is too high for ${name} with these IVs. Maximum is ${maxPossibleCp}.`);
      byId('currentCp').focus();
      return;
    }

    byId('resultName').textContent = name;
    const leagueList = byId('leagueList');
    leagueList.innerHTML = '';
    lastResults = [];

    for (const league of LEAGUES) {
      if (league.cap && cp > league.cap) {
        leagueList.append(createUnavailableLeagueRow(league, cp));
        lastResults.push({ league, eligible: false });
        continue;
      }

      const result = calculateRank(
        selectedPokemon,
        ivs,
        league.cap || 100000,
        selectedPokemon.levelCap,
      );

      if (!result) {
        leagueList.append(createNoBuildLeagueRow(league));
        lastResults.push({ league, eligible: false });
        continue;
      }

      leagueList.append(createRankedLeagueRow(league, result));
      lastResults.push({
        league,
        eligible: true,
        rank: result.rank,
        result,
      });
    }

    const best = lastResults.find((result) => result.eligible);
    updateNickname(best, true);
    byId('copyName').disabled = !best;
    byId('savePokemon').disabled = !best;
    byId('results').classList.remove('hidden');
    updateNicknamePreview();
    byId('results').scrollIntoView({ behavior: scrollBehavior(), block: 'nearest' });
  }

  function saveCurrentPokemon() {
    const best = lastResults.find((result) => result.eligible);
    if (!best || !selectedPokemon) return;

    const saved = readCollection();
    saved.unshift({
      id: selectedPokemon.id,
      name: selectedPokemon.name,
      dex: selectedPokemon.dex,
      iv: readIVs(),
      cp: Number(byId('currentCp').value),
      currentHp: Number(byId('currentHp').value) || null,
      maxHp: Number(byId('maxHp').value) || null,
      rank: best.rank,
      league: best.league.slug,
      addedAt: Date.now(),
    });

    if (!writeCollection(saved)) {
      showToast('Could not save this scan on your device');
      return;
    }

    renderCollection();
    showToast('Added to your collection');
  }

  function showOcrSummary(name, cp, ivs, pokemonHp, rawName) {
    const summary = byId('ocrSummary');
    const fields = [];

    summary.classList.remove('hidden');
    fields.push(name
      ? `Pokémon: <strong>${escapeHtml(name.name)}</strong>`
      : `Pokémon: not recognized${rawName?.trim() ? ` (“${escapeHtml(rawName.trim())}”)` : ''} — choose it in the form below`);
    fields.push(cp
      ? `CP: <strong>${cp}</strong>`
      : 'CP: not recognized — enter it below');
    fields.push(ivs
      ? `IV bar estimates: <strong>${ivs.attack}/${ivs.defense}/${ivs.hp}</strong>`
      : 'IV bars not confidently read — set them manually below');
    fields.push(pokemonHp
      ? `Pokémon HP (current / max): <strong>${pokemonHp.current} / ${pokemonHp.max}</strong>`
      : 'Pokémon HP: not recognized — enter it below if needed');

    summary.innerHTML = `${fields.join('<br>')}<br><span>Review every value before adding the result to your collection.</span>`;
    if (!name || !cp || !ivs) summary.classList.add('warn');
  }

  async function readScreenshot(file) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('Choose an image file');
      return;
    }

    if (activePreviewUrl) URL.revokeObjectURL(activePreviewUrl);
    activePreviewUrl = URL.createObjectURL(file);
    byId('uploadPreview').src = activePreviewUrl;
    byId('uploadPreviewWrap').classList.remove('hidden');
    byId('scanProgress').classList.remove('hidden');
    byId('ocrSummary').classList.add('hidden');
    byId('uploadStatus').textContent = 'Processing on this device…';
    byId('progressBar').style.width = '0%';

    try {
      const image = await new Promise((resolve, reject) => {
        const preview = new Image();
        preview.onload = () => resolve(preview);
        preview.onerror = () => reject(new Error('This image format could not be opened.'));
        preview.src = activePreviewUrl;
      });
      await dataReady;

      const scan = await scanScreenshot(image, pokemonData, (progress) => {
        byId('progressText').textContent = progress.status === 'recognizing text'
          ? 'Reading screenshot…'
          : `Preparing OCR: ${progress.status}`;

        if (progress.status === 'recognizing text') {
          byId('progressBar').style.width = `${Math.round(progress.progress * 100)}%`;
        }
      });

      if (scan.name) {
        byId('pokemon').value = scan.name.name;
        byId('pokemon').dispatchEvent(new Event('input', { bubbles: true }));
        byId('pokemon').dispatchEvent(new Event('change', { bubbles: true }));
      }
      if (scan.cp) byId('currentCp').value = scan.cp;

      if (scan.pokemonHp) {
        byId('currentHp').value = scan.pokemonHp.current;
        byId('maxHp').value = scan.pokemonHp.max;
      } else {
        byId('currentHp').value = '';
        byId('maxHp').value = '';
      }

      if (scan.ivs) {
        for (const stat of IV_STATS) {
          byId(stat).value = scan.ivs[stat];
          byId(`${stat}Value`).textContent = scan.ivs[stat];
        }
      }

      showOcrSummary(scan.name, scan.cp, scan.ivs, scan.pokemonHp, scan.rawName);
      byId('uploadStatus').textContent = 'Screenshot processed on this device. Verify the fields below.';
      byId('scanProgress').classList.add('hidden');

      if (scan.name && scan.cp && scan.ivs && selectedPokemon) {
        renderResults();
      } else {
        showToast('Review the detected values, then finish any fields that are missing');
      }
    } catch (error) {
      byId('scanProgress').classList.add('hidden');
      byId('uploadStatus').textContent = 'Could not read this screenshot. You can still enter its details manually.';
      byId('ocrSummary').classList.remove('hidden');
      byId('ocrSummary').classList.add('warn');
      byId('ocrSummary').textContent = error.message
        || 'OCR failed. Try a clear screenshot of the appraisal screen.';
      showToast('Screenshot scan failed');
    }
  }

  for (const stat of IV_STATS) {
    byId(stat).addEventListener('input', () => {
      byId(`${stat}Value`).textContent = byId(stat).value;
      hideResults();
    });
  }

  byId('startCamera').addEventListener('click', enableCamera);
  byId('flipCamera').addEventListener('click', () => {
    cameraFacing = cameraFacing === 'environment' ? 'user' : 'environment';
    if (cameraStream) enableCamera();
  });

  byId('pokemon').addEventListener('input', () => {
    updateSelectedPokemon();

    if (selectedPokemon) {
      byId('pokemon').setCustomValidity('');
      byId('pokemon').classList.remove('invalid');
    } else if (byId('pokemon').value.trim()) {
      byId('pokemon').classList.add('invalid');
    }

    hideResults();
  });
  byId('pokemon').addEventListener('change', () => {
    updateSelectedPokemon();
    hideResults();
  });
  byId('currentCp').addEventListener('input', hideResults);

  byId('analyze').addEventListener('click', renderResults);
  byId('dismiss').addEventListener('click', hideResults);
  byId('copyName').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(byId('nickname').textContent);
      showToast('Nickname copied');
    } catch {
      showToast('Select and copy the nickname');
    }
  });
  byId('savePokemon').addEventListener('click', saveCurrentPokemon);
  byId('screenshotFile').addEventListener('change', (event) => {
    readScreenshot(event.target.files?.[0]);
  });

  const dataReady = initializePokemonData();
  updateNicknamePreview();

  return { refreshNickname };
}
