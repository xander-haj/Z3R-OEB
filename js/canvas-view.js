/**
 * Canvas viewport, pointer, pan, zoom, pick, and paint behavior.
 */

import {
  bindCanvasKeyboardControls,
  instantPaintEnabled,
  shouldStartCanvasPan,
} from "./canvas-input-policy.js?v=20260626-control-shortcuts";
import { paintSelectedAsset } from "./canvas-paint.js?v=20260626-paint-settings";
import { drawSelectedSprite } from "./canvas-selection-draw.js?v=20260626-paint-settings";
import { handleWheelZoom } from "./canvas-zoom.js?v=20260626-control-tabs";
import { AREA_GRID_LABEL_GUTTER, drawAreaGridLabels } from "./grid-labels.js";
import { layerVisible } from "./layer-state.js?v=20260621-render-restore20";
import { beginTileMultiSelect, clearTileSelection, drawSelectedTile, drawTileSelection,
  endTileMultiSelect, moveTileMultiSelect } from "./tile-selection.js?v=20260621-render-restore20";

const INSPECT_GRID_EVENT = "workbench:inspect-grid-change";

/**
 * Bind canvas controls used by the Workbench map view.
 *
 * Parameters:
 *   state: Shared Workbench state.
 *   handlers: Inspector, pick, context menu, paint, and render callbacks.
 * Returns:
 *   None.
 */
export function bindCanvas(state, handlers) {
  const canvas = document.querySelector("#mapCanvas");
  canvas.addEventListener("pointerdown", (event) => beginPointer(state, event, handlers));
  canvas.addEventListener("pointermove", (event) => movePointer(state, event, handlers));
  canvas.addEventListener("pointerup", (event) => endPointer(state, event));
  canvas.addEventListener("auxclick", preventAuxClick);
  canvas.addEventListener("click", (event) => handleClick(state, event, handlers));
  canvas.addEventListener("contextmenu", (event) => handleContextMenu(state, event, handlers));
  canvas.addEventListener("wheel", (event) => handleWheelZoom(state, event, () => draw(state)), { passive: false });
  window.addEventListener("resize", () => draw(state));
  window.addEventListener("workbench:grid-labels-change", () => draw(state));
  window.addEventListener(INSPECT_GRID_EVENT, () => draw(state));
  bindCanvasKeyboardControls(state, () => draw(state));
}

/**
 * Draw the offscreen world canvas into the visible viewport.
 *
 * Parameters:
 *   state: Shared Workbench state.
 * Returns:
 *   None.
 */
export function draw(state) {
  const canvas = document.querySelector("#mapCanvas");
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.max(1, Math.floor(rect.width));
  canvas.height = Math.max(1, Math.floor(rect.height));
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!state.worldCanvas) {
    return;
  }
  ctx.setTransform(state.zoom, 0, 0, state.zoom, state.panX, state.panY);
  ctx.drawImage(state.worldCanvas, 0, 0);
  drawAreaGridLabels(ctx, state);
  if (layerVisible(state.layers, "multiSelection")) {
    drawTileSelection(ctx, state);
  }
  if (layerVisible(state.layers, "tileSelection")) {
    drawSelectedTile(ctx, state.selected, state.inspectGrid);
  }
  if (layerVisible(state.layers, "enemySelection")) {
    drawSelectedSprite(ctx, state.selected);
  }
}

/**
 * Fit the active rendered group into the viewport.
 *
 * Parameters:
 *   state: Shared Workbench state.
 * Returns:
 *   None.
 */
export function fitToView(state) {
  const rect = document.querySelector("#mapCanvas").getBoundingClientRect();
  const gutter = areaGridLabelGutter(state);
  const width = Math.max(1, rect.width - gutter);
  const height = Math.max(1, rect.height - gutter);
  state.zoom = Math.min(width / state.group.width, height / state.group.height) * 0.96;
  state.panX = gutter + (width - state.group.width * state.zoom) / 2;
  state.panY = gutter + (height - state.group.height * state.zoom) / 2;
  draw(state);
}

/**
 * Reserve canvas margin for row/column labels when the atlas labels are visible.
 *
 * Parameters:
 *   state: Shared Workbench state.
 * Returns:
 *   Gutter size in canvas pixels.
 */
function areaGridLabelGutter(state) {
  return state.showGridLabels === false || state.group?.kind !== "atlas" ? 0 : AREA_GRID_LABEL_GUTTER;
}

/**
 * Begin either command/alt tile selection or normal panning on pointer down.
 *
 * Parameters:
 *   state: Shared Workbench state.
 *   event: Pointer event.
 *   handlers: Inspector callback collection.
 * Returns:
 *   None.
 */
function beginPointer(state, event, handlers) {
  if (event.button === 0 || event.button === 1) {
    state.pointerStart = { x: event.clientX, y: event.clientY };
  }
  if (beginTileMultiSelect(state, event, handlers)) {
    draw(state);
    return;
  }
  if (!shouldStartCanvasPan(state, event)) {
    return;
  }
  state.dragging = true;
  state.draggingPointerId = event.pointerId;
  state.dragStart = { x: event.clientX, y: event.clientY, panX: state.panX, panY: state.panY };
  event.preventDefault();
  event.currentTarget.setPointerCapture(event.pointerId);
}

/**
 * Update either command/alt tile selection or normal viewport panning.
 *
 * Parameters:
 *   state: Shared Workbench state.
 *   event: Pointer event.
 *   handlers: Inspector callback collection.
 * Returns:
 *   None.
 */
