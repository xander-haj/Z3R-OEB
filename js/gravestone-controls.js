/**
 * Properties-panel controls for fixed-index overworld gravestone records.
 */

import { normalizeRecord } from "./gravestone-mod-export.js?v=20260621-render-restore20";
import { applyCommand } from "./operations.js?v=20260621-render-restore20";

let boundState = null;
let boundActions = null;

export function bindGravestoneControls(state, actions) {
  boundState = state;
  boundActions = actions;
  ensureControls();
  document.querySelector("#applyGravestoneButton").addEventListener("click", applyGravestoneEdit);
  syncGravestoneControls(state, null);
}

export function syncGravestoneControls(state, info = state?.selected) {
  const selection = editableSelection(info);
  const record = selection ? gravestoneRecord(state, selection.gravestoneIndex) : null;
  state.gravestoneSelection = record ? selection : null;
  fillControls(record);
}

function applyGravestoneEdit() {
  const selection = boundState?.gravestoneSelection;
  const before = selection ? gravestoneRecord(boundState, selection.gravestoneIndex) : null;
  if (!before) {
    boundActions.setStatus("Select a gravestone first");
    return;
  }
  let after;
  try {
    after = editedRecord(before);
  } catch (error) {
    boundActions.setStatus(error.message);
    return;
  }
  if (JSON.stringify(before) === JSON.stringify(after)) {
    boundActions.setStatus("Gravestone unchanged");
    return;
  }
  applyCommand(boundState.history, boundState, {
    kind: "gravestone.set-record",
    index: before.index,
    before,
    after,
  });
  boundActions.setStatus(`Updated gravestone ${hex(before.index, 2)}`);
  syncGravestoneControls(boundState);
  boundActions.rerender();
}

function ensureControls() {
  if (document.querySelector("[data-gravestone-controls]")) {
    return;
  }
  const section = document.createElement("section");
  section.dataset.gravestoneControls = "true";
  section.append(
    heading(),
    label("Index", input("gravestoneIndexInput", true)),
    label("X", input("gravestoneXInput")),
    label("Y", input("gravestoneYInput")),
    label("Tilemap", input("gravestoneTilemapInput", true)),
    label("Special", input("gravestoneSpecialInput", true)),
    buttonRow(),
  );
  const inspector = document.querySelector("#inspectorRows").closest("section");
  inspector.parentNode.insertBefore(section, inspector);
}

function editableSelection(info) {
  return info?.kind === "interaction" && info.layer === "gravestones" ? info : null;
}

function gravestoneRecord(state, index) {
  const record = state?.sourceData?.gravestones?.records?.[index];
  return record ? normalizeRecord(clone(record)) : null;
}

function editedRecord(before) {
  return normalizeRecord({
    ...before,
    area: undefined,
    tilemapPos: undefined,
    tilemap_pos: undefined,
    x: document.querySelector("#gravestoneXInput").value,
    y: document.querySelector("#gravestoneYInput").value,
  });
}

function fillControls(record) {
  const disabled = !record;
  setField("gravestoneIndexInput", record ? hex(record.index, 2) : "", true);
  setField("gravestoneXInput", record ? hex(record.x, 3) : "", disabled);
  setField("gravestoneYInput", record ? hex(record.y, 3) : "", disabled);
  setField("gravestoneTilemapInput", record ? hex(record.tilemapPos, 4) : "", disabled);
  setField("gravestoneSpecialInput", record?.special || "", true);
  document.querySelector("#applyGravestoneButton").disabled = disabled;
}

function setField(id, value, disabled) {
  const field = document.querySelector(`#${id}`);
  field.value = value;
  field.disabled = disabled;
}

function heading() {
  const h2 = document.createElement("h2");
  h2.textContent = "Gravestone";
  return h2;
}

function label(text, child) {
  const labelElement = document.createElement("label");
  labelElement.append(text, child);
  return labelElement;
}

function input(id, disabled = false) {
  const field = document.createElement("input");
  field.id = id;
  field.disabled = disabled;
  return field;
}

function buttonRow() {
  const row = document.createElement("div");
  row.className = "row";
  const button = document.createElement("button");
  button.id = "applyGravestoneButton";
  button.type = "button";
  button.textContent = "Apply Gravestone";
  row.append(button);
  return row;
}

function hex(value, width) {
  return `0x${Number(value).toString(16).toUpperCase().padStart(width, "0")}`;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}
