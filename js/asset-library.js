/**
 * Foldered editor asset library panel.
 */

import { ensureFolderPath } from "./asset-folder-model.js";
import { renderAssetLibraryView } from "./asset-library-view.js?v=20260626-tile-asset-paint";
import {
  buildTileAsset,
  selectedTileMap32Value,
  terrainAssetPayload,
} from "./asset-tile-model.js?v=20260626-tile-asset-paint";

const ASSET_FORMAT = "zelda3-overworld-map32-library-v1";

/**
 * Create an empty asset library document.
 *
 * Parameters: none.
 * Returns:
 *   Foldered saved asset document.
 */
export function createDefaultAssetLibrary() {
  return {
    format: ASSET_FORMAT,
    activeFolderId: "default",
    selectedTileId: null,
    folders: [{ id: "default", name: "Saved Assets", tiles: [] }],
  };
}

/**
 * Store and render an asset library document.
 *
 * Parameters:
 *   state: Shared Workbench state.
 *   document: Server asset library document, or null.
 * Returns:
 *   None.
 */
export function loadAssetLibraryDocument(state, document) {
  state.assetLibrary = normalizeLibrary(document || createDefaultAssetLibrary());
  renderAssetPanel(state);
}

/**
 * Bind asset panel controls.
 *
 * Parameters:
 *   state: Shared Workbench state.
 *   actions: persist and status callbacks.
 * Returns:
 *   None.
 */
export function bindAssetPanel(state, actions) {
  document.querySelector("#createFolderButton").addEventListener("click", () => createFolder(state, actions));
  document.querySelector("#assetFolderName").addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      createFolder(state, actions);
    }
  });
  document.querySelector("#assetFolders").addEventListener("click", (event) => {
    handleAssetClick(state, actions, event);
  });
  document.querySelector("#assetFolders").addEventListener("change", (event) => {
    handleAssetMove(state, actions, event);
  });
}

/**
 * Save an inspected terrain tile into the active asset folder.
 *
 * Parameters:
 *   state: Shared Workbench state.
 *   info: Tile info returned by the map inspector.
 *   actions: persist and status callbacks.
 * Returns:
 *   Promise resolving after persistence.
 */
export async function saveTileAsset(state, info, actions) {
  const library = ensureLibrary(state);
  const folder = activeFolder(library);
  const tile = buildTileAsset(state, info, uniqueId("tile"));
  folder.tiles.push(tile);
  library.selectedTileId = tile.id;
  renderAssetPanel(state);
  actions.setStatus(`Saving ${tile.name}`);
  await persistLibrary(state, actions, `Saved ${tile.name}`);
}

/**
 * Return the selected asset's map32 value for painting.
 *
 * Parameters:
 *   state: Shared Workbench state.
 * Returns:
 *   Numeric map32 id, or null.
 */
export function selectedAssetMap32(state) {
  const tile = selectedTile(ensureLibrary(state));
  const value = selectedTileMap32Value(tile);
  return Number.isFinite(value) ? value : null;
}

/**
 * Return the selected saved terrain asset for paint mode.
 *
 * Parameters:
 *   state: Shared Workbench state.
 * Returns:
 *   Object with terrain kind and numeric value, or null.
 */
export function selectedTerrainAsset(state) {
  return terrainAssetPayload(selectedTile(ensureLibrary(state)));
}

/**
 * Render the asset library folder and tile controls.
 *
 * Parameters:
 *   state: Shared Workbench state.
 * Returns:
 *   None.
 */
export function renderAssetPanel(state) {
  renderAssetLibraryView(state, ensureLibrary(state));
}

/**
 * Normalize an asset library before storing it in UI state.
 *
 * Parameters:
 *   library: Candidate library object.
 * Returns:
 *   Safe library object with at least one folder.
 */
function normalizeLibrary(library) {
  if (!library || !Array.isArray(library.folders) || !library.folders.length) {
    return createDefaultAssetLibrary();
  }
  library.format = ASSET_FORMAT;
  if (!library.folders.some((folder) => folder.id === library.activeFolderId)) {
    library.activeFolderId = library.folders[0].id;
  }
  return library;
}

/**
 * Ensure state has an asset library.
 *
 * Parameters:
 *   state: Shared Workbench state.
 * Returns:
 *   Asset library document.
 */
function ensureLibrary(state) {
  if (!state.assetLibrary) {
    state.assetLibrary = createDefaultAssetLibrary();
  }
  return state.assetLibrary;
}

/**
 * Handle clicks in the asset folder list.
 *
 * Parameters:
 *   state: Shared Workbench state.
 *   actions: persist and status callbacks.
 *   event: Click event.
 * Returns:
 *   None.
 */
