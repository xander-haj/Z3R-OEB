/**
 * Browser-side generated overworld topology model for Header.size edits.
 */

import {
  adjustGridRow,
  adjustPixelRow,
  clone,
  gridRowOffset,
  pixelRowOffset,
} from "./topology-row-shape.js?v=20260621-render-restore20";

const TOPOLOGY_STRIDE = 192;
const SPECIAL_AREA_END = 160;
const GRID_STEP = 32;
const PIXEL_STEP = 512;
const SIZE_CODES = { small: 0, big: 1, large: 1, wide: 2, tall: 3 };
const SIZE_NAMES = ["small", "big", "wide", "tall"];
const SIZE_OFFSETS = {
  small: [0],
  big: [0, 1, 8, 9],
  large: [0, 1, 8, 9],
  wide: [0, 1],
  tall: [0, 8],
};

/** Validate one Header.size edit against generated topology ownership rules. */
export function validateHeaderSizeEdit(sourceData, area, oldSize, newSize) {
  const oldCanonical = canonicalTopologySize(oldSize);
  const newCanonical = canonicalTopologySize(newSize);
  if (!Number.isInteger(area) || area < 0 || area >= SPECIAL_AREA_END) {
    return "Header.size area is outside the editable overworld topology range.";
  }
  if (oldCanonical === newCanonical || area >= 128) {
    return "";
  }
  const fitError = topologyFitError(area, newCanonical);
  if (fitError) {
    return fitError;
  }
  const topology = buildSourceTopology(sourceData, new Map([[area, oldCanonical]]));
  if (topology.parents[area] !== area) {
    return `Header.size can only change on area head ${hex(area, 2)}.`;
  }
  return absorbedOwnerError(area, oldCanonical, newCanonical, topology);
}

/** Regenerate mutable area parent and size arrays after Header.size changes. */
export function refreshSourceTopology(sourceData) {
  const topology = buildSourceTopology(sourceData);
  replaceArray(sourceData.areaParentIds, topology.parents);
  replaceArray(sourceData.areaSizes, topology.sizes);
  return topology;
}

/**
 * Move browser metadata records the same way topology_patch.py moves YAML rows.
 *
 * Expansions copy absorbed child rows into the new parent but leave the child
 * object unchanged, avoiding export of stale "empty deleted child file" patches.
 */
export function resizeSourceTopologyRecords(sourceData, area, oldSize, newSize) {
  const oldCanonical = canonicalTopologySize(oldSize);
  const newCanonical = canonicalTopologySize(newSize);
  if (!sourceData?.areaHeaders || area >= 128 || oldCanonical === newCanonical) {
    return;
  }
  const topology = buildSourceTopology(sourceData, new Map([[area, oldCanonical]]));
  const parent = sourceData.areaHeaders[area];
  if (!parent) {
    return;
  }
  const oldOffsets = SIZE_OFFSETS[oldCanonical];
  const newOffsets = SIZE_OFFSETS[newCanonical];
  splitParentRecords(sourceData, area, parent, newOffsets, oldOffsets);
  mergeNewChildren(sourceData, area, parent, oldOffsets, newOffsets, topology);
}

/** Build generated topology from current Header.size values. */
function buildSourceTopology(sourceData, overrides = new Map()) {
  const parents = Array.from({ length: TOPOLOGY_STRIDE }, (_, area) => area);
  const sizes = Array.from({ length: TOPOLOGY_STRIDE }, () => 0);
  const children = {};
  for (const worldBase of [0, 64]) {
    const covered = new Set();
    for (let y = 0; y < 8; y += 1) {
      for (let x = 0; x < 8; x += 1) {
        const area = worldBase + y * 8 + x;
        if (!covered.has(area)) {
          claimArea(sourceData, overrides, parents, sizes, children, covered, area);
        }
      }
    }
  }
  for (let area = 128; area < SPECIAL_AREA_END; area += 1) {
    const size = areaSize(sourceData, overrides, area);
    parents[area] = area;
    sizes[area] = SIZE_CODES[size];
    children[area] = [area];
  }
  return { children, parents, sizes };
}

/** Claim one normal-world parent and every child cell owned by its size. */
function claimArea(sourceData, overrides, parents, sizes, children, covered, area) {
  const size = areaSize(sourceData, overrides, area);
  const owned = [];
  for (const offset of SIZE_OFFSETS[size]) {
    const child = area + offset;
    covered.add(child);
    parents[child] = area;
    sizes[child] = SIZE_CODES[size];
    owned.push(child);
  }
  children[area] = owned;
}

