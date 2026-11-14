/* Pokémon GO base stats and forms: PvPoke's public Game Master. */

const GAME_MASTER_URL = 'https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/gamemaster.json';
const DATABASE_NAME = 'iv-scout-data';
const DATABASE_VERSION = 1;
const STORE_NAME = 'cache';
const POKEMON_CACHE_KEY = 'pokemon';

const CPM = [
  0.0939999967813491, 0.135137430784308, 0.166397869586944,
  0.192650914456886, 0.215732470154762, 0.236572655026622,
  0.255720049142837, 0.273530381100769, 0.290249884128570,
  0.306057381335773, 0.321087598800659, 0.335445032295077,
  0.349212676286697, 0.362457748778790, 0.375235587358474,
  0.387592411085168, 0.399567276239395, 0.411193549517250,
  0.422500014305114, 0.432926413410414, 0.443107545375824,
  0.453059953871985, 0.462798386812210, 0.472336077786704,
  0.481684952974319, 0.490855810259008, 0.499858438968658,
  0.508701756943992, 0.517393946647644, 0.525942508771329,
  0.534354329109191, 0.542635762230353, 0.550792694091796,
  0.558830599438087, 0.566754519939422, 0.574569148039264,
  0.582278907299041, 0.589887911977272, 0.597400009632110,
  0.604823657502073, 0.612157285213470, 0.619404110566050,
  0.626567125320434, 0.633649181622743, 0.640652954578399,
  0.647580963301656, 0.654435634613037, 0.661219263506722,
  0.667934000492096, 0.674581899290818, 0.681164920330047,
  0.687684905887771, 0.694143652915954, 0.700542893277978,
  0.706884205341339, 0.713169102333341, 0.719399094581604,
  0.725575616972598, 0.731700003147125, 0.734741011137376,
  0.737769484519958, 0.740785574597326, 0.743789434432983,
  0.746781208702482, 0.749761044979095, 0.752729105305821,
  0.755685508251190, 0.758630366519684, 0.761563837528228,
  0.764486065255226, 0.767397165298461, 0.770297273971590,
  0.773186504840850, 0.776064945942412, 0.778932750225067,
  0.781790064808426, 0.784636974334716, 0.787473583646825,
  0.790300011634826, 0.792803950958807, 0.795300006866455,
  0.797803921486970, 0.800300002098083, 0.802803892322847,
  0.805299997329711, 0.807803863460723, 0.810299992561340,
  0.812803834895026, 0.815299987792968, 0.817803806620319,
  0.820299983024597, 0.822803778631297, 0.825299978256225,
  0.827803750922782, 0.830299973487854, 0.832803753381377,
  0.835300028324127, 0.837803755931569, 0.840300023555755,
  0.842803729034748, 0.845300018787384, 0.847803702398935,
  0.850300014019012, 0.852803676019539, 0.855300009250640,
  0.857803649892077, 0.860300004482269, 0.862803624012168,
  0.865299999713897,
];

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => {
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
    request.onerror = () => reject(request.error);
  });
}

async function readCachedPokemon() {
  let database;

  try {
    database = await openDatabase();
    return await new Promise((resolve, reject) => {
      const request = database
        .transaction(STORE_NAME)
        .objectStore(STORE_NAME)
        .get(POKEMON_CACHE_KEY);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } catch {
    return null;
  } finally {
    database?.close();
  }
}

async function cachePokemon(value) {
  let database;

  try {
    database = await openDatabase();
    await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).put(value, POKEMON_CACHE_KEY);
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
    });
  } catch {
    // The live data can still be used when the browser cannot persist it.
  } finally {
    database?.close();
  }
}

function labelPokemonForm(pokemon) {
  if (pokemon.name.includes('(')) return pokemon;

  const normalizedName = pokemon.name
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
  const normalizedId = String(pokemon.id || '')
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, '_');
  const prefix = normalizedName.replace(/([a-z])([0-9])/g, '$1_$2');

  if (!normalizedId.startsWith(`${prefix}_`)) return pokemon;

  const suffix = normalizedId
    .slice(prefix.length + 1)
    .split('_')
    .filter(Boolean);

  if (!suffix.length) return pokemon;

  const formLabels = {
    alola: 'Alolan',
    alolan: 'Alolan',
    galar: 'Galarian',
    galarian: 'Galarian',
    hisui: 'Hisuian',
    hisuian: 'Hisuian',
    paldea: 'Paldean',
    paldean: 'Paldean',
  };
  const form = suffix
    .map((part) => formLabels[part] || part[0].toLocaleUpperCase() + part.slice(1))
    .join(' ');

  pokemon.name = `${pokemon.name} (${form})`;
  return pokemon;
}

