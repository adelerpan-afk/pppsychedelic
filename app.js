// ============================================================
// app.js – Seamless Pattern Generator
// ============================================================

const els = {
  file: document.querySelector("#svgFile"),
  fileName: document.querySelector("#fileName"),
  thumbStrip: document.querySelector("#thumbStrip"),
  tileWidth: document.querySelector("#tileWidth"),
  tileHeight: document.querySelector("#tileHeight"),
  count: document.querySelector("#count"),
  seed: document.querySelector("#seed"),
  baseScale: document.querySelector("#baseScale"),
  scaleVariance: document.querySelector("#scaleVariance"),
  rotation: document.querySelector("#rotation"),
  spacing: document.querySelector("#spacing"),
  jitter: document.querySelector("#jitter"),
  distribution: document.querySelectorAll('input[name="distribution"]'),
  randomMode: document.querySelector("#randomMode"),
  allowEdgeCuts: document.querySelector("#allowEdgeCuts"),
  showTile: document.querySelector("#showTile"),
  bgMode: document.querySelectorAll('input[name="bgMode"]'),
  bgColorPicker: document.querySelector("#bgColorPicker"),
  colorMode: document.querySelectorAll('input[name="colorMode"]'),
  singleColorPicker: document.querySelector("#singleColorPicker"),
  multiColorHex: document.querySelector("#multiColorHex"),
  randomColorBtn: document.querySelector("#randomColorBtn"),
  generateBtn: document.querySelector("#generateBtn"),
  autoLayoutBtn: document.querySelector("#autoLayoutBtn"),
  sampleBtn: document.querySelector("#sampleBtn"),
  shuffleBtn: document.querySelector("#shuffleBtn"),
  downloadPngBtn: document.querySelector("#downloadPngBtn"),
  downloadSvgBtn: document.querySelector("#downloadSvgBtn"),
  downloadJpgBtn: document.querySelector("#downloadJpgBtn"),
  batchCount: document.querySelector("#batchCount"),
  batchFormat: document.querySelector("#batchFormat"),
  batchOutputMode: document.querySelector("#batchOutputMode"),
  batchDownloadCountBtn: document.querySelector("#batchDownloadCountBtn"),
  batchDownloadJsonBtn: document.querySelector("#batchDownloadJsonBtn"),
  batchStatus: document.querySelector("#batchStatus"),
  repeatPreview: document.querySelector("#repeatPreview"),
  tileFrame: document.querySelector("#tileFrame"),
  canvas: document.querySelector("#tileCanvas"),
  previewScale: document.querySelector("#previewScale"),
  statusText: document.querySelector("#statusText"),
  baseScaleValue: document.querySelector("#baseScaleValue"),
  scaleVarianceValue: document.querySelector("#scaleVarianceValue"),
  rotationValue: document.querySelector("#rotationValue"),
  spacingValue: document.querySelector("#spacingValue"),
  jitterValue: document.querySelector("#jitterValue"),
  coverageLabel: document.querySelector("#coverageLabel"),
  coverageBar: document.querySelector("#coverageBar"),
  statCoverage: document.querySelector("#statCoverage"),
  statObjectCount: document.querySelector("#statObjectCount"),
  statAverageDistance: document.querySelector("#statAverageDistance"),
  statDuplicateEdge: document.querySelector("#statDuplicateEdge"),
  statLargest: document.querySelector("#statLargest"),
  statSmallest: document.querySelector("#statSmallest"),
  statCanvasSize: document.querySelector("#statCanvasSize"),
  repeatCount: document.querySelector("#repeatCount"),
  repeatCountValue: document.querySelector("#repeatCountValue"),
  exportJsonBtn: document.querySelector("#exportJsonBtn"),
  importJsonInput: document.querySelector("#importJsonInput"),
  checkAllBtn: document.querySelector("#checkAllBtn"),
  uncheckAllBtn: document.querySelector("#uncheckAllBtn"),
  resetFilesBtn: document.querySelector("#resetFilesBtn"),
  batchMode: document.querySelectorAll('input[name="batchMode"]'),
  jpgSettings: document.querySelector("#jpgSettings"),
  jpgDpi: document.querySelector("#jpgDpi"),
  printWidth: document.querySelector("#printWidth"),
  printHeight: document.querySelector("#printHeight"),
  jpgQuality: document.querySelector("#jpgQuality"),
  pixelDimensions: document.querySelector("#pixelDimensions"),
};

const CANVAS_RATIO = 16 / 9;
const MAX_PLACEMENT_ATTEMPTS = 300;
const MAX_SHRINK_STEPS = 6;
const CLIENT_ZIP_URL = "https://cdn.jsdelivr.net/npm/client-zip@2.5.0/index.js";

const ctx = els.canvas.getContext("2d");

const state = {
  sources: [],
  nextSourceId: 1,
  placements: [],
  skippedCount: 0,
  batchSeeds: [],
  batchJsonData: null,
};

const sampleSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 90">
  <path d="M18 45 C18 22 37 10 60 10 C83 10 102 22 102 45 C102 68 83 80 60 80 C37 80 18 68 18 45Z" fill="#0e7c66"/>
  <path d="M40 28 C52 18 70 18 82 28" fill="none" stroke="#ffffff" stroke-width="8" stroke-linecap="round"/>
  <circle cx="45" cy="50" r="7" fill="#e0a458"/>
  <circle cx="75" cy="50" r="7" fill="#d65f68"/>
</svg>`;

// ---------- UTILITY ----------
function mulberry32(seed) {
  let value = seed >>> 0;
  return function random() {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function numberFrom(el) {
  return Number.parseFloat(el.value);
}

function escapeAttr(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function parseHexList(text) {
  return (text || "")
    .split(",")
    .map((value) => value.trim())
    .filter((value) => /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value));
}

function randomHexColor() {
  const value = Math.floor(Math.random() * 0xffffff);
  return `#${value.toString(16).padStart(6, "0")}`;
}

function checkedSources() {
  return state.sources.filter((source) => source.checked);
}

// ---------- JPG UTILITY ----------
function updatePixelDimensions() {
  const dpi = parseInt(els.jpgDpi.value) || 300;
  const width = parseFloat(els.printWidth.value) || 4;
  const height = parseFloat(els.printHeight.value) || 4;
  const pixelW = Math.round(width * dpi);
  const pixelH = Math.round(height * dpi);
  els.pixelDimensions.textContent = `${pixelW} × ${pixelH}`;
}

// ---------- SETTINGS ----------
function getSettings() {
  const width = Math.round(numberFrom(els.tileWidth));
  const height = Math.round(numberFrom(els.tileHeight));

  const distribution = document.querySelector('input[name="distribution"]:checked')?.value ?? "random";
  const bgMode = document.querySelector('input[name="bgMode"]:checked')?.value ?? "transparent";
  const colorMode = document.querySelector('input[name="colorMode"]:checked')?.value ?? "original";

  return {
    width,
    height,
    count: Math.round(numberFrom(els.count)),
    seed: Math.round(numberFrom(els.seed)),
    baseScale: numberFrom(els.baseScale) / 100,
    scaleVariance: numberFrom(els.scaleVariance) / 100,
    rotation: numberFrom(els.rotation),
    spacing: numberFrom(els.spacing),
    minPoissonDistance: numberFrom(els.spacing),
    jitter: numberFrom(els.jitter) / 100,
    distribution,
    randomMode: els.randomMode.checked,
    allowEdgeCuts: els.allowEdgeCuts.checked,
    background: {
      mode: bgMode,
      color: els.bgColorPicker.value,
    },
    coloring: {
      mode: colorMode,
      singleColor: els.singleColorPicker.value,
      colors: parseHexList(els.multiColorHex.value),
    },
  };
}

