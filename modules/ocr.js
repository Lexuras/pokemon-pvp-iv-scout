let ocrWorker;
let ocrLibraryPromise;

function loadOcrLibrary() {
  if (window.Tesseract) return Promise.resolve();
  if (ocrLibraryPromise) return ocrLibraryPromise;

  ocrLibraryPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
    script.onload = resolve;
    script.onerror = () => reject(new Error('Could not load the on-device OCR library'));
    document.head.append(script);
  });

  return ocrLibraryPromise;
}

async function getOcrWorker(onProgress) {
  await loadOcrLibrary();

  if (!ocrWorker) {
    ocrWorker = await window.Tesseract.createWorker('eng', 1, {
      workerPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/worker.min.js',
      corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5',
      langPath: 'https://tessdata.projectnaptha.com/4.0.0',
      workerBlobURL: true,
      logger: (message) => {
        if (!message.status) return;

        onProgress({
          status: message.status,
          progress: message.progress || 0,
        });
      },
    });
  }

  return ocrWorker;
}

function normalizeName(value) {
  return value
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function editDistance(left, right) {
  const row = Array.from({ length: right.length + 1 }, (_value, index) => index);

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    let diagonal = row[0];
    row[0] = leftIndex;

    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const above = row[rightIndex];
      const substitutionCost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;

      row[rightIndex] = Math.min(
        row[rightIndex] + 1,
        row[rightIndex - 1] + 1,
        diagonal + substitutionCost,
      );
      diagonal = above;
    }
  }

  return row[right.length];
}

function matchPokemonFromText(text, pokemonData) {
  if (!pokemonData) return null;

  const query = normalizeName(text);
  if (!query) return null;

  const pokemon = pokemonData.pokemon;
  const exactMatches = pokemon.filter((entry) => normalizeName(entry.name) === query);
  if (exactMatches.length === 1) return exactMatches[0];
  if (exactMatches.length > 1) return null;

  const matches = [];

  for (const entry of pokemon) {
    const name = normalizeName(entry.name);
    if (name.length < 4) continue;

    const distance = editDistance(query, name);
    if (distance <= Math.min(2, Math.floor(name.length / 5))) {
      matches.push({ pokemon: entry, distance });
    }
  }

  matches.sort((left, right) => left.distance - right.distance);

  return matches.length
    && (!matches[1] || matches[1].distance > matches[0].distance)
    ? matches[0].pokemon
    : null;
}

function cropForOcr(image, box) {
  const sourceWidth = image.naturalWidth;
  const sourceHeight = image.naturalHeight;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(sourceWidth * box.x * 2);
  canvas.height = Math.round(sourceHeight * box.y * 2);

  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(
    image,
    Math.round(sourceWidth * box.left),
    Math.round(sourceHeight * box.top),
    Math.round(sourceWidth * box.x),
    Math.round(sourceHeight * box.y),
    0,
    0,
    canvas.width,
    canvas.height,
  );

  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  for (let index = 0; index < pixels.data.length; index += 4) {
    const gray = (
      pixels.data[index] * 3
      + pixels.data[index + 1] * 6
      + pixels.data[index + 2]
    ) / 10;
    const value = Math.max(0, Math.min(255, (gray - 105) * 1.8 + 128));

    pixels.data[index] = value;
    pixels.data[index + 1] = value;
    pixels.data[index + 2] = value;
  }

  context.putImageData(pixels, 0, 0);
  return canvas;
}

async function recognizeCrop(worker, image, kind) {
  const config = kind === 'cp'
    ? {
      tessedit_pageseg_mode: '7',
      tessedit_char_whitelist: '0123456789',
      classify_bln_numeric_mode: '1',
    }
    : kind === 'pokemonHp'
      ? {
        tessedit_pageseg_mode: '7',
        tessedit_char_whitelist: '0123456789/HP hp',
        classify_bln_numeric_mode: '0',
      }
      : {
        tessedit_pageseg_mode: '7',
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz -().',
        classify_bln_numeric_mode: '0',
      };
  const box = kind === 'cp'
    ? { left: 0.40, top: 0.035, x: 0.25, y: 0.065 }
    : kind === 'pokemonHp'
      ? { left: 0.37, top: 0.46, x: 0.26, y: 0.055 }
      : { left: 0.16, top: 0.395, x: 0.68, y: 0.085 };

  if (kind !== 'cp' && kind !== 'pokemonHp') {
    config.preserve_interword_spaces = '1';
  }

  await worker.setParameters(config);
  const result = await worker.recognize(cropForOcr(image, box));
  return result.data.text?.trim() || '';
}

