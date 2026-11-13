# IV Scout

An iPhone-oriented installable web app for uploading a Pokémon GO appraisal screenshot, confirming detected details, and checking stat-product ranks by Pokémon form.

## Run it

Serve this directory from an HTTPS origin, then open it in iPhone Safari. Camera access and service workers require a secure origin. For a quick Mac-only preview, `python3 -m http.server 8000` works for layout and manual entry, but it does not provide iPhone camera access or installability.

The app downloads the PvPoke Game Master when online and stores normalized Pokémon data in IndexedDB for later offline use. The first successful load requires internet access. Screenshot OCR runs locally in the browser with Tesseract.js; it uses no API key and does not upload the image. On first use, the OCR library, WebAssembly core, and English language model are downloaded from CDNs. Offline OCR is available only if the browser retained those downloaded files. Name, CP, and displayed current/max HP are read from cropped appraisal-screen areas; IV values are read from the three colored appraisal bars and should still be reviewed before saving. If multiple forms share the same displayed name in Pokémon GO, confirm the form in the Pokémon field before trusting its rank.

## Ranking method

For the selected Pokémon form, the app evaluates each of the 4,096 Attack/Defense/Stamina IV spreads. It picks each spread's highest half-level at or below the league CP limit (up to level 50), computes the Pokémon GO CP and battle stats, and sorts by stat product. Great League and Ultra League are ruled out when the entered current CP is above their caps. Master League has no CP cap. Rank is species/form-specific; the same IVs can rank differently for an unevolved Pokémon and its evolution.

The rank is a stat-product IV rank, not PvPoke's battle/meta ranking. It does not account for moves, shadows' damage modifiers, acquisition-level floors, or Best Buddy level 51.

## Data

Pokémon GO base stats and form names are loaded from [PvPoke's Game Master](https://github.com/pvpoke/pvpoke/blob/master/src/data/gamemaster.json). PvPoke's source is available under the MIT License; the notice is preserved in [LICENSE.pvpoke](LICENSE.pvpoke).


## Settings and app cache

Nickname formats and the Dark or Light theme are saved in localStorage under the app's settings key. The Scanner screen's **Reset app cache** action asks before deleting only CacheStorage entries named with IV Scout's `iv-scout-` prefix and the `iv-scout-data` Pokémon IndexedDB database, then reloads the app. It leaves the collection and settings intact and does not clear the browser's general cache.

This repository contains only static app files; it has no build scripts or deployment workflow. The Scanner's app version, build identifier, and build time are therefore explicitly shown as unversioned, not generated, and not recorded. Maintain those static labels in `index.html` when a release process begins; do not treat them as generated release metadata.
