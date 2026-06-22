/**
 * Properties-panel controls for overworld Items rows compiled into kOverworldSecrets.
 */

import { applyCommand, parseNumber } from "./operations.js?v=20260621-render-restore20";
import { cloneItemRecord } from "./interaction-mod-export.js?v=20260621-render-restore20";
import {
  secretItemNames,
  normalizeSecretItem,
  secretSpawnRuntime,
  secretItemCoordLimits,
} from "./secret-item-shape.js?v=20260621-render-restore20";

const IDS = ["secretItemRecordInput", "secretItemXInput", "secretItemYInput", "secretItemNameInput"];
const BUTTON_IDS = ["addSecretItemButton", "applySecretItemButton", "deleteSecretItemButton"];

let boundState = null;
let boundActions = null;

/**
 * Bind generated secret-item controls to shared Workbench state.
 *
 * Parameters:
 *   state: Shared Workbench state.
 *   actions: Rerender and status callbacks.
 * Returns:
 *   None.
 */
export function bindSecretItemControls(state, actions) {
  boundState = state;
  boundActions = actions;
  ensureControls();
  document.querySelector("#addSecretItemButton").addEventListener("click", addSecretItem);
  document.querySelector("#applySecretItemButton").addEventListener("click", applySecretItemEdit);
  document.querySelector("#deleteSecretItemButton").addEventListener("click", deleteSecretItem);
  syncSecretItemControls(state, null);
}

/**
 * Refresh controls from the currently selected hidden item row.
 *
 * Parameters:
 *   state: Shared Workbench state.
 *   info: Current inspector selection.
 * Returns:
 *   None.
 */
export function syncSecretItemControls(state, info = state?.selected) {
  const selection = editableSelection(info);
  const record = selection ? itemRecord(state, selection) : null;
  const target = addTarget(state, info);
  state.secretItemSelection = record ? selection : null;
  state.secretItemAddTarget = target;
  fillControls(record, selection, target);
}

/**
 * Add a new secret item row to the selected tile's area.
 *
 * Parameters: none.
 * Returns:
 *   None.
 */
function addSecretItem() {
  const target = boundState?.secretItemAddTarget;
  if (!target) {
    boundActions.setStatus("Select a light or dark world tile first");
    return;
  }
  const item = editedItem({
    x: target.x,
    y: target.y,
    name: fields().secretItemNameInput.value,
  }, target.area);
  const items = itemList(boundState, target.area);
  const index = items.length;
  applyCommand(boundState.history, boundState, {
    kind: "metadata.set-item-record",
    action: "insert",
    area: target.area,
    index,
    after: item,
  });
  boundActions.setStatus(`Added ${item.displayName}`);
  syncSecretItemControls(boundState);
  boundActions.rerender();
}

/**
 * Apply the current item fields as one undoable metadata edit.
 *
 * Parameters: none.
 * Returns:
 *   None.
 */
function applySecretItemEdit() {
  const selection = boundState?.secretItemSelection;
  const before = selection ? itemRecord(boundState, selection) : null;
  if (!before) {
    boundActions.setStatus("Select a secret item first");
    return;
  }
  const after = editedItem(before, selection.area);
  if (JSON.stringify(before) === JSON.stringify(after)) {
    boundActions.setStatus("Secret item unchanged");
    return;
  }
  applyCommand(boundState.history, boundState, {
    kind: "metadata.set-item-record",
    area: selection.area,
    index: selection.interactionIndex,
    before,
    after,
  });
  boundActions.setStatus(`Updated ${after.displayName}`);
  syncSecretItemControls(boundState);
  boundActions.rerender();
}

/**
 * Delete the currently selected secret item row.
 *
 * Parameters: none.
 * Returns:
 *   None.
 */
function deleteSecretItem() {
  const selection = boundState?.secretItemSelection;
  const before = selection ? itemRecord(boundState, selection) : null;
  if (!before) {
    boundActions.setStatus("Select a secret item first");
    return;
  }
  applyCommand(boundState.history, boundState, {
    kind: "metadata.set-item-record",
    action: "delete",
    area: selection.area,
    index: selection.interactionIndex,
    before,
  });
  boundState.selected = null;
  boundState.secretItemSelection = null;
  boundActions.setStatus(`Deleted ${before.displayName}`);
  syncSecretItemControls(boundState, null);
  boundActions.rerender();
}

/**
 * Create the generated controls once before the inspector details section.
 */
function ensureControls() {
  if (document.querySelector("[data-secret-item-controls]")) {
    return;
  }
  const section = document.createElement("section");
  section.dataset.secretItemControls = "true";
  section.append(
    heading(),
    label("Record", input("secretItemRecordInput", true)),
    label("X", numberInput("secretItemXInput")),
    label("Y", numberInput("secretItemYInput")),
    label("Name", nameSelect()),
    buttonRow(),
  );
  const inspector = document.querySelector("#inspectorRows").closest("section");
  inspector.parentNode.insertBefore(section, inspector);
}

/**
 * Return selected editable Items records only.
 */
function editableSelection(info) {
  return info?.kind === "interaction" && info.interactionList === "items" ? info : null;
}

/**
 * Return a cloned item record for the selected row.
 */
