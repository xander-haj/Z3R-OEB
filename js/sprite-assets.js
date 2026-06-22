/**
 * Saved asset helpers for overworld sprite placements.
 */

import { loadAssetLibraryDocument, renderAssetPanel } from "./asset-library.js";

/**
 * Save a selected sprite spawn into the active asset folder.
 *
 * Parameters:
 *   state: Shared Workbench state.
 *   sprite: Sprite selection object from the sprite overlay.
 *   actions: Asset persistence and status callbacks.
 * Returns:
 *   Promise resolving after persistence.
 */
export async function saveSpriteAsset(state, sprite, actions) {
  const library = ensureLibrary(state);
  const folder = activeFolder(library);
  const asset = buildSpriteAsset(state, sprite);
  folder.tiles.push(asset);
  library.selectedTileId = asset.id;
  renderAssetPanel(state);
  actions.setStatus(`Saving ${asset.name}`);
  await persistLibrary(state, actions, `Saved ${asset.name}`);
}

/**
 * Return the selected saved sprite asset.
 *
 * Parameters:
 *   state: Shared Workbench state.
 * Returns:
 *   Sprite asset entry, or null.
 */
export function selectedSpriteAsset(state) {
  const asset = selectedAsset(state);
  return asset?.kind === "sprite" ? asset : null;
}

/**
 * Build a portable sprite asset payload from a selected spawn.
 *
 * Parameters mirror saveSpriteAsset.
 */
function buildSpriteAsset(state, sprite) {
  const stages = sprite.stages?.length ? sprite.stages : [sprite.primaryStage || "first"];
  return {
    id: uniqueId("sprite"),
    kind: "sprite",
    name: `${sprite.name} from ${hex(sprite.area, 2)} ${sprite.x},${sprite.y}`,
    preview: captureSpritePreview(state, sprite),
    sprite: {
      type: sprite.type,
      name: sprite.name,
      stages,
      primaryStage: sprite.primaryStage || stages[0],
      stageInfo: stageInfoForSprite(state, sprite, stages),
    },
    source: {
      group: sprite.groupId,
      area: hex(sprite.area, 2),
      x: sprite.x,
      y: sprite.y,
    },
  };
}

/**
 * Capture a compact sprite preview from the rendered world canvas.
 *
 * Parameters mirror buildSpriteAsset.
 * Returns:
 *   Data URL preview image, or null.
 */
function captureSpritePreview(state, sprite) {
  if (!state.worldCanvas || !sprite) {
    return null;
  }
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(state.worldCanvas, sprite.centerX - 16, sprite.centerY - 16, 32, 32, 0, 0, 32, 32);
  return canvas.toDataURL("image/png");
}

/**
 * Copy the source sprite-set gfx/palette info needed by this spawn.
 *
 * Parameters:
 *   state: Shared Workbench state.
 *   sprite: Sprite selection object.
 *   stages: Progression stages to preserve.
 * Returns:
 *   Object keyed by stage.
 */
function stageInfoForSprite(state, sprite, stages) {
  const header = state.sourceData?.areaHeaders?.[sprite.area];
  const info = {};
  for (const stage of stages) {
    const source = sprite.custom || header?.spriteSets?.[stage]?.info ||
      header?.spriteSets?.[sprite.primaryStage]?.info;
    const sourceArea = source?.sourceArea ?? sprite.area;
    info[stage] = {
      gfx: source?.gfx ?? 0,
      palette: source?.palette ?? 0,
      darkWorld: source?.darkWorld ?? (sprite.area >= 64),
      sourceArea: hex(sourceArea, 2),
    };
  }
  return info;
}

/**
 * Persist and re-render the asset library.
 *
 * Parameters mirror saveSpriteAsset plus status text.
 */
async function persistLibrary(state, actions, message) {
  if (!state.currentMod) {
    renderAssetPanel(state);
    actions.setStatus(`${message}; select a mod to persist`);
    return;
  }
  const data = await actions.save(ensureLibrary(state));
  loadAssetLibraryDocument(state, data.assetLibrary);
  actions.setStatus(message);
}

/**
 * Ensure state has an asset library document.
 */
function ensureLibrary(state) {
  return state.assetLibrary;
}

/**
 * Return the active save folder.
 */
function activeFolder(library) {
  return library.folders.find((folder) => folder.id === library.activeFolderId) || library.folders[0];
}

/**
 * Return the selected saved asset entry.
 */
function selectedAsset(state) {
  for (const folder of state.assetLibrary?.folders || []) {
    const asset = folder.tiles.find((entry) => entry.id === state.assetLibrary.selectedTileId);
    if (asset) {
      return asset;
    }
  }
  return null;
}

/**
 * Create a portable asset id.
 */
function uniqueId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Format a value as uppercase hex.
 */
function hex(value, width = 4) {
  return `0x${Number(value).toString(16).toUpperCase().padStart(width, "0")}`;
}