function normalizeGameMaster(master) {
  const source = master.pokemon || master;
  const pokemon = source
    .filter((entry) => (
      entry.speciesId
      && entry.speciesName
      && entry.baseStats
      && entry.baseStats.atk > 0
      && entry.baseStats.def > 0
      && entry.baseStats.hp > 0
    ))
    .map((entry) => labelPokemonForm({
      id: entry.speciesId,
      name: entry.speciesName,
      dex: entry.dex || 0,
      atk: entry.baseStats.atk,
      def: entry.baseStats.def,
      hp: entry.baseStats.hp,
      alias: entry.aliasId || null,
      levelCap: Math.min(50, entry.levelCap || 50),
    }));

  return {
    timestamp: master.timestamp || new Date().toISOString(),
    pokemon,
  };
}

export async function loadPokemonData(onStatus = () => {}) {
  onStatus('Loading Pokémon data…');

  try {
    const response = await fetch(GAME_MASTER_URL, { cache: 'no-cache' });
    if (!response.ok) throw new Error('Game data request failed');

    const result = normalizeGameMaster(await response.json());
    await cachePokemon(result);
    return result;
  } catch (error) {
    const cached = await readCachedPokemon();

    if (cached) {
      cached.pokemon = cached.pokemon.map(labelPokemonForm);
      onStatus('Using saved Pokémon data');
      return cached;
    }

    throw error;
  }
}

function getMultiplier(level) {
  return CPM[Math.round(level * 2 - 2)];
}

export function cpAt(pokemon, ivs, level) {
  const multiplier = getMultiplier(level);

  return Math.max(10, Math.floor(
    (pokemon.atk + ivs[0])
    * Math.sqrt(pokemon.def + ivs[1])
    * Math.sqrt(pokemon.hp + ivs[2])
    * multiplier * multiplier / 10,
  ));
}

export function statsAt(pokemon, ivs, level) {
  const multiplier = getMultiplier(level);
  const attack = (pokemon.atk + ivs[0]) * multiplier;
  const defense = (pokemon.def + ivs[1]) * multiplier;
  const hp = pokemon.id === 'shedinja'
    ? 10
    : Math.max(10, Math.floor((pokemon.hp + ivs[2]) * multiplier));
  const cp = Math.max(
    10,
    Math.floor(
      attack
      * Math.sqrt((pokemon.def + ivs[1]) * (pokemon.hp + ivs[2]))
      * multiplier / 10,
    ),
  );

  return { cp, sp: attack * defense * hp };
}

export function calculateRank(pokemon, targetIVs, cpCap, maxLevel = 50) {
  const entries = [];

  for (let attack = 0; attack <= 15; attack += 1) {
    for (let defense = 0; defense <= 15; defense += 1) {
      for (let hp = 0; hp <= 15; hp += 1) {
        let best = null;

        for (let halfLevel = 2; halfLevel <= maxLevel * 2; halfLevel += 1) {
          const level = halfLevel / 2;
          const stats = statsAt(pokemon, [attack, defense, hp], level);
          if (stats.cp > cpCap) break;
          best = { ...stats, level };
        }

        if (best) entries.push({ iv: [attack, defense, hp], ...best });
      }
    }
  }

  entries.sort((left, right) => (
    right.sp - left.sp
    || left.iv[0] - right.iv[0]
    || right.iv[1] - left.iv[1]
    || right.iv[2] - left.iv[2]
  ));

  const index = entries.findIndex((entry) => (
    entry.iv[0] === targetIVs[0]
    && entry.iv[1] === targetIVs[1]
    && entry.iv[2] === targetIVs[2]
  ));

  if (index < 0) return null;

  return {
    rank: index + 1,
    total: entries.length,
    percent: entries.length ? entries[index].sp / entries[0].sp * 100 : 0,
    ...entries[index],
  };
}