// ---------- UI UPDATE ----------
function updateLabels() {
  els.baseScaleValue.value = `${els.baseScale.value}%`;
  els.scaleVarianceValue.value = `${els.scaleVariance.value}%`;
  els.rotationValue.value = `${els.rotation.value} deg`;
  els.spacingValue.value = `${els.spacing.value} px`;
  els.jitterValue.value = `${els.jitter.value}%`;
}

function updateRepeatLabel() {
  els.repeatCountValue.textContent = `${els.repeatCount.value}×`;
}

function exportSizeLabel(settings = getSettings()) {
  const is4K = settings.width === 3840 && settings.height === 2160;
  const is4KSquare = settings.width === 3840 && settings.height === 3840;

  if (is4K) return "4K";
  if (is4KSquare) return "4K-Square";
  return `${settings.width}x${settings.height}`;
}

function exportFileLabel(settings = getSettings()) {
  return exportSizeLabel(settings).toLowerCase();
}

function updateExportLabels() {
  const label = exportSizeLabel();
  els.downloadPngBtn.textContent = `Download PNG ${label}`;
  els.downloadSvgBtn.textContent = `Download SVG ${label}`;
}

function selectedDistributionInput(value) {
  return Array.from(els.distribution).find((input) => input.value === value);
}

function setDistribution(value) {
  const input = selectedDistributionInput(value);
  if (input) input.checked = true;
  els.randomMode.checked = value !== "grid";
}

function setRadioValue(nodeList, value) {
  Array.from(nodeList).forEach((input) => {
    input.checked = input.value === value;
  });
}

function parseSvgAspect(svgText) {
  const doc = new DOMParser().parseFromString(svgText, "image/svg+xml");
  const svg = doc.querySelector("svg");
  if (!svg) return 1;

  const viewBox = svg.getAttribute("viewBox");
  if (viewBox) {
    const parts = viewBox.split(/[\s,]+/).map(Number);
    if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) return parts[2] / parts[3];
  }

  const width = Number.parseFloat(svg.getAttribute("width"));
  const height = Number.parseFloat(svg.getAttribute("height"));
  return width > 0 && height > 0 ? width / height : 1;
}

function loadImageFromText(svgText) {
  return new Promise((resolve, reject) => {
    const blob = new Blob([svgText], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => resolve({ image, url });
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("SVG tidak bisa dibaca sebagai gambar."));
    };
    image.src = url;
  });
}

function updateFileLabel() {
  const total = state.sources.length;
  const active = checkedSources().length;
  els.fileName.textContent = total ? `${active}/${total} SVG aktif` : "Pilih file SVG (bisa banyak)";
}

function renderThumbStrip() {
  els.thumbStrip.innerHTML = "";
  state.sources.forEach((source) => {
    const item = document.createElement("div");
    item.className = "thumb-item";
    item.innerHTML = `
      <button type="button" class="thumb-remove" data-remove="${source.id}" aria-label="Hapus ${escapeAttr(source.name)}">×</button>
      <span class="thumb-preview"><img src="${source.url}" alt="${escapeAttr(source.name)}" /></span>
      <label class="thumb-check">
        <input type="checkbox" data-toggle="${source.id}" ${source.checked ? "checked" : ""} />
        <span class="thumb-name" title="${escapeAttr(source.name)}">${escapeAttr(source.name)}</span>
      </label>
    `;
    els.thumbStrip.appendChild(item);
  });
}

// ---------- MANAJEMEN FILE ----------
function checkAllFiles() {
  state.sources.forEach(s => s.checked = true);
  renderThumbStrip();
  updateFileLabel();
  drawPattern().catch(console.error);
}

function uncheckAllFiles() {
  state.sources.forEach(s => s.checked = false);
  renderThumbStrip();
  updateFileLabel();
  drawPattern().catch(console.error);
}

function resetFiles() {
  state.sources.forEach(s => URL.revokeObjectURL(s.url));
  state.sources = [];
  state.nextSourceId = 1;
  renderThumbStrip();
  updateFileLabel();
  drawPattern().catch(console.error);
}

function getSourceName() {
  const sources = checkedSources();
  if (!sources.length) return "pattern";
  const names = sources.map(s => s.name.replace(/\.svg$/i, ''));
  if (names.length === 1) return names[0];
  return names[0] + ` (+${names.length - 1} more)`;
}

// ---------- MODIFIKASI SVG UNTUK MULTI COLOR PER PATH ----------
function modifySvgWithMultiColors(svgText, colors, seed) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgText, "image/svg+xml");
  const svg = doc.querySelector("svg");
  if (!svg) return svgText;

  const elements = svg.querySelectorAll(
    "path, circle, rect, ellipse, polygon, polyline, line, text"
  );
  const random = mulberry32(seed);
  elements.forEach((el) => {
    const color = colors[Math.floor(random() * colors.length)];
    el.setAttribute("fill", color);
  });

  const serializer = new XMLSerializer();
  return serializer.serializeToString(doc);
}

// ---------- COLLISION & PLACEMENT ----------
function edgeAnchor(index, settings, random) {
  const side = index % 4;
  const edgeBand = Math.min(64, Math.min(settings.width, settings.height) * 0.08);
  if (side === 0) return { x: random() * edgeBand, y: random() * settings.height };
  if (side === 1) return { x: settings.width - random() * edgeBand, y: random() * settings.height };
  if (side === 2) return { x: random() * settings.width, y: random() * edgeBand };
  return { x: random() * settings.width, y: settings.height - random() * edgeBand };
}

function dimensionsForLongSide(longSide, aspect) {
  return {
    width: aspect >= 1 ? longSide : longSide * aspect,
    height: aspect >= 1 ? longSide / aspect : longSide,
  };
}

function makeCandidate(index, settings, random, longSide, aspect, point = null) {
  const dimensions = dimensionsForLongSide(longSide, aspect);
  const rotation = settings.rotation === 0 ? 0 : (random() * 2 - 1) * settings.rotation;
  const base = { width: dimensions.width, height: dimensions.height, rotation };
  const edgePoint = settings.allowEdgeCuts && index < 4 ? edgeAnchor(index, settings, random) : null;
  const position = edgePoint ?? point ?? PatternDistribution.randomPosition(settings, random, base);

  return {
    id: index,
    x: position.x,
    y: position.y,
    width: dimensions.width,
    height: dimensions.height,
    rotation,
    opacity: 1,
  };
}

function candidatePositionForAttempt(index, attempt, settings, random, candidate, placed) {
  if (attempt === 0 && settings.allowEdgeCuts && index < 4) return { x: candidate.x, y: candidate.y };
  return PatternDistribution.positionForAttempt({
    index,
    attempt,
    settings,
    random,
    item: candidate,
    placed,
  });
}

function pickColorForItem(settings, random) {
  if (settings.coloring.mode === "single") return settings.coloring.singleColor;
  if (settings.coloring.mode === "multi" && settings.coloring.colors.length) {
    return settings.coloring.colors[Math.floor(random() * settings.coloring.colors.length)];
  }
  return null;
}

