/**
 * Properties-panel controls for shared overworld sprite-set gfx/palette context.
 */

import { applyCommand, parseNumber } from "./operations.js?v=20260621-render-restore20";

const STAGES = [
  { key: "beginning", label: "Beginning" },
  { key: "first", label: "First part" },
  { key: "second", label: "Second part" },
];
const IDS = [
  "spriteInfoAreaInput",
  "spriteInfoStageInput",
  "spriteInfoGfxInput",
  "spriteInfoPaletteInput",
  "applySpriteInfoButton",
];

let boundState = null;
let boundActions = null;

/**
 * Bind generated sprite context controls to shared Workbench state.
 */
export function bindSpriteInfoControls(state, actions) {
  boundState = state;
  boundActions = actions;
  ensureControls();
  fields().spriteInfoStageInput.addEventListener("change", handleStageChange);
  fields().applySpriteInfoButton.addEventListener("click", applySpriteInfoEdit);
  syncSpriteInfoControls(state, null);
}

/**
 * Refresh controls from the selected area and stage.
 */
export function syncSpriteInfoControls(state, info = state?.selected) {
  const area = selectedArea(info);
  const stages = stagesForArea(area);
  const stage = selectedStage(state, stages);
  state.spriteInfoSelection = Number.isFinite(area) && stage ? { area, stage } : null;
  fillControls(area, stage, stages, spriteInfoRecord(state, area, stage));
}

/**
 * Apply the current gfx/palette fields as one undoable metadata edit.
 */
function applySpriteInfoEdit() {
  const selection = boundState?.spriteInfoSelection;
  const before = selection ? spriteInfoRecord(boundState, selection.area, selection.stage) : null;
  if (!before) {
    boundActions.setStatus("Select a main-overworld sprite context first");
    return;
  }
  const after = {
    gfx: byteValue(fields().spriteInfoGfxInput.value),
    palette: byteValue(fields().spriteInfoPaletteInput.value),
  };
  if (JSON.stringify(before) === JSON.stringify(after)) {
    boundActions.setStatus("Sprite context unchanged");
    return;
  }
  applyCommand(boundState.history, boundState, {
    kind: "metadata.set-sprite-info",
    area: selection.area,
    stage: selection.stage,
    before,
    after,
  });
  boundActions.setStatus(`Updated sprite context ${hex(selection.area, 2)}`);
  syncSpriteInfoControls(boundState);
  boundActions.rerender();
}

/**
 * Create the generated control section.
 */
function ensureControls() {
  if (document.querySelector("[data-sprite-info-controls]")) {
    return;
  }
  const section = document.createElement("section");
  section.dataset.spriteInfoControls = "true";
  section.append(
    heading(),
    label("Area", input("spriteInfoAreaInput", true)),
    label("Stage", stageSelect()),
    label("Sprite GFX", input("spriteInfoGfxInput")),
    label("Sprite Palette", input("spriteInfoPaletteInput")),
    buttonRow(),
  );
  const inspector = document.querySelector("#inspectorRows").closest("section");
  inspector.parentNode.insertBefore(section, inspector);
}

/**
 * Re-sync controls after manually choosing a stage.
 */
function handleStageChange() {
  boundState.spriteInfoStage = fields().spriteInfoStageInput.value;
  syncSpriteInfoControls(boundState);
}

/**
 * Fill controls and disable them when the compiler cannot write this area.
 */
function fillControls(area, stage, stages, info) {
  const ui = fields();
  fillStageOptions(ui.spriteInfoStageInput, stages, stage);
  ui.spriteInfoAreaInput.value = Number.isFinite(area) ? hex(area, 2) : "";
  ui.spriteInfoGfxInput.value = info ? hex(info.gfx, 2) : "";
  ui.spriteInfoPaletteInput.value = info ? hex(info.palette, 2) : "";
  setDisabled(ui, !info);
}

/**
 * Return a cloned info block for a compiler-backed sprite set.
 */
function spriteInfoRecord(state, area, stage) {
  if (!Number.isFinite(area) || area >= 128 || !stage) {
    return null;
  }
  const info = state?.sourceData?.areaHeaders?.[area]?.spriteSets?.[stage]?.info;
  return info ? { gfx: byteValue(info.gfx), palette: byteValue(info.palette) } : null;
}

/**
 * Return available editable stages for one area.
 */
function stagesForArea(area) {
  if (!Number.isFinite(area) || area >= 128) {
    return [];
  }
  return area < 64 ? STAGES : [{ key: "first", label: "Shared" }];
}

/**
 * Pick the current stage, preserving the user's manual choice when valid.
 */
function selectedStage(state, stages) {
  const wanted = state?.spriteInfoStage || (state?.enemyStage === "all" ? "first" : state?.enemyStage);
  return stages.some((stage) => stage.key === wanted) ? wanted : stages[0]?.key || null;
}

/**
 * Return the selected area head from any editor selection shape.
 */
function selectedArea(info) {
  const area = info?.area ?? info?.contextScreen ?? info?.screen;
  return Number.isFinite(area) ? area : null;
}

/**
 * Fill the stage select with currently available stages.
 */
function fillStageOptions(select, stages, selected) {
  select.innerHTML = "";
  for (const stage of stages) {
    const option = document.createElement("option");
    option.value = stage.key;
    option.textContent = stage.label;
    select.append(option);
  }
  select.value = selected || "";
}

/**
 * Enable or disable all generated controls.
 */
function setDisabled(ui, disabled) {
  for (const id of IDS) {
    ui[id].disabled = disabled || id === "spriteInfoAreaInput";
  }
}

function heading() {
  const title = document.createElement("h2");
  title.textContent = "Sprite Context";
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

function stageSelect() {
  const node = document.createElement("select");
  node.id = "spriteInfoStageInput";
  return node;
}

function buttonRow() {
  const row = document.createElement("div");
  row.className = "row";
  const button = document.createElement("button");
  button.id = "applySpriteInfoButton";
  button.type = "button";
  button.textContent = "Apply Sprite Context";
  row.append(button);
  return row;
}

function fields() {
  const result = {};
  for (const id of IDS) {
    result[id] = document.querySelector(`#${id}`);
  }
  return result;
}

function byteValue(value) {
  const parsed = parseNumber(value);
  return Math.max(0, Math.min(255, Number.isFinite(parsed) ? parsed : 0));
}

function hex(value, width) {
  return `0x${Number(value).toString(16).toUpperCase().padStart(width, "0")}`;
}
