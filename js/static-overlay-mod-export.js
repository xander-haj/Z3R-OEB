/**
 * Metadata apply/export for editable static overworld overlay tile writes.
 */

const FORMAT = "zelda3-overworld-metadata-v1";
const OVERLAYS_PATH = ["Overlays"];
const SCREEN_COUNT = 160;

export function snapshotStaticOverlays(sourceData) {
  return (sourceData?.areaHeaders || []).map((header) => (
    (header?.staticOverlays || []).map(toYamlStaticOverlay)
  ));
}

export function applyStaticOverlayPatchDocument(sourceData, document) {
  for (const operation of document?.patches || []) {
    if (!isStaticOverlayOperation(operation)) {
      continue;
    }
    const area = numeric(operation.area ?? operation.screen, -1);
    if (area < 0 || area >= SCREEN_COUNT) {
      continue;
    }
    const header = sourceData?.areaHeaders?.[area];
    if (!header) {
      continue;
    }
    applyOverlayOperation(header, operation);
  }
}

export function exportStaticOverlayPatch(base, sourceData, existing) {
  const patches = (existing?.patches || []).filter((operation) => !isOwnedStaticOverlayOperation(operation));
  const areaCount = Math.min(SCREEN_COUNT, (sourceData?.areaHeaders || []).length);
  for (let area = 0; area < areaCount; area += 1) {
    const current = (sourceData.areaHeaders[area]?.staticOverlays || []).map(toYamlStaticOverlay);
    const original = base?.[area] || [];
    if (JSON.stringify(current) !== JSON.stringify(original)) {
      patches.push({ kind: "metadata.static-overlay", area, path: OVERLAYS_PATH, value: current });
    }
  }
  return { format: FORMAT, patches };
}

export function cloneStaticOverlayRecord(value, limits) {
  return normalizeStaticOverlay(value, limits);
}

export function normalizeStaticOverlay(value, limits = { x: 63, y: 63 }) {
  return {
    tile: rangedInteger(value?.tile ?? value?.tileId ?? value?.tile_id, "tile", 0, 0xffff),
    x: rangedInteger(value?.x, "x", 0, limits.x),
    y: rangedInteger(value?.y, "y", 0, limits.y),
  };
}

export function toYamlStaticOverlay(value) {
  const row = normalizeStaticOverlay(value);
  return { x: row.x, y: row.y, tile: row.tile };
}

function applyOverlayOperation(header, operation) {
  const path = normalizeOverlayPath(operation.path);
  header.staticOverlays = header.staticOverlays || [];
  if (path.length <= 1) {
    header.staticOverlays = overlayListValue(operation.value).map((row) => (
      normalizeStaticOverlay(row)
    ));
    return;
  }
  const index = requireOverlayIndex(path[1], header.staticOverlays.length);
  if (path.length === 2) {
    header.staticOverlays[index] = normalizeStaticOverlay(operation.value);
    return;
  }
  if (path.length !== 3) {
    throw new Error("Overlays rows only support x, y, and tile fields");
  }
  const row = toYamlStaticOverlay(header.staticOverlays[index]);
  row[overlayRowKey(path[2])] = operation.value;
  header.staticOverlays[index] = normalizeStaticOverlay(row);
}

function normalizeOverlayPath(path) {
  if (path === undefined || path === null) {
    return OVERLAYS_PATH;
  }
  return Array.isArray(path) ? path : [path];
}

function overlayListValue(value) {
  if (value === undefined || value === null) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new Error("Overlays metadata must be a list");
  }
  return value;
}

function requireOverlayIndex(value, length) {
  const index = numeric(value, -1);
  if (index < 0 || index >= length) {
    throw new Error(`Overlays index ${index} is outside the current overlay list`);
  }
  return index;
}

function overlayRowKey(key) {
  const field = String(key);
  if (field === "tile_id") {
    return "tile";
  }
  if (field !== "x" && field !== "y" && field !== "tile") {
    throw new Error("Overlays rows only support x, y, and tile fields");
  }
  return field;
}

function isStaticOverlayOperation(operation) {
  const pathKey = Array.isArray(operation?.path) ? operation.path[0] : operation?.path;
  return operation?.kind === "metadata.static-overlay" || pathKey === "Overlays";
}

function isOwnedStaticOverlayOperation(operation) {
  const area = numeric(operation?.area ?? operation?.screen, -1);
  return isStaticOverlayOperation(operation) && area >= 0 && area < SCREEN_COUNT;
}

function numeric(value, fallback = 0) {
  if (Number.isInteger(value)) {
    return value;
  }
  const match = String(value ?? "").trim().match(/^(-?)(?:0x([0-9a-f]+)|([0-9]+))$/i);
  if (!match) {
    return fallback;
  }
  return (match[1] === "-" ? -1 : 1) * Number.parseInt(match[2] ?? match[3], match[2] ? 16 : 10);
}

function rangedInteger(value, label, min, max) {
  const parsed = strictInteger(value, label);
  if (parsed < min || parsed > max) {
    throw new Error(`Static overlay ${label} must be between ${min} and ${max}`);
  }
  return parsed;
}

function strictInteger(value, label) {
  if (typeof value === "number" && Number.isInteger(value)) {
    return value;
  }
  if (typeof value !== "string") {
    throw new Error(`Static overlay ${label} must be an integer`);
  }
  const text = value.trim();
  const radix = /^[-+]?0x[0-9a-f]+$/i.test(text) ? 16 : 10;
  if (radix === 10 && !/^[-+]?\d+$/.test(text)) {
    throw new Error(`Static overlay ${label} must be an integer`);
  }
  return Number.parseInt(text, radix);
}
