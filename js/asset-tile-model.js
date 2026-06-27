/**
 * Saved tile asset construction and display helpers for map32, map16, and map8 selections.
 */

import { parseNumber } from "./operations.js?v=20260621-render-restore20";
import { selectedTileRect } from "./tile-selection.js?v=20260621-render-restore20";

// Asset previews are normalized to a compact square so all grid levels align in the asset list.
const PREVIEW_SIZE = 32;

// Saved terrain asset kinds use explicit payload fields while preserving old implicit map32 entries.
const TILE_ASSET_FIELDS = {
  map32: "map32",
  map16: "map16",
  map8: "map8Word",
};

// Each grid level stores the coordinate that matches the exact selected terrain granularity.
const TILE_ASSET_COORDS = {
  map32: ["map32X", "map32Y"],
  map16: ["map16X", "map16Y"],
  map8: ["map8X", "map8Y"],
};

/**
 * Build a saved terrain asset from the currently inspected grid level.
 *
 * Parameters:
 *   state: Shared Workbench state.
 *   info: Tile information returned by OverworldMapCache.inspect.
 *   id: Unique asset id supplied by the asset library owner.
 * Returns:
 *   Saved terrain asset entry.
 */
export function buildTileAsset(state, info, id) {
  const gridLevel = normalizeTileAssetGrid(info?.inspectGrid || state.inspectGrid);
  const value = selectedTileValue(info, gridLevel);
  const coord = selectedTileCoordinate(info, gridLevel);
  const field = TILE_ASSET_FIELDS[gridLevel];
  return {
    id,
    kind: gridLevel,
    name: `${tileAssetKindLabel(gridLevel)} ${hex(value)} from ${hex(info.screen, 2)} ${coord.x},${coord.y}`,
    [field]: `base:${hex(value)}`,
    preview: captureTileAssetPreview(state, info, gridLevel),
    source: {
      group: state.group.id,
      screen: hex(info.screen, 2),
      grid: gridLevel,
      x: coord.x,
      y: coord.y,
    },
  };
}

/**
 * Return the map32 id from a selected saved asset when it is paint-compatible.
 *
 * Parameters:
 *   tile: Saved asset entry, or null.
 * Returns:
 *   Numeric map32 id, or null for non-map32 assets.
 */
export function selectedTileMap32Value(tile) {
  const asset = terrainAssetPayload(tile);
  if (asset?.kind !== "map32") {
    return null;
  }
  return asset.value;
}

/**
 * Return the selected terrain asset kind and numeric value.
 *
 * Parameters:
 *   tile: Saved asset entry, or null.
 * Returns:
 *   Object with kind and value, or null for unsupported assets.
 */
export function terrainAssetPayload(tile) {
  if (!tile || tile.kind === "sprite") {
    return null;
  }
  const value = parseStoredRef(storedTileRef(tile));
  return Number.isFinite(value) ? { kind: storedTileKind(tile), value } : null;
}

/**
 * Build the compact label shown for saved terrain assets.
 *
 * Parameters:
 *   tile: Saved asset entry.
 * Returns:
 *   User-facing asset label.
 */
export function tileAssetDisplayLabel(tile) {
  const kind = storedTileKind(tile);
  const ref = storedTileRef(tile);
  return ref ? `${tileAssetKindLabel(kind)} ${ref} - ${tile.name}` : tile.name;
}

/**
 * Normalize a caller-provided grid name to a supported terrain asset kind.
 *
 * Parameters:
 *   value: Candidate grid level.
 * Returns:
 *   map32, map16, or map8.
 */
export function normalizeTileAssetGrid(value) {
  return value === "map16" || value === "map8" ? value : "map32";
}

/**
 * Return the short user-facing label for one terrain grid level.
 *
 * Parameters:
 *   gridLevel: map32, map16, or map8.
 * Returns:
 *   Display label.
 */
export function tileAssetKindLabel(gridLevel) {
  if (gridLevel === "map8") {
    return "Map8";
  }
  if (gridLevel === "map16") {
    return "Map16";
  }
  return "Map32";
}

/**
 * Read the selected value for one terrain grid level.
 *
 * Parameters:
 *   info: Tile inspection info.
 *   gridLevel: map32, map16, or map8.
 * Returns:
 *   Numeric tile reference.
 */
function selectedTileValue(info, gridLevel) {
  if (gridLevel === "map8") {
    return info.map8Word;
  }
  if (gridLevel === "map16") {
    return info.map16;
  }
  return info.map32;
}

/**
 * Read the coordinate pair that matches the selected terrain grid level.
 *
 * Parameters:
 *   info: Tile inspection info.
 *   gridLevel: map32, map16, or map8.
 * Returns:
 *   Object with the selected grid coordinate.
 */
function selectedTileCoordinate(info, gridLevel) {
  const [xKey, yKey] = TILE_ASSET_COORDS[gridLevel];
  return { x: info[xKey], y: info[yKey] };
}

/**
 * Capture the selected terrain cell and scale smaller grid levels into the standard preview square.
 *
 * Parameters mirror buildTileAsset except gridLevel is already normalized.
 * Returns:
 *   PNG data URL, or null when no rendered source exists.
 */
function captureTileAssetPreview(state, info, gridLevel) {
  if (!state.worldCanvas || !info) {
    return null;
  }
  const rect = selectedTileRect(info, gridLevel);
  const canvas = document.createElement("canvas");
  canvas.width = PREVIEW_SIZE;
  canvas.height = PREVIEW_SIZE;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(
    state.worldCanvas,
    rect.x,
    rect.y,
    rect.size,
    rect.size,
    0,
    0,
    PREVIEW_SIZE,
    PREVIEW_SIZE,
  );
  return canvas.toDataURL("image/png");
}

/**
 * Resolve the stored terrain kind, preserving compatibility with legacy entries that omit kind.
 *
 * Parameters:
 *   tile: Saved asset entry.
 * Returns:
 *   map32, map16, or map8.
 */
function storedTileKind(tile) {
  return normalizeTileAssetGrid(tile?.kind || "map32");
}

/**
 * Return the saved reference field for one terrain asset.
 *
 * Parameters:
 *   tile: Saved asset entry.
 * Returns:
 *   Stored reference string or number.
 */
function storedTileRef(tile) {
  const kind = storedTileKind(tile);
  if (kind === "map8") {
    return tile.map8Word ?? tile.map8;
  }
  return tile[TILE_ASSET_FIELDS[kind]];
}

/**
 * Parse a saved base-prefixed, decimal, hex, or numeric tile reference.
 *
 * Parameters:
 *   value: Stored reference.
 * Returns:
 *   Numeric tile reference.
 */
function parseStoredRef(value) {
  if (typeof value === "string" && value.startsWith("base:")) {
    return parseNumber(value.slice(5));
  }
  return parseNumber(value);
}

/**
 * Format a tile reference as uppercase hex.
 *
 * Parameters:
 *   value: Numeric value.
 *   width: Hex digit count.
 * Returns:
 *   Hex string.
 */
function hex(value, width = 4) {
  return `0x${Number(value).toString(16).toUpperCase().padStart(width, "0")}`;
}
