/**
 * Properties-panel controls for ZScream-style static overlay tile writes.
 */

import { applyCommand } from "./operations.js?v=20260621-render-restore20";
import { cloneStaticOverlayRecord } from "./static-overlay-mod-export.js?v=20260621-render-restore20";

const IDS = ["staticOverlayRecordInput", "staticOverlayXInput", "staticOverlayYInput", "staticOverlayTileInput"];
const BUTTON_IDS = ["addStaticOverlayButton", "applyStaticOverlayButton", "deleteStaticOverlayButton"];

let boundState = null;
let boundActions = null;

export function bindStaticOverlayControls(state, actions) {
  boundState = state;
  boundActions = actions;
  ensureControls();
  document.querySelector("#addStaticOverlayButton").addEventListener("click", addStaticOverlay);
  document.querySelector("#applyStaticOverlayButton").addEventListener("click", applyStaticOverlay);
  document.querySelector("#deleteStaticOverlayButton").addEventListener("click", deleteStaticOverlay);
  syncStaticOverlayControls(state, null);
}

export function syncStaticOverlayControls(state, info = state?.selected) {
  const target = addTarget(state, info);
  const selection = target ? overlayAt(state, target.area, target.x, target.y) : null;
  state.staticOverlayTarget = target;
  state.staticOverlaySelection = selection;
  fillControls(selection?.record || null, selection, target, info);
}

function addStaticOverlay() {
  const target = boundState?.staticOverlayTarget;
  if (!target) {
    boundActions.setStatus("Select an overworld map16 tile first");
    return;
  }
  const existing = overlayAt(boundState, target.area, target.x, target.y);
  if (existing) {
    applyStaticOverlay();
    return;
  }
  const after = readEditedRecord(target);
  if (!after) {
    return;
  }
  const conflict = conflictAt(boundState, target.area, after, -1);
  if (conflict) {
    applyCommand(boundState.history, boundState, {
      kind: "metadata.set-static-overlay",
      area: target.area,
      index: conflict.index,
      before: conflict.record,
      after,
    });
    boundActions.setStatus(`Updated static overlay ${hex(after.tile, 4)}`);
    syncStaticOverlayControls(boundState);
    boundActions.rerender();
    return;
  }
  const list = overlayList(boundState, target.area);
  applyCommand(boundState.history, boundState, {
    kind: "metadata.set-static-overlay",
    action: "insert",
    area: target.area,
    index: list.length,
    after,
  });
  boundActions.setStatus(`Added static overlay ${hex(after.tile, 4)}`);
  syncStaticOverlayControls(boundState);
  boundActions.rerender();
}

function applyStaticOverlay() {
  const selection = boundState?.staticOverlaySelection;
  if (!selection) {
    boundActions.setStatus("Select a tile with a static overlay first");
    return;
  }
  const before = selection.record;
  const after = readEditedRecord(before);
  if (!after) {
    return;
  }
  if (JSON.stringify(before) === JSON.stringify(after)) {
    boundActions.setStatus("Static overlay unchanged");
    return;
  }
  const conflict = conflictAt(boundState, selection.area, after, selection.index);
  applyCommand(boundState.history, boundState, {
    kind: "metadata.set-static-overlay",
    area: selection.area,
    index: selection.index,
    before,
    after,
    conflict,
  });
  boundActions.setStatus(`Updated static overlay ${hex(after.tile, 4)}`);
  syncStaticOverlayControls(boundState);
  boundActions.rerender();
}

function deleteStaticOverlay() {
  const selection = boundState?.staticOverlaySelection;
  if (!selection) {
    boundActions.setStatus("Select a tile with a static overlay first");
    return;
  }
  applyCommand(boundState.history, boundState, {
    kind: "metadata.set-static-overlay",
    action: "delete",
    area: selection.area,
    index: selection.index,
    before: selection.record,
  });
  boundActions.setStatus(`Deleted static overlay ${hex(selection.record.tile, 4)}`);
  syncStaticOverlayControls(boundState);
  boundActions.rerender();
}

function ensureControls() {
  if (document.querySelector("[data-static-overlay-controls]")) {
    return;
  }
  const section = document.createElement("section");
  section.dataset.staticOverlayControls = "true";
  section.append(
    heading(),
    label("Record", input("staticOverlayRecordInput", true)),
    label("X", numberInput("staticOverlayXInput")),
    label("Y", numberInput("staticOverlayYInput")),
    label("Tile", input("staticOverlayTileInput")),
    buttonRow(),
  );
  const inspector = document.querySelector("#inspectorRows").closest("section");
  inspector.parentNode.insertBefore(section, inspector);
}

