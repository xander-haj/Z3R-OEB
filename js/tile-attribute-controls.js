/**
 * Properties-panel controls for the 512-byte overworld map8 tile-type table.
 */

import { parseNumber } from "./operations.js?v=20260621-render-restore20";

const PATCH_PATH = "patches/tile-attributes.json";
const PATCH_FORMAT = "zelda3-overworld-tile-attributes-v1";
const EDIT_KIND = "tile.map8-attribute";

let boundState = null;
let boundActions = null;

/**
 * Bind the generated tile-attribute controls to shared Workbench state.
 *
 * Parameters:
 *   state: Shared Workbench state.
 *   actions: Rerender, status, and optional inspector callbacks.
 * Returns:
 *   None.
 */
export function bindTileAttributeControls(state, actions) {
  boundState = state;
  boundActions = actions;
  ensureControls();
  controls().applyTileAttributeButton.addEventListener("click", applyTileAttributeEdit);
  syncTileAttributeControls(state, null);
}

/**
 * Refresh controls from the current tile selection.
 *
 * Parameters:
 *   state: Shared Workbench state.
 *   info: Current selection.
 * Returns:
 *   None.
 */
export function syncTileAttributeControls(state, info = state?.selected) {
  const fields = controls();
  const selection = selectedTileAttribute(info);
  state.tileAttributeSelection = selection;
  fields.tileAttributeIndexInput.value = selection ? hex(selection.index, 3) : "";
  fields.tileAttributeValueInput.value = selection && selection.current !== null ? hex(selection.current, 2) : "";
  const disabled = !selection || selection.current === null;
  fields.tileAttributeValueInput.disabled = disabled;
  fields.applyTileAttributeButton.disabled = disabled;
}

/**
 * Apply the control value to preview state and the sparse patch JSON document.
 *
 * Parameters: none.
 * Returns:
 *   None.
 */
function applyTileAttributeEdit() {
  const state = boundState;
  const selection = state?.tileAttributeSelection;
  if (!state?.currentMod) {
    boundActions.setStatus("Create or select a mod first");
    return;
  }
  if (!selection) {
    boundActions.setStatus("Select a terrain tile first");
    return;
  }
  const value = parseNumber(controls().tileAttributeValueInput.value);
  if (!Number.isInteger(value) || value < 0 || value > 0xff) {
    boundActions.setStatus("Tile type must be a byte value");
    return;
  }
  const before = state.sourceData.map8TileAttributes?.[selection.index] ?? 0;
  if (before === value) {
    boundActions.setStatus("Tile type unchanged");
    return;
  }
  try {
    writePatchEdit(selection.index, value);
  } catch (error) {
    boundActions.setStatus(error.message);
    return;
  }
  applyPreviewValue(state, selection.index, value);
  boundActions.setStatus(`Updated tile type ${hex(selection.index, 3)} -> ${hex(value, 2)}`);
  boundActions.updateInspector?.(state.selected);
  boundActions.rerender();
}

/**
 * Create controls inside the existing Tile section without growing index.html.
 */
function ensureControls() {
  if (document.querySelector("[data-tile-attribute-controls]")) {
    return;
  }
  const section = document.createElement("div");
  section.dataset.tileAttributeControls = "true";
  section.append(
    label("Type Index", input("tileAttributeIndexInput", true)),
    label("Tile Type", input("tileAttributeValueInput", false)),
    applyRow(),
  );
  const rows = document.querySelector("#inspectorRows");
  rows.parentNode.insertBefore(section, rows);
}

/**
 * Return a selected tile's type-table coordinate and current byte.
 *
 * Parameters:
 *   info: Current selection.
 * Returns:
 *   Selection descriptor, or null when the current selection is not terrain.
 */
function selectedTileAttribute(info) {
  if (info?.kind !== "tile" || !Number.isInteger(info.tileTypeIndex)) {
    return null;
  }
  return {
    index: info.tileTypeIndex,
    current: Number.isFinite(info.tileType) ? info.tileType : null,
  };
}

/**
 * Upsert a sparse tile-attribute edit into the editable patch textarea.
 */
function writePatchEdit(index, value) {
  const textarea = document.querySelector(`[data-patch-path="${PATCH_PATH}"]`);
  if (!textarea) {
    throw new Error("Tile attribute patch editor is unavailable");
  }
  const documentValue = normalizeDocument(textarea ? JSON.parse(textarea.value) : null);
  documentValue.edits = documentValue.edits.filter((edit) => editIndex(edit) !== index);
  documentValue.edits.push({
    kind: EDIT_KIND,
    target: { index: hex(index, 3) },
    set: { type: hex(value, 2) },
  });
  if (textarea) {
    textarea.value = JSON.stringify(documentValue, null, 2);
  }
}

/**
 * Apply the tile-type byte to sourceData and map-cache preview state.
 */
function applyPreviewValue(state, index, value) {
  const attributes = Array.from(state.sourceData.map8TileAttributes || []);
  while (attributes.length < 512) {
    attributes.push(0);
  }
  attributes[index] = value;
  state.sourceData.map8TileAttributes = attributes;
  if (state.app?.mapCache) {
    state.app.mapCache.map8TileAttributes = attributes;
  }
  if (state.selected?.kind === "tile" && state.selected.tileTypeIndex === index) {
    state.selected.tileType = value;
  }
}

/**
 * Normalize missing or stale textarea JSON into the supported patch envelope.
 */
function normalizeDocument(documentValue) {
  if (documentValue?.format === PATCH_FORMAT && Array.isArray(documentValue.edits)) {
    return documentValue;
  }
  return { format: PATCH_FORMAT, edits: [] };
}

/**
 * Return the target index for one existing edit, or null when it is not this patch kind.
 */
function editIndex(edit) {
  if (edit?.kind !== EDIT_KIND) {
    return null;
  }
  const value = edit.target?.index ?? edit.index ?? edit.target?.tile ?? edit.tile;
  const index = parseNumber(value);
  return Number.isInteger(index) ? index : null;
}

/**
 * Build one label/control pair for the generated Properties controls.
 */
function label(text, control) {
  const node = document.createElement("label");
  node.textContent = text;
  node.append(control);
  return node;
}

/**
 * Build one input control.
 */
function input(id, disabled) {
  const node = document.createElement("input");
  node.id = id;
  node.disabled = disabled;
  return node;
}

/**
 * Build the apply button row.
 */
function applyRow() {
  const row = document.createElement("div");
  row.className = "row";
  const button = document.createElement("button");
  button.id = "applyTileAttributeButton";
  button.type = "button";
  button.textContent = "Apply Tile Type";
  row.append(button);
  return row;
}

/**
 * Lazily resolve generated control elements by id.
 */
function controls() {
  return {
    applyTileAttributeButton: document.querySelector("#applyTileAttributeButton"),
    tileAttributeIndexInput: document.querySelector("#tileAttributeIndexInput"),
    tileAttributeValueInput: document.querySelector("#tileAttributeValueInput"),
  };
}

/**
 * Format a value as uppercase hexadecimal text.
 */
function hex(value, width) {
  return `0x${Number(value).toString(16).toUpperCase().padStart(width, "0")}`;
}
