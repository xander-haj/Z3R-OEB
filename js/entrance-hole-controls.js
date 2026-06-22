/**
 * Properties-panel controls for grid-based overworld entrances and fall holes.
 */

import { applyCommand, parseNumber } from "./operations.js?v=20260621-render-restore20";

const EDITABLE_LISTS = ["entrances", "holes"];
const IDS = [
  "entranceHoleKindInput",
  "entranceHoleRecordInput",
  "entranceHoleXInput",
  "entranceHoleYInput",
  "entranceHoleIdInput",
  "applyEntranceHoleButton",
];

let boundState = null;
let boundActions = null;

/**
 * Bind generated entrance/hole controls to shared Workbench state.
 *
 * Parameters:
 *   state: Shared Workbench state.
 *   actions: Rerender and status callbacks.
 * Returns:
 *   None.
 */
export function bindEntranceHoleControls(state, actions) {
  boundState = state;
  boundActions = actions;
  ensureControls();
  fields().applyEntranceHoleButton.addEventListener("click", applyEntranceHoleEdit);
  syncEntranceHoleControls(state, null);
}

/**
 * Refresh controls from the currently selected entrance or fall-hole marker.
 *
 * Parameters:
 *   state: Shared Workbench state.
 *   info: Current inspector selection.
 * Returns:
 *   None.
 */
export function syncEntranceHoleControls(state, info = state?.selected) {
  const selection = editableSelection(info);
  const record = selection ? navigationRecord(state, selection) : null;
  state.entranceHoleSelection = record ? selection : null;
  fillControls(record, selection, coordLimits(state, selection), minY(selection));
}

/**
 * Apply grid and destination edits as one undoable full-record replacement.
 *
 * Parameters: none.
 * Returns:
 *   None.
 */
function applyEntranceHoleEdit() {
  const selection = boundState?.entranceHoleSelection;
  const before = selection ? navigationRecord(boundState, selection) : null;
  if (!before) {
    boundActions.setStatus("Select an entrance or fall hole first");
    return;
  }
  const after = editedRecord(selection, before);
  if (JSON.stringify(before) === JSON.stringify(after)) {
    boundActions.setStatus("Entrance or hole record unchanged");
    return;
  }
  applyCommand(boundState.history, boundState, {
    kind: "metadata.set-navigation-record",
    area: selection.area,
    list: selection.navigationList,
    index: selection.navigationIndex,
    before,
    after,
  });
  syncSelectedMarker(selection, after);
  boundActions.setStatus(`Updated ${after.displayName}`);
  syncEntranceHoleControls(boundState);
  boundActions.rerender();
}

/**
 * Create the generated entrance/hole section once before inspector details.
 *
 * Parameters: none.
 * Returns:
 *   None.
 */
function ensureControls() {
  if (document.querySelector("[data-entrance-hole-controls]")) {
    return;
  }
  const title = document.createElement("h2");
  title.textContent = "Entrance / Hole";
  const section = document.createElement("section");
  section.dataset.entranceHoleControls = "true";
  section.append(
    title,
    label("Type", input("entranceHoleKindInput", true)),
    label("Record", input("entranceHoleRecordInput", true)),
    label("X", numberInput("entranceHoleXInput")),
    label("Y", numberInput("entranceHoleYInput")),
    label("Entrance ID", numberInput("entranceHoleIdInput")),
    buttonRow(),
  );
  const inspector = document.querySelector("#inspectorRows").closest("section");
  inspector.parentNode.insertBefore(section, inspector);
}

/**
 * Return selected editable entrance and fall-hole markers only.
 *
 * Parameters:
 *   info: Current inspector selection.
 * Returns:
 *   Selection info, or null when the selected marker belongs to another layer.
 */
function editableSelection(info) {
  return info?.kind === "interaction" && EDITABLE_LISTS.includes(info.navigationList) ? info : null;
}

