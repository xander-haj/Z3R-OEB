/**
 * Properties-panel controls for overworld sprite placement rows.
 */

import { applyCommand, parseNumber } from "./operations.js?v=20260621-render-restore20";
import { spritePlacementDisplayName, spritePlacementRole } from "./sprite-labels.js?v=20260621-render-restore20";
import { getEditorSpawnSpriteRenderMode } from "./enemy-sprite-renderer.js?v=20260621-secret-item-vram";

const IDS = [
  "spritePlacementRecordInput",
  "spritePlacementStageInput",
  "spritePlacementTypeInput",
  "spritePlacementNameInput",
  "spritePlacementXInput",
  "spritePlacementYInput",
];

let boundState = null;
let boundActions = null;

/**
 * Bind the sprite placement controls to shared Workbench state.
 */
export function bindSpritePlacementControls(state, actions) {
  boundState = state;
  boundActions = actions;
  ensureControls();
  fields().spritePlacementNameInput.addEventListener("change", syncTypeFromName);
  document.querySelector("#applySpritePlacementButton").addEventListener("click", applySpritePlacementEdit);
  document.querySelector("#deleteSpritePlacementButton").addEventListener("click", deleteSpritePlacement);
  syncSpritePlacementControls(state, null);
}

/**
 * Refresh controls from the current selected overworld sprite placement.
 */
export function syncSpritePlacementControls(state, info = state?.selected) {
  const selection = editableSelection(info);
  state.spritePlacementSelection = selection;
  fillControls(selection);
}

/**
 * Replace the selected sprite placement row or linked rows.
 */
function applySpritePlacementEdit() {
  const selection = boundState?.spritePlacementSelection;
  const placements = placementRows(boundState, selection);
  if (!placements.length) {
    boundActions.setStatus("Select one overworld sprite placement first");
    return;
  }
  const after = editedSprite(placements[0].before, selection.area);
  const commandPlacements = placements.map((placement) => ({
    ...placement,
    after: { ...after, ...(placement.before.custom ? { custom: clone(placement.before.custom) } : {}) },
  }));
  if (commandPlacements.every((row) => sameSprite(row.before, row.after))) {
    boundActions.setStatus("Sprite placement unchanged");
    return;
  }
  applyCommand(boundState.history, boundState, {
    kind: "metadata.set-sprite-placement",
    action: "replace",
    placements: commandPlacements,
  });
  updateSelectedSprite(selection, commandPlacements[0].after);
  boundActions.setStatus(`Updated sprite ${selection.id}`);
  syncSpritePlacementControls(boundState);
  boundActions.updateInspector?.(boundState.selected);
  boundActions.rerender();
}

/**
 * Delete the selected sprite placement row or linked rows.
 */
function deleteSpritePlacement() {
  const selection = boundState?.spritePlacementSelection;
  const placements = placementRows(boundState, selection);
  if (!placements.length) {
    boundActions.setStatus("Select one overworld sprite placement first");
    return;
  }
  applyCommand(boundState.history, boundState, {
    kind: "metadata.set-sprite-placement",
    action: "delete",
    placements,
  });
  boundState.selected = null;
  boundState.spritePlacementSelection = null;
  boundActions.setStatus(`Deleted sprite ${selection.id}`);
  syncSpritePlacementControls(boundState, null);
  boundActions.updateInspector?.(null);
  boundActions.rerender();
}

/**
 * Create the control section without growing index.html.
 */
function ensureControls() {
  if (document.querySelector("[data-sprite-placement-controls]")) {
    return;
  }
  const section = document.createElement("section");
  section.dataset.spritePlacementControls = "true";
  section.append(
    heading(),
    label("Record", input("spritePlacementRecordInput", true)),
    label("Stages", input("spritePlacementStageInput", true)),
    label("Type", input("spritePlacementTypeInput", true)),
    label("Name", select("spritePlacementNameInput")),
    label("X", numberInput("spritePlacementXInput")),
    label("Y", numberInput("spritePlacementYInput")),
    buttonRow(),
  );
  const inspector = document.querySelector("#inspectorRows").closest("section");
  inspector.parentNode.insertBefore(section, inspector);
}

/**
 * Return editable selection metadata only for sprite placements with source rows.
 */
function editableSelection(info) {
  if ((info?.kind !== "sprite" && info?.kind !== "enemy") || !info.stagePlacements?.length) {
    return null;
  }
  return {
    area: info.area,
    id: info.id,
    info,
    placements: info.stagePlacements.map((row) => ({ ...row })),
  };
}

/**
 * Return exact source rows for one selected placement.
 */
function placementRows(state, selection) {
  if (!selection) {
    return [];
  }
  const seen = new Set();
  return selection.placements.flatMap((placement) => {
    const row = { ...placement, stage: compilerStage(selection.area, placement.stage) };
    const key = `${row.stage}:${row.index}`;
    if (seen.has(key)) {
      return [];
    }
    seen.add(key);
    const sprite = spriteRow(state, selection.area, row);
    return sprite ? [{ ...row, area: selection.area, before: clone(sprite) }] : [];
  });
}

function compilerStage(area, stage) {
  return area >= 64 ? "first" : stage;
}

function spriteRow(state, area, placement) {
  return state?.sourceData?.areaHeaders?.[area]?.spriteSets?.[placement.stage]?.sprites?.[placement.index] || null;
}

/**
 * Build one edited sprite row while preserving compiler YAML name/type consistency.
 */
