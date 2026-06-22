/**
 * Properties-panel controls for direct overworld Header fields.
 */

import {
  editHeaderValue,
  editableHeaderValue,
} from "./header-mod-export.js?v=20260621-render-restore20";
import { applyCommand } from "./operations.js?v=20260621-render-restore20";
import { validateHeaderSizeEdit } from "./topology-model.js?v=20260621-render-restore20";

const SIZE_OPTIONS = ["small", "big", "wide", "tall"];
const MUSIC_TAGS = [
  { key: "beginning", label: "Beginning" },
  { key: "zelda", label: "Zelda rescued" },
  { key: "sword", label: "Master sword" },
  { key: "agahnim", label: "Agahnim defeated" },
];
const BASE_CONTROL_IDS = [
  "headerAreaInput",
  "headerSizeInput",
  "headerGfxInput",
  "headerPaletteInput",
  "headerSignTextInput",
  "applyHeaderButton",
];
const CONTROL_IDS = [
  ...BASE_CONTROL_IDS,
  ...MUSIC_TAGS.flatMap((tag) => [musicId(tag.key), ambientId(tag.key)]),
];
const FALLBACK_MUSIC_NAMES = [
  "None", "Title", "World_map", "Beginning", "Rabbit", "Forest", "Intro", "Town",
  "Warp", "Dark_world", "Master_swd", "File_select", "Soldier", "Mountain", "Shop",
  "Fanfare",
];
const FALLBACK_AMBIENT_NAMES = [
  "None", "Heavy rain", "Light rain", "Stop", "Earthquake", "Wind", "Flute", "Chime 1",
  "Chime 2",
];

let boundState = null;
let boundActions = null;

/**
 * Bind map-header controls to shared Workbench state.
 *
 * Parameters:
 *   state: Shared Workbench state.
 *   actions: Rerender and status callbacks.
 * Returns:
 *   None.
 */
export function bindHeaderControls(state, actions) {
  boundState = state;
  boundActions = actions;
  ensureMusicControls();
  controls().applyHeaderButton.addEventListener("click", applyHeaderEdit);
  syncHeaderControls(state, null);
}

/**
 * Refresh header controls from the current selection.
 *
 * Parameters:
 *   state: Shared Workbench state.
 *   info: Tile, sprite, or interaction selection.
 * Returns:
 *   None.
 */
export function syncHeaderControls(state, info = state?.selected) {
  const area = selectedArea(info);
  state.headerEditArea = Number.isFinite(area) ? area : null;
  const header = Number.isFinite(area) ? editableHeaderValue(state.sourceData, area) : null;
  fillControls(area, header);
}

/**
 * Apply the current control values as one undoable Header edit.
 *
 * Parameters: none.
 * Returns:
 *   None.
 */
function applyHeaderEdit() {
  const state = boundState;
  const area = state?.headerEditArea;
  const before = Number.isFinite(area) ? editableHeaderValue(state.sourceData, area) : null;
  if (!before) {
    boundActions.setStatus("Rerun overworld dump before editing map headers");
    return;
  }
  const fields = controls();
  const backed = compilerBackedHeaderFields(area);
  const edits = readHeaderEdits(fields, before, backed, area);
  if (edits.error) {
    boundActions.setStatus(edits.error);
    return;
  }
  const after = editHeaderValue(before, edits.value);
  if (JSON.stringify(before) === JSON.stringify(after)) {
    boundActions.setStatus("Header fields unchanged");
    return;
  }
  const topologyError = validateHeaderSizeEdit(state.sourceData, area, before.size, after.size);
  if (topologyError) {
    boundActions.setStatus(topologyError);
    return;
  }
  applyCommand(state.history, state, {
    kind: "metadata.set-header",
    area,
    before,
    after,
  });
  boundActions.setStatus(`Updated header ${hex(area, 2)}`);
  syncHeaderControls(state);
  boundActions.rerender();
}

/**
 * Create the generated music/ambient controls without growing index.html.
 */