/**
 * Return a cloned normalized navigation row for the selected marker.
 *
 * Parameters:
 *   state: Shared Workbench state.
 *   selection: Editable entrance or fall-hole selection.
 * Returns:
 *   Cloned normalized row, or null when the backing row is unavailable.
 */
function navigationRecord(state, selection) {
  const list = state?.sourceData?.areaHeaders?.[selection.area]?.navigation?.[selection.navigationList];
  const record = list?.[selection.navigationIndex];
  return record ? clone(record) : null;
}

/**
 * Populate controls and disable them when no entrance or hole is selected.
 *
 * Parameters:
 *   record: Current normalized navigation row.
 *   selection: Current editable selection.
 *   limits: Largest legal x/y grid coordinates for the selected area.
 *   yMin: Smallest legal y coordinate for the selected list.
 * Returns:
 *   None.
 */
function fillControls(record, selection, limits, yMin) {
  const ui = fields();
  ui.entranceHoleKindInput.value = selection?.category || "";
  ui.entranceHoleRecordInput.value = record && selection.navigationList === "entrances" ?
    `slot ${record.index}` : record ? `slot ${record.index}` : "";
  ui.entranceHoleXInput.value = record ? String(record.x ?? record.gridX ?? 0) : "";
  ui.entranceHoleYInput.value = record ? String(record.y ?? record.gridY ?? yMin) : "";
  ui.entranceHoleIdInput.value = record ? hex(record.entranceId, 2) : "";
  ui.entranceHoleXInput.min = "0";
  ui.entranceHoleYInput.min = String(yMin);
  ui.entranceHoleXInput.max = String(limits.x);
  ui.entranceHoleYInput.max = String(limits.y);
  setDisabled(ui, !record);
}

/**
 * Build the normalized after-row from form values while preserving row identity.
 *
 * Parameters:
 *   selection: Editable entrance or fall-hole selection.
 *   before: Current normalized navigation row.
 * Returns:
 *   Edited normalized navigation row.
 */
function editedRecord(selection, before) {
  const limits = coordLimits(boundState, selection);
  const x = clampedNumber(fields().entranceHoleXInput.value, 0, limits.x);
  const y = clampedNumber(fields().entranceHoleYInput.value, minY(selection), limits.y);
  const entranceId = clampedNumber(fields().entranceHoleIdInput.value, 0, 255);
  const displayName = selection.navigationList === "entrances" ?
    `Entrance ${before.index} -> ${entranceId}` : `Fall hole ${before.index} -> ${entranceId}`;
  return {
    ...before,
    x,
    y,
    entranceId,
    gridX: x,
    gridY: y,
    displayName,
  };
}

/**
 * Keep the selected marker object aligned after applyCommand writes source data.
 *
 * Parameters:
 *   selection: Selected marker object from shared state.
 *   record: Edited normalized entrance or hole row.
 * Returns:
 *   None.
 */
function syncSelectedMarker(selection, record) {
  selection.gridX = record.gridX;
  selection.gridY = record.gridY;
  selection.code = record.index ?? record.entranceId;
  selection.displayName = record.displayName;
  selection.id = String(record.index ?? record.entranceId);
  selection.name = record.displayName;
  selection.x = selection.originX + record.gridX * 16 + 8;
  selection.y = selection.originY + record.gridY * 16 + 8;
  selection.centerX = selection.x;
  selection.centerY = selection.y;
  selection.pixelX = null;
  selection.pixelY = null;
  selection.runtimeNote = navigationNote(selection.navigationList, record);
}

/**
 * Return the largest area-local 16px grid coordinates for this marker's area.
 *
 * Parameters:
 *   state: Shared Workbench state.
 *   selection: Editable entrance or fall-hole selection.
 * Returns:
 *   Object with x and y inclusive maxima.
 */
function coordLimits(state, selection) {
  const size = state?.sourceData?.areaHeaders?.[selection?.area]?.size;
  return {
    x: size === "big" || size === "wide" ? 63 : 31,
    y: size === "big" || size === "tall" ? 63 : 31,
  };
}