function handleAssetClick(state, actions, event) {
  const folderButton = event.target.closest("[data-use-folder-id]");
  if (folderButton) {
    setActiveFolder(state, actions, folderButton.dataset.useFolderId);
    return;
  }
  const tileButton = event.target.closest("[data-tile-id]");
  if (tileButton) {
    selectTileForPaint(state, actions, tileButton.dataset.tileId);
  }
}

/**
 * Handle tile move dropdown changes.
 *
 * Parameters mirror handleAssetClick.
 */
function handleAssetMove(state, actions, event) {
  if (!event.target.matches("[data-move-tile-id]")) {
    return;
  }
  moveTile(state, event.target.dataset.sourceFolderId, event.target.value, event.target.dataset.moveTileId);
  persistLibrary(state, actions, "Moved asset tile");
}

/**
 * Create a custom asset folder.
 *
 * Parameters mirror handleAssetClick.
 */
function createFolder(state, actions) {
  const input = document.querySelector("#assetFolderName");
  const path = input.value.trim();
  if (!path) {
    actions.setStatus("Enter an asset folder name");
    return;
  }
  const library = ensureLibrary(state);
  const folder = ensureFolderPath(library, path, () => uniqueId("folder"));
  input.value = "";
  renderAssetPanel(state);
  persistLibrary(state, actions, `Selected ${folder.name}`);
}

/**
 * Select the active save folder.
 *
 * Parameters mirror handleAssetClick plus folder id.
 */
function setActiveFolder(state, actions, folderId) {
  ensureLibrary(state).activeFolderId = folderId;
  persistLibrary(state, actions, "Selected asset folder");
}

/**
 * Select a saved tile for painting.
 *
 * Parameters mirror handleAssetClick plus tile id.
 */
function selectTileForPaint(state, actions, tileId) {
  const library = ensureLibrary(state);
  library.selectedTileId = tileId;
  const tile = selectedTile(library);
  if (tile && (tile.kind || "map32") === "map32") {
    document.querySelector("#map32Input").value = tile.map32.replace("base:", "");
  }
  persistLibrary(state, actions, tile ? `Selected ${tile.name}` : "Selected asset tile");
}

/**
 * Move a saved tile between folders.
 *
 * Parameters:
 *   state: Shared Workbench state.
 *   sourceId: Folder currently containing the tile.
 *   targetId: Destination folder id.
 *   tileId: Tile id to move.
 * Returns:
 *   None.
 */
function moveTile(state, sourceId, targetId, tileId) {
  if (sourceId === targetId) {
    return;
  }
  const library = ensureLibrary(state);
  const source = library.folders.find((folder) => folder.id === sourceId);
  const target = library.folders.find((folder) => folder.id === targetId);
  const index = source?.tiles.findIndex((tile) => tile.id === tileId) ?? -1;
  if (!source || !target || index < 0) {
    return;
  }
  target.tiles.push(source.tiles.splice(index, 1)[0]);
}

/**
 * Persist and re-render the asset library.
 *
 * Parameters:
 *   state: Shared Workbench state.
 *   actions: persist and status callbacks.
 *   message: Success status text.
 * Returns:
 *   Promise resolving after persistence.
 */
async function persistLibrary(state, actions, message) {
  if (!state.currentMod) {
    renderAssetPanel(state);
    actions.setStatus(`${message}; select a mod to persist`);
    return;
  }
  try {
    const data = await actions.save(ensureLibrary(state));
    loadAssetLibraryDocument(state, data.assetLibrary);
    actions.setStatus(message);
  } catch (error) {
    renderAssetPanel(state);
    actions.setStatus(error.message);
  }
}

/**
 * Return the active save folder.
 *
 * Parameters:
 *   library: Asset library document.
 * Returns:
 *   Folder object.
 */
function activeFolder(library) {
  return library.folders.find((folder) => folder.id === library.activeFolderId) || library.folders[0];
}

/**
 * Return the selected tile.
 *
 * Parameters:
 *   library: Asset library document.
 * Returns:
 *   Tile object, or null.
 */
function selectedTile(library) {
  for (const folder of library.folders) {
    const tile = folder.tiles.find((entry) => entry.id === library.selectedTileId);
    if (tile) {
      return tile;
    }
  }
  return null;
}

/**
 * Create a portable asset id.
 *
 * Parameters:
 *   prefix: id prefix.
 * Returns:
 *   Lowercase id.
 */
function uniqueId(prefix) {
  const stamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${stamp}-${random}`;
}