function placeOneObject(index, settings, random, baseLongSide, placed, sources) {
  const sourceIndex = Math.floor(random() * sources.length);
  const source = sources[sourceIndex];
  const aspect = Math.max(0.05, source.aspect || 1);
  const color = pickColorForItem(settings, random);
  const variance = 1 + (random() - 0.5) * settings.scaleVariance;
  const initialLongSide = clamp(baseLongSide * variance, 8, Math.min(settings.width, settings.height));

  for (let shrinkStep = 0; shrinkStep <= MAX_SHRINK_STEPS; shrinkStep += 1) {
    const longSide = initialLongSide * 0.9 ** shrinkStep;

    for (let attempt = 0; attempt < MAX_PLACEMENT_ATTEMPTS; attempt += 1) {
      const candidate = makeCandidate(index, settings, random, longSide, aspect);
      const point = candidatePositionForAttempt(index, attempt, settings, random, candidate, placed);
      candidate.x = point.x;
      candidate.y = point.y;

      if (!PatternCollision.collidesWithExisting(candidate, placed, settings, settings.spacing)) {
        candidate.attempts = attempt + 1;
        candidate.scaleReduction = shrinkStep;
        candidate.source = source;
        candidate.color = color;
        return candidate;
      }
    }
  }

  return null;
}

function estimateObjectArea(longSide, aspect) {
  const width = aspect >= 1 ? longSide : longSide * aspect;
  const height = aspect >= 1 ? longSide / aspect : longSide;
  return width * height;
}

function calculateAutoLayout() {
  const settings = getSettings();
  const canvasArea = settings.width * settings.height;
  const targetCoverage = 0.3;
  const sources = checkedSources();
  const aspect = Math.max(0.05, sources[0]?.aspect || 1);
  const shortSide = Math.min(settings.width, settings.height);
  const canvasScale = Math.sqrt(canvasArea / (3840 * 2160));
  const baseCount = clamp(Math.round(30 * canvasScale), 14, 96);
  let count = baseCount;
  let longSide = Math.sqrt((canvasArea * targetCoverage) / (count * (aspect >= 1 ? 1 / aspect : aspect)));

  longSide = clamp(longSide, shortSide * 0.055, shortSide * 0.18);

  let objectArea = estimateObjectArea(longSide, aspect);
  count = clamp(Math.round((canvasArea * targetCoverage) / objectArea), 8, 140);
  const gridCellArea = canvasArea / count;
  const spacing = clamp(Math.sqrt(gridCellArea) * 0.12, shortSide * 0.012, 180);
  const scale = clamp((longSide / shortSide) * 100, 5, 80);
  const variance = clamp(24 + Math.abs(aspect - 1) * 8, 18, 44);
  const jitter = 72;

  return {
    count: Math.round(count),
    scale: Math.round(scale),
    spacing: Math.round(spacing),
    variance: Math.round(variance),
    jitter,
  };
}

function applyAutoLayout() {
  const layout = calculateAutoLayout();
  els.count.value = layout.count;
  els.baseScale.value = layout.scale;
  els.scaleVariance.value = layout.variance;
  els.spacing.value = layout.spacing;
  els.jitter.value = layout.jitter;
  setDistribution("blue-noise");
  updateLabels();
  drawPattern().catch(console.error);
}

function buildPlacements(settings) {
  const random = mulberry32(settings.seed);
  const baseLongSide = Math.min(settings.width, settings.height) * settings.baseScale;
  const sources = checkedSources();
  const placed = [];
  let skippedCount = 0;

  if (!sources.length) {
    state.skippedCount = 0;
    return placed;
  }

  for (let index = 0; index < settings.count; index += 1) {
    const item = placeOneObject(index, settings, random, baseLongSide, placed, sources);
    if (item) placed.push(item);
    else skippedCount += 1;
  }

  state.skippedCount = skippedCount;
  return placed;
}

// ---------- RENDER SUMBER GAMBAR ----------
async function renderSourceFor(item) {
  if (item.renderSource) return item.renderSource;
  const settings = getSettings();

  if (settings.coloring.mode === "original") {
    item.renderSource = item.source.image;
  } else if (settings.coloring.mode === "single") {
    const color = item.color || settings.coloring.singleColor;
    const off = document.createElement("canvas");
    off.width = Math.max(1, Math.round(item.width));
    off.height = Math.max(1, Math.round(item.height));
    const offCtx = off.getContext("2d");
    offCtx.drawImage(item.source.image, 0, 0, off.width, off.height);
    offCtx.globalCompositeOperation = "source-atop";
    offCtx.fillStyle = color;
    offCtx.fillRect(0, 0, off.width, off.height);
    item.renderSource = off;
  } else if (settings.coloring.mode === "multi") {
    const colors = settings.coloring.colors;
    if (!colors.length) {
      item.renderSource = item.source.image;
    } else {
      const seed = settings.seed + (item.id || 0);
      const modifiedSvg = modifySvgWithMultiColors(item.source.text, colors, seed);
      const blob = new Blob([modifiedSvg], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob);
      const image = new Image();
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = () => reject(new Error("Gagal memuat SVG yang dimodifikasi"));
        image.src = url;
      });
      URL.revokeObjectURL(url);
      item.renderSource = image;
    }
  }
  return item.renderSource;
}

function drawImageItem(item, dx, dy) {
  const source = item.renderSource;
  if (!source) return;
  ctx.save();
  ctx.translate(item.x + dx, item.y + dy);
  ctx.rotate((item.rotation * Math.PI) / 180);
  ctx.globalAlpha = item.opacity;
  ctx.drawImage(source, -item.width / 2, -item.height / 2, item.width, item.height);
  ctx.restore();
}

function updateStatsPanel(settings) {
  const stats = PatternStats.calculatePatternStats(
    state.placements,
    settings,
    PatternCollision.wrapOffsets,
  );
  const coverage = Math.max(0, stats.coverage);
  const progressWidth = Math.min(100, coverage);
  const coverageText = `${coverage.toFixed(1)}%`;

  els.coverageLabel.textContent = coverageText;
  els.statCoverage.textContent = coverageText;
  els.statObjectCount.textContent = `${stats.objectCount}`;
  els.statAverageDistance.textContent = `${Math.round(stats.averageDistance)} px`;
  els.statDuplicateEdge.textContent = `${stats.duplicateEdgeObjects}`;
  els.statLargest.textContent = `${Math.round(stats.largestObject)} px2`;
  els.statSmallest.textContent = `${Math.round(stats.smallestObject)} px2`;

  const ratio = settings.width / settings.height;
  let aspectLabel = '';
  if (Math.abs(ratio - 16 / 9) < 0.01) aspectLabel = '16:9';
  else if (Math.abs(ratio - 1) < 0.01) aspectLabel = '1:1';
  else if (Math.abs(ratio - 4 / 3) < 0.01) aspectLabel = '4:3';
  else if (Math.abs(ratio - 3 / 2) < 0.01) aspectLabel = '3:2';
  else if (Math.abs(ratio - 21 / 9) < 0.01) aspectLabel = '21:9';
  else aspectLabel = ratio.toFixed(2);

  els.statCanvasSize.textContent = `${settings.width} × ${settings.height} (${aspectLabel})`;

  els.coverageBar.style.width = `${progressWidth}%`;
  els.coverageBar.classList.remove("coverage-good", "coverage-warn", "coverage-danger");

  if (coverage >= 20 && coverage < 40) els.coverageBar.classList.add("coverage-good");
  if (coverage >= 40 && coverage <= 60) els.coverageBar.classList.add("coverage-warn");
  if (coverage > 60) els.coverageBar.classList.add("coverage-danger");
}

// ---------- DRAW PATTERN (ASYNC) ----------
let isDrawing = false;

