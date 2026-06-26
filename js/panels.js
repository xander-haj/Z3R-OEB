/**
 * DOM panel helpers for mod selection, inspector, and patch JSON editors.
 */

import { defaultPatch } from "./patch-editor-defaults.js?v=20260625-editor-db";
import { appendEditorDatabaseRows } from "./inspector-database-rows.js?v=20260625-exit-filter";

const PATCH_LABELS = {
  "patches/map32-definitions.json": "Map32 Definitions",
  "patches/map16-definitions.json": "Map16 Definitions",
  "patches/map8-words.json": "Map8 Words",
  "patches/tile-attributes.json": "Tile Attributes",
  "patches/chr-recipes.json": "CHR Recipes",
  "patches/palettes.json": "Palettes",
  "patches/metadata.json": "Metadata",
  "patches/dialogue.json": "Dialogue",
};

/**
 * Update status text.
 *
 * Parameters:
 *   text: Status message.
 * Returns:
 *   None.
 */
export function setStatus(text) {
  document.querySelector("#statusText").textContent = text;
}

/**
 * Fill the mod selector.
 *
 * Parameters:
 *   mods: Server mod list.
 * Returns:
 *   None.
 */
export function fillMods(mods) {
  const select = document.querySelector("#modSelect");
  select.innerHTML = '<option value="">No mod selected</option>';
  for (const mod of mods) {
    const option = document.createElement("option");
    option.value = mod.id;
    option.textContent = mod.error ? `${mod.id} (invalid)` : `${mod.id} — ${mod.name}`;
    select.append(option);
  }
}

/**
 * Render editable JSON patch textareas for non-terrain layers.
 *
 * Parameters:
 *   patches: Patch document map from the server.
 * Returns:
 *   None.
 */
export function renderPatchEditors(patches) {
  const container = document.querySelector("#patchEditors");
  container.innerHTML = "";
  for (const [path, label] of Object.entries(PATCH_LABELS)) {
    const wrapper = document.createElement("div");
    wrapper.className = "patch-editor";
    const title = document.createElement("h2");
    title.textContent = label;
    const textarea = document.createElement("textarea");
    textarea.dataset.patchPath = path;
    textarea.value = JSON.stringify(patches[path] || defaultPatch(path), null, 2);
    wrapper.append(title, textarea);
    container.append(wrapper);
  }
}

/**
 * Read JSON patch editors back into documents.
 *
 * Parameters: none.
 * Returns:
 *   Patch document map.
 */
export function readPatchEditors() {
  const patches = {};
  for (const textarea of document.querySelectorAll("[data-patch-path]")) {
    patches[textarea.dataset.patchPath] = JSON.parse(textarea.value);
  }
  return patches;
}

/**
 * Update the inspector rows for terrain tiles, sprite placements, or interactions.
 *
 * Parameters:
 *   info: Tile information from OverworldMapCache.inspect or a sprite selection.
 *   inspectGrid: Active map32/map16/map8 inspection mode.
 *   editorDb: Optional editor database descriptor from dat-dump.
 * Returns:
 *   None.
 */
export function updateInspector(info, inspectGrid = "map32", editorDb = null) {
  const rows = document.querySelector("#inspectorRows");
  if (!info) {
    rows.innerHTML = "<dt>Selection</dt><dd>none</dd>";
    return;
  }
  if (info.kind === "sprite" || info.kind === "enemy") {
    updateSpriteInspector(rows, info, editorDb);
    return;
  }
  if (info.kind === "interaction") {
    updateInteractionInspector(rows, info, editorDb);
    return;
  }
  rows.innerHTML = "";
  for (const [key, value] of [
    ["Inspect", inspectGridLabel(inspectGrid)],
    ["Screen", hex(info.screen, 2)],
    ["Area", `${hex(info.area, 2)}${info.areaSize ? ` (${info.areaSize})` : ""}`],
    ["Map32", `${hex(info.map32)} @ ${info.map32X},${info.map32Y}`],
    ["Map16", `${hex(info.map16)} @ ${info.map16X},${info.map16Y}`],
    ["Map8", hex(info.map8Word)],
    ["Map8 Tile", `${hex(info.map8Tile, 3)} @ ${info.map8X},${info.map8Y}`],
    ["Type Index", hex(info.tileTypeIndex, 3)],
    ["Tile Type", info.tileType === null ? "not dumped" : hex(info.tileType, 2)],
    ["Palette", info.palette],
    ["Flip", `H ${info.map8HFlip ? "yes" : "no"} / V ${info.map8VFlip ? "yes" : "no"}`],
    ["Priority", info.priority ? "yes" : "no"],
  ]) {
    const dt = document.createElement("dt");
    const dd = document.createElement("dd");
    dt.textContent = key;
    dd.textContent = value;
    rows.append(dt, dd);
  }
  appendEditorDatabaseRows(rows, info, inspectGrid, editorDb, appendRow);
}

