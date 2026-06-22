/**
 * Data helpers for generated map32/map16 transform definitions.
 */

import { applyTileDefinitionPatches } from "./tile-definition-preview.js?v=20260621-render-restore20";

const MAP32_FORMAT = "zelda3-overworld-map32-definitions-v1";
const MAP16_FORMAT = "zelda3-overworld-map16-definitions-v1";
const QUADRANTS = ["tl", "tr", "bl", "br"];

/**
 * Reset transform state and apply existing tile-definition patches for preview.
 *
 * Parameters:
 *   state: Shared Workbench state.
 *   patches: Optional loaded patch documents.
 * Returns:
 *   None.
 */
export function initializeTransformData(state, patches = {}) {
  state.map32TransformState = {
    map16Definitions: [],
    map32Definitions: [],
    map16Ids: new Map(),
    map32Ids: new Map(),
    nextMap16Id: state.assets.map16ToMap8.length / 4,
    nextMap32Id: state.assets.map32ToMap16.length,
  };
  applyTileDefinitionPatches(state, patches);
}

/**
 * Merge editor-created map32 definitions into the saved patch document.
 *
 * Parameters:
 *   state: Shared Workbench state.
 *   existing: Existing patch document from the editor.
 * Returns:
 *   Patch document with generated map32 definitions included.
 */
export function exportMap32TransformPatch(state, existing) {
  return mergeDefinitions(existing, MAP32_FORMAT, state.map32TransformState?.map32Definitions || []);
}

/**
 * Merge editor-created map16 definitions into the saved patch document.
 *
 * Parameters:
 *   state: Shared Workbench state.
 *   existing: Existing patch document from the editor.
 * Returns:
 *   Patch document with generated map16 definitions included.
 */
export function exportMap16TransformPatch(state, existing) {
  return mergeDefinitions(existing, MAP16_FORMAT, state.map32TransformState?.map16Definitions || []);
}

/**
 * Return or create a transformed map32 id.
 *
 * Parameters:
 *   state: Shared Workbench state.
 *   map32Id: Source map32 id.
 *   transform: rotateLeft, rotateRight, flipHorizontal, or flipVertical.
 * Returns:
 *   Numeric map32 id for the transformed tile.
 */
export function transformedMap32Id(state, map32Id, transform) {
  const grid = map32ToMap8Grid(state.assets, map32Id);
  const transformed = transformGrid(grid, transform);
  const map16Ids = gridToMap16Ids(state, transformed);
  return defineMap32(state, map16Ids, map32Id);
}

/**
 * Format a numeric id as uppercase hex.
 *
 * Parameters:
 *   value: Numeric id.
 * Returns:
 *   Hex string.
 */
export function hex(value) {
  return `0x${Number(value).toString(16).toUpperCase().padStart(4, "0")}`;
}

/**
 * Expand one map32 id into a 4x4 grid of map8 words.
 *
 * Parameters:
 *   assets: ZeldaAssets object.
 *   map32Id: Source map32 id.
 * Returns:
 *   4x4 matrix of map8 words.
 */
function map32ToMap8Grid(assets, map32Id) {
  const ids = assets.map32ToMap16[map32Id];
  return [
    [...map16Words(assets, ids[0]).slice(0, 2), ...map16Words(assets, ids[1]).slice(0, 2)],
    [...map16Words(assets, ids[0]).slice(2, 4), ...map16Words(assets, ids[1]).slice(2, 4)],
    [...map16Words(assets, ids[2]).slice(0, 2), ...map16Words(assets, ids[3]).slice(0, 2)],
    [...map16Words(assets, ids[2]).slice(2, 4), ...map16Words(assets, ids[3]).slice(2, 4)],
  ];
}

/**
 * Return the four map8 words that make up one map16 id.
 *
 * Parameters:
 *   assets: ZeldaAssets object.
 *   map16Id: Source map16 id.
 * Returns:
 *   Four map8 words ordered tl, tr, bl, br.
 */
function map16Words(assets, map16Id) {
  return Array.from(assets.map16ToMap8.slice(map16Id * 4, map16Id * 4 + 4));
}

/**
 * Transform a 4x4 map8-word grid.
 *
 * Parameters:
 *   grid: 4x4 map8-word matrix.
 *   transform: Transform name.
 * Returns:
 *   Transformed 4x4 matrix.
 */