async function drawPattern() {
  if (isDrawing) return;
  isDrawing = true;
  try {
    const settings = getSettings();
    els.canvas.width = settings.width;
    els.canvas.height = settings.height;

    ctx.clearRect(0, 0, settings.width, settings.height);
    if (settings.background.mode === "color") {
      ctx.fillStyle = settings.background.color;
      ctx.fillRect(0, 0, settings.width, settings.height);
    }

    const sources = checkedSources();
    if (!sources.length) {
      state.placements = [];
      updatePreviewBackground(settings);
      updateStatsPanel(settings);
      els.statusText.textContent = state.sources.length
        ? "Centang minimal satu SVG untuk membuat pattern."
        : "Upload SVG untuk mulai membuat pattern.";
      return;
    }

    state.placements = buildPlacements(settings);
    await Promise.all(state.placements.map((item) => renderSourceFor(item)));

    state.placements.forEach((item) => {
      PatternCollision.wrapOffsets(item, settings).forEach(({ dx, dy }) =>
        drawImageItem(item, dx, dy)
      );
    });

    updatePreviewBackground(settings);
    updateStatsPanel(settings);

    const duplicateCount = state.placements.reduce((sum, item) => {
      return sum + PatternCollision.wrapOffsets(item, settings).length - 1;
    }, 0);
    const skipped = state.skippedCount ? `, ${state.skippedCount} objek dilewati karena collision` : "";

    const aspectLabel = settings.width === settings.height ? 'Square 1:1' : 'Rectangle 16:9';
    els.statusText.textContent = `${state.placements.length} objek, ${duplicateCount} salinan tepi${skipped}, ${aspectLabel} ${settings.width} x ${settings.height}px.`;
  } finally {
    isDrawing = false;
  }
}

function updatePreviewBackground(settings = getSettings()) {
  const scale = numberFrom(els.previewScale) / 100;
  const repeat = Math.round(numberFrom(els.repeatCount)) || 1;
  const url = els.canvas.toDataURL("image/png");
  const displayW = Math.round(settings.width * scale);
  const displayH = Math.round(settings.height * scale);
  const tileW = displayW / repeat;
  const tileH = displayH / repeat;
  els.repeatPreview.style.backgroundImage = `url("${url}")`;
  els.repeatPreview.style.backgroundSize = `${tileW}px ${tileH}px`;
  els.tileFrame.style.width = `${displayW}px`;
  els.tileFrame.style.height = `${displayH}px`;
  els.tileFrame.classList.toggle("hidden-border", !els.showTile.checked);
}

function validateCurrentCollisions() {
  const settings = getSettings();
  for (let i = 0; i < state.placements.length; i += 1) {
    for (let j = i + 1; j < state.placements.length; j += 1) {
      if (
        PatternCollision.collidesWithExisting(
          state.placements[i],
          [state.placements[j]],
          settings,
          settings.spacing,
        )
      ) {
        return { valid: false, pair: [i, j] };
      }
    }
  }
  return { valid: true, pair: null };
}

window.PatternAppDebug = {
  getPlacements: () => state.placements.map((item) => ({ ...item })),
  validateCurrentCollisions,
};

// ---------- DOWNLOAD ----------
function download(filename, href) {
  const link = document.createElement("a");
  link.download = filename;
  link.href = href;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function downloadPng() {
  if (!state.placements.length) return;
  const settings = getSettings();
  download(`seamless-pattern-${exportFileLabel(settings)}-${els.seed.value}.png`, els.canvas.toDataURL("image/png"));
}

function svgFilterId(hex) {
  return `recolor-${hex.replace("#", "").toLowerCase()}`;
}

function buildSvgMarkup(settings, placements) {
  const sourceHrefs = new Map();
  placements.forEach((item) => {
    if (!sourceHrefs.has(item.source.id)) {
      sourceHrefs.set(
        item.source.id,
        `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(item.source.text)))}`,
      );
    }
  });

  const usedColors = new Map();
  placements.forEach((item) => {
    if (item.color && !usedColors.has(item.color)) {
      usedColors.set(item.color, svgFilterId(item.color));
    }
  });

  const filterDefs = Array.from(usedColors.entries())
    .map(
      ([hex, filterId]) =>
        `<filter id="${filterId}" x="-20%" y="-20%" width="140%" height="140%"><feFlood flood-color="${escapeAttr(hex)}" result="flood" /><feComposite in="flood" in2="SourceGraphic" operator="in" /></filter>`,
    )
    .join("\n    ");

  const images = placements
    .flatMap((item) =>
      PatternCollision.wrapOffsets(item, settings).map(({ dx, dy }) => {
        const x = item.x + dx;
        const y = item.y + dy;
        const href = sourceHrefs.get(item.source.id);
        const filterAttr = item.color ? ` filter="url(#${usedColors.get(item.color)})"` : "";
        return [
          `<image href="${href}"${filterAttr}`,
          `x="${escapeAttr(-item.width / 2)}" y="${escapeAttr(-item.height / 2)}"`,
          `width="${escapeAttr(item.width)}" height="${escapeAttr(item.height)}"`,
          `transform="translate(${escapeAttr(x)} ${escapeAttr(y)}) rotate(${escapeAttr(item.rotation)})" />`,
        ].join(" ");
      }),
    )
    .join("\n    ");

  const backgroundRect =
    settings.background.mode === "color"
      ? `<rect width="100%" height="100%" fill="${escapeAttr(settings.background.color)}" />`
      : `<rect width="100%" height="100%" fill="transparent" />`;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${settings.width}" height="${settings.height}" viewBox="0 0 ${settings.width} ${settings.height}">`,
    `  <defs><clipPath id="tileClip"><rect width="${settings.width}" height="${settings.height}" /></clipPath>${filterDefs ? `\n    ${filterDefs}` : ""}</defs>`,
    `  ${backgroundRect}`,
    `  <g clip-path="url(#tileClip)">`,
    `    ${images}`,
    `  </g>`,
    `</svg>`,
  ].join("\n");
}