function inspectGridLabel(value) {
  if (value === "map8") {
    return "Map8";
  }
  if (value === "map16") {
    return "Map16";
  }
  return "Map32";
}

/**
 * Update the inspector for a selected overworld sprite placement.
 *
 * Parameters:
 *   rows: Definition-list element to replace.
 *   info: Sprite selection object from the sprite overlay.
 *   editorDb: Optional editor database descriptor from dat-dump.
 * Returns:
 *   None.
 */
function updateSpriteInspector(rows, info, editorDb) {
  rows.innerHTML = "";
  appendRow(rows, "Selection", "overworld sprite");
  appendRow(rows, "Record", info.placementRole || "sprite placement");
  appendRow(rows, "ID", info.id);
  appendRow(rows, "Name", info.displayName || info.name);
  appendRow(rows, "Area", hex(info.area, 2));
  appendRow(rows, "Spawn", `${info.x},${info.y} on the 16px sprite grid`);
  appendRow(rows, "Stages", renderStageList(info.stageColors));
  appendRow(rows, "Sprite", info.renderMode);
  appendRow(rows, "Edit Together", terrainSummary(info));
  if (info.terrainDependency) {
    appendRow(rows, "Terrain Detail", info.terrainDependency.detail);
  }
  appendEditorDatabaseRows(rows, info, "map32", editorDb, appendRow);
}

/**
 * Update the inspector for hidden items, travel markers, entrances, holes, and exits.
 *
 * Parameters:
 *   rows: Definition-list element to replace.
 *   info: Interaction selection object from the interaction overlay.
 *   editorDb: Optional editor database descriptor from dat-dump.
 * Returns:
 *   None.
 */
function updateInteractionInspector(rows, info, editorDb) {
  rows.innerHTML = "";
  appendRow(rows, "Selection", info.category || "interaction");
  appendRow(rows, "Code", info.id || "none");
  appendRow(rows, "Name", info.displayName || info.name || "Unknown");
  appendRow(rows, "Behavior", readableBehavior(info.behavior));
  appendRow(rows, "Area", hex(info.area, 2));
  appendInteractionPosition(rows, info);
  if (shouldShowInteractionSprite(info)) {
    appendRow(rows, "Sprite", interactionSpriteSummary(info));
  }
  appendRow(rows, "Draw", info.renderMode || "marker");
  if (info.spriteGraphics !== null && info.spriteGraphics !== undefined) {
    appendRow(rows, "Graphics", hex(info.spriteGraphics, 2));
  }
  if (info.oamFlags !== null && info.oamFlags !== undefined) {
    appendRow(rows, "OAM Flags", hex(info.oamFlags, 2));
  }
  appendRuntimeRows(rows, info);
  if (info.randomOptions?.length) {
    appendRow(rows, "Random Pool", randomOptionSummary(info.randomOptions));
  }
  if (info.sourceTable) {
    appendRow(rows, "Table", info.sourceTable);
  }
  if (info.source) {
    appendRow(rows, "Source", info.source);
  }
  if (info.runtimeNote) {
    appendRow(rows, "Runtime Note", info.runtimeNote);
  }
  appendEditorDatabaseRows(rows, info, "map32", editorDb, appendRow);
}

function appendInteractionPosition(rows, info) {
  if (info.gridX !== null && info.gridX !== undefined) {
    appendRow(rows, "Grid", `${info.gridX},${info.gridY} on the 16px grid`);
  }
  if (info.pixelX !== null && info.pixelX !== undefined) {
    const label = info.navigationList === "exits" ? "Spawn Pixel" : "Pixel";
    appendRow(rows, label, `${info.pixelX},${info.pixelY} in area-local pixels`);
  }
  if (Array.isArray(info.door)) {
    appendRow(rows, "Door Grid", `${info.door[1]},${info.door[2]} ${info.door[0]}`);
  }
}

function shouldShowInteractionSprite(info) {
  return info.spriteType !== null && info.spriteType !== undefined ||
    info.behavior === "random_sprite_or_empty" ||
    info.behavior === "fixed_sprite_spawn";
}