function splitParentRecords(sourceData, area, parent, keptOffsets, oldOffsets) {
  for (const offset of oldOffsets) {
    if (offset && !keptOffsets.includes(offset)) {
      childHeader(sourceData, parent, area + offset);
    }
  }
  splitGridList(sourceData, area, parent, parent.navigation, "entrances", keptOffsets);
  splitGridList(sourceData, area, parent, parent.navigation, "holes", keptOffsets);
  splitGridList(sourceData, area, parent, parent, "staticOverlays", keptOffsets);
  splitGridList(sourceData, area, parent, parent.interactions, "items", keptOffsets);
  splitPixelList(sourceData, area, parent, parent.navigation, "travel", keptOffsets);
  splitPixelList(sourceData, area, parent, parent.navigation, "exits", keptOffsets);
  splitSpriteSets(sourceData, area, parent, keptOffsets);
}

function mergeNewChildren(sourceData, area, parent, oldOffsets, newOffsets, topology) {
  const merged = new Set();
  for (const offset of newOffsets) {
    if (oldOffsets.includes(offset) || offset === 0) {
      continue;
    }
    const owner = topology.parents[area + offset] ?? area + offset;
    const child = sourceData.areaHeaders[owner];
    if (!child || owner === area || merged.has(owner)) {
      continue;
    }
    const ownerOffset = owner - area;
    mergeGridList(parent.navigation, child.navigation, "entrances", ownerOffset);
    mergeGridList(parent.navigation, child.navigation, "holes", ownerOffset);
    mergeGridList(parent, child, "staticOverlays", ownerOffset);
    mergeGridList(parent.interactions, child.interactions, "items", ownerOffset);
    mergePixelList(parent.navigation, child.navigation, "travel", ownerOffset);
    mergePixelList(parent.navigation, child.navigation, "exits", ownerOffset);
    mergeSpriteSets(parent, child, ownerOffset);
    merged.add(owner);
  }
}

function splitGridList(sourceData, area, parent, target, key, keptOffsets) {
  if (!target?.[key]) {
    return;
  }
  const kept = [];
  for (const row of target[key]) {
    const offset = gridRowOffset(row);
    if (keptOffsets.includes(offset)) {
      kept.push(row);
    } else {
      const child = childHeader(sourceData, parent, area + offset);
      const childTarget = childTargetFor(child, target);
      childTarget[key] = childTarget[key] || [];
      childTarget[key].push(adjustGridRow(row, offset, -GRID_STEP));
    }
  }
  target[key] = kept;
}

function splitPixelList(sourceData, area, parent, target, key, keptOffsets) {
  if (!target?.[key]) {
    return;
  }
  const kept = [];
  for (const row of target[key]) {
    const offset = pixelRowOffset(row);
    if (keptOffsets.includes(offset)) {
      kept.push(row);
    } else {
      const child = childHeader(sourceData, parent, area + offset);
      child.navigation[key] = child.navigation[key] || [];
      child.navigation[key].push(adjustPixelRow(row, offset, -PIXEL_STEP));
    }
  }
  target[key] = kept;
}

function splitSpriteSets(sourceData, area, parent, keptOffsets) {
  for (const [stage, set] of uniqueSpriteEntries(parent.spriteSets)) {
    const kept = [];
    for (const row of set.sprites || []) {
      const offset = gridRowOffset(row);
      if (keptOffsets.includes(offset)) {
        kept.push(row);
      } else {
        const child = childHeader(sourceData, parent, area + offset);
        ensureSpriteStage(child, stage, set).sprites.push(adjustGridRow(row, offset, -GRID_STEP));
      }
    }
    set.sprites = kept;
  }
}

function mergeGridList(parent, child, key, offset) {
  parent[key] = parent[key] || [];
  parent[key].push(...(child?.[key] || []).map((row) => adjustGridRow(row, offset, GRID_STEP)));
}

function mergePixelList(parent, child, key, offset) {
  parent[key] = parent[key] || [];
  parent[key].push(...(child?.[key] || []).map((row) => adjustPixelRow(row, offset, PIXEL_STEP)));
}

function mergeSpriteSets(parent, child, offset) {
  for (const [stage, set] of uniqueSpriteEntries(child.spriteSets)) {
    const target = ensureSpriteStage(parent, stage, set);
    target.sprites.push(...(set.sprites || []).map((row) => adjustGridRow(row, offset, GRID_STEP)));
  }
}