function downloadSvg() {
  if (!state.placements.length) return;
  const settings = getSettings();
  const svg = buildSvgMarkup(settings, state.placements);
  const blob = new Blob([svg], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  download(`seamless-pattern-${exportFileLabel(settings)}-${els.seed.value}.svg`, url);
  window.setTimeout(() => URL.revokeObjectURL(url), 500);
}

// ---------- DOWNLOAD JPG INDIVIDUAL ----------
function downloadJpg() {
  if (!state.placements.length) {
    alert('Generate pattern terlebih dahulu!');
    return;
  }

  const settings = getSettings();
  const dpi = parseInt(els.jpgDpi.value) || 300;
  const printWidth = parseFloat(els.printWidth.value) || 4;
  const printHeight = parseFloat(els.printHeight.value) || 4;
  const quality = parseFloat(els.jpgQuality.value) || 0.92;
  const pixelWidth = Math.round(printWidth * dpi);
  const pixelHeight = Math.round(printHeight * dpi);

  const jpgCanvas = document.createElement('canvas');
  jpgCanvas.width = pixelWidth;
  jpgCanvas.height = pixelHeight;
  const jpgCtx = jpgCanvas.getContext('2d');

  if (settings.background.mode === "color") {
    jpgCtx.fillStyle = settings.background.color;
    jpgCtx.fillRect(0, 0, pixelWidth, pixelHeight);
  }

  jpgCtx.drawImage(els.canvas, 0, 0, pixelWidth, pixelHeight);

  jpgCanvas.toBlob(function(blob) {
    const url = URL.createObjectURL(blob);
    const filename = `seamless-pattern-${exportFileLabel(settings)}-${dpi}dpi-${els.seed.value}.jpg`;
    download(filename, url);
    window.setTimeout(() => URL.revokeObjectURL(url), 500);
  }, 'image/jpeg', quality);
}

// ---------- HANDLE FILE ----------
async function handleFiles(event) {
  const files = Array.from(event.target.files || []);
  if (!files.length) return;

  for (const file of files) {
    try {
      const svgText = await file.text();
      const loaded = await loadImageFromText(svgText);
      state.sources.push({
        id: state.nextSourceId++,
        name: file.name,
        text: svgText,
        url: loaded.url,
        image: loaded.image,
        aspect: parseSvgAspect(svgText),
        checked: true,
      });
    } catch (error) {
      els.statusText.textContent = error.message;
    }
  }

  event.target.value = "";
  renderThumbStrip();
  updateFileLabel();
  await drawPattern();
}

async function useSampleSvg() {
  try {
    const loaded = await loadImageFromText(sampleSvg);
    state.sources.push({
      id: state.nextSourceId++,
      name: "contoh-shape.svg",
      text: sampleSvg,
      url: loaded.url,
      image: loaded.image,
      aspect: parseSvgAspect(sampleSvg),
      checked: true,
    });
    renderThumbStrip();
    updateFileLabel();
    await drawPattern();
  } catch (error) {
    els.statusText.textContent = error.message;
  }
}

function shuffleSeed() {
  els.seed.value = Math.floor(Math.random() * 999999) + 1;
  drawPattern().catch(console.error);
}

function syncHeightToWidth() {
  const width = Math.round(numberFrom(els.tileWidth));
  const selected = document.querySelector('input[name="aspectRatio"]:checked');

  if (selected) {
    switch (selected.value) {
      case '1:1':
        els.tileHeight.value = width;
        break;
      case '4:3':
        els.tileHeight.value = Math.round(width / (4 / 3));
        break;
      case '3:2':
        els.tileHeight.value = Math.round(width / (3 / 2));
        break;
      case '21:9':
        els.tileHeight.value = Math.round(width / (21 / 9));
        break;
      case '16:9':
      default:
        els.tileHeight.value = Math.round(width / CANVAS_RATIO);
        break;
    }
  } else {
    els.tileHeight.value = Math.round(width / CANVAS_RATIO);
  }
}

function syncWidthToHeight() {
  const height = Math.round(numberFrom(els.tileHeight));
  const selected = document.querySelector('input[name="aspectRatio"]:checked');

  if (selected) {
    switch (selected.value) {
      case '1:1':
        els.tileWidth.value = height;
        break;
      case '4:3':
        els.tileWidth.value = Math.round(height * (4 / 3));
        break;
      case '3:2':
        els.tileWidth.value = Math.round(height * (3 / 2));
        break;
      case '21:9':
        els.tileWidth.value = Math.round(height * (21 / 9));
        break;
      case '16:9':
      default:
        els.tileWidth.value = Math.round(height * CANVAS_RATIO);
        break;
    }
  } else {
    els.tileWidth.value = Math.round(height * CANVAS_RATIO);
  }
}

function canvasToBlob(canvas) {
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/png"));
}

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

// ---------- BATCH DOWNLOAD BY COUNT ----------
async function* batchGeneratorByCount(count, format) {
  const seeds = state.batchSeeds && state.batchSeeds.length
    ? state.batchSeeds.slice(0, count)
    : Array.from({ length: count }, () => Math.floor(Math.random() * 999999) + 1);

  const sourceName = getSourceName();

  const jpgDpi = parseInt(els.jpgDpi.value) || 300;
  const printWidth = parseFloat(els.printWidth.value) || 4;
  const printHeight = parseFloat(els.printHeight.value) || 4;
  const jpgQuality = parseFloat(els.jpgQuality.value) || 0.92;
  const pixelWidth = Math.round(printWidth * jpgDpi);
  const pixelHeight = Math.round(printHeight * jpgDpi);

  for (let i = 0; i < seeds.length; i++) {
    const seed = seeds[i];
    els.seed.value = seed;
    await drawPattern();
    await nextFrame();

    const settings = getSettings();
    const index = i + 1;
    els.batchStatus.textContent = `Membuat gambar ${index}/${seeds.length} (seed ${seed})...`;

    const baseName = `${sourceName}-${index}-${seed}`;

    if (format === "png" || format === "both") {
      const blob = await canvasToBlob(els.canvas);
      if (blob) yield { name: `png/${baseName}.png`, input: blob, lastModified: new Date() };
    }
    if (format === "svg" || format === "both") {
      const svg = buildSvgMarkup(settings, state.placements);
      yield {
        name: `svg/${baseName}.svg`,
        input: new Blob([svg], { type: "image/svg+xml" }),
        lastModified: new Date(),
      };
    }
    if (format === "jpg" || format === "both") {
      const jpgCanvas = document.createElement('canvas');
      jpgCanvas.width = pixelWidth;
      jpgCanvas.height = pixelHeight;
      const jpgCtx = jpgCanvas.getContext('2d');

      if (settings.background.mode === "color") {
        jpgCtx.fillStyle = settings.background.color;
        jpgCtx.fillRect(0, 0, pixelWidth, pixelHeight);
      }

      jpgCtx.drawImage(els.canvas, 0, 0, pixelWidth, pixelHeight);

      const jpgBlob = await new Promise(resolve => {
        jpgCanvas.toBlob(resolve, 'image/jpeg', jpgQuality);
      });

      if (jpgBlob) {
        yield {
          name: `jpg/${baseName}.jpg`,
          input: jpgBlob,
          lastModified: new Date()
        };
      }

      jpgCanvas.width = 0;
      jpgCanvas.height = 0;
    }
  }
}

async function batchDownloadByCount() {
  if (!checkedSources().length) {
    els.batchStatus.textContent = "Centang minimal satu SVG dulu.";
    return;
  }

  const count = clamp(Math.round(numberFrom(els.batchCount)) || 1, 1, 500);
  const format = els.batchFormat.value;
  const outputMode = els.batchOutputMode ? els.batchOutputMode.value : "zip";

  const originalSeed = els.seed.value;
  els.batchDownloadCountBtn.disabled = true;
  els.batchStatus.textContent = "Menyiapkan batch berdasarkan jumlah...";

  try {
    if (outputMode === "individual") {
      let fileCount = 0;
      for await (const file of batchGeneratorByCount(count, format)) {
        const url = URL.createObjectURL(file.input);
        download(file.name, url);
        URL.revokeObjectURL(url);
        fileCount++;
        els.batchStatus.textContent = `Mengunduh ${fileCount} ...`;
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      els.batchStatus.textContent = `Selesai. ${fileCount} file diunduh secara individual.`;
    } else {
      const zipName = `batch-count-${Date.now()}.zip`;
      let handle = null;
      let useFilePicker = false;
      if (window.showSaveFilePicker) {
        try {
          handle = await window.showSaveFilePicker({
            suggestedName: zipName,
            types: [{ description: "ZIP archive", accept: { "application/zip": [".zip"] } }],
          });
          useFilePicker = true;
        } catch (error) {
          if (error?.name === "AbortError") {
            els.batchStatus.textContent = "Batch dibatalkan.";
            return;
          }
          console.warn("File picker failed, falling back to download:", error);
          handle = null;
          useFilePicker = false;
        }
      }

      const { downloadZip } = await import(CLIENT_ZIP_URL);
      const response = downloadZip(batchGeneratorByCount(count, format));

      if (handle && useFilePicker) {
        try {
          const writable = await handle.createWritable();
          await response.body.pipeTo(writable);
          els.batchStatus.textContent = `Selesai. ${count} pattern disimpan ke ${zipName}.`;
        } catch (writeError) {
          console.warn("Failed to write via file picker, falling back to download:", writeError);
          const blob = await response.blob();
          const url = URL.createObjectURL(blob);
          download(zipName, url);
          window.setTimeout(() => URL.revokeObjectURL(url), 500);
          els.batchStatus.textContent = `Selesai (fallback). ${count} pattern diunduh sebagai ${zipName}.`;
        }
      } else {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        download(zipName, url);
        window.setTimeout(() => URL.revokeObjectURL(url), 500);
        els.batchStatus.textContent = `Selesai. ${count} pattern diunduh sebagai ${zipName}.`;
      }
    }
  } catch (error) {
    els.batchStatus.textContent = `Gagal membuat batch: ${error.message}`;
  } finally {
    els.seed.value = originalSeed;
    await drawPattern();
    els.batchDownloadCountBtn.disabled = false;
  }
}

// ---------- BATCH DOWNLOAD BY JSON ----------
function applySettingsFromObject(data) {
  if (data.tileWidth) els.tileWidth.value = data.tileWidth;
  if (data.tileHeight) els.tileHeight.value = data.tileHeight;
  if (data.count !== undefined) els.count.value = data.count;
  if (data.seed !== undefined) els.seed.value = data.seed;
  if (data.baseScale !== undefined) els.baseScale.value = data.baseScale;
  if (data.scaleVariance !== undefined) els.scaleVariance.value = data.scaleVariance;
  if (data.rotation !== undefined) els.rotation.value = data.rotation;
  if (data.spacing !== undefined) els.spacing.value = data.spacing;
  if (data.jitter !== undefined) els.jitter.value = data.jitter;

  if (data.distribution) setRadioValue(els.distribution, data.distribution);
  if (data.randomMode !== undefined) els.randomMode.checked = data.randomMode;
  if (data.allowEdgeCuts !== undefined) els.allowEdgeCuts.checked = data.allowEdgeCuts;

  if (data.background) {
    if (data.background.mode) setRadioValue(els.bgMode, data.background.mode);
    if (data.background.color) els.bgColorPicker.value = data.background.color;
  }

  if (data.coloring) {
    if (data.coloring.mode) setRadioValue(els.colorMode, data.coloring.mode);
    if (data.coloring.singleColor) els.singleColorPicker.value = data.coloring.singleColor;
    if (data.coloring.colors) els.multiColorHex.value = data.coloring.colors.join(', ');
  }

  updateLabels();
  syncHeightToWidth();
  updateExportLabels();
}

async function* batchGeneratorByJson(jsonData, format) {
  const mode = document.querySelector('input[name="batchMode"]:checked')?.value || 'checked';
  let sourcesToProcess;

  if (mode === 'all') {
    sourcesToProcess = state.sources.slice();
  } else if (mode === 'original') {
    sourcesToProcess = null;
  } else {
    sourcesToProcess = checkedSources();
  }

  if (mode === 'original') {
    if (!checkedSources().length) {
      els.batchStatus.textContent = "Tidak ada file SVG yang dicentang untuk mode Original.";
      return;
    }
  } else {
    if (!sourcesToProcess.length) {
      els.batchStatus.textContent = "Tidak ada file SVG untuk diproses.";
      return;
    }
  }

  const backupChecked = state.sources.map(src => src.checked);

  const jpgDpi = parseInt(els.jpgDpi.value) || 300;
  const printWidth = parseFloat(els.printWidth.value) || 4;
  const printHeight = parseFloat(els.printHeight.value) || 4;
  const jpgQuality = parseFloat(els.jpgQuality.value) || 0.92;
  const pixelWidth = Math.round(printWidth * jpgDpi);
  const pixelHeight = Math.round(printHeight * jpgDpi);

  for (let i = 0; i < jsonData.length; i++) {
    const jsonItem = jsonData[i];
    applySettingsFromObject(jsonItem);
    const settings = getSettings();
    const seed = settings.seed || (i + 1);

    if (mode === 'original') {
      await drawPattern();
      await nextFrame();

      const baseName = `combined-${i + 1}-${seed}`;
      els.batchStatus.textContent = `[${i + 1}/${jsonData.length}] Original combined (seed ${seed})...`;

      if (format === "png" || format === "both") {
        const blob = await canvasToBlob(els.canvas);
        if (blob) yield { name: `png/${baseName}.png`, input: blob, lastModified: new Date() };
      }
      if (format === "svg" || format === "both") {
        const svg = buildSvgMarkup(settings, state.placements);
        yield {
          name: `svg/${baseName}.svg`,
          input: new Blob([svg], { type: "image/svg+xml" }),
          lastModified: new Date(),
        };
      }
      if (format === "jpg" || format === "both") {
        const jpgCanvas = document.createElement('canvas');
        jpgCanvas.width = pixelWidth;
        jpgCanvas.height = pixelHeight;
        const jpgCtx = jpgCanvas.getContext('2d');

        if (settings.background.mode === "color") {
          jpgCtx.fillStyle = settings.background.color;
          jpgCtx.fillRect(0, 0, pixelWidth, pixelHeight);
        }

        jpgCtx.drawImage(els.canvas, 0, 0, pixelWidth, pixelHeight);

        const jpgBlob = await new Promise(resolve => {
          jpgCanvas.toBlob(resolve, 'image/jpeg', jpgQuality);
        });

        if (jpgBlob) {
          yield {
            name: `jpg/${baseName}.jpg`,
            input: jpgBlob,
            lastModified: new Date()
          };
        }

        jpgCanvas.width = 0;
        jpgCanvas.height = 0;
      }
    } else {
      const sources = mode === 'all' ? state.sources : checkedSources();
      for (let s = 0; s < sources.length; s++) {
        const source = sources[s];
        state.sources.forEach(src => src.checked = false);
        source.checked = true;
        renderThumbStrip();
        updateFileLabel();

        await drawPattern();
        await nextFrame();

        const settingsLocal = getSettings();
        const seedLocal = settingsLocal.seed || (i + 1);
        const idxJson = i + 1;
        const idxSource = s + 1;
        const baseName = `${source.name.replace(/\.svg$/i, '')}-${idxJson}-${seedLocal}`;
        els.batchStatus.textContent = `[${idxJson}/${jsonData.length}] [${idxSource}/${sources.length}] ${source.name} (seed ${seedLocal})...`;

        if (format === "png" || format === "both") {
          const blob = await canvasToBlob(els.canvas);
          if (blob) yield { name: `png/${baseName}.png`, input: blob, lastModified: new Date() };
        }
        if (format === "svg" || format === "both") {
          const svg = buildSvgMarkup(settingsLocal, state.placements);
          yield {
            name: `svg/${baseName}.svg`,
            input: new Blob([svg], { type: "image/svg+xml" }),
            lastModified: new Date(),
          };
        }
        if (format === "jpg" || format === "both") {
          const jpgCanvas = document.createElement('canvas');
          jpgCanvas.width = pixelWidth;
          jpgCanvas.height = pixelHeight;
          const jpgCtx = jpgCanvas.getContext('2d');

          if (settingsLocal.background.mode === "color") {
            jpgCtx.fillStyle = settingsLocal.background.color;
            jpgCtx.fillRect(0, 0, pixelWidth, pixelHeight);
          }

          jpgCtx.drawImage(els.canvas, 0, 0, pixelWidth, pixelHeight);

          const jpgBlob = await new Promise(resolve => {
            jpgCanvas.toBlob(resolve, 'image/jpeg', jpgQuality);
          });

          if (jpgBlob) {
            yield {
              name: `jpg/${baseName}.jpg`,
              input: jpgBlob,
              lastModified: new Date()
            };
          }

          jpgCanvas.width = 0;
          jpgCanvas.height = 0;
        }
      }
    }
  }

  if (mode !== 'original') {
    state.sources.forEach((src, idx) => src.checked = backupChecked[idx]);
    renderThumbStrip();
    updateFileLabel();
  }
}

async function batchDownloadByJson() {
  if (!state.batchJsonData || !state.batchJsonData.length) {
    els.batchStatus.textContent = "Upload file JSON terlebih dahulu.";
    return;
  }

  const mode = document.querySelector('input[name="batchMode"]:checked')?.value || 'checked';
  const sources = mode === 'all' ? state.sources : checkedSources();
  if (!sources.length) {
    els.batchStatus.textContent = "Tidak ada file SVG untuk diproses.";
    return;
  }

  const format = els.batchFormat.value;
  const outputMode = els.batchOutputMode ? els.batchOutputMode.value : "zip";

  const originalSeed = els.seed.value;
  els.batchDownloadJsonBtn.disabled = true;
  els.batchStatus.textContent = "Menyiapkan batch dari JSON...";

  try {
    if (outputMode === "individual") {
      let fileCount = 0;
      for await (const file of batchGeneratorByJson(state.batchJsonData, format)) {
        const url = URL.createObjectURL(file.input);
        download(file.name, url);
        URL.revokeObjectURL(url);
        fileCount++;
        els.batchStatus.textContent = `Mengunduh ${fileCount} ...`;
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      els.batchStatus.textContent = `Selesai. ${fileCount} file diunduh secara individual.`;
    } else {
      const zipName = `batch-json-${Date.now()}.zip`;
      let handle = null;
      let useFilePicker = false;
      if (window.showSaveFilePicker) {
        try {
          handle = await window.showSaveFilePicker({
            suggestedName: zipName,
            types: [{ description: "ZIP archive", accept: { "application/zip": [".zip"] } }],
          });
          useFilePicker = true;
        } catch (error) {
          if (error?.name === "AbortError") {
            els.batchStatus.textContent = "Batch dibatalkan.";
            return;
          }
          console.warn("File picker failed, falling back to download:", error);
          handle = null;
          useFilePicker = false;
        }
      }

      const { downloadZip } = await import(CLIENT_ZIP_URL);
      const response = downloadZip(batchGeneratorByJson(state.batchJsonData, format));

      if (handle && useFilePicker) {
        try {
          const writable = await handle.createWritable();
          await response.body.pipeTo(writable);
          const total = state.batchJsonData.length * sources.length;
          els.batchStatus.textContent = `Selesai. ${total} pattern dari JSON disimpan ke ${zipName}.`;
        } catch (writeError) {
          console.warn("Failed to write via file picker, falling back to download:", writeError);
          const blob = await response.blob();
          const url = URL.createObjectURL(blob);
          download(zipName, url);
          window.setTimeout(() => URL.revokeObjectURL(url), 500);
          const total = state.batchJsonData.length * sources.length;
          els.batchStatus.textContent = `Selesai (fallback). ${total} pattern dari JSON diunduh sebagai ${zipName}.`;
        }
      } else {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        download(zipName, url);
        window.setTimeout(() => URL.revokeObjectURL(url), 500);
        const total = state.batchJsonData.length * sources.length;
        els.batchStatus.textContent = `Selesai. ${total} pattern dari JSON diunduh sebagai ${zipName}.`;
      }
    }
  } catch (error) {
    els.batchStatus.textContent = `Gagal membuat batch: ${error.message}`;
  } finally {
    els.seed.value = originalSeed;
    await drawPattern();
    els.batchDownloadJsonBtn.disabled = false;
  }
}

// ---------- EXPORT / IMPORT SETTINGS ----------
function exportSettings() {
  const settings = getSettings();
  const batchSeeds = state.batchSeeds && state.batchSeeds.length ? state.batchSeeds : [];
  const exportData = {
    ...settings,
    batchSeeds: batchSeeds,
  };
  exportData.baseScale = Math.round(exportData.baseScale * 100);
  exportData.scaleVariance = Math.round(exportData.scaleVariance * 100);
  exportData.jitter = Math.round(exportData.jitter * 100);

  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  download(`pattern-settings-${Date.now()}.json`, url);
  window.setTimeout(() => URL.revokeObjectURL(url), 500);
}

function importSettings(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);

      if (Array.isArray(data)) {
        state.batchJsonData = data;
        state.batchSeeds = [];
        els.batchStatus.textContent = `JSON batch loaded: ${data.length} entries.`;
        console.log('Batch JSON loaded:', data);
        return;
      }

      applySettingsFromObject(data);

      if (data.batchSeeds && Array.isArray(data.batchSeeds)) {
        state.batchSeeds = data.batchSeeds;
      } else {
        state.batchSeeds = [];
      }
      state.batchJsonData = null;

      els.batchStatus.textContent = `Settings loaded: ${Object.keys(data).length} properties.`;
      drawPattern().catch(console.error);
    } catch (err) {
      alert('File JSON tidak valid: ' + err.message);
      els.batchStatus.textContent = 'Gagal load JSON: ' + err.message;
    }
  };
  reader.readAsText(file);
}