function ensureMusicControls() {
  if (document.querySelector("[data-header-music-controls]")) {
    return;
  }
  const section = document.createElement("div");
  section.dataset.headerMusicControls = "true";
  for (const tag of MUSIC_TAGS) {
    section.append(musicRow(tag));
  }
  const applyRow = document.querySelector("#applyHeaderButton").closest(".row");
  applyRow.parentNode.insertBefore(section, applyRow);
}

/**
 * Fill controls and disable editing when a full Header block is unavailable.
 */
function fillControls(area, header) {
  const fields = controls();
  fillSizeOptions(fields.headerSizeInput, header?.size);
  fillMusicOptions(fields, header);
  fields.headerAreaInput.value = Number.isFinite(area) ? hex(area, 2) : "";
  fields.headerSizeInput.value = header?.size || "";
  fields.headerGfxInput.value = header ? hex(header.gfx, 2) : "";
  fields.headerPaletteInput.value = header ? hex(header.palette, 2) : "";
  fields.headerSignTextInput.value = header ? hex(header.signText, 4) : "";
  setDisabled(fields, !header, area);
}

/**
 * Fill every music and ambient select with compiler-valid names.
 */
function fillMusicOptions(fields, header) {
  const music = optionNames(boundState, "musicNames", FALLBACK_MUSIC_NAMES, 15);
  const ambient = optionNames(boundState, "ambientSoundNames", FALLBACK_AMBIENT_NAMES, 15);
  for (const tag of MUSIC_TAGS) {
    fillSelect(fields[musicId(tag.key)], music, header?.music?.[tag.key]);
    fillSelect(fields[ambientId(tag.key)], ambient, header?.ambient?.[tag.key]);
  }
}

/**
 * Populate the area-size selector with compiler-backed YAML values.
 */
function fillSizeOptions(select, current) {
  select.innerHTML = "";
  for (const value of SIZE_OPTIONS) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.append(option);
  }
  select.value = SIZE_OPTIONS.includes(current) ? current : "big";
}

/**
 * Read only the Header music/ambient tags that are valid for the selected area.
 */
function readTagValues(fields, current, kind, area) {
  const result = clone(current || {});
  for (const tag of MUSIC_TAGS) {
    if (tagEditable(area, tag.key)) {
      result[tag.key] = fields[controlId(kind, tag.key)].value;
    }
  }
  return result;
}

/**
 * Read numeric controls only when the local compiler backs the selected field.
 */
function readHeaderEdits(fields, before, backed, area) {
  const gfx = readBackedNumber(fields.headerGfxInput, before.gfx, backed.gfx, "Header.gfx", 0, 0xff);
  const palette = readBackedNumber(
    fields.headerPaletteInput, before.palette, backed.palette, "Header.palette", 0, 0xff);
  const signText = readBackedNumber(
    fields.headerSignTextInput, before.signText, backed.signText, "Header.sign_text", 0, 0xffff);
  const error = gfx.error || palette.error || signText.error;
  if (error) {
    return { error };
  }
  return {
    value: {
      ambient: readTagValues(fields, before.ambient, "ambient", area),
      gfx: gfx.value,
      music: readTagValues(fields, before.music, "music", area),
      palette: palette.value,
      size: fields.headerSizeInput.value,
      signText: signText.value,
    },
  };
}

function readBackedNumber(control, fallback, backed, label, min, max) {
  if (!backed) {
    return { value: fallback };
  }
  const parsed = strictInteger(control.value);
  if (!Number.isInteger(parsed)) {
    return { error: `${label} must be an integer` };
  }
  if (parsed < min || parsed > max) {
    return { error: `${label} must be ${min}..${max}` };
  }
  return { value: parsed };
}

function strictInteger(value) {
  if (Number.isInteger(value)) {
    return value;
  }
  const match = String(value ?? "").trim().match(/^(-?)(?:0x([0-9a-f]+)|([0-9]+))$/i);
  if (!match) {
    return null;
  }
  return (match[1] === "-" ? -1 : 1) * Number.parseInt(match[2] ?? match[3], match[2] ? 16 : 10);
}

/**
 * Enable or disable editable controls together.
 */
