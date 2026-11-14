import { NICKNAME_TEMPLATES } from './storage.js';

const NICKNAME_TOKEN_PATTERN = /\{(rank|league|dex|name|attack|defense|hp|ivPercent)\}/g;

export function buildNicknameValues({
  best,
  includeRank = false,
  pokemon,
  ivs,
}) {
  return {
    rank: includeRank && best ? best.rank : '—',
    league: includeRank && best ? best.league.slug : 'GL',
    dex: pokemon ? String(pokemon.dex).padStart(3, '0') : '000',
    name: pokemon ? pokemon.name : 'Pokémon',
    attack: ivs[0],
    defense: ivs[1],
    hp: ivs[2],
    ivPercent: Math.round(ivs.reduce((sum, value) => sum + value, 0) / 45 * 100),
  };
}

export function formatNickname(settings, values) {
  const template = settings.nicknamePreset === 'custom'
    ? settings.customTemplate
    : NICKNAME_TEMPLATES[settings.nicknamePreset];

  return template
    .replace(NICKNAME_TOKEN_PATTERN, (_match, token) => String(values[token]))
    .replace(/\s+/g, ' ')
    .trim();
}
