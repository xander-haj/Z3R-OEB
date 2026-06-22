/**
 * Properties-panel controls for special-overworld kSpExit visual tables.
 */

import {
  specialBgUsesExitVisuals,
  specialExitSlot,
} from "../viewer/js/special-scene-context.js?v=20260621-render-restore20";
import { applyCommand } from "./operations.js?v=20260621-render-restore20";
import { parseSpecialExitField, SPECIAL_EXIT_FIELDS } from "./special-exit-shape.js?v=20260621-render-restore20";

const IDS = [
  "specialVisualSlotInput",
  "specialVisualSprGfxInput",
  "specialVisualAuxGfxInput",
  "specialVisualPalBgInput",
  "specialVisualPalSprInput",
  "applySpecialVisualButton",
];
const TRIFORCE_ROOM = 0x189;

let boundState = null;
let boundActions = null;

export function bindSpecialVisualControls(state, actions) {
  boundState = state;
  boundActions = actions;
  ensureControls();
  fields().applySpecialVisualButton.addEventListener("click", applySpecialVisual);
  syncSpecialVisualControls(state, null);
}

export function syncSpecialVisualControls(state, info = state?.selected) {
  const selection = selectionFor(state, info);
  state.specialVisualSelection = selection;
  fillControls(selection);
}

function applySpecialVisual() {
  const selection = boundState?.specialVisualSelection;
  if (!selection?.owner) {
    boundActions.setStatus("Select a compiler-backed special area first");
    return;
  }
  const before = selection.record;
  const result = readRecord(selection);
  if (result.error) {
    boundActions.setStatus(result.error);
    return;
  }
  const after = result.value;
  if (JSON.stringify(before) === JSON.stringify(after)) {
    boundActions.setStatus("Special visuals unchanged");
    return;
  }
  applyCommand(boundState.history, boundState, {
    kind: "metadata.set-special-visual",
    slot: selection.slot,
    owner: selection.owner,
    before,
    after,
  });
  boundActions.setStatus(`Updated special visual slot ${selection.slot}`);
  syncSpecialVisualControls(boundState);
  boundActions.rerender();
}

function selectionFor(state, info) {
  const area = info?.area ?? info?.contextScreen ?? info?.screen;
  if (!Number.isFinite(area) || area < 0x80 || area >= 0xa0) {
    return null;
  }
  const slot = Number.isFinite(info?.specialSlot) ? info.specialSlot : specialExitSlot(state?.sourceData, area);
  if (!Number.isFinite(slot)) {
    return null;
  }
  return {
    area,
    bgBacked: selectionBgBacked(state?.sourceData, area, info),
    owner: specialExitOwner(state?.sourceData, slot),
    record: specialVisualRecord(state?.sourceData, slot),
    slot,
  };
}

function selectionBgBacked(sourceData, area, info) {
  const room = info?.specialRoom;
  if (Number.isFinite(info?.specialSlot) && Number.isFinite(room)) {
    return room !== TRIFORCE_ROOM;
  }
  return specialBgUsesExitVisuals(sourceData, area);
}

function specialVisualRecord(sourceData, slot) {
  return {
    auxGfx: byteValue(sourceData?.spExitAuxGfx?.[slot]),
    palBg: byteValue(sourceData?.spExitPalBg?.[slot]),
    palSpr: byteValue(sourceData?.spExitPalSpr?.[slot]),
    sprGfx: byteValue(sourceData?.spExitSprGfx?.[slot]),
  };
}

function specialExitOwner(sourceData, slot) {
  const room = 0x180 + slot;
  for (const header of sourceData?.areaHeaders || []) {
    for (const [index, exit] of (header?.navigation?.exits || []).entries()) {
      if (exit.room === room && exit.specialExit) {
        return { area: header.area, index };
      }
    }
  }
  return null;
}