// ---------- EVENT LISTENERS ----------
[
  els.count,
  els.seed,
  els.baseScale,
  els.scaleVariance,
  els.rotation,
  els.spacing,
  els.jitter,
  els.allowEdgeCuts,
].forEach((el) => {
  el.addEventListener("input", () => {
    updateLabels();
    drawPattern().catch(console.error);
  });
});

els.distribution.forEach((input) => {
  input.addEventListener("input", () => {
    els.randomMode.checked = input.value !== "grid";
    drawPattern().catch(console.error);
  });
});
els.randomMode.addEventListener("input", () => {
  setDistribution(els.randomMode.checked ? "random" : "grid");
  drawPattern().catch(console.error);
});

els.colorMode.forEach((input) => {
  input.addEventListener("input", () => {
    state.placements.forEach(item => delete item.renderSource);
    drawPattern().catch(console.error);
  });
});
els.multiColorHex.addEventListener("input", () => {
  state.placements.forEach(item => delete item.renderSource);
  drawPattern().catch(console.error);
});
els.singleColorPicker.addEventListener("input", () => {
  state.placements.forEach(item => delete item.renderSource);
  drawPattern().catch(console.error);
});

els.bgMode.forEach((input) => input.addEventListener("input", () => drawPattern().catch(console.error)));
els.bgColorPicker.addEventListener("input", () => drawPattern().catch(console.error));
els.randomColorBtn.addEventListener("click", () => {
  const total = clamp(Math.round(numberFrom(els.count)) || 6, 3, 12);
  const colors = Array.from({ length: total }, randomHexColor);
  els.multiColorHex.value = colors.join(", ");
  setRadioValue(els.colorMode, "multi");
  state.placements.forEach(item => delete item.renderSource);
  drawPattern().catch(console.error);
});
els.tileWidth.addEventListener("input", () => {
  syncHeightToWidth();
  updateExportLabels();
  drawPattern().catch(console.error);
});
els.tileHeight.addEventListener("input", () => {
  syncWidthToHeight();
  updateExportLabels();
  drawPattern().catch(console.error);
});
els.file.addEventListener("change", handleFiles);
els.thumbStrip.addEventListener("change", (event) => {
  const id = Number(event.target.dataset.toggle);
  if (!id) return;
  const source = state.sources.find((item) => item.id === id);
  if (source) source.checked = event.target.checked;
  updateFileLabel();
  drawPattern().catch(console.error);
});
els.thumbStrip.addEventListener("click", (event) => {
  const id = Number(event.target.dataset.remove);
  if (!id) return;
  const index = state.sources.findIndex((item) => item.id === id);
  if (index === -1) return;
  URL.revokeObjectURL(state.sources[index].url);
  state.sources.splice(index, 1);
  renderThumbStrip();
  updateFileLabel();
  drawPattern().catch(console.error);
});
els.generateBtn.addEventListener("click", () => drawPattern().catch(console.error));
els.autoLayoutBtn.addEventListener("click", applyAutoLayout);
els.sampleBtn.addEventListener("click", useSampleSvg);
els.shuffleBtn.addEventListener("click", shuffleSeed);
els.downloadPngBtn.addEventListener("click", downloadPng);
els.downloadSvgBtn.addEventListener("click", downloadSvg);
els.downloadJpgBtn.addEventListener("click", downloadJpg);
els.batchDownloadCountBtn.addEventListener("click", batchDownloadByCount);
els.batchDownloadJsonBtn.addEventListener("click", batchDownloadByJson);
els.previewScale.addEventListener("input", () => updatePreviewBackground());
els.showTile.addEventListener("input", () => updatePreviewBackground());
els.repeatCount.addEventListener("input", () => {
  updateRepeatLabel();
  updatePreviewBackground();
});