async function recognizePokemonName(worker, image, pokemonData) {
  const config = {
    tessedit_pageseg_mode: '7',
    tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz -().',
    classify_bln_numeric_mode: '0',
    preserve_interword_spaces: '1',
  };
  await worker.setParameters(config);
  let result = await worker.recognize(
    cropForOcr(image, { left: 0.18, top: 0.405, x: 0.64, y: 0.05 }),
  );
  let text = result.data.text?.trim() || '';
  if (matchPokemonFromText(text, pokemonData)) return text;

  await worker.setParameters({ ...config, tessedit_pageseg_mode: '6' });
  result = await worker.recognize(
    cropForOcr(image, { left: 0.12, top: 0.395, x: 0.76, y: 0.075 }),
  );
  text = result.data.text?.trim() || text;
  if (matchPokemonFromText(text, pokemonData)) return text;

  await worker.setParameters({ ...config, tessedit_pageseg_mode: '6' });
  result = await worker.recognize(image);
  const lines = (result.data.lines || [])
    .filter((line) => (
      line.bbox
      && line.bbox.y0 < image.naturalHeight * 0.49
      && line.bbox.y1 > image.naturalHeight * 0.39
    ))
    .sort((left, right) => {
      const targetY = image.naturalHeight * 0.425;
      const leftY = (left.bbox.y0 + left.bbox.y1) / 2;
      const rightY = (right.bbox.y0 + right.bbox.y1) / 2;
      return Math.abs(leftY - targetY) - Math.abs(rightY - targetY);
    });

  for (const line of lines) {
    if (matchPokemonFromText(line.text, pokemonData)) return line.text.trim();
  }

  for (const line of (result.data.text || '').split(/[\r\n]+/)) {
    if (matchPokemonFromText(line, pokemonData)) return line.trim();
  }

  return text;
}

function readCp(text) {
  const normalized = text.replace(/[Oo]/g, '0').replace(/[Il|]/g, '1');
  const digits = normalized.replace(/[^0-9]/g, '');
  if (digits.length < 2 || digits.length > 4) return null;

  const value = Number(digits);
  return value >= 10 && value <= 7000 ? value : null;
}

function readPokemonHp(text) {
  const normalized = text.replace(/[Oo]/g, '0').replace(/[Il|]/g, '1');
  const match = normalized.match(/(\d{1,3})\s*\/\s*(\d{1,3})/);
  if (!match) return null;

  const current = Number(match[1]);
  const max = Number(match[2]);
  return current > 0 && max >= current && max <= 500 ? { current, max } : null;
}

function isIvColor(red, green, blue) {
  const orange = red > 145 && green > 65 && red > green * 1.16 && red > blue * 1.35;
  const pink = red > 135 && blue > 75 && red > green * 1.12 && blue > green * 1.1;
  return orange || pink;
}

