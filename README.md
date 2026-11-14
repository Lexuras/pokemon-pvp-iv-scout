# IV Scout

IV Scout is an installable static web app for uploading a Pokémon GO appraisal screenshot, checking the detected details, and comparing stat-product ranks by Pokémon form.

## Project structure

```text
index.html                 Semantic page structure and accessible controls
styles.css                 Design tokens, base styles, components, themes, and responsive layouts
app.js                     Small composition entry point for the app modules
modules/
  pokemon-data.js           Game Master loading, IndexedDB cache, CP, stats, and rank calculations
  ocr.js                    On-device screenshot recognition and IV bar reading
  scanner.js                Camera, manual entry, scan results, and save-to-collection flow
  collection.js             Collection display, search, sorting, deletion, and clearing
  settings.js               Settings state, theme, layout selection, and responsive detection
  navigation.js             Scanner, collection, and Settings screen navigation
  cache-controls.js         App cache and Pokémon data reset action
  nickname.js               Nickname template formatting
  storage.js                Existing Settings and collection localStorage records
  dom.js                    Small shared DOM, escaping, toast, and motion helpers
sw.js                       Offline precache and static asset cache behavior
```

The JavaScript files use browser-native ES modules. Pokémon data and rank calculations stay independent of DOM updates. Settings remain under `iv-scout-settings`; collection records remain under `iv-scout-collection` with their existing fields. Screenshot OCR runs on-device. Game Master data is fetched when online and falls back to the existing IndexedDB cache while offline.

## Run the static app locally

From this directory, start a local HTTP server:

```sh
python3 -m http.server 8000
```

Open [http://localhost:8000](http://localhost:8000). The app has no build step or package installation. A local HTTP server supports the service worker and local app cache; camera access and installation on a phone require an HTTPS origin. For iPhone Safari, deploy the static files to HTTPS.

The first successful data load requires internet access. Screenshot OCR uses Tesseract.js in the browser and does not upload the image. On first use, its library, WebAssembly core, and English language model are downloaded from CDNs; offline OCR depends on the browser retaining those files. Review the detected name, form, CP, HP, and IV values before saving a scan.

## Ranking method

For the selected Pokémon form, the app evaluates all 4,096 Attack/Defense/HP IV spreads. It picks each spread's highest half-level at or below the league CP limit (up to level 50), computes the Pokémon GO CP and battle stats, and sorts by stat product. Great League and Ultra League are ruled out when the entered current CP is above their caps. Master League has no CP cap. Rank is species/form-specific; the same IVs can rank differently for an unevolved Pokémon and its evolution.

The rank is a stat-product IV rank, not PvPoke's battle/meta ranking. It does not account for moves, shadows' damage modifiers, acquisition-level floors, or Best Buddy level 51.

## Data and cache behavior

Pokémon GO base stats and form names are loaded from [PvPoke's Game Master](https://github.com/pvpoke/pvpoke/blob/master/src/data/gamemaster.json). PvPoke's source is available under the MIT License; the notice is preserved in [LICENSE.pvpoke](LICENSE.pvpoke).

The Scanner's **Reset app cache** action deletes only CacheStorage entries with the `iv-scout-` prefix and the `iv-scout-data` Pokémon IndexedDB database, then reloads the app. It leaves the collection and Settings in localStorage intact and does not clear the browser's general cache.

This repository contains only static app files; it has no build scripts or deployment workflow. The Scanner therefore shows the static version/build labels as unversioned and not generated. Maintain those labels in `index.html` if a release process is added later.

## Future Node/Vite integration

The module boundaries are already standard ES module imports, so a future Vite site can use `index.html` and `app.js` as its initial entry point and then move these modules into the site's source tree. Configure the app's data and public asset paths for the chosen deployment base, and keep the service worker precache list aligned with emitted files. A future design system can replace or supplement `styles.css` with Tailwind or another styling approach without moving Pokémon calculations, OCR, storage, and screen controllers into one global script.
