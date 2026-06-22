/**
 * Apply/export for fixed-index overworld gravestone table patches.
 */

const FORMAT = "zelda3-overworld-gravestones-v1";
const COORD_MAX = 4088;
const AREA_MAX = 0x3f;
const LOCAL_COORD_MAX = 0x3ff;
const U16_MAX = 0xffff;

export function snapshotGravestones(sourceData) {
  return (sourceData?.gravestones?.records || []).map(recordShape);
}

export function applyGravestonePatchDocument(sourceData, document) {
  const records = sourceData?.gravestones?.records || [];
  for (const operation of document?.patches || []) {
    if (operation?.kind !== "gravestone.record") {
      continue;
    }
    const index = integer(operation.index, "gravestone index");
    if (index < 0 || index >= records.length) {
      throw new Error(`Gravestone index ${index} is out of range`);
    }
    records[index] = patchedRecord(records[index], patchValue(operation, index));
  }
}

export function exportGravestonePatch(base, sourceData, existing) {
  const patches = (existing?.patches || []).filter((operation) => operation?.kind !== "gravestone.record");
  for (const record of sourceData?.gravestones?.records || []) {
    const current = recordShape(record);
    const original = base?.[record.index];
    if (JSON.stringify(current) !== JSON.stringify(original)) {
      patches.push({ kind: "gravestone.record", index: record.index, value: current });
    }
  }
  return { format: FORMAT, patches };
}

export function normalizeRecord(record) {
  const x = clampCoord(integer(record.x, "gravestone x"));
  const y = clampCoord(integer(record.y, "gravestone y"));
  const area = areaValue(record.area, x, y);
  validateLocalPosition(area, x, y, record.index);
  const expectedTilemap = tilemapFromPoint(area, x, y);
  const tilemapPos = tilemapValue(record, expectedTilemap);
  if (tilemapPos !== expectedTilemap) {
    throw new Error(
      `Gravestone ${record.index} tilemap does not match x/y/area; expected ${hex(expectedTilemap, 4)}`,
    );
  }
  return {
    ...record,
    area,
    x,
    y,
    localX: x - (area & 7) * 512,
    localY: y - (area >> 3) * 512,
    tilemapGridX: (tilemapPos >> 1) & 0x3f,
    tilemapGridY: tilemapPos >> 7,
    tilemapPos,
    triggerX: x,
    triggerY: y + 16,
  };
}

function recordShape(record) {
  const normalized = normalizeRecord(record);
  return {
    area: normalized.area,
    tilemapPos: normalized.tilemapPos,
    x: normalized.x,
    y: normalized.y,
  };
}

function patchValue(operation, index) {
  if (!hasOwn(operation, "value") || operation.value === null) {
    return {};
  }
  if (typeof operation.value !== "object" || Array.isArray(operation.value)) {
    throw new Error(`Gravestone record ${index} value must be an object`);
  }
  return operation.value;
}

function patchedRecord(before, value) {
  const record = { ...before, ...value };
  if (!hasOwn(value, "area")) {
    record.area = undefined;
  }
  if (!hasOwn(value, "tilemapPos") && !hasOwn(value, "tilemap_pos")) {
    record.tilemapPos = undefined;
    record.tilemap_pos = undefined;
  }
  return normalizeRecord(record);
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function tilemapFromPoint(area, x, y) {
  const localX = Math.floor((x - (area & 7) * 512) / 16);
  const localY = Math.floor((y - (area >> 3) * 512) / 16);
  return ((localY << 6) | (localX & 0x3f)) << 1;
}

function areaFromWorld(x, y) {
  return Math.floor(y / 512) * 8 + Math.floor(x / 512);
}

function clampCoord(value) {
  return Math.max(0, Math.min(COORD_MAX, value));
}

function areaValue(value, x, y) {
  if (value === undefined) {
    return areaFromWorld(x, y);
  }
  const area = integer(value, "gravestone area");
  if (area < 0 || area > AREA_MAX) {
    throw new Error(`Gravestone area must be 0..${hex(AREA_MAX, 2)}`);
  }
  return area;
}

function tilemapValue(record, fallback) {
  const value = record.tilemapPos ?? record.tilemap_pos;
  if (value === undefined || value === null) {
    return fallback;
  }
  const tilemapPos = integer(value, "gravestone tilemap");
  if (tilemapPos < 0 || tilemapPos > U16_MAX) {
    throw new Error("Gravestone tilemap must be 0..0xffff");
  }
  if (tilemapPos & 1) {
    throw new Error("Gravestone tilemap must be even");
  }
  return tilemapPos;
}

function validateLocalPosition(area, x, y, index) {
  const localX = x - (area & 7) * 512;
  const localY = y - (area >> 3) * 512;
  if (localX < 0 || localX > LOCAL_COORD_MAX) {
    throw new Error(`Gravestone ${index} x is outside area ${hex(area, 2)}`);
  }
  if (localY < 0 || localY > LOCAL_COORD_MAX) {
    throw new Error(`Gravestone ${index} y is outside area ${hex(area, 2)}`);
  }
}

function integer(value, label) {
  if (Number.isInteger(value)) {
    return value;
  }
  const text = String(value).trim();
  if (!/^[+-]?(?:0x[0-9a-f]+|\d+)$/i.test(text)) {
    throw new Error(`${label} must be an integer`);
  }
  const sign = text.startsWith("-") ? -1 : 1;
  const unsigned = text.replace(/^[+-]/, "");
  const parsed = unsigned.toLowerCase().startsWith("0x")
    ? sign * Number.parseInt(unsigned.slice(2), 16)
    : Number.parseInt(text, 10);
  if (!Number.isInteger(parsed)) {
    throw new Error(`${label} must be an integer`);
  }
  return parsed;
}

function hex(value, width) {
  return `0x${Number(value).toString(16).toUpperCase().padStart(width, "0")}`;
}
