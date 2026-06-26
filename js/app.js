/**
 * Main browser controller for the Overworld Workbench.
 */

import { ZeldaAssets } from "../viewer/js/assets.js?v=20260621-render-restore20";
import { buildMapGroups } from "../viewer/js/map-groups.js?v=20260621-render-restore20";
import { loadSourceData } from "../viewer/js/source-parser.js?v=20260621-render-restore20";
import { OverworldMapCache } from "../viewer/js/overworld-map.js?v=20260621-render-restore20";
import { TilesetCache } from "../viewer/js/tilesets.js?v=20260621-render-restore20";
import { createMod, listMods, loadMod, saveAssetLibrary, saveMod } from "./api.js";
import {
  bindAssetPanel, createDefaultAssetLibrary, loadAssetLibraryDocument, saveTileAsset,
  selectedAssetMap32,
} from "./asset-library.js?v=20260621-render-restore20";
import { bindCanvas, draw, fitToView } from "./canvas-view.js?v=20260626-control-shortcuts";
import {
  bindTileContextMenu, showPaintContextMenu, showTileContextMenu,
} from "./context-menu.js?v=20260621-render-restore20";
import { ensureBaseDumpAvailable } from "./dump-availability.js?v=20260625-editor-db";
import {
  applyEditorDatabaseToSourceData, editorDatabaseStatus, loadEditorDatabase,
} from "./editor-database.js?v=20260625-sprite-markers";
import {
  bindEnemyToggle as bindSpriteToggle, inspectEnemyAt as inspectSpriteAt,
} from "./enemy-overlay.js?v=20260625-sprite-markers";
import { bindGuideControls } from "./guide.js?v=20260621-guide-tabs";
import { inspectInteractionAt } from "./interaction-overlay.js?v=20260625-dice-icon-only";
import { bindLayerControls } from "./layer-controls.js?v=20260621-render-restore20";
import { bindMetadataControls, syncMetadataControls } from "./metadata-controls.js?v=20260626-tab-toggle";
import * as terrainMod from "./mod-export.js?v=20260621-render-restore20";
import {
  paintNavigationSelection, selectedNavigationMove,
} from "./navigation-mod-export.js?v=20260621-render-restore20";
import {
  exportMap16TransformPatch,
  exportMap32TransformPatch,
  initializeTransformData,
} from "./map32-transform-data.js?v=20260621-render-restore20";
import { bindMap32TransformControls } from "./map32-transforms.js?v=20260621-render-restore20";
import { bindModMenu } from "./mod-menu.js?v=20260626-control-shortcuts";
import { createHistory, recordCommand, redo, undo } from "./operations.js?v=20260625-dialogue-tab";
import {
  fillMods, readPatchEditors, renderPatchEditors, setStatus, updateInspector,
} from "./panels.js?v=20260625-dialogue-tab";
import { bindSidePanels, openAssetsPanel, openPropertiesPanel } from "./side-panels.js?v=20260621-panel-layout";
import { saveSpriteAsset, selectedSpriteAsset } from "./sprite-assets.js?v=20260621-render-restore20";
import { paintSpriteAsset } from "./sprite-mod-export.js?v=20260621-render-restore20";
import { selectionStatus } from "./tile-status.js?v=20260621-render-restore20";
import { bindToolbar, bindWorldTabs } from "./toolbar.js?v=20260621-render-restore20";
import {
  applyLayerPatchDocuments,
  exportLayerPatchDocuments,
  snapshotLayerBaselines,
} from "./workbench-layer-patches.js?v=20260625-dialogue-tab";
import { createWorkbenchRenderer } from "./workbench-render.js?v=20260626-paint-settings";
const state = {
  dumpPath: "assets/overworld_dump",
  assets: null, editorDb: null,
  sourceData: null, app: null,
  groups: null,
  group: null,
  worldCanvas: null,
  baseSnapshot: null,
  baseMetadataSnapshot: null,
  baseDialogueSnapshot: null,
  history: createHistory(),
  currentMod: null,
  manifest: null,
  assetLibrary: createDefaultAssetLibrary(),
  selected: null,
  tileSelection: null,
  layers: null,
  inspectGrid: "map32",
  currentTool: "select",
  showEnemies: false,
  enemyStage: "first",
  zoom: 0.22,
  panX: 0,
  panY: 0,
  dragging: false,
  suppressNextClick: false,
};

const rerender = createWorkbenchRenderer(state);

/**
 * Initialize the Workbench after the DOM is available.
 *
 * Parameters: none.
 * Returns:
 *   Promise resolving after first render.
 */
async function main() {
  bindControls();
  await refreshMods();
  if (!(await ensureBaseDumpAvailable(setStatus))) return;
  await loadDump("assets/overworld_dump");
  loadAssetLibraryDocument(state, null);
  renderPatchEditors({});
  setStatus(editorDatabaseStatus(state.editorDb));
}

/**
 * Load a base or generated overworld dump into the shared viewer renderer.
 *
 * Parameters:
 *   dumpPath: URL path accepted by ZeldaAssets/loadSourceData.
 *   resetBase: Whether this dump becomes the clean state for sparse export.
 * Returns:
 *   Promise resolving after render.
 */
async function loadDump(dumpPath, resetBase = true) {
  setStatus("Loading dump");
  state.dumpPath = dumpPath;
  const [assets, sourceData, editorDb] = await Promise.all([
    ZeldaAssets.load("", dumpPath),
    loadSourceData("", dumpPath),
    loadEditorDatabase("", "assets/dat-dump"),
  ]);
  applyEditorDatabaseToSourceData(sourceData, editorDb);
  state.assets = assets;
  state.editorDb = editorDb;
  state.sourceData = sourceData;
  state.app = {
    assets,
    sourceData,
    mapCache: new OverworldMapCache(assets, sourceData),
    tilesetCache: new TilesetCache(assets, sourceData),
  };
  state.selected = null;
  state.tileSelection = null;
  state.suppressNextClick = false;
  initializeTransformData(state);
  state.groups = buildMapGroups(sourceData);
  state.group = state.groups.light;
  if (resetBase) {
    state.baseSnapshot = terrainMod.snapshotMap32(assets);
    snapshotLayerBaselines(state);
    state.history = createHistory();
  }
  await rerender();
  fitToView(state);
}

/**
 * Bind all static controls and canvas interaction.
 *
 * Parameters: none.
 * Returns:
 *   None.
 */
function bindControls() {
  bindModMenu({ setStatus });
  document.querySelector("#createModButton").addEventListener("click", handleCreateMod);
  document.querySelector("#saveButton").addEventListener("click", handleSave);
  document.querySelector("#baseButton").addEventListener("click", handleLoadBaseDump);
  document.querySelector("#modSelect").addEventListener("change", handleModSelect);
  document.querySelector("#undoButton").addEventListener("click", () => applyHistory(undo));
  document.querySelector("#redoButton").addEventListener("click", () => applyHistory(redo));
  document.querySelector("#fitButton").addEventListener("click", () => fitToView(state));
  bindToolbar(state);
  bindWorldTabs(state, { rerender, fitToView });
  bindSpriteToggle(state, rerender, setStatus);
  bindSidePanels(() => draw(state));
  bindGuideControls();
  bindAssetPanel(state, assetActions());
  bindLayerControls(state, { rerender, draw, setStatus });
  bindMetadataControls(state, { rerender, setStatus, updateInspector: handleInspectorUpdate });
  bindMap32TransformControls(state, {
    rerender,
    setStatus,
    updateInspector: handleInspectorUpdate,
  });
  bindTileContextMenu({ onSave: handleSaveAsset });
  bindCanvas(state, {
    rerender,
    updateInspector: handleInspectorUpdate,
    onPick: handlePickTile, onEnemyPick: openPropertiesPanel, onInteractionPick: openPropertiesPanel,
    onTileMenu: showTileContextMenu,
    onEnemyMenu: showTileContextMenu,
    onPaintMenu: showPaintContextMenu,
    getEnemyAt: inspectSpriteAt,
    getInteractionAt: inspectInteractionAt,
    getPaintMap32: () => selectedAssetMap32(state),
    getPaintNavigation: () => selectedNavigationMove(state),
    getPaintSprite: () => selectedSpriteAsset(state),
    onPaintNavigation: (selection, info, point) =>
      paintNavigationSelection(state, selection, info, point, { setStatus, rerender }),
    onPaintSprite: handlePaintSpriteAsset,
    onPaintMissing: () => setStatus("Select an asset tile or sprite first"),
  });
}

/**
 * Refresh the mod dropdown from the server.
 *
 * Parameters: none.
 * Returns:
 *   Promise resolving after DOM update.
 */
async function refreshMods() {
  const data = await listMods();
  fillMods(data.mods);
}

/**
 * Create a new mod package through the server.
 *
 * Parameters: none.
 * Returns:
 *   Promise resolving after the mod is selected.
 */
async function handleCreateMod() {
  const id = document.querySelector("#newModId").value.trim();
  if (!id) {
    setStatus("Enter a mod id first");
    return;
  }
  const data = await createMod(id, id);
  await refreshMods();
  if (state.assets) loadModPayload(data.mod);
  document.querySelector("#modSelect").value = id;
  setStatus(`Created ${id}`);
}

async function handleLoadBaseDump() {
  if (await ensureBaseDumpAvailable(setStatus)) {
    await loadDump("assets/overworld_dump");
    setStatus(editorDatabaseStatus(state.editorDb));
  }
}

