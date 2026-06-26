/**
 * Canvas input policy for paint-mode click, drag-pan, and keyboard-pan behavior.
 */

import { ZOOM_IN_FACTOR, ZOOM_OUT_FACTOR, zoomAtCanvasCenter } from "./canvas-zoom.js?v=20260626-control-tabs";
import {
  currentEditorSettings,
  shortcutMatches,
} from "./editor-settings.js?v=20260626-control-shortcuts";

const PAN_STEP = 64;
const FAST_PAN_MULTIPLIER = 3;

let spaceHeld = false;

/**
 * Bind global keyboard controls that affect the canvas viewport.
 */
export function bindCanvasKeyboardControls(state, drawCanvas) {
  window.addEventListener("keydown", (event) => handleKeyDown(state, event, drawCanvas));
  window.addEventListener("keyup", (event) => {
    if (event.code === "Space") {
      spaceHeld = false;
    }
  });
}

/**
 * Return whether paint mode should paint from a normal left click.
 */
export function instantPaintEnabled(state) {
  return state.currentTool === "paint" && currentEditorSettings().paintActivation === "instant";
}

/**
 * Return whether a pointerdown should enter viewport panning.
 */
export function shouldStartCanvasPan(state, event) {
  if (event.button === 1) {
    return state.currentTool !== "paint" || currentEditorSettings().paintPanGesture === "middle-drag";
  }
  if (event.button !== 0) {
    return false;
  }
  if (state.currentTool !== "paint") {
    return true;
  }
  const settings = currentEditorSettings();
  if (settings.paintPanGesture === "middle-drag") {
    return false;
  }
  return settings.paintPanGesture !== "space-drag" || spaceHeld;
}

/**
 * Handle space tracking and optional WASD/arrow viewport panning.
 */
function handleKeyDown(state, event, drawCanvas) {
  if (blocksGlobalShortcut(event)) {
    return;
  }
  const settings = currentEditorSettings();
  if (runConfiguredShortcut(state, event, settings, drawCanvas)) {
    return;
  }
  if (ignoresCanvasNavigation(event)) {
    return;
  }
  if (event.code === "Space") {
    spaceHeld = true;
    event.preventDefault();
    return;
  }
  if (!settings.keyboardPan || event.metaKey || event.ctrlKey || event.altKey) {
    return;
  }
  const delta = keyboardPanDelta(event);
  if (!delta) {
    return;
  }
  event.preventDefault();
  state.panX += delta.x;
  state.panY += delta.y;
  drawCanvas();
}

/**
 * Run a configured shortcut action when the key event matches one.
 */
function runConfiguredShortcut(state, event, settings, drawCanvas) {
  const shortcuts = settings.shortcuts || {};
  if (shortcutMatches(event, shortcuts.zoomIn)) {
    event.preventDefault();
    zoomAtCanvasCenter(state, ZOOM_IN_FACTOR);
    drawCanvas();
    return true;
  }
  if (shortcutMatches(event, shortcuts.zoomOut)) {
    event.preventDefault();
    zoomAtCanvasCenter(state, ZOOM_OUT_FACTOR);
    drawCanvas();
    return true;
  }
  if (shortcutMatches(event, shortcuts.undo)) {
    event.preventDefault();
    document.querySelector("#undoButton")?.click();
    return true;
  }
  if (shortcutMatches(event, shortcuts.redo)) {
    event.preventDefault();
    document.querySelector("#redoButton")?.click();
    return true;
  }
  return false;
}

/**
 * Convert a supported key into a viewport pan delta.
 */
function keyboardPanDelta(event) {
  const step = PAN_STEP * (event.shiftKey ? FAST_PAN_MULTIPLIER : 1);
  return {
    ArrowLeft: { x: step, y: 0 },
    ArrowRight: { x: -step, y: 0 },
    ArrowUp: { x: 0, y: step },
    ArrowDown: { x: 0, y: -step },
    KeyA: { x: step, y: 0 },
    KeyD: { x: -step, y: 0 },
    KeyW: { x: 0, y: step },
    KeyS: { x: 0, y: -step },
  }[event.code] || null;
}

/**
 * Avoid hijacking typing or open modal overlays with global shortcuts.
 */
function blocksGlobalShortcut(event) {
  const textInput = event.target?.closest?.("input, textarea, select, [contenteditable='true']");
  const modalOpen = document.querySelector(".modal-overlay:not([hidden]), .guide-overlay:not([hidden])");
  return Boolean(textInput || modalOpen);
}

/**
 * Avoid stealing Space/WASD/arrow behavior from focused buttons.
 */
function ignoresCanvasNavigation(event) {
  return Boolean(event.target?.closest?.("button"));
}