/**
 * Append one key/value row to the inspector definition list.
 *
 * Parameters:
 *   rows: Target definition-list element.
 *   key: Row label.
 *   value: String or DOM node to display.
 * Returns:
 *   None.
 */
function appendRow(rows, key, value) {
  const dt = document.createElement("dt");
  const dd = document.createElement("dd");
  dt.textContent = key;
  if (value instanceof Node) {
    dd.append(value);
  } else {
    dd.textContent = value;
  }
  rows.append(dt, dd);
}

/**
 * Render the progression-stage color chips that used to be represented only on-canvas.
 *
 * Parameters:
 *   colors: Stage/color pairs from the sprite selection.
 * Returns:
 *   Inline DOM element containing labeled stage chips.
 */
function renderStageList(colors) {
  const list = document.createElement("span");
  list.className = "stage-chip-list";
  for (const item of colors || []) {
    const chip = document.createElement("span");
    chip.className = "stage-chip";
    chip.style.setProperty("--stage-color", item.color);
    chip.textContent = item.stage;
    list.append(chip);
  }
  return list;
}

/**
 * Describe whether this sprite must move with a matching terrain/background tile.
 *
 * Parameters:
 *   info: Sprite selection object.
 * Returns:
 *   User-facing terrain pairing summary.
 */
function terrainSummary(info) {
  if (!info.terrainDependency) {
    return "no terrain dependency recorded";
  }
  return `yes: ${info.terrainDependency.label}`;
}

function interactionSpriteSummary(info) {
  if (info.spriteType !== null && info.spriteType !== undefined) {
    return `${hex(info.spriteType, 2)} ${info.spriteName || "Unknown"}`;
  }
  if (info.behavior === "random_sprite_or_empty") {
    return "randomized at spawn time";
  }
  if (info.code >= 1 && info.code <= 22 && info.code !== 4 && info.code !== 0x16) {
    return "missing from current dump; rerun overworld dump";
  }
  return "not a fixed spawned sprite";
}

/**
 * Render Sprite_SpawnSecret runtime fields when the selected secret has them.
 *
 * Parameters:
 *   rows: Definition-list element to append into.
 *   info: Interaction selection object.
 * Returns:
 *   None.
 */
function appendRuntimeRows(rows, info) {
  const parts = [];
  if (info.spawnAiState !== null && info.spawnAiState !== undefined) {
    parts.push(`AI ${info.spawnAiState}`);
  }
  if (info.spawnXOffset) {
    parts.push(`x+${info.spawnXOffset}px`);
  }
  if (info.zVelocity !== null && info.zVelocity !== undefined) {
    parts.push(`zvel ${info.zVelocity}`);
  }
  if (info.ignoreProjectile !== null && info.ignoreProjectile !== undefined) {
    parts.push(info.ignoreProjectile ? "ignores projectiles" : "projectile vulnerable");
  }
  if (parts.length) {
    appendRow(rows, "Spawn State", parts.join(", "));
  }
}

/**
 * Convert random-secret choices into a compact human-readable list.
 *
 * Parameters:
 *   options: Normalized random choice records.
 * Returns:
 *   Display string for the Properties panel.
 */
function randomOptionSummary(options) {
  return options.map((option) => {
    const code = option.code === null || option.code === undefined ? "??" : hex(option.code, 2);
    const sprite = option.spriteType === null || option.spriteType === undefined ? "no sprite" :
      `${hex(option.spriteType, 2)} ${option.spriteName || "sprite"}`;
    return `${code} ${option.displayName} (${sprite})`;
  }).join(", ");
}

/**
 * Convert internal interaction behavior keys into panel labels.
 *
 * Parameters:
 *   behavior: Dump behavior key.
 * Returns:
 *   Human-readable label.
 */
function readableBehavior(behavior) {
  return {
    entrance_or_trigger: "entrance or trigger",
    fixed_sprite_spawn: "fixed sprite spawn",
    hardcoded_shovel_reward: "hard-coded shovel reward",
    bird_travel: "bird travel destination",
    entrance: "overworld entrance slot",
    exit: "dungeon exit point",
    hole: "fall hole",
    no_spawn: "no spawned object",
    random_sprite_or_empty: "random sprite or empty",
    whirlpool: "whirlpool destination",
  }[behavior] || behavior || "unknown";
}

/**
 * Format a value as uppercase hex.
 *
 * Parameters:
 *   value: Numeric value.
 *   width: Hex digit count.
 * Returns:
 *   Hex string.
 */
function hex(value, width = 4) {
  return `0x${Number(value).toString(16).toUpperCase().padStart(width, "0")}`;
}