function readRecord(selection) {
  const ui = fields();
  const before = selection?.record || {};
  const bgBacked = Boolean(selection?.bgBacked);
  const sprGfx = readByteField("sprGfx", ui.specialVisualSprGfxInput.value);
  const palSpr = readByteField("palSpr", ui.specialVisualPalSprInput.value);
  const auxGfx = bgBacked ? readByteField("auxGfx", ui.specialVisualAuxGfxInput.value) : null;
  const palBg = bgBacked ? readByteField("palBg", ui.specialVisualPalBgInput.value) : null;
  const error = sprGfx.error || palSpr.error || auxGfx?.error || palBg?.error;
  if (error) {
    return { error };
  }
  return {
    value: {
      auxGfx: bgBacked ? auxGfx.value : before.auxGfx,
      palBg: bgBacked ? palBg.value : before.palBg,
      palSpr: palSpr.value,
      sprGfx: sprGfx.value,
    },
  };
}

function fillControls(selection) {
  const ui = fields();
  const record = selection?.record;
  ui.specialVisualSlotInput.value = selection ? slotLabel(selection) : "";
  ui.specialVisualSprGfxInput.value = record ? hex(record.sprGfx, 2) : "";
  ui.specialVisualAuxGfxInput.value = record ? hex(record.auxGfx, 2) : "";
  ui.specialVisualPalBgInput.value = record ? hex(record.palBg, 2) : "";
  ui.specialVisualPalSprInput.value = record ? hex(record.palSpr, 2) : "";
  setDisabled(!selection?.owner, selection);
}

function slotLabel(selection) {
  const owner = selection.owner ? `area ${hex(selection.owner.area, 2)} exit ${selection.owner.index}` : "unbacked";
  return `${hex(selection.area, 2)} -> slot ${selection.slot} (${owner})`;
}

function setDisabled(disabled, selection) {
  const ui = fields();
  for (const id of IDS) {
    ui[id].disabled = disabled || id === "specialVisualSlotInput";
  }
  const bgDisabled = disabled || !selection?.bgBacked;
  ui.specialVisualAuxGfxInput.disabled = bgDisabled;
  ui.specialVisualPalBgInput.disabled = bgDisabled;
  ui.specialVisualAuxGfxInput.title = bgDisabled ? "BG context comes from a special scene profile." : "";
  ui.specialVisualPalBgInput.title = bgDisabled ? "BG context comes from a special scene profile." : "";
}

function ensureControls() {
  if (document.querySelector("[data-special-visual-controls]")) {
    return;
  }
  const section = document.createElement("section");
  section.dataset.specialVisualControls = "true";
  section.append(
    heading(),
    label("Slot", input("specialVisualSlotInput", true)),
    label("Sprite GFX", input("specialVisualSprGfxInput")),
    label("Aux GFX", input("specialVisualAuxGfxInput")),
    label("BG Pal", input("specialVisualPalBgInput")),
    label("Sprite Pal", input("specialVisualPalSprInput")),
    buttonRow(),
  );
  const inspector = document.querySelector("#inspectorRows").closest("section");
  inspector.parentNode.insertBefore(section, inspector);
}

function heading() {
  const title = document.createElement("h2");
  title.textContent = "Special Visuals";
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

function buttonRow() {
  const row = document.createElement("div");
  row.className = "row";
  row.append(button("applySpecialVisualButton", "Apply Special"));
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

function byteValue(value) {
  const parsed = integerOrNull(value);
  return Math.max(0, Math.min(0xff, Number.isInteger(parsed) ? parsed : 0));
}

function integerOrNull(value) {
  if (Number.isInteger(value)) {
    return value;
  }
  const match = String(value ?? "").trim().match(/^(-?)(?:0x([0-9a-f]+)|([0-9]+))$/i);
  if (!match) {
    return null;
  }
  return (match[1] === "-" ? -1 : 1) * Number.parseInt(match[2] ?? match[3], match[2] ? 16 : 10);
}

function readByteField(key, value) {
  return parseSpecialExitField(SPECIAL_EXIT_FIELDS.find((field) => field.key === key), value);
}

function hex(value, width) {
  return `0x${Number(value).toString(16).toUpperCase().padStart(width, "0")}`;
}