function movePointer(state, event, handlers) {
  if (moveTileMultiSelect(state, event, handlers)) {
    draw(state);
    return;
  }
  if (!state.dragging) {
    return;
  }
  state.panX = state.dragStart.panX + event.clientX - state.dragStart.x;
  state.panY = state.dragStart.panY + event.clientY - state.dragStart.y;
  draw(state);
}

/**
 * End command/alt tile selection or normal pointer panning.
 *
 * Parameters:
 *   state: Shared Workbench state.
 *   event: Pointer event.
 * Returns:
 *   None.
 */
function endPointer(state, event) {
  if (endTileMultiSelect(state, event)) {
    draw(state);
    return;
  }
  if (state.draggingPointerId !== event.pointerId) {
    return;
  }
  state.dragging = false;
  state.draggingPointerId = null;
  event.currentTarget.releasePointerCapture(event.pointerId);
}

/**
 * Handle map click for view, picker, or paint mode.
 *
 * Parameters:
 *   state: Shared Workbench state.
 *   event: Mouse click event.
 *   handlers: Inspector and pick callbacks.
 * Returns:
 *   None.
 */
function handleClick(state, event, handlers) {
  if (state.suppressNextClick) {
    state.suppressNextClick = false;
    state.pointerStart = null;
    return;
  }
  const moved = pointerMoved(state, event);
  state.pointerStart = null;
  if (!state.app || moved) {
    return;
  }
  const instantPaint = instantPaintEnabled(state);
  if (!instantPaint) {
    if (inspectEventSprite(state, event, handlers)) {
      return;
    }
    if (inspectEventInteraction(state, event, handlers)) {
      return;
    }
  }
  const info = inspectEventTile(state, event, handlers);
  if (!info) {
    return;
  }
  if (state.currentTool === "paint") {
    if (instantPaint) {
      paintSelectedAsset(state, info, handlers, canvasToWorld(state, event));
    }
    return;
  }
  handlers.onPick(info);
}

function inspectEventInteraction(state, event, handlers) {
  const point = canvasToWorld(state, event);
  const interaction = handlers.getInteractionAt?.(state, point.x, point.y) || null;
  if (!interaction) {
    return null;
  }
  clearTileSelection(state);
  state.selected = interaction;
  handlers.updateInspector(interaction);
  handlers.onInteractionPick?.(interaction);
  draw(state);
  return interaction;
}

/**
 * Handle right-click tile actions for the active tool.
 *
 * Parameters mirror handleClick.
 */
function handleContextMenu(state, event, handlers) {
  event.preventDefault();
  if (!state.app) {
    return;
  }
  if (state.currentTool === "select" && inspectEventSprite(state, event, handlers)) {
    handlers.onEnemyMenu?.(state.selected, event);
    return;
  }
  const info = inspectEventTile(state, event, handlers);
  if (!info) {
    return;
  }
  if (state.currentTool === "paint") {
    const point = canvasToWorld(state, event);
    const label = handlers.getPaintNavigation?.() ? "Move Marker" : "Paint";
    handlers.onPaintMenu?.(info, event, () => paintSelectedAsset(state, info, handlers, point), label);
  } else {
    handlers.onTileMenu(info, event);
  }
}

/**
 * Inspect and publish sprite information for a pointer event when the overlay is active.
 *
 * Parameters mirror inspectEventTile.
 * Returns:
 *   Sprite selection object, or null.
 */
function inspectEventSprite(state, event, handlers) {
  const point = canvasToWorld(state, event);
  const sprite = handlers.getEnemyAt?.(state, point.x, point.y) || null;
  if (!sprite) {
    return null;
  }
  clearTileSelection(state);
  state.selected = sprite;
  handlers.updateInspector(sprite);
  handlers.onEnemyPick?.(sprite);
  draw(state);
  return sprite;
}

/**
 * Inspect and publish tile information for a pointer event.
 *
 * Parameters mirror handleClick.
 * Returns:
 *   Tile information object, or null.
 */
function inspectEventTile(state, event, handlers) {
  const point = canvasToWorld(state, event);
  const info = state.app.mapCache.inspect(state.group, point.x, point.y);
  clearTileSelection(state);
  state.selected = info;
  handlers.updateInspector(info);
  draw(state);
  return info;
}

/**
 * Convert a canvas-space pointer to rendered world coordinates.
 *
 * Parameters:
 *   state: Shared Workbench state.
 *   event: Pointer or mouse event.
 * Returns:
 *   Object with x/y world coordinates.
 */
function canvasToWorld(state, event) {
  const rect = event.currentTarget.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left - state.panX) / state.zoom,
    y: (event.clientY - rect.top - state.panY) / state.zoom,
  };
}

/**
 * Determine whether a click follows a drag.
 *
 * Parameters:
 *   state: Shared Workbench state.
 *   event: Mouse click event.
 * Returns:
 *   True if the pointer moved enough to count as panning.
 */
function pointerMoved(state, event) {
  const start = state.pointerStart || state.dragStart;
  return start && (Math.abs(event.clientX - start.x) > 2 || Math.abs(event.clientY - start.y) > 2);
}

/**
 * Prevent browser middle-click autoscroll after middle-drag panning starts.
 */
function preventAuxClick(event) {
  if (event.button === 1) {
    event.preventDefault();
  }
}