/**
 * Return the compiler-valid minimum Y coordinate for a navigation list.
 *
 * Parameters:
 *   selection: Editable entrance or fall-hole selection.
 * Returns:
 *   8 for fall holes, otherwise 0.
 */
function minY(selection) {
  return selection?.navigationList === "holes" ? 8 : 0;
}

/**
 * Rebuild the inspector note after an entrance-id edit.
 *
 * Parameters:
 *   listName: Navigation list name.
 *   record: Normalized entrance or fall-hole row.
 * Returns:
 *   Human-readable runtime table note.
 */
function navigationNote(listName, record) {
  const table = listName === "entrances" ? "kOverworld_Entrance_*" : "kFallHole_*";
  return `${table} slot ${record.index}: ${record.x},${record.y} -> entrance ${record.entranceId}`;
}

/**
 * Enable only editable entrance/hole fields.
 *
 * Parameters:
 *   ui: Resolved control map.
 *   disabled: Whether the section has no editable row.
 * Returns:
 *   None.
 */
function setDisabled(ui, disabled) {
  for (const id of IDS) {
    ui[id].disabled = disabled || id === "entranceHoleKindInput" || id === "entranceHoleRecordInput";
  }
}

/**
 * Build one label/control pair.
 *
 * Parameters:
 *   text: Label text.
 *   control: Form control to append.
 * Returns:
 *   Label element.
 */
function label(text, control) {
  const node = document.createElement("label");
  node.textContent = text;
  node.append(control);
  return node;
}

/**
 * Build a text input control.
 *
 * Parameters:
 *   id: DOM id for the generated input.
 *   disabled: Whether the input starts read-only.
 * Returns:
 *   Input element.
 */
function input(id, disabled = false) {
  const node = document.createElement("input");
  node.id = id;
  node.disabled = disabled;
  return node;
}

/**
 * Build a number-like input that still accepts hex through parseNumber.
 *
 * Parameters:
 *   id: DOM id for the generated input.
 * Returns:
 *   Input element.
 */
function numberInput(id) {
  const node = input(id);
  node.inputMode = "numeric";
  return node;
}

/**
 * Build the apply button row.
 *
 * Parameters: none.
 * Returns:
 *   Row element containing the apply button.
 */
function buttonRow() {
  const row = document.createElement("div");
  row.className = "row";
  const button = document.createElement("button");
  button.id = "applyEntranceHoleButton";
  button.type = "button";
  button.textContent = "Apply Entrance / Hole";
  row.append(button);
  return row;
}

/**
 * Resolve all generated controls by id.
 *
 * Parameters: none.
 * Returns:
 *   Object keyed by control id.
 */
function fields() {
  const result = {};
  for (const id of IDS) {
    result[id] = document.querySelector(`#${id}`);
  }
  return result;
}

/**
 * Parse and clamp one numeric input field.
 *
 * Parameters:
 *   value: Input text.
 *   min: Smallest accepted integer.
 *   max: Largest accepted integer.
 * Returns:
 *   Integer clamped to the requested range.
 */
function clampedNumber(value, min, max) {
  const parsed = parseNumber(value);
  const number = Number.isFinite(parsed) ? parsed : min;
  return Math.max(min, Math.min(max, number));
}

/**
 * Format a numeric value as uppercase hex.
 *
 * Parameters:
 *   value: Numeric value.
 *   width: Minimum hex digit count.
 * Returns:
 *   `0x`-prefixed uppercase hex text.
 */
function hex(value, width) {
  return `0x${Number(value).toString(16).toUpperCase().padStart(width, "0")}`;
}

/**
 * Clone JSON-compatible navigation metadata.
 *
 * Parameters:
 *   value: JSON-compatible value.
 * Returns:
 *   Deep clone of the provided value.
 */
function clone(value) {
  return JSON.parse(JSON.stringify(value));
}
