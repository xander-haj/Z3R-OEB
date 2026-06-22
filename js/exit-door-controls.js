/**
 * Generated controls for the optional door animation attached to a dungeon exit.
 */

// Door labels map directly to the YAML strings compiled into normal/fancy exit door tables.
const DOOR_TYPES = [
  { value: "none", label: "None" },
  { value: "wooden", label: "Wooden" },
  { value: "bombable", label: "Bombable" },
  { value: "sanctuary", label: "Sanctuary" },
  { value: "palace", label: "Palace" },
];

/**
 * Create the exit-door controls once, directly before the Apply button row.
 *
 * Parameters: none.
 * Returns:
 *   None.
 */
export function ensureExitDoorControls() {
  if (document.querySelector("[data-exit-door-fields]")) {
    return;
  }
  const group = document.createElement("div");
  group.dataset.exitDoorFields = "true";
  group.hidden = true;
  group.append(buildTypeLabel(), buildNumberLabel("Door X", "x"), buildNumberLabel("Door Y", "y"));
  const buttonRow = document.querySelector("#applyNavigationRecordButton").closest(".row");
  buttonRow.parentNode.insertBefore(group, buttonRow);
  doorField("type").addEventListener("change", () => refreshDoorInputState(false));
}

/**
 * Fill the controls from an exit record or hide them for non-exit navigation rows.
 *
 * Parameters:
 *   record: Normalized navigation row from source-parser/navigation-mod-export.
 * Returns:
 *   None.
 */
export function fillExitDoorControls(record) {
  const group = document.querySelector("[data-exit-door-fields]");
  const door = normalizeDoor(record?.door);
  group.hidden = record?.type !== "exit";
  doorField("type").value = door.type;
  doorField("x").value = String(door.x);
  doorField("y").value = String(door.y);
  refreshDoorInputState(!record);
}

/**
 * Read the selected door payload, returning null when an exit is set to no door.
 *
 * Parameters:
 *   record: Current navigation record.
 * Returns:
 *   Door YAML tuple, null for no door, or undefined for non-exit records.
 */
export function readExitDoor(record) {
  if (record?.type !== "exit") {
    return undefined;
  }
  const type = doorField("type").value;
  if (type === "none" || !DOOR_TYPES.some((entry) => entry.value === type)) {
    return null;
  }
  return [type, clampNumber(doorField("x").value), clampNumber(doorField("y").value)];
}

/**
 * Disable the generated controls while still allowing the hidden state to win.
 *
 * Parameters:
 *   disabled: Whether the owning navigation record form is disabled.
 * Returns:
 *   None.
 */
export function setExitDoorDisabled(disabled) {
  refreshDoorInputState(disabled);
}

/**
 * Build the door-type select label used by the generated panel.
 *
 * Parameters: none.
 * Returns:
 *   Label element containing the select input.
 */
function buildTypeLabel() {
  const label = document.createElement("label");
  label.textContent = "Door Type";
  const select = document.createElement("select");
  select.dataset.exitDoorKey = "type";
  for (const type of DOOR_TYPES) {
    const option = document.createElement("option");
    option.value = type.value;
    option.textContent = type.label;
    select.append(option);
  }
  label.append(select);
  return label;
}

/**
 * Build one numeric door-coordinate control.
 *
 * Parameters:
 *   text: Visible label text.
 *   key: Door field key stored in the input dataset.
 * Returns:
 *   Label element containing the numeric input.
 */
function buildNumberLabel(text, key) {
  const label = document.createElement("label");
  label.textContent = text;
  const input = document.createElement("input");
  input.dataset.exitDoorKey = key;
  input.type = "number";
  input.min = "0";
  input.max = "63";
  input.step = "1";
  input.value = "0";
  label.append(input);
  return label;
}

/**
 * Normalize a YAML door tuple into control fields.
 *
 * Parameters:
 *   value: Door tuple from an exit row.
 * Returns:
 *   Object with type, x, and y fields.
 */
function normalizeDoor(value) {
  if (!Array.isArray(value) || !DOOR_TYPES.some((entry) => entry.value === value[0])) {
    return { type: "none", x: 0, y: 0 };
  }
  return { type: value[0], x: clampNumber(value[1]), y: clampNumber(value[2]) };
}

/**
 * Enable or disable the generated controls based on row state and door type.
 *
 * Parameters:
 *   disabled: Whether the whole generated group should be disabled.
 * Returns:
 *   None.
 */
function refreshDoorInputState(disabled) {
  const group = document.querySelector("[data-exit-door-fields]");
  const hidden = group.hidden || disabled;
  const noDoor = doorField("type").value === "none";
  doorField("type").disabled = hidden;
  doorField("x").disabled = hidden || noDoor;
  doorField("y").disabled = hidden || noDoor;
}

/**
 * Clamp numeric input to the 6-bit door coordinate range used by the ROM tables.
 *
 * Parameters:
 *   value: User-entered number.
 * Returns:
 *   Integer in the inclusive 0..63 range.
 */
function clampNumber(value) {
  const match = String(value ?? "").trim().match(/^([+-]?)(?:0x([0-9a-f]+)|(\d+))$/i);
  if (!match) {
    throw new Error("Door coordinate must be an integer");
  }
  const sign = match[1] === "-" ? -1 : 1;
  const parsed = sign * Number.parseInt(match[2] ?? match[3], match[2] ? 16 : 10);
  return Math.max(0, Math.min(63, parsed));
}

/**
 * Return one generated door control by dataset key.
 *
 * Parameters:
 *   key: Door field key.
 * Returns:
 *   Generated input or select element.
 */
function doorField(key) {
  return document.querySelector(`[data-exit-door-key="${key}"]`);
}
