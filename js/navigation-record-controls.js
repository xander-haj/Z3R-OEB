/**
 * Properties-panel controls for coupled travel and dungeon-exit metadata rows.
 */

import { applyCommand, parseNumber } from "./operations.js?v=20260621-render-restore20";
import {
  ensureExitDoorControls,
  fillExitDoorControls,
  readExitDoor,
  setExitDoorDisabled,
} from "./exit-door-controls.js?v=20260621-render-restore20";
import {
  normalizeSpecialExit,
  parseSpecialExitField,
  SPECIAL_EXIT_FIELDS,
  specialExitRangeText,
} from "./special-exit-shape.js?v=20260621-render-restore20";

const IDS = [
  "navRecordKindInput",
  "navRecordKeyInput",
  "navRecordXyInput",
  "navRecordScrollInput",
  "navRecordCameraInput",
  "navRecordLoadInput",
  "navRecordUnkInput",
  "navRecordExtraInput",
  "applyNavigationRecordButton",
];

let boundState = null;
let boundActions = null;

/**
 * Bind navigation record controls to shared Workbench state.
 *
 * Parameters:
 *   state: Shared Workbench state.
 *   actions: Rerender and status callbacks.
 * Returns:
 *   None.
 */
export function bindNavigationRecordControls(state, actions) {
  boundState = state;
  boundActions = actions;
  ensureExitDoorControls();
  ensureSpecialExitControls();
  fields().applyNavigationRecordButton.addEventListener("click", applyNavigationRecord);
  syncNavigationRecordControls(state, null);
}

/**
 * Refresh controls from the selected travel or exit marker.
 *
 * Parameters:
 *   state: Shared Workbench state.
 *   info: Current selection.
 * Returns:
 *   None.
 */
export function syncNavigationRecordControls(state, info = state?.selected) {
  const selection = editableSelection(info);
  const record = selection ? navigationRecord(state, selection) : null;
  state.navigationRecordSelection = record ? selection : null;
  fill(record, selection);
}

/**
 * Apply form values as one full-record navigation metadata edit.
 *
 * Parameters: none.
 * Returns:
 *   None.
 */