if (els.checkAllBtn) {
  els.checkAllBtn.addEventListener("click", checkAllFiles);
}
if (els.uncheckAllBtn) {
  els.uncheckAllBtn.addEventListener("click", uncheckAllFiles);
}
if (els.resetFilesBtn) {
  els.resetFilesBtn.addEventListener("click", resetFiles);
}

if (els.exportJsonBtn) {
  els.exportJsonBtn.addEventListener("click", exportSettings);
}
if (els.importJsonInput) {
  els.importJsonInput.addEventListener("change", (e) => {
    if (e.target.files.length) {
      importSettings(e.target.files[0]);
    }
    e.target.value = '';
  });
}

// ---------- JPG EVENT LISTENERS ----------
els.batchFormat.addEventListener('change', function() {
  if (this.value === 'jpg' || this.value === 'both') {
    els.jpgSettings.classList.add('visible');
    updatePixelDimensions();
  } else {
    els.jpgSettings.classList.remove('visible');
  }
});

els.jpgDpi.addEventListener('input', updatePixelDimensions);
els.printWidth.addEventListener('input', updatePixelDimensions);
els.printHeight.addEventListener('input', updatePixelDimensions);

document.querySelectorAll('.preset-size-btn').forEach(btn => {
  btn.addEventListener('click', function() {
    els.printWidth.value = this.dataset.w;
    els.printHeight.value = this.dataset.h;
    updatePixelDimensions();
  });
});

