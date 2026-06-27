/**
 * Converts saved terrain assets into map32 placements that the overworld terrain grid can store.
 */

import {
  map16WithMap8Word,
  map32WithMap16,
} from "./map32-transform-data.js?v=20260627-build-refs";

/**
 * Resolve the map32 id produced by painting one saved terrain asset into an inspected cell.
 *
 * Parameters:
 *   state: Shared Workbench state.
 *   info: Tile information returned by OverworldMapCache.inspect.
 *   asset: Selected saved terrain asset descriptor.
 * Returns:
 *   Numeric map32 id for the edited terrain cell, or null when the asset is unsupported.
 */
export function paintedMap32Id(state, info, asset) {
  if (!asset) {
    return null;
  }
  if (asset.kind === "map32") {
    return asset.value;
  }
  if (asset.kind === "map16") {
    return paintMap16Asset(state, info, asset.value);
  }
  if (asset.kind === "map8") {
    return paintMap8Asset(state, info, asset.value);
  }
  return null;
}

/**
 * Replace the selected map16 quadrant inside the current map32 definition.
 *
 * Parameters:
 *   state: Shared Workbench state.
 *   info: Tile inspection object.
 *   map16Id: Saved map16 asset id.
 * Returns:
 *   Numeric map32 id containing the replacement quadrant.
 */
function paintMap16Asset(state, info, map16Id) {
  return map32WithMap16(state, info.map32, selectedMap16Quadrant(info), map16Id);
}

/**
 * Replace one map8 word, then place the resulting map16 into the current map32 quadrant.
 *
 * Parameters:
 *   state: Shared Workbench state.
 *   info: Tile inspection object.
 *   map8Word: Saved packed map8 word.
 * Returns:
 *   Numeric map32 id containing the replacement word.
 */
function paintMap8Asset(state, info, map8Word) {
  const map16Id = map16WithMap8Word(state, info.map16, selectedMap8Slot(info), map8Word);
  return map32WithMap16(state, info.map32, selectedMap16Quadrant(info), map16Id);
}

/**
 * Resolve the selected 16x16 quadrant within the current 32x32 map32 tile.
 *
 * Parameters:
 *   info: Tile inspection object.
 * Returns:
 *   Zero-based tl/tr/bl/br quadrant index.
 */
function selectedMap16Quadrant(info) {
  return (info.map16Y & 1) * 2 + (info.map16X & 1);
}

/**
 * Resolve the selected 8x8 slot within the current 16x16 map16 tile.
 *
 * Parameters:
 *   info: Tile inspection object.
 * Returns:
 *   Zero-based tl/tr/bl/br slot index.
 */
function selectedMap8Slot(info) {
  return (info.map8Y & 1) * 2 + (info.map8X & 1);
}