function applyNavigationRecord() {
  const selection = boundState?.navigationRecordSelection;
  const before = selection ? navigationRecord(boundState, selection) : null;
  if (!before) {
    boundActions.setStatus("Select a travel point or dungeon exit first");
    return;
  }
  const after = {
    ...before,
    xy: parsePair(fields().navRecordXyInput.value),
    scrollXy: parsePair(fields().navRecordScrollInput.value),
    cameraXy: parsePair(fields().navRecordCameraInput.value),
    loadXy: parsePair(fields().navRecordLoadInput.value),
    unk: parsePair(fields().navRecordUnkInput.value),
  };
  const door = readExitDoor(before);
  if (door !== undefined) {
    if (door) {
      after.door = door;
    } else {
      delete after.door;
    }
  }
  const specialExit = readSpecialExit(before);
  if (specialExit.error) {
    boundActions.setStatus(specialExit.error);
    return;
  }
  if (specialExit.value) {
    after.specialExit = specialExit.value;
  }
  if (before.whirlpoolSrcArea !== undefined) {
    after.whirlpoolSrcArea = clampNumber(fields().navRecordKeyInput.value, 0, 159);
    after.displayName = `Whirlpool from area ${hex(after.whirlpoolSrcArea, 2)}`;
  }
  after.pixelX = after.xy[0];
  after.pixelY = after.xy[1];
  if (JSON.stringify(before) === JSON.stringify(after)) {
    boundActions.setStatus("Navigation record unchanged");
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
  boundActions.setStatus(`Updated ${selection.category}`);
  syncNavigationRecordControls(boundState);
  boundActions.rerender();
}

/**
 * Return selected travel or exit markers only.
 */
function editableSelection(info) {
  return info?.kind === "interaction" && ["travel", "exits"].includes(info.navigationList) ? info : null;
}

/**
 * Return a cloned navigation row for a marker selection.
 */
function navigationRecord(state, selection) {
  const list = state?.sourceData?.areaHeaders?.[selection.area]?.navigation?.[selection.navigationList];
  const record = list?.[selection.navigationIndex];
  return record ? clone(record) : null;
}

/**
 * Populate controls and disable them when no coupled record is selected.
 */
function fill(record, selection) {
  const ui = fields();
  ui.navRecordKindInput.value = selection?.category || "";
  ui.navRecordKeyInput.value = record ? keyLabel(selection.navigationList, record) : "";
  ui.navRecordXyInput.value = record ? pairText(record.xy) : "";
  ui.navRecordScrollInput.value = record ? pairText(record.scrollXy) : "";
  ui.navRecordCameraInput.value = record ? pairText(record.cameraXy) : "";
  ui.navRecordLoadInput.value = record ? pairText(record.loadXy) : "";
  ui.navRecordUnkInput.value = record ? pairText(record.unk) : "";
  ui.navRecordExtraInput.value = record ? extraLabel(record) : "";
  fillExitDoorControls(record);
  fillSpecialExit(record);
  setDisabled(ui, !record, record);
}

/**
 * Describe slot keys, allowing whirlpool source areas to stay numeric-editable.
 */
function keyLabel(listName, record) {
  if (listName === "travel") {
    return record.birdTravelId !== undefined ? `bird slot ${record.birdTravelId}` : hex(record.whirlpoolSrcArea, 2);
  }
  return `exit ${record.index}, room ${hex(record.room, 4)}`;
}

/**
 * Describe optional payloads that stay attached to the record.
 */
function extraLabel(record) {
  const parts = [];
  if (record.door) {
    parts.push(`door ${record.door.join(",")}`);
  }
  if (record.specialExit) {
    parts.push("special exit payload");
  }
  return parts.join("; ") || "none";
}

/**
 * Enable only editable coupled-field controls.
 */
function setDisabled(ui, disabled, record) {
  for (const id of IDS) {
    ui[id].disabled = disabled ||
      id === "navRecordKindInput" || id === "navRecordExtraInput" ||
      (id === "navRecordKeyInput" && record?.whirlpoolSrcArea === undefined);
  }
  for (const input of specialExitInputs()) {
    input.disabled = disabled || input.closest("[data-special-exit-fields]").hidden;
  }
  setExitDoorDisabled(disabled);
}

/**
 * Create special-exit controls once, directly before the Apply button row.
 */
function ensureSpecialExitControls() {
  if (document.querySelector("[data-special-exit-fields]")) {
    return;
  }
  const group = document.createElement("div");
  group.dataset.specialExitFields = "true";
  group.hidden = true;
  for (const field of SPECIAL_EXIT_FIELDS) {
    const label = document.createElement("label");
    label.textContent = field.label;
    const input = document.createElement("input");
    input.dataset.specialExitKey = field.key;
    input.inputMode = "numeric";
    input.title = `${field.label}: ${specialExitRangeText(field)}`;
    input.value = "0";
    label.append(input);
    group.append(label);
  }
  const buttonRow = fields().applyNavigationRecordButton.closest(".row");
  buttonRow.parentNode.insertBefore(group, buttonRow);
}

/**
 * Fill special-exit controls when the selected exit owns a special payload.
 */
function fillSpecialExit(record) {
  const group = document.querySelector("[data-special-exit-fields]");
  const payload = normalizeSpecialExit(record?.specialExit);
  group.hidden = !payload;
  for (const input of specialExitInputs()) {
    input.value = payload ? String(payload[input.dataset.specialExitKey]) : "0";
  }
}

/**
 * Read edited special-exit fields, preserving exits without that payload.
 */
function readSpecialExit(record) {
  if (!record.specialExit) {
    return { value: null };
  }
  const result = {};
  for (const field of SPECIAL_EXIT_FIELDS) {
    const parsed = parseSpecialExitField(field, specialExitInput(field.key)?.value);
    if (parsed.error) {
      return parsed;
    }
    result[field.key] = parsed.value;
  }
  return { value: result };
}

/**
 * Return the generated special-exit input collection.
 */
function specialExitInputs() {
  return Array.from(document.querySelectorAll("[data-special-exit-key]"));
}

/**
 * Return the generated input for a single special-exit field key.
 */
function specialExitInput(key) {
  return document.querySelector(`[data-special-exit-key="${key}"]`);
}

/**
 * Parse "x,y" text into a two-number tuple.
 */
function parsePair(text) {
  const parts = String(text).split(",");
  return [safeNumber(parts[0]), safeNumber(parts[1])];
}

/**
 * Parse one numeric field and fall back to zero for incomplete input.
 */
function safeNumber(value) {
  const parsed = parseNumber(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Parse and clamp one numeric field to the valid overworld area range.
 */
function clampNumber(value, min, max) {
  return Math.max(min, Math.min(max, safeNumber(value)));
}

/**
 * Format a two-number tuple for compact editing.
 */
function pairText(value) {
  return `${value?.[0] ?? 0}, ${value?.[1] ?? 0}`;
}

/**
 * Resolve all form elements by id.
 */
function fields() {
  const result = {};
  for (const id of IDS) {
    result[id] = document.querySelector(`#${id}`);
  }
  return result;
}

/**
 * Format a value as uppercase hex.
 */
function hex(value, width) {
  return `0x${Number(value).toString(16).toUpperCase().padStart(width, "0")}`;
}

/**
 * Clone JSON-compatible navigation metadata.
 */
function clone(value) {
  return JSON.parse(JSON.stringify(value));
}