// ============================================================
// ASPECT RATIO EVENT LISTENER
// ============================================================

document.getElementById('applyAspectBtn').addEventListener('click', applyAspectRatio);

document.querySelectorAll('input[name="aspectRatio"]').forEach(radio => {
  radio.addEventListener('change', function() {
    // Optional: auto-apply without clicking button
    // applyAspectRatio();
  });
});

// ============================================================
// ASPECT RATIO
// ============================================================

function applyAspectRatio() {
  const selected = document.querySelector('input[name="aspectRatio"]:checked');
  if (!selected) return;

  const widthInput = document.getElementById('tileWidth');
  const heightInput = document.getElementById('tileHeight');

  const baseWidth = 3840;
  let targetHeight;

  switch (selected.value) {
    case '16:9':
      targetHeight = Math.round(baseWidth / (16 / 9));
      break;
    case '1:1':
      targetHeight = baseWidth;
      break;
    case '4:3':
      targetHeight = Math.round(baseWidth / (4 / 3));
      break;
    case '3:2':
      targetHeight = Math.round(baseWidth / (3 / 2));
      break;
    case '21:9':
      targetHeight = Math.round(baseWidth / (21 / 9));
      break;
    default:
      targetHeight = Math.round(baseWidth / (16 / 9));
  }

  widthInput.value = baseWidth;
  heightInput.value = targetHeight;

  syncHeightToWidth();
  updateExportLabels();
  drawPattern().catch(console.error);
}

// ============================================================
// COLLAPSIBLE SECTIONS
// ============================================================

document.querySelectorAll('.section-header').forEach(header => {
  header.addEventListener('click', function(e) {
    if (e.target.closest('.collapse-btn')) return;

    const targetId = this.dataset.section;
    const body = document.getElementById(`section-${targetId}`);
    const btn = this.querySelector('.collapse-btn');

    if (body) {
      body.classList.toggle('collapsed');
      btn.classList.toggle('collapsed');
      btn.textContent = body.classList.contains('collapsed') ? '+' : '−';
    }
  });
});

document.querySelectorAll('.collapse-btn').forEach(btn => {
  btn.addEventListener('click', function(e) {
    e.stopPropagation();
    const targetId = this.dataset.target;
    const body = document.getElementById(`section-${targetId}`);

    if (body) {
      body.classList.toggle('collapsed');
      this.classList.toggle('collapsed');
      this.textContent = body.classList.contains('collapsed') ? '+' : '−';
    }
  });
});

// ============================================================
// JPG ORIENTATION
// ============================================================

document.getElementById('applyOrientationBtn').addEventListener('click', function() {
  const orientation = document.querySelector('input[name="jpgOrientation"]:checked');
  if (!orientation) return;

  const widthInput = document.getElementById('printWidth');
  const heightInput = document.getElementById('printHeight');
  const currentWidth = parseFloat(widthInput.value) || 4;
  const currentHeight = parseFloat(heightInput.value) || 4;

  switch (orientation.value) {
    case 'portrait':
      if (currentWidth >= currentHeight) {
        widthInput.value = Math.min(currentWidth, currentHeight);
        heightInput.value = Math.max(currentWidth, currentHeight);
      }
      break;
    case 'landscape':
      if (currentWidth <= currentHeight) {
        widthInput.value = Math.max(currentWidth, currentHeight);
        heightInput.value = Math.min(currentWidth, currentHeight);
      }
      break;
    case 'square':
      const avg = (currentWidth + currentHeight) / 2;
      widthInput.value = Math.round(avg * 10) / 10;
      heightInput.value = Math.round(avg * 10) / 10;
      break;
  }

  updatePixelDimensions();
});

// ============================================================
// VERTICAL SLIDER
// ============================================================

function setVerticalSlider(containerId) {
  const container = document.getElementById(containerId);
  if (container) {
    container.classList.add('vertical');
  }
}

// ---------- INISIALISASI ----------
updateLabels();
updateExportLabels();
setDistribution("random");
updateFileLabel();
updateRepeatLabel();

// Set default aspect ratio ke 1:1 (SQUARE)
const defaultAspect = document.querySelector('input[name="aspectRatio"][value="1:1"]');
if (defaultAspect) {
  defaultAspect.checked = true;
  applyAspectRatio();
}

// Set default JPG orientation ke SQUARE
const defaultOrientation = document.querySelector('input[name="jpgOrientation"][value="square"]');
if (defaultOrientation) {
  defaultOrientation.checked = true;
  const widthInput = document.getElementById('printWidth');
  const heightInput = document.getElementById('printHeight');
  const avg = (parseFloat(widthInput.value) + parseFloat(heightInput.value)) / 2;
  widthInput.value = Math.round(avg * 10) / 10;
  heightInput.value = Math.round(avg * 10) / 10;
  updatePixelDimensions();
}

// Inisialisasi JPG settings
if (els.batchFormat.value === 'jpg' || els.batchFormat.value === 'both') {
  els.jpgSettings.classList.add('visible');
  updatePixelDimensions();
} else {
  els.jpgSettings.classList.remove('visible');
}

drawPattern().catch(console.error);