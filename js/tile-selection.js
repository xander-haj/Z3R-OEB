/**
 * Multi-cell map32 selection helpers for the Overworld Workbench canvas.
 */

// Map32 cells render as fixed 32x32 world-pixel squares in the editor canvas.
const MAP32_SIZE = 32;
const MAP16_SIZE = 16;
const MAP8_SIZE = 8;

// Cyan distinguishes multi-selected cells from the yellow active-cell inspector outline.
const MULTI_FILL = "rgba(44, 211, 255, 0.16)";
const MULTI_STROKE = "rgba(93, 229, 255, 0.92)";

// Yellow remains the single active selection color used throughout the Workbench.
const ACTIVE_FILL = "rgba(255, 231, 105, 0.18)";
const ACTIVE_STROKE = "rgba(255, 244, 154, 0.95)";

/**
 * Return whether a pointer event is requesting map32 multi-selection.
 *
 * Parameters:
 *   event: Pointer or mouse event.
 * Returns:
 *   True when Command on macOS or Alt is held.
 */
export function isTileMultiSelectEvent(event) {
  return Boolean(event.metaKey || event.altKey);
}

/**
 * Start a command/alt drag selection without entering pan mode.
 *
 * Parameters:
 *   state: Shared Workbench state.
 *   event: Pointer event from the canvas.
 *   handlers: Inspector callback collection.
 * Returns:
 *   True when the event was consumed by tile multi-selection.
 */
export function beginTileMultiSelect(state, event, handlers) {
  if (event.button !== 0 || !state.app || !isTileMultiSelectEvent(event) || state.inspectGrid !== "map32") {
    return false;
  }
  event.preventDefault();
  const selection = ensureTileSelection(state);
  selection.active = true;
  selection.pointerId = event.pointerId;
  addTileFromEvent(state, event, handlers);
  event.currentTarget.setPointerCapture(event.pointerId);
  return true;
}

/**
 * Add the tile under the current pointer while a multi-select drag is active.
 *
 * Parameters:
 *   state: Shared Workbench state.
 *   event: Pointer event from the canvas.
 *   handlers: Inspector callback collection.
 * Returns:
 *   True when an active tile-selection drag consumed the event.
 */
export function moveTileMultiSelect(state, event, handlers) {
  const selection = state.tileSelection;
  if (!selection?.active || selection.pointerId !== event.pointerId) {
    return false;
  }
  event.preventDefault();
  addTileFromEvent(state, event, handlers);
  return true;
}

/**
 * Finish an active multi-select drag and suppress the synthetic click that follows pointerup.
 *
 * Parameters:
 *   state: Shared Workbench state.
 *   event: Pointer event from the canvas.
 * Returns:
 *   True when an active tile-selection drag ended.
 */
export function endTileMultiSelect(state, event) {
  const selection = state.tileSelection;
  if (!selection?.active || selection.pointerId !== event.pointerId) {
    return false;
  }
  selection.active = false;
  selection.pointerId = null;
  state.suppressNextClick = true;
  event.currentTarget.releasePointerCapture(event.pointerId);
  return true;
}

/**
 * Clear the current multi-selection when a normal single-object selection takes over.
 *
 * Parameters:
 *   state: Shared Workbench state.
 * Returns:
 *   None.
 */
export function clearTileSelection(state) {
  state.tileSelection = { active: false, pointerId: null, cells: [], keys: new Set() };
}

/**
 * Return the selected map32 cells targeted by batch transform actions.
 *
 * Parameters:
 *   state: Shared Workbench state.
 * Returns:
 *   Array of selected cell descriptors.
 */
export function selectedTileCells(state) {
  return state.tileSelection?.cells || [];
}

/**
 * Build the stable key used to avoid selecting one map32 cell more than once.
 *
 * Parameters:
 *   cell: Selected cell descriptor.
 * Returns:
 *   Screen/x/y key string.
 */
export function tileCellKey(cell) {
  return `${cell.screen}:${cell.x}:${cell.y}`;
}

/**
 * Draw every command/alt selected map32 cell as a batch-selection overlay.
 *
 * Parameters:
 *   ctx: Visible canvas 2D context with world transform applied.
 *   state: Shared Workbench state.
 * Returns:
 *   None.
 */
export function drawTileSelection(ctx, state) {
  const cells = selectedTileCells(state);
  if (!cells.length) {
    return;
  }
  ctx.save();
  ctx.fillStyle = MULTI_FILL;
  ctx.strokeStyle = MULTI_STROKE;
  ctx.lineWidth = 2 / ctx.getTransform().a;
  for (const cell of cells) {
    const rect = cell.rect;
    ctx.fillRect(rect.x, rect.y, rect.size, rect.size);
    ctx.strokeRect(rect.x + 1, rect.y + 1, rect.size - 2, rect.size - 2);
  }
  ctx.restore();
}

/**
 * Draw a visible 32x32 outline around the active map32 inspector cell.
 *
 * Parameters:
 *   ctx: Visible canvas 2D context with world transform applied.
 *   info: Selected tile information, or null.
 * Returns:
 *   None.
 */