function setDisabled(fields, disabled, area) {
  for (const id of BASE_CONTROL_IDS) {
    fields[id].disabled = disabled || id === "headerAreaInput";
  }
  const backed = compilerBackedHeaderFields(area);
  fields.headerGfxInput.disabled = fields.headerGfxInput.disabled || !backed.gfx;
  fields.headerPaletteInput.disabled = fields.headerPaletteInput.disabled || !backed.palette;
  fields.headerSignTextInput.disabled = fields.headerSignTextInput.disabled || !backed.signText;
  fields.headerSizeInput.title = "Area size writes generated topology: small, big, wide, or tall.";
  fields.headerGfxInput.title = backed.gfx ? "" : "Header.gfx only compiles for areas 00-7F.";
  fields.headerPaletteInput.title = backed.palette ? "" : "Header.palette only compiles for areas 00-7F.";
  fields.headerSignTextInput.title = backed.signText ? "" : "Header.sign_text only compiles for areas 00-7F.";
  for (const tag of MUSIC_TAGS) {
    const tagDisabled = disabled || !tagEditable(area, tag.key);
    fields[musicId(tag.key)].disabled = tagDisabled;
    fields[ambientId(tag.key)].disabled = tagDisabled;
  }
}

/**
 * Return whether a progression music slot exists for this area.
 */
function tagEditable(area, tag) {
  return Number.isFinite(area) && (area < 64 || tag === "agahnim");
}

/**
 * Return which direct Header fields have local compiler/runtime backing.
 */
function compilerBackedHeaderFields(area) {
  return {
    gfx: Number.isFinite(area) && area < 128,
    palette: Number.isFinite(area) && area < 128,
    signText: Number.isFinite(area) && area < 128,
  };
}

/**
 * Return the selected area head from any editor selection shape.
 */
function selectedArea(info) {
  const area = info?.area ?? info?.contextScreen ?? info?.screen;
  return Number.isFinite(area) ? area : null;
}

/**
 * Build one generated music/ambient row.
 */
function musicRow(tag) {
  const row = document.createElement("div");
  row.className = "row";
  row.append(
    label(tag.label, select(musicId(tag.key))),
    label("Ambient", select(ambientId(tag.key))),
  );
  return row;
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
 * Build one select control.
 */
function select(id) {
  const node = document.createElement("select");
  node.id = id;
  return node;
}

/**
 * Populate a select with valid names plus the current value if the dump is unusual.
 */
function fillSelect(select, names, current) {
  const values = current && !names.includes(current) ? [...names, current] : names;
  select.innerHTML = "";
  for (const value of values) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.append(option);
  }
  select.value = current || values[0] || "";
}

/**
 * Return ordered compiler names from dumped source tables, with fallback for stale dumps.
 */
function optionNames(state, key, fallback, maxCode) {
  const table = state?.sourceData?.[key] || {};
  const names = Object.entries(table)
    .map(([code, name]) => ({ code: Number(code), name }))
    .filter((row) => Number.isInteger(row.code) && row.code >= 0 && row.code <= maxCode)
    .sort((a, b) => a.code - b.code)
    .map((row) => row.name);
  return names.length ? names : fallback;
}

/**
 * Lazily resolve control elements by id.
 */
function controls() {
  const result = {};
  for (const id of CONTROL_IDS) {
    result[id] = document.querySelector(`#${id}`);
  }
  return result;
}

/**
 * Return a select id for one music or ambient Header key.
 */
function controlId(kind, tag) {
  return kind === "music" ? musicId(tag) : ambientId(tag);
}

function musicId(tag) {
  return `headerMusic${capitalized(tag)}Input`;
}

function ambientId(tag) {
  return `headerAmbient${capitalized(tag)}Input`;
}

function capitalized(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * Format a value as uppercase hex for compact map-property controls.
 */
function hex(value, width) {
  return `0x${Number(value).toString(16).toUpperCase().padStart(width, "0")}`;
}

/**
 * Clone JSON-compatible Header fields.
 */
function clone(value) {
  return JSON.parse(JSON.stringify(value));
}