function editedSprite(before, area) {
  const ui = fields();
  const name = ui.spritePlacementNameInput.value || before.name;
  const type = typeFromName(name, before.type);
  const limits = coordLimits(boundState, area);
  return {
    ...before,
    name,
    type,
    x: clamp(parseNumber(ui.spritePlacementXInput.value), 0, limits.x),
    y: clamp(parseNumber(ui.spritePlacementYInput.value), 0, limits.y),
  };
}

/**
 * Refresh the selected record so inspector/draw stay coherent before rerender.
 */
function updateSelectedSprite(selection, sprite) {
  const selected = selection.info;
  const baseX = selected.originX + sprite.x * 16;
  const baseY = selected.originY + sprite.y * 16;
  const renderMode = getEditorSpawnSpriteRenderMode(sprite.type, boundState.sourceData, selected.area);
  selected.baseX = baseX;
  selected.baseY = baseY;
  selected.bounds = hitBounds(baseX, baseY, renderMode.kind === "oam");
  selected.centerX = baseX + 8;
  selected.centerY = baseY + 8;
  selected.id = hex(sprite.type, 2);
  selection.id = selected.id;
  selected.displayName = spritePlacementDisplayName(sprite.name, sprite.type);
  selected.name = sprite.name;
  selected.placementRole = spritePlacementRole(sprite.type);
  selected.renderKind = renderMode.kind;
  selected.renderMode = renderMode.label;
  selected.renderable = renderMode.kind === "oam";
  selected.type = sprite.type;
  selected.x = sprite.x;
  selected.y = sprite.y;
}

/**
 * Fill controls from the selected placement.
 */
function fillControls(selection) {
  const ui = fields();
  const sprite = selection ? placementRows(boundState, selection)[0]?.before : null;
  fillNameOptions(ui.spritePlacementNameInput, sprite?.name);
  ui.spritePlacementRecordInput.value = selection ? `${hex(selection.area, 2)}:${selection.id}` : "";
  ui.spritePlacementStageInput.value = selection ? selection.placements.map((row) => row.stage).join(", ") : "";
  ui.spritePlacementTypeInput.value = sprite ? hex(sprite.type, 2) : "";
  ui.spritePlacementNameInput.value = sprite?.name || "";
  ui.spritePlacementXInput.value = sprite ? String(sprite.x) : "";
  ui.spritePlacementYInput.value = sprite ? String(sprite.y) : "";
  setDisabled(ui, !sprite);
}

/**
 * Populate compiler-valid sprite names from the latest dump.
 */
function fillNameOptions(select, current) {
  const names = (boundState?.sourceData?.spriteNames || []).filter(isByteSpriteName);
  const values = current && isByteSpriteName(current) && !names.includes(current) ?
    [current, ...names] : names;
  select.innerHTML = "";
  for (const value of values) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = spritePlacementDisplayName(value, typeFromName(value, 0));
    select.append(option);
  }
  select.value = current || values[0] || "";
  syncTypeFromName();
}

/**
 * Sync the read-only type byte display from the selected compiler name.
 */
function syncTypeFromName() {
  const ui = fields();
  const type = typeFromName(ui.spritePlacementNameInput.value, 0);
  ui.spritePlacementTypeInput.value = hex(type, 2);
}

function coordLimits(state, area) {
  const size = state?.sourceData?.areaHeaders?.[area]?.size;
  return {
    x: size === "big" || size === "wide" ? 63 : 31,
    y: size === "big" || size === "tall" ? 63 : 31,
  };
}

function setDisabled(ui, disabled) {
  for (const id of IDS) {
    ui[id].disabled = disabled ||
      id === "spritePlacementRecordInput" ||
      id === "spritePlacementStageInput" ||
      id === "spritePlacementTypeInput";
  }
  document.querySelector("#applySpritePlacementButton").disabled = disabled;
  document.querySelector("#deleteSpritePlacementButton").disabled = disabled;
}

function heading() {
  const title = document.createElement("h2");
  title.textContent = "Sprite Placement";
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

function select(id) {
  const node = document.createElement("select");
  node.id = id;
  return node;
}

function numberInput(id) {
  const node = input(id);
  node.type = "number";
  node.min = "0";
  return node;
}

function buttonRow() {
  const row = document.createElement("div");
  row.className = "row";
  row.append(button("applySpritePlacementButton", "Apply Sprite"), button("deleteSpritePlacementButton", "Delete"));
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
  return Object.fromEntries(IDS.map((id) => [id, document.querySelector(`#${id}`)]));
}

function hitBounds(baseX, baseY, renderable) {
  const padding = renderable ? 10 : 8;
  return { x: baseX - padding, y: baseY - padding, width: 16 + padding * 2, height: 16 + padding * 2 };
}

function sameSprite(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function clamp(value, min, max) {
  const numeric = Number.isFinite(value) ? value : min;
  return Math.max(min, Math.min(max, numeric));
}

function hex(value, width) {
  return `0x${hexByte(value).padStart(width, "0")}`;
}

function hexByte(value) {
  return Number(value).toString(16).toUpperCase().padStart(2, "0");
}

function typeFromName(name, fallback) {
  const match = String(name).match(/^([0-9a-f]{2})-/i);
  const parsed = match ? Number.parseInt(match[1], 16) : NaN;
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 0xff ? parsed : fallback;
}

function isByteSpriteName(name) {
  return typeFromName(name, null) !== null;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}