function estimateIvsFromBars(image) {
  const width = 1179;
  const height = Math.round(image.naturalHeight * width / image.naturalWidth);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(image, 0, 0, width, height);
  const data = context.getImageData(0, 0, width, height).data;
  const x0 = Math.round(width * 0.118);
  const x1 = Math.round(width * 0.475);
  const y0 = Math.round(height * 0.70);
  const y1 = Math.round(height * 0.89);
  const rows = [];

  for (let y = y0; y < y1; y += 1) {
    let count = 0;

    for (let x = Math.round(width * 0.13); x < x1; x += 2) {
      const index = (y * width + x) * 4;
      const red = data[index];
      const green = data[index + 1];
      const blue = data[index + 2];

      if (isIvColor(red, green, blue)) {
        count += 1;
      } else if (
        red > 185 && red < 242
        && green > 185 && green < 242
        && blue > 185 && blue < 245
        && Math.max(red, green, blue) - Math.min(red, green, blue) < 16
      ) {
        count += 0.45;
      }
    }

    rows.push({ y, count });
  }

  const peaks = [];
  for (let index = 2; index < rows.length - 2; index += 1) {
    const count = rows[index - 2].count
      + rows[index - 1].count
      + rows[index].count
      + rows[index + 1].count
      + rows[index + 2].count;

    if (
      count > 18
      && count >= rows[index - 1].count + rows[index].count + rows[index + 1].count
    ) {
      peaks.push({ y: rows[index].y, count });
    }
  }

  const clusters = [];
  for (const peak of peaks) {
    let cluster = clusters[clusters.length - 1];

    if (!cluster || peak.y - cluster.last > 10) {
      cluster = { first: peak.y, last: peak.y, peak };
      clusters.push(cluster);
    } else {
      cluster.last = peak.y;
      if (peak.count > cluster.peak.count) cluster.peak = peak;
    }
  }

  const centers = clusters.map((cluster) => cluster.peak).filter((peak) => peak.count >= 4);
  let best = null;

  for (let first = 0; first < centers.length; first += 1) {
    for (let second = first + 1; second < centers.length; second += 1) {
      for (let third = second + 1; third < centers.length; third += 1) {
        const distanceOne = centers[second].y - centers[first].y;
        const distanceTwo = centers[third].y - centers[second].y;
        if (distanceOne < 75 || distanceOne > 130 || distanceTwo < 75 || distanceTwo > 130) {
          continue;
        }

        const colorStrength = (
          centers[first].count + centers[second].count + centers[third].count
        ) / 20;
        const score = Math.abs(distanceOne - height * 0.042)
          + Math.abs(distanceTwo - height * 0.042)
          - Math.min(30, colorStrength);

        if (!best || score < best.score) {
          best = {
            score,
            rows: [centers[first].y, centers[second].y, centers[third].y],
          };
        }
      }
    }
  }

  if (!best) return null;

  const result = {};
  const stats = [
    ['attack', best.rows[0]],
    ['defense', best.rows[1]],
    ['hp', best.rows[2]],
  ];

  for (const [stat, y] of stats) {
    const values = [];
    const groupWidth = width * 0.112;
    const groupPitch = width * 0.119;

    for (let group = 0; group < 3; group += 1) {
      const left = x0 + group * groupPitch;

      for (let unit = 0; unit < 5; unit += 1) {
        const centerX = Math.round(left + (unit + 0.5) * groupWidth / 5);
        let colored = 0;
        let samples = 0;

        for (let deltaY = -3; deltaY <= 3; deltaY += 1) {
          for (let deltaX = -2; deltaX <= 2; deltaX += 1) {
            const x = Math.round(centerX + deltaX);
            const row = y + deltaY;

            if (x < 0 || x >= width || row < 0 || row >= height) continue;

            const index = (row * width + x) * 4;
            samples += 1;
            if (isIvColor(data[index], data[index + 1], data[index + 2])) colored += 1;
          }
        }

        values.push(colored / samples > 0.35);
      }
    }

    result[stat] = values.filter(Boolean).length;
  }

  return result;
}

export async function scanScreenshot(image, pokemonData, onProgress = () => {}) {
  const worker = await getOcrWorker(onProgress);
  const cpText = await recognizeCrop(worker, image, 'cp');
  const nameText = await recognizePokemonName(worker, image, pokemonData);
  const hpText = await recognizeCrop(worker, image, 'pokemonHp');

  return {
    name: matchPokemonFromText(nameText, pokemonData),
    cp: readCp(cpText),
    ivs: estimateIvsFromBars(image),
    pokemonHp: readPokemonHp(hpText),
    rawName: nameText,
  };
}
