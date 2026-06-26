/**
 * Properties-panel UI for adding, deleting, moving, and reallocating navigation rows.
 */

import { applyCommand } from "./operations.js?v=20260621-render-restore20";
import {
  LISTS,
  allocationError,
  allocationRequest,
  areaMax,
  clampNumber,
  clampRecordToArea,
  defaultGridRecord,
  deletedSlotLocation,
  hex,
  navigationList,
  navigationRecord,
  navigationSelection,
  recordForAllocation,
  roomValue,
  selectedCompatibleRecord,
  slotValue,
  targetArea,
  typeForSelection,
} from "./navigation-allocation-model.js?v=20260621-render-restore20";

const IDS = [
  "navAllocSelectedInput",
  "navAllocTypeInput",
  "navAllocAreaInput",
  "navAllocSlotInput",
  "navAllocRoomInput",
];
const BUTTON_IDS = ["navAllocAddButton", "navAllocApplyButton", "navAllocMoveButton", "navAllocDeleteButton"];
const DELETE_BLOCKED_MESSAGE = "Travel rows are fixed live destinations; move or edit them instead.";

let boundState = null;
let boundActions = null;

export function bindNavigationAllocationControls(state, actions) {
  boundState = state;
  boundActions = actions;
  ensureControls();
  document.querySelector("#navAllocAddButton").addEventListener("click", addNavigationRecord);
  document.querySelector("#navAllocApplyButton").addEventListener("click", applyNavigationAllocation);
  document.querySelector("#navAllocMoveButton").addEventListener("click", moveNavigationRecord);
  document.querySelector("#navAllocDeleteButton").addEventListener("click", deleteNavigationRecord);
  syncNavigationAllocationControls(state, null);
}

export function syncNavigationAllocationControls(state, info = state?.selected) {
  const selection = navigationSelection(info);
  const record = selection ? navigationRecord(state, selection) : null;
  const target = targetArea(state, info);
  state.navigationAllocationSelection = record ? selection : null;
  fillControls(record, selection, target);
}

function addNavigationRecord() {
  const request = allocationRequest(fields(), null, boundState);
  const selection = boundState?.navigationAllocationSelection;
  const source = selectedCompatibleRecord(boundState, selection, request.type);
  if (!source && !["entrance", "hole"].includes(request.type)) {
    boundActions.setStatus("Select an existing travel or exit row to copy first");
    return;
  }
  const after = safeRecordForAllocation(source || defaultGridRecord(boundState, request), request);
  if (!after || allocationFailed(request, after, null)) {
    return;
  }
  const deleted = deletedSlotLocation(boundState, request.type, request.slot);
  if (deleted) {
    reuseDeletedSlot(request, deleted, after);
    return;
  }
  const list = navigationList(boundState, request.area, LISTS[request.type], true);
  applyCommand(boundState.history, boundState, {
    kind: "metadata.set-navigation-record",
    action: "insert",
    area: request.area,
    list: LISTS[request.type],
    index: list.length,
    after,
  });
  boundActions.setStatus(`Added ${after.displayName}`);
  syncNavigationAllocationControls(boundState, null);
  boundActions.rerender();
}

function reuseDeletedSlot(request, deleted, after) {
  if (deleted.area === request.area) {
    applyCommand(boundState.history, boundState, {
      kind: "metadata.set-navigation-record",
      area: request.area,
      list: deleted.listName,
      index: deleted.index,
      before: deleted.value,
      after,
    });
  } else {
    const targetList = navigationList(boundState, request.area, deleted.listName, true);
    applyCommand(boundState.history, boundState, {
      kind: "metadata.set-navigation-record",
      action: "move-area",
      list: deleted.listName,
      from: { area: deleted.area, index: deleted.index, value: deleted.value },
      to: { area: request.area, index: targetList.length, value: after },
    });
  }
  boundActions.setStatus(`Reused deleted slot for ${after.displayName}`);
  syncNavigationAllocationControls(boundState, null);
  boundActions.rerender();
}

