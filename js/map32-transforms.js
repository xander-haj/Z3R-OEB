/**
 * Properties-panel controls for transforming the selected map32 terrain cell.
 */

import { applyCommand } from "./operations.js?v=20260621-render-restore20";
import { hex, transformedMap32Id } from "./map32-transform-data.js?v=20260621-render-restore20";
import { selectedTileCells, tileCellKey } from "./tile-selection.js?v=20260621-render-restore20";

const LABELS = {
  rotateLeft: "Rotated left",
  rotateRight: "Rotated right",
  flipHorizontal: "Flipped horizontally",
  flipVertical: "Flipped vertically",
};

/**
 * Bind the transform buttons in the Properties panel.
 *
 * Parameters:
 *   state: Shared Workbench state.
 *   actions: Rerender, status, and inspector callbacks.
 * Returns:
 *   None.
 */
export function bindMap32TransformControls(state, actions) {
  for (const button of document.querySelectorAll("[data-map32-transform]")) {
    button.addEventListener("click", () => transformSelectedTile(state, actions, button.dataset.map32Transform));
  }
}

/**
 * Apply one transform to the currently selected map32 cell.
 *
 * Parameters:
 *   state: Shared Workbench state.
 *   actions: Rerender, status, and inspector callbacks.
 *   transform: rotateLeft, rotateRight, flipHorizontal, or flipVertical.
 * Returns:
 *   None.
 */
function transformSelectedTile(state, actions, transform) {
  const targets = transformTargets(state);
  if (!targets.length) {
    actions.setStatus("Select one or more terrain tiles first");
    return;
  }
  const edits = buildTransformEdits(state, targets, transform);
  if (!edits.length) {
    actions.setStatus("Tile transform did not change the selected tiles");
    return;
  }
  applyTransformCommand(state, edits);
  syncTransformedSelection(state, actions, edits);
  actions.rerender();
  actions.setStatus(transformStatus(transform, edits));
}

/**
 * Resolve transform targets from multi-selection first, then the active single tile.
 *
 * Parameters:
 *   state: Shared Workbench state.
 * Returns:
 *   Array of selected map32 cell descriptors.
 */
function transformTargets(state) {
  const cells = selectedTileCells(state);
  if (cells.length) {
    return cells;
  }
  const selection = state.selected;
  if (!selection || selection.kind === "sprite" || selection.kind === "enemy") {
    return [];
  }
  return [{
    screen: selection.screen,
    x: selection.map32X,
    y: selection.map32Y,
    map32: selection.map32,
  }];
}

/**
 * Convert target cells into before/after terrain edits for one transform.
 *
 * Parameters:
 *   state: Shared Workbench state.
 *   targets: Selected map32 cell descriptors.
 *   transform: rotateLeft, rotateRight, flipHorizontal, or flipVertical.
 * Returns:
 *   Array of changed terrain edits.
 */
function buildTransformEdits(state, targets, transform) {
  const edits = [];
  for (const target of targets) {
    const words = state.assets.map32Words[target.screen];
    if (!words) {
      continue;
    }
    const index = target.y * 16 + target.x;
    const before = words[index];
    if (before === undefined) {
      continue;
    }
    const after = transformedMap32Id(state, before, transform);
    if (after !== before) {
      edits.push({ screen: target.screen, x: target.x, y: target.y, before, after });
    }
  }
  return edits;
}

/**
 * Apply one or many terrain edits through the shared undo/redo command stack.
 *
 * Parameters:
 *   state: Shared Workbench state.
 *   edits: Changed terrain edits.
 * Returns:
 *   None.
 */
function applyTransformCommand(state, edits) {
  if (edits.length === 1) {
    const edit = edits[0];
    applyCommand(state.history, state.assets, { kind: "terrain.set-map32", ...edit });
    return;
  }
  applyCommand(state.history, state.assets, { kind: "terrain.set-map32-batch", edits });
}

/**
 * Keep inspector and selection state aligned with transformed map32 ids.
 *
 * Parameters:
 *   state: Shared Workbench state.
 *   actions: Inspector callback collection.
 *   edits: Changed terrain edits.
 * Returns:
 *   None.
 */
function syncTransformedSelection(state, actions, edits) {
  const editByCell = new Map(edits.map((edit) => [tileCellKey(edit), edit]));
  for (const cell of selectedTileCells(state)) {
    const edit = editByCell.get(tileCellKey(cell));
    if (edit) {
      cell.map32 = edit.after;
    }
  }
  const activeEdit = activeSelectionEdit(state.selected, editByCell);
  const displayEdit = activeEdit || edits[0];
  if (activeEdit) {
    state.selected.map32 = activeEdit.after;
    actions.updateInspector(state.selected);
  }
  document.querySelector("#map32Input").value = hex(displayEdit.after);
}

/**
 * Return the transform edit matching the active inspector tile, when it changed.
 *
 * Parameters:
 *   selection: Current inspector selection.
 *   editByCell: Map keyed by screen/x/y.
 * Returns:
 *   Matching terrain edit, or null.
 */
function activeSelectionEdit(selection, editByCell) {
  if (!selection || selection.kind === "sprite" || selection.kind === "enemy") {
    return null;
  }
  return editByCell.get(tileCellKey({
    screen: selection.screen,
    x: selection.map32X,
    y: selection.map32Y,
  })) || null;
}

/**
 * Build the status text for a completed transform.
 *
 * Parameters:
 *   transform: Transform key from the clicked button.
 *   edits: Changed terrain edits.
 * Returns:
 *   User-facing status text.
 */
function transformStatus(transform, edits) {
  if (edits.length === 1) {
    return `${LABELS[transform]} to ${hex(edits[0].after)}`;
  }
  return `${LABELS[transform]} ${edits.length} tiles`;
}