/**
 * Load the selected mod package.
 *
 * Parameters: none.
 * Returns:
 *   Promise resolving after patch editors update.
 */
async function handleModSelect() {
  const id = document.querySelector("#modSelect").value;
  if (!id) {
    state.currentMod = null;
    state.manifest = null;
    loadAssetLibraryDocument(state, null);
    return;
  }
  if (!(await ensureBaseDumpAvailable(setStatus))) {
    return;
  }
  const data = await loadMod(id);
  await loadDump("assets/overworld_dump");
  loadModPayload(data.mod);
  setStatus(`Loaded ${id}`);
}

/**
 * Store a server mod payload into browser state.
 *
 * Parameters:
 *   mod: Server mod payload.
 * Returns:
 *   None.
 */
function loadModPayload(mod) {
  state.currentMod = mod.manifest.id;
  state.manifest = mod.manifest;
  renderPatchEditors(mod.patches || {});
  loadAssetLibraryDocument(state, mod.assetLibrary || null);
  initializeTransformData(state, mod.patches || {});
  terrainMod.applyTerrainPatchDocument(
    state.assets,
    mod.patches?.["patches/terrain.json"],
    state.map32TransformState.map32Ids,
  );
  applyLayerPatchDocuments(state, mod.patches || {});
  rerender();
}

/**
 * Build callbacks used by the asset library panel.
 *
 * Parameters: none.
 * Returns:
 *   Asset panel action callbacks.
 */
function assetActions() {
  return { save: saveCurrentAssetLibrary, setStatus };
}

/**
 * Save the active mod asset library through the server.
 *
 * Parameters:
 *   library: Foldered map32 asset library document.
 * Returns:
 *   Promise resolving to the server payload.
 */
function saveCurrentAssetLibrary(library) {
  if (!state.currentMod) {
    throw new Error("Create or select a mod first");
  }
  return saveAssetLibrary(state.currentMod, library);
}

/**
 * Save an inspected tile into the asset library from the context menu.
 *
 * Parameters:
 *   info: Tile information from the map inspector.
 * Returns:
 *   Promise resolving after persistence.
 */
async function handleSaveAsset(info) {
  openAssetsPanel();
  try {
    if (info.kind === "sprite" || info.kind === "enemy") {
      await saveSpriteAsset(state, info, assetActions());
    } else {
      await saveTileAsset(state, info, assetActions());
    }
  } catch (error) {
    setStatus(error.message);
  }
}

/**
 * Pick one map32 tile into the Properties map32 field.
 *
 * Parameters:
 *   info: Tile information from the map inspector.
 * Returns:
 *   None.
 */
function handlePickTile(info) {
  document.querySelector("#map32Input").value = `0x${info.map32.toString(16).toUpperCase()}`;
  setStatus(selectionStatus(info, state.inspectGrid));
}

/**
 * Update the inspector panel and map-header controls from one selection.
 */
function handleInspectorUpdate(info) {
  updateInspector(info, state.inspectGrid, state.editorDb);
  syncMetadataControls(state, info);
}

/**
 * Paint a selected saved sprite asset into the target sprite set.
 */
function handlePaintSpriteAsset(asset, info, point) {
  const placed = paintSpriteAsset(state, info, point, asset);
  if (!placed) {
    setStatus("Unable to place sprite asset here");
    return;
  }
  recordCommand(state.history, { kind: "sprite.add-placement", placements: placed.placements });
  const note = placed.visualConflicts?.length ? "; isolated source sprite visuals" : "";
  setStatus(`Placed ${placed.name} at ${placed.x},${placed.y}${note}`);
  rerender();
}

/**
 * Save the current sparse terrain diff and layer JSON patches.
 */
async function handleSave() {
  if (!state.currentMod) {
    setStatus("Create or select a mod first");
    return;
  }
  const patches = readPatchEditors();
  patches["patches/map16-definitions.json"] =
    exportMap16TransformPatch(state, patches["patches/map16-definitions.json"]);
  patches["patches/map32-definitions.json"] =
    exportMap32TransformPatch(state, patches["patches/map32-definitions.json"]);
  patches["patches/terrain.json"] = terrainMod.exportTerrainPatch(state.baseSnapshot, state.assets);
  exportLayerPatchDocuments(state, patches);
  await saveMod(state.currentMod, { manifest: state.manifest, patches });
  setStatus(`Saved ${state.currentMod}`);
}

/**
 * Apply undo or redo and re-render.
 *
 * Parameters:
 *   fn: undo or redo function.
 * Returns:
 *   None.
 */
function applyHistory(fn) {
  if (fn(state.history, state)) {
    syncMetadataControls(state);
    rerender();
  }
}

main().catch((error) => setStatus(error.message));