function addTarget(state, info) {
  if (info?.kind !== "tile" || state?.group?.kind !== "atlas") {
    return null;
  }
  const coord = tileOverlayCoord(state, info);
  return { area: info.area, x: coord.x, y: coord.y, tile: info.map16 };
}

function tileOverlayCoord(state, info) {
  const group = state.group;
  const screenOffset = info.screen - group.base;
  const areaOffset = info.area - group.base;
  const dx = screenOffset % group.columns - areaOffset % group.columns;
  const dy = Math.floor(screenOffset / group.columns) - Math.floor(areaOffset / group.columns);
  return {
    x: clamp(info.map16X + dx * 32, 0, 63),
    y: clamp(info.map16Y + dy * 32, 0, 63),
  };
}

function overlayAt(state, area, x, y) {
  const list = overlayList(state, area);
  const index = list.findIndex((row) => row.x === x && row.y === y);
  return index < 0 ? null : { area, index, record: cloneStaticOverlayRecord(list[index]) };
}

function overlayList(state, area) {
  const header = state?.sourceData?.areaHeaders?.[area];
  if (!header) {
    return [];
  }
  header.staticOverlays = header.staticOverlays || [];
  return header.staticOverlays;
}

function conflictAt(state, area, record, ignoredIndex) {
  const list = overlayList(state, area);
  const index = list.findIndex((row, rowIndex) => (
    rowIndex !== ignoredIndex && row.x === record.x && row.y === record.y
  ));
  return index < 0 ? null : { index, record: cloneStaticOverlayRecord(list[index]) };
}

function readEditedRecord(seed) {
  const area = seed.area ?? boundState.staticOverlayTarget?.area;
  try {
    return cloneStaticOverlayRecord({
      tile: fields().staticOverlayTileInput.value,
      x: fields().staticOverlayXInput.value,
      y: fields().staticOverlayYInput.value,
    });
  } catch (error) {
    boundActions.setStatus(error?.message || "Invalid static overlay");
    return null;
  }
}

function fillControls(record, selection, target, info) {
  const ui = fields();
  setInputLimits(ui, target?.area ?? selection?.area);
  ui.staticOverlayRecordInput.value = selection ? `${hex(selection.area, 2)}:${selection.index}` :
    target ? `${hex(target.area, 2)}:new` : "";
  ui.staticOverlayXInput.value = record ? String(record.x) : target ? String(target.x) : "";
  ui.staticOverlayYInput.value = record ? String(record.y) : target ? String(target.y) : "";
  ui.staticOverlayTileInput.value = record ? hex(record.tile, 4) :
    info?.map16 !== undefined ? hex(info.map16, 4) : "";
  setDisabled(!record && !target, !record, !target);
}

function setDisabled(inputsDisabled, editDisabled, addDisabled) {
  const ui = fields();
  for (const id of IDS) {
    ui[id].disabled = inputsDisabled || id === "staticOverlayRecordInput";
  }
  for (const id of BUTTON_IDS) {
    document.querySelector(`#${id}`).disabled = inputsDisabled;
  }
  document.querySelector("#applyStaticOverlayButton").disabled = editDisabled;
  document.querySelector("#deleteStaticOverlayButton").disabled = editDisabled;
  document.querySelector("#addStaticOverlayButton").disabled = addDisabled;
}

function setInputLimits(ui) {
  ui.staticOverlayXInput.max = "63";
  ui.staticOverlayYInput.max = "63";
}

function heading() {
  const title = document.createElement("h2");
  title.textContent = "Static Overlay";
  return title;
}

function label(text, control) {
  const node = document.createElement("label");
  node.textContent = text;
  node.append(control);
  return node;
}

function input(id, disabled = false) {
  const node = document.createElement("input");
  node.id = id;
  node.disabled = disabled;
  return node;
}

function numberInput(id) {
  const node = input(id);
  node.type = "number";
  node.min = "0";
  node.max = "63";
  node.step = "1";
  return node;
}

function buttonRow() {
  const row = document.createElement("div");
  row.className = "row";
  row.append(
    button("addStaticOverlayButton", "Add Overlay"),
    button("applyStaticOverlayButton", "Apply Overlay"),
    button("deleteStaticOverlayButton", "Delete"),
  );
  return row;
}

function button(id, text) {
  const node = document.createElement("button");
  node.id = id;
  node.type = "button";
  node.textContent = text;
  return node;
}

function fields() {
  const result = {};
  for (const id of IDS) {
    result[id] = document.querySelector(`#${id}`);
  }
  return result;
}

function clamp(value, min, max) {
  const safe = Number.isFinite(value) ? value : min;
  return Math.max(min, Math.min(max, safe));
}

function hex(value, width) {
  return `0x${Number(value).toString(16).toUpperCase().padStart(width, "0")}`;
}