function transformGrid(grid, transform) {
  if (transform === "flipHorizontal") {
    return grid.map((row) => row.slice().reverse().map((word) => word ^ 0x4000));
  }
  if (transform === "flipVertical") {
    return grid.slice().reverse().map((row) => row.map((word) => word ^ 0x8000));
  }
  if (transform === "rotateRight") {
    return grid[0].map((_, x) => grid.map((row) => row[x]).reverse());
  }
  return grid[0].map((_, x) => grid.map((row) => row[grid.length - 1 - x]));
}

/**
 * Convert a transformed 4x4 map8 grid into four map16 ids.
 *
 * Parameters:
 *   state: Shared Workbench state.
 *   grid: 4x4 map8-word matrix.
 * Returns:
 *   Four map16 ids ordered tl, tr, bl, br.
 */
function gridToMap16Ids(state, grid) {
  return [
    defineMap16(state, [grid[0][0], grid[0][1], grid[1][0], grid[1][1]]),
    defineMap16(state, [grid[0][2], grid[0][3], grid[1][2], grid[1][3]]),
    defineMap16(state, [grid[2][0], grid[2][1], grid[3][0], grid[3][1]]),
    defineMap16(state, [grid[2][2], grid[2][3], grid[3][2], grid[3][3]]),
  ];
}

/**
 * Return an existing map16 id for a word pattern, or append a generated one.
 *
 * Parameters:
 *   state: Shared Workbench state.
 *   words: Four map8 words.
 * Returns:
 *   Numeric map16 id.
 */
function defineMap16(state, words) {
  const key = words.join(",");
  const existing = findExistingMap16(state.assets, key);
  if (existing !== null) {
    return existing;
  }
  const id = state.assets.map16ToMap8.length / 4;
  state.assets.map16ToMap8 = [...Array.from(state.assets.map16ToMap8), ...words];
  syncMapCache(state);
  state.map32TransformState.map16Definitions.push({
    kind: "tile.map16-definition",
    id,
    setMap8: Object.fromEntries(QUADRANTS.map((label, index) => [label, hex(words[index])])),
  });
  return id;
}

/**
 * Return an existing map32 id for a map16 pattern, or append a generated one.
 *
 * Parameters:
 *   state: Shared Workbench state.
 *   map16Ids: Four map16 ids.
 *   source: Source map32 id used for readable generated definitions.
 * Returns:
 *   Numeric map32 id.
 */
function defineMap32(state, map16Ids, source) {
  const key = map16Ids.join(",");
  const existing = findExistingMap32(state.assets, key);
  if (existing !== null) {
    return existing;
  }
  const id = state.assets.map32ToMap16.length;
  state.assets.map32ToMap16.push(map16Ids);
  state.map32TransformState.map32Definitions.push({
    kind: "tile.map32-definition",
    id,
    from: hex(source),
    setMap16: Object.fromEntries(QUADRANTS.map((label, index) => [label, map16Ids[index]])),
  });
  return id;
}

/**
 * Find a map16 id that already matches serialized words.
 *
 * Parameters:
 *   assets: ZeldaAssets object.
 *   key: Comma-joined four-word signature.
 * Returns:
 *   Numeric map16 id, or null.
 */
function findExistingMap16(assets, key) {
  for (let id = 0; id < assets.map16ToMap8.length / 4; id += 1) {
    if (map16Words(assets, id).join(",") === key) {
      return id;
    }
  }
  return null;
}

/**
 * Find a map32 id that already matches serialized map16 ids.
 *
 * Parameters:
 *   assets: ZeldaAssets object.
 *   key: Comma-joined four-map16 signature.
 * Returns:
 *   Numeric map32 id, or null.
 */
function findExistingMap32(assets, key) {
  for (let id = 0; id < assets.map32ToMap16.length; id += 1) {
    if (assets.map32ToMap16[id]?.join(",") === key) {
      return id;
    }
  }
  return null;
}

/**
 * Keep OverworldMapCache pointed at the current map16 table.
 *
 * Parameters:
 *   state: Shared Workbench state.
 * Returns:
 *   None.
 */
function syncMapCache(state) {
  if (state.app?.mapCache) {
    state.app.mapCache.map16ToMap8 = state.assets.map16ToMap8;
  }
}

/**
 * Merge generated definitions into an existing patch document without duplicating ids.
 *
 * Parameters:
 *   existing: Existing patch document.
 *   format: Patch format string.
 *   generated: Generated definitions from this editor session.
 * Returns:
 *   Patch document.
 */
function mergeDefinitions(existing, format, generated) {
  const ids = new Set(generated.map((definition) => String(definition.id)));
  const kept = (existing?.definitions || []).filter((definition) => !ids.has(String(definition.id)));
  return { format, definitions: [...kept, ...generated] };
}