export function drawSelectedTile(ctx, info, gridLevel = "map32") {
  if (!info || info.kind === "sprite" || info.kind === "enemy") {
    return;
  }
  const rect = selectedTileRect(info, gridLevel);
  ctx.save();
  ctx.fillStyle = ACTIVE_FILL;
  ctx.strokeStyle = ACTIVE_STROKE;
  ctx.lineWidth = 2 / ctx.getTransform().a;
  ctx.fillRect(rect.x, rect.y, rect.size, rect.size);
  ctx.strokeRect(rect.x + 1, rect.y + 1, rect.size - 2, rect.size - 2);
  ctx.restore();
}

/**
 * Resolve selected map32 display bounds in rendered world pixels.
 *
 * Parameters:
 *   info: Selected tile information from the map inspector.
 * Returns:
 *   Rectangle object for the selected map32 cell.
 */
export function selectedMap32Rect(info) {
  return selectedTileRect(info, "map32");
}

/**
 * Resolve selected tile display bounds for the active inspection grid.
 *
 * Parameters:
 *   info: Selected tile information from the map inspector.
 *   gridLevel: map32, map16, or map8.
 * Returns:
 *   Rectangle object for the selected grid cell.
 */
export function selectedTileRect(info, gridLevel = "map32") {
  if (gridLevel === "map8") {
    return selectedMap8Rect(info);
  }
  if (gridLevel === "map16") {
    return selectedMap16Rect(info);
  }
  if (info.displayMap32X !== undefined && info.displayMap32Y !== undefined) {
    return { x: info.displayMap32X, y: info.displayMap32Y, size: MAP32_SIZE };
  }
  return {
    x: info.worldTileX + info.map32X * MAP32_SIZE,
    y: info.worldTileY + info.map32Y * MAP32_SIZE,
    size: MAP32_SIZE,
  };
}

function selectedMap16Rect(info) {
  if (info.displayMap16X !== undefined && info.displayMap16Y !== undefined) {
    return { x: info.displayMap16X, y: info.displayMap16Y, size: MAP16_SIZE };
  }
  return {
    x: info.worldTileX + info.map16X * MAP16_SIZE,
    y: info.worldTileY + info.map16Y * MAP16_SIZE,
    size: MAP16_SIZE,
  };
}

function selectedMap8Rect(info) {
  if (info.displayTileX !== undefined && info.displayTileY !== undefined) {
    return { x: info.displayTileX, y: info.displayTileY, size: MAP8_SIZE };
  }
  return {
    x: info.worldTileX + info.map8X * MAP8_SIZE,
    y: info.worldTileY + info.map8Y * MAP8_SIZE,
    size: MAP8_SIZE,
  };
}

/**
 * Ensure the shared state has a usable multi-selection object and Set index.
 *
 * Parameters:
 *   state: Shared Workbench state.
 * Returns:
 *   Mutable tile-selection object.
 */
function ensureTileSelection(state) {
  if (!state.tileSelection) {
    clearTileSelection(state);
  }
  if (!(state.tileSelection.keys instanceof Set)) {
    state.tileSelection.keys = new Set(state.tileSelection.cells.map(tileCellKey));
  }
  return state.tileSelection;
}

/**
 * Inspect the map32 cell under a pointer event and add it to the batch selection.
 *
 * Parameters:
 *   state: Shared Workbench state.
 *   event: Pointer event from the canvas.
 *   handlers: Inspector callback collection.
 * Returns:
 *   True when a terrain tile was inspected.
 */
function addTileFromEvent(state, event, handlers) {
  const point = eventWorldPoint(state, event);
  const info = state.app.mapCache.inspect(state.group, point.x, point.y);
  if (!info || info.kind === "sprite" || info.kind === "enemy") {
    return false;
  }
  const selection = ensureTileSelection(state);
  const cell = cellFromInfo(info);
  const key = tileCellKey(cell);
  if (!selection.keys.has(key)) {
    selection.keys.add(key);
    selection.cells.push(cell);
  }
  state.selected = info;
  handlers.updateInspector(info);
  return true;
}

/**
 * Convert inspector tile information into the compact descriptor used by batch edits.
 *
 * Parameters:
 *   info: Tile information from OverworldMapCache.inspect.
 * Returns:
 *   Selected cell descriptor.
 */
function cellFromInfo(info) {
  return {
    screen: info.screen,
    x: info.map32X,
    y: info.map32Y,
    map32: info.map32,
    rect: selectedMap32Rect(info),
  };
}

/**
 * Convert a canvas pointer position to rendered world coordinates.
 *
 * Parameters:
 *   state: Shared Workbench state.
 *   event: Pointer or mouse event.
 * Returns:
 *   Object with x/y world coordinates.
 */
function eventWorldPoint(state, event) {
  const rect = event.currentTarget.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left - state.panX) / state.zoom,
    y: (event.clientY - rect.top - state.panY) / state.zoom,
  };
}