function childHeader(sourceData, parent, area) {
  const child = sourceData.areaHeaders[area] || { area };
  child.area = area;
  child.exists = true;
  child.size = "small";
  child.gfx = child.gfx ?? parent.gfx;
  child.palette = child.palette ?? parent.palette;
  child.navigation = child.navigation || { travel: [], entrances: [], holes: [], exits: [] };
  child.interactions = child.interactions || { items: [], shovelSpots: [] };
  child.spriteSets = child.spriteSets || {};
  child.staticOverlays = child.staticOverlays || [];
  sourceData.areaHeaders[area] = child;
  return child;
}

function childTargetFor(child, target) {
  if (target === child.navigation || target?.travel || target?.entrances || target?.holes || target?.exits) {
    return child.navigation;
  }
  if (target === child.interactions || target?.items || target?.shovelSpots) {
    return child.interactions;
  }
  return child;
}

function ensureSpriteStage(header, stage, template) {
  header.spriteSets = header.spriteSets || {};
  const set = header.spriteSets[stage] || { info: clone(template?.info || {}), sprites: [] };
  set.sprites = set.sprites || [];
  header.spriteSets[stage] = set;
  if (header.area >= 64 && ["beginning", "first", "second"].includes(stage)) {
    header.spriteSets.beginning = set;
    header.spriteSets.first = set;
    header.spriteSets.second = set;
  }
  return set;
}

function uniqueSpriteEntries(spriteSets = {}) {
  const keys = ["first", "beginning", "second", ...Object.keys(spriteSets)];
  const seenKeys = new Set(), seenSets = new Set(), result = [];
  for (const key of keys) {
    const set = spriteSets[key];
    if (!set || seenKeys.has(key) || seenSets.has(set)) {
      continue;
    }
    seenKeys.add(key);
    seenSets.add(set);
    result.push([key, set]);
  }
  return result;
}

/**
 * Return an error when expanding would partially absorb another parent.
 */
function absorbedOwnerError(area, oldSize, newSize, topology) {
  const oldChildren = childSet(area, oldSize);
  const newChildren = childSet(area, newSize);
  const checked = new Set();
  for (const child of [...newChildren].filter((item) => !oldChildren.has(item)).sort((a, b) => a - b)) {
    const owner = topology.parents[child];
    if (owner === area || checked.has(owner)) {
      continue;
    }
    const owned = new Set(topology.children[owner] || [owner]);
    if (![...owned].every((item) => newChildren.has(item))) {
      return `Header.size for ${hex(area, 2)} would partially absorb ${hex(owner, 2)}.`;
    }
    checked.add(owner);
  }
  return "";
}

/**
 * Return a set of child area ids that one area size owns.
 */
function childSet(area, size) {
  return new Set(SIZE_OFFSETS[size].map((offset) => area + offset));
}

/**
 * Read and canonicalize an area Header.size value.
 */
function areaSize(sourceData, overrides, area) {
  const value = overrides.get(area) ?? sourceData?.areaHeaders?.[area]?.header?.size ??
    sourceData?.areaHeaders?.[area]?.size;
  return canonicalTopologySize(value);
}

/**
 * Return the canonical size keyword used by local compiler tables.
 */
function canonicalTopologySize(value) {
  const code = SIZE_CODES[value];
  return Number.isInteger(code) ? SIZE_NAMES[code] : "small";
}

/**
 * Return an error when a size would cross the 8x8 normal-world grid.
 */
function topologyFitError(area, size) {
  const x = area & 7;
  const y = (area & 63) >> 3;
  if ((size === "big" || size === "wide") && x >= 7) {
    return `Header.size ${size} in area ${hex(area, 2)} crosses the east world edge.`;
  }
  if ((size === "big" || size === "tall") && y >= 7) {
    return `Header.size ${size} in area ${hex(area, 2)} crosses the south world edge.`;
  }
  return "";
}

/**
 * Replace an existing array in place so group objects keep their reference.
 */
function replaceArray(target, values) {
  if (!Array.isArray(target)) {
    return;
  }
  target.splice(0, target.length, ...values);
}

/**
 * Format an area id as a fixed-width uppercase hex number.
 */
function hex(value, width) {
  return `0x${Number(value).toString(16).toUpperCase().padStart(width, "0")}`;
}