function itemRecord(state, selection) {
  const record = itemList(state, selection.area)?.[selection.interactionIndex];
  return record ? cloneItemRecord(
    record, secretSpawnRuntime(state?.sourceData), secretItemNames(state?.sourceData)) : null;
}

/**
 * Return the mutable item list for one area.
 */
function itemList(state, area) {
  const header = state?.sourceData?.areaHeaders?.[area];
  header.interactions = header.interactions || { items: [], shovelSpots: [] };
  header.interactions.items = header.interactions.items || [];
  return header.interactions.items;
}

/**
 * Build the normalized item row from current control values.
 */
function editedItem(before, area) {
  const limits = secretItemCoordLimits(boundState?.sourceData?.areaHeaders?.[area]);
  return normalizeSecretItem({
    ...before,
    x: clamp(parseNumber(fields().secretItemXInput.value), 0, limits.x),
    y: clamp(parseNumber(fields().secretItemYInput.value), 0, limits.y),
    name: fields().secretItemNameInput.value,
  }, secretSpawnRuntime(boundState?.sourceData), secretItemNames(boundState?.sourceData));
}

/**
 * Fill controls and disable them unless a secret item is selected.
 */
function fillControls(record, selection, target) {
  const ui = fields();
  ui.secretItemRecordInput.value = record ? `${hex(selection.area, 2)}:${selection.interactionIndex}` :
    target ? `${hex(target.area, 2)}:new` : "";
  ui.secretItemXInput.value = record ? String(record.x) : target ? String(target.x) : "";
  ui.secretItemYInput.value = record ? String(record.y) : target ? String(target.y) : "";
  ui.secretItemNameInput.value = record?.name || secretItemNames(boundState?.sourceData)[0];
  setDisabled(!record && !target, !record, !target);
}

/**
 * Enable or disable generated controls together.
 */
function setDisabled(inputsDisabled, editDisabled, addDisabled) {
  const ui = fields();
  for (const id of IDS) {
    ui[id].disabled = inputsDisabled || id === "secretItemRecordInput";
  }
  for (const id of BUTTON_IDS) {
    document.querySelector(`#${id}`).disabled = inputsDisabled;
  }
  document.querySelector("#applySecretItemButton").disabled = editDisabled;
  document.querySelector("#deleteSecretItemButton").disabled = editDisabled;
  document.querySelector("#addSecretItemButton").disabled = addDisabled;
}

/**
 * Build the section heading.
 */
function heading() {
  const title = document.createElement("h2");
  title.textContent = "Secret Item";
  return title;
}

/**
 * Build one label/control row.
 */
function label(text, control) {
  const node = document.createElement("label");
  node.textContent = text;
  node.append(control);
  return node;
}

/**
 * Build a plain input.
 */
function input(id, disabled = false) {
  const node = document.createElement("input");
  node.id = id;
  node.disabled = disabled;
  return node;
}

/**
 * Build a numeric grid-coordinate input.
 */
function numberInput(id) {
  const node = input(id);
  node.type = "number";
  node.min = "0";
  node.max = "63";
  node.step = "1";
  return node;
}

/**
 * Build the exact compiler-name select list.
 */
function nameSelect() {
  const select = document.createElement("select");
  select.id = "secretItemNameInput";
  for (const name of secretItemNames(boundState?.sourceData)) {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    select.append(option);
  }
  return select;
}

/**
 * Build the apply button row.
 */
function buttonRow() {
  const row = document.createElement("div");
  row.className = "row";
  row.append(
    button("addSecretItemButton", "Add Item"),
    button("applySecretItemButton", "Apply Item"),
    button("deleteSecretItemButton", "Delete"),
  );
  return row;
}

/**
 * Build one action button.
 */
function button(id, text) {
  const node = document.createElement("button");
  node.id = id;
  node.type = "button";
  node.textContent = text;
  return node;
}

/**
 * Return an add target from a selected map tile.
 */
function addTarget(state, info) {
  if (info?.kind !== "tile" || info.area >= 128 || state?.group?.kind !== "atlas") {
    return null;
  }
  const coord = tileSecretCoord(state, info);
  return { area: info.area, x: coord.x, y: coord.y };
}

/**
 * Convert a tile selection to the area-local 16px secret grid.
 */
function tileSecretCoord(state, info) {
  const group = state.group;
  const screenOffset = info.screen - group.base;
  const areaOffset = info.area - group.base;
  const dx = screenOffset % group.columns - areaOffset % group.columns;
  const dy = Math.floor(screenOffset / group.columns) - Math.floor(areaOffset / group.columns);
  const limits = secretItemCoordLimits(state.sourceData?.areaHeaders?.[info.area]);
  return {
    x: clamp(info.map16X + dx * 32, 0, limits.x),
    y: clamp(info.map16Y + dy * 32, 0, limits.y),
  };
}

/**
 * Clamp a numeric value to an inclusive range.
 */
function clamp(value, min, max) {
  const safe = Number.isFinite(value) ? value : min;
  return Math.max(min, Math.min(max, safe));
}

/**
 * Resolve generated controls by id.
 */
function fields() {
  const result = {};
  for (const id of IDS) {
    result[id] = document.querySelector(`#${id}`);
  }
  return result;
}

/**
 * Format an area id as uppercase hex.
 */
function hex(value, width) {
  return `0x${Number(value).toString(16).toUpperCase().padStart(width, "0")}`;
}