function applyNavigationAllocation() {
  const selection = boundState?.navigationAllocationSelection;
  const before = selection ? navigationRecord(boundState, selection) : null;
  if (!before) {
    boundActions.setStatus("Select a navigation record first");
    return;
  }
  const request = allocationRequest(fields(), selection.area, boundState);
  if (LISTS[request.type] !== selection.navigationList) {
    boundActions.setStatus("Allocation type must match the selected navigation list");
    return;
  }
  const after = safeRecordForAllocation(before, request);
  if (!after || allocationFailed(request, after, selection)) {
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
  boundActions.setStatus(`Reassigned ${after.displayName}`);
  syncNavigationAllocationControls(boundState);
  boundActions.rerender();
}

function moveNavigationRecord() {
  const selection = boundState?.navigationAllocationSelection;
  const before = selection ? navigationRecord(boundState, selection) : null;
  const area = clampNumber(fields().navAllocAreaInput.value, 0, areaMax(boundState));
  if (!before) {
    boundActions.setStatus("Select a navigation record first");
    return;
  }
  if (area === selection.area) {
    boundActions.setStatus("Navigation record is already in that area");
    return;
  }
  const after = clampRecordToArea(boundState, before, area);
  const targetList = navigationList(boundState, area, selection.navigationList, true);
  applyCommand(boundState.history, boundState, {
    kind: "metadata.set-navigation-record",
    action: "move-area",
    list: selection.navigationList,
    from: { area: selection.area, index: selection.navigationIndex, value: before },
    to: { area, index: targetList.length, value: after },
  });
  boundState.selected = null;
  boundState.navigationAllocationSelection = null;
  boundActions.setStatus(`Moved ${after.displayName} to area ${hex(area, 2)}`);
  syncNavigationAllocationControls(boundState, null);
  boundActions.rerender();
}

function deleteNavigationRecord() {
  const selection = boundState?.navigationAllocationSelection;
  const before = selection ? navigationRecord(boundState, selection) : null;
  if (!before) {
    boundActions.setStatus("Select a navigation record first");
    return;
  }
  if (selection.navigationList === "travel") {
    boundActions.setStatus(DELETE_BLOCKED_MESSAGE);
    return;
  }
  const after = deletedRecord(selection.navigationList, before);
  applyCommand(boundState.history, boundState, {
    kind: "metadata.set-navigation-record",
    action: "delete",
    area: selection.area,
    list: selection.navigationList,
    index: selection.navigationIndex,
    before,
    after,
  });
  boundState.selected = null;
  boundState.navigationAllocationSelection = null;
  boundActions.setStatus(`Deleted ${before.displayName}`);
  syncNavigationAllocationControls(boundState, null);
  boundActions.rerender();
}

function deletedRecord(listName, before) {
  const label = listName === "entrances" ? "Entrance" : listName === "holes" ? "Fall hole" : "Exit";
  const table = listName === "entrances" ? "kOverworld_Entrance_*" :
    listName === "holes" ? "kFallHole_*" : "kExitData_*";
  return {
    index: before.index,
    deleted: true,
    type: before.type,
    displayName: `${label} ${before.index} DELETED`,
    source: "metadata deleted slot",
    sourceTable: table,
  };
}

function ensureControls() {
  if (document.querySelector("[data-navigation-allocation-controls]")) {
    return;
  }
  const section = document.createElement("section");
  section.dataset.navigationAllocationControls = "true";
  section.append(
    heading(),
    label("Selected", input("navAllocSelectedInput", true)),
    label("Type", typeSelect()),
    label("Target Area", numberInput("navAllocAreaInput")),
    label("Slot / Source", numberInput("navAllocSlotInput")),
    label("Special Room", numberInput("navAllocRoomInput")),
    buttonRow(),
  );
  const inspector = document.querySelector("#inspectorRows").closest("section");
  inspector.parentNode.insertBefore(section, inspector);
}

/**
 * Fill controls from the selected row or selected target area.
 */
function fillControls(record, selection, target) {
  const ui = fields();
  const type = record ? typeForSelection(selection, record) : ui.navAllocTypeInput.value || "entrance";
  ui.navAllocSelectedInput.value = record ? `${selection.category} ${record.displayName}` : "none";
  ui.navAllocTypeInput.value = type;
  ui.navAllocAreaInput.value = String(record ? selection.area : target ?? 0);
  ui.navAllocSlotInput.value = String(slotValue(boundState, type, record));
  ui.navAllocRoomInput.value = hex(roomValue(boundState, type, record), 3);
  setDisabled(!record, target === null);
}

/**
 * Convert allocation construction errors into status messages.
 */
function safeRecordForAllocation(record, request) {
  try {
    return recordForAllocation(record, request);
  } catch (error) {
    boundActions.setStatus(error.message);
    return null;
  }
}

/**
 * Validate a requested allocation and report the first problem.
 */
function allocationFailed(request, record, selection) {
  const error = allocationError(boundState, request, record, selection);
  if (error) {
    boundActions.setStatus(error);
    return true;
  }
  return false;
}

/**
 * Enable or disable controls based on selection/target availability.
 */
function setDisabled(noSelection, noTarget) {
  const ui = fields();
  for (const id of IDS) {
    ui[id].disabled = id === "navAllocSelectedInput";
  }
  for (const id of BUTTON_IDS) {
    document.querySelector(`#${id}`).disabled = false;
  }
  document.querySelector("#navAllocAddButton").disabled = noTarget;
  document.querySelector("#navAllocApplyButton").disabled = noSelection;
  document.querySelector("#navAllocMoveButton").disabled = noSelection;
  document.querySelector("#navAllocDeleteButton").disabled = noSelection;
  document.querySelector("#navAllocDeleteButton").title = DELETE_BLOCKED_MESSAGE;
}

/**
 * Build section heading.
 */
function heading() {
  const node = document.createElement("h2");
  node.textContent = "Navigation Allocation";
  return node;
}

/**
 * Build one label/control pair.
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
 * Build a numeric text input that accepts decimal or hex.
 */
function numberInput(id) {
  const node = input(id);
  node.inputMode = "numeric";
  return node;
}

/**
 * Build the allocation type selector.
 */
function typeSelect() {
  const select = document.createElement("select");
  select.id = "navAllocTypeInput";
  for (const [value, labelText] of typeOptions()) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = labelText;
    select.append(option);
  }
  return select;
}

/**
 * Return the supported allocation type labels.
 */
function typeOptions() {
  return [
    ["travel", "Travel"],
    ["entrance", "Entrance"],
    ["hole", "Fall Hole"],
    ["exit", "Exit"],
    ["special", "Special Exit"],
  ];
}

/**
 * Build allocation action buttons.
 */
function buttonRow() {
  const row = document.createElement("div");
  row.className = "row";
  row.append(
    button("navAllocAddButton", "Add Copy"),
    button("navAllocApplyButton", "Apply Slot"),
    button("navAllocMoveButton", "Move Area"),
    button("navAllocDeleteButton", "Delete"),
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
 * Resolve generated controls by id.
 */
function fields() {
  const result = {};
  for (const id of IDS) {
    result[id] = document.querySelector(`#${id}`);
  }
  return result;
}
