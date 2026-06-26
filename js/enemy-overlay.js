/**
 * Overworld sprite placement overlay for the Workbench canvas.
 */

import {
  groupScreenHeight,
  groupScreenWidth,
  groupViewport,
  resolveGroupContextScreen,
} from "../viewer/js/map-groups.js?v=20260621-render-restore20";
import {
  drawEditorSpawnSpritesToImage,
  ensureEditorEnemySprites,
  getEditorSpawnSpriteRenderMode,
} from "./enemy-sprite-renderer.js?v=20260621-secret-item-vram";
import {
  drawSpriteMarker,
  shouldDrawSpriteMarker,
} from "./enemy-marker-visual.js?v=20260625-sprite-markers";
import { spritePlacementDisplayName, spritePlacementRole } from "./sprite-labels.js?v=20260621-render-restore20";
const STAGE_COLORS = {
  beginning: "#f4c35d",
  first: "#ff6b5f",
  second: "#5bb8ff",
};
const STAGE_LABELS = {
  beginning: "Beginning",
  first: "First part",
  second: "Second part",
  all: "All sets",
};
const STAGE_ORDER = ["beginning", "first", "second"];

const TERRAIN_DEPENDENCIES = new Map([
  [0x55, {
    label: "Deep water",
    detail: "River Zora surfacing checks tile attribute 0x08; shallow water 0x09 only works in the bugfix path.",
  }],
  [0x56, {
    label: "Water entry",
    detail: "Walking Zora is a delayed surfacing sprite, so keep water-looking terrain under the spawn.",
  }],
  [0xd2, {
    label: "Water interaction",
    detail: "Fish checks its current tile; deep water removes it, while shallow/deep water drive splash behavior.",
  }],
  [0x63, {
    label: "Quicksand pit",
    detail: "DebirandoPit is a sand/quicksand object and should move with matching pit terrain.",
  }],
  [0x64, {
    label: "Sand burrow",
    detail: "Debirando emerges from sand; pair this spawn with matching sand terrain for correct gameplay context.",
  }],
  [0x71, {
    label: "Sand burrow",
    detail: "Leever behavior is sand-burrow themed; pair this spawn with matching desert/sand terrain.",
  }],
]);

/**
 * Bind every sprite toggle button to the same overlay state.
 *
 * Parameters:
 *   state: Shared Workbench state.
 *   render: Callback that re-renders the current world canvas.
 *   setStatus: Status text callback.
 * Returns:
 *   None.
 */
export function bindEnemyToggle(state, render, setStatus) {
  ensureEditorEnemySprites().then(() => {
    render();
  });
  const stageSelect = document.querySelector("#enemyStageSelect");
  if (stageSelect) {
    state.enemyStage = state.enemyStage || stageSelect.value || "first";
    stageSelect.addEventListener("change", () => {
      state.enemyStage = stageSelect.value;
      setStatus(`Overworld sprite set: ${STAGE_LABELS[state.enemyStage] || state.enemyStage}`);
      render();
    });
  }
  for (const button of document.querySelectorAll("[data-enemy-toggle]")) {
    button.addEventListener("click", () => {
      state.showEnemies = !state.showEnemies;
      syncSpriteButtons(state.showEnemies);
      render();
    });
  }
  syncSpriteButtons(Boolean(state.showEnemies));
}

/**
 * Draw all known overworld sprite placements onto the rendered group canvas.
 *
 * Parameters:
 *   app: Renderer dependency bundle with sourceData.
 *   canvas: Offscreen group canvas returned by the viewer renderer.
 *   group: Active light, dark, or special group descriptor.
 * Returns:
 *   Number of spawn records represented on the canvas.
 */
export function drawEnemyOverlay(app, canvas, group, stageFilter = "first", layers = {}) {
  if (!app?.sourceData || !canvas || group.kind !== "atlas") {
    return 0;
  }
  const ctx = canvas.getContext("2d");
  const spawns = collectSpriteSpawns(app, group, stageFilter);
  const showArt = layerVisible(layers, "enemySpriteArt");
  const showMarkers = layerVisible(layers, "enemyMarkers");
  if (showArt) {
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    for (const bucket of renderBuckets(spawns)) {
      drawEditorSpawnSpritesToImage(app, image, bucket.area, bucket.originX, bucket.originY, bucket.spawns, {
        spriteStage: bucket.stage,
      });
    }
    ctx.putImageData(image, 0, 0);
  }
  if (showMarkers) {
    for (const spawn of spawns) {
      if (shouldDrawSpriteMarker(spawn, showArt)) {
        drawSpriteMarker(ctx, spawn);
      }
    }
  }
  return spawns.length;
}

/**
 * Return whether a sprite overlay layer is visible unless explicitly disabled.
 */
function layerVisible(layers, key) {
  return layers?.[key] !== false;
}

/**
 * Inspect a sprite placement under the pointer before terrain hit-testing runs.
 *
 * Parameters:
 *   state: Shared Workbench state.
 *   worldX/worldY: Rendered group-space pointer coordinates.
 * Returns:
 *   Sprite selection object, or null when no spawn is under the pointer.
 */
export function inspectEnemyAt(state, worldX, worldY) {
  if (!state.showEnemies || !state.app || state.group?.kind !== "atlas") {
    return null;
  }
  if (!layerVisible(state.layers, "enemySpriteArt") && !layerVisible(state.layers, "enemyMarkers")) {
    return null;
  }
  let match = null;
  let bestDistance = Infinity;
  for (const spawn of collectSpriteSpawns(state.app, state.group, state.enemyStage || "first")) {
    if (!pointInBounds(worldX, worldY, spawn.bounds)) {
      continue;
    }
    const distance = Math.hypot(worldX - spawn.centerX, worldY - spawn.centerY);
    if (distance < bestDistance) {
      bestDistance = distance;
      match = spawn;
    }
  }
  return match ? { ...match } : null;
}

/**
 * Keep the expanded-panel and collapsed-toolbar buttons visually synchronized.
 *
 * Parameters:
 *   active: Whether the sprite overlay is active.
 * Returns:
 *   None.
 */
function syncSpriteButtons(active) {
  for (const button of document.querySelectorAll("[data-enemy-toggle]")) {
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  }
}

/**
 * Collect every unique spawn record visible in one atlas group.
 *
 * Parameters:
 *   app: Renderer dependency bundle with sourceData.
 *   group: Atlas group descriptor.
 * Returns:
 *   Unique spawn records with world-space bounds and properties metadata.
 */
function collectSpriteSpawns(app, group, stageFilter) {
  const result = [];
  const drawnAreas = new Set();
  for (let row = 0; row < group.rows; row += 1) {
    for (let col = 0; col < group.columns; col += 1) {
      const screen = group.base + row * group.columns + col;
      const area = resolveGroupContextScreen(group, screen);
      if (drawnAreas.has(area)) {
        continue;
      }
      drawnAreas.add(area);
      result.push(...collectAreaSpawns(app.sourceData, group, area, stageFilter));
    }
  }
  return result;
}

/**
 * Collect one area's unique spawn entries at its atlas origin.
 *
 * Parameters:
 *   sourceData: Parsed dump metadata.
 *   group: Atlas group descriptor.
 *   area: Area-header screen id.
 * Returns:
 *   Sprite records in rendered group coordinates.
 */
function collectAreaSpawns(sourceData, group, area, stageFilter) {
  const index = area - group.base;
  if (index < 0 || index >= group.rows * group.columns) {
    return [];
  }
  const viewport = groupViewport(group);
  const originX = (index % group.columns) * groupScreenWidth(group) - viewport.x;
  const originY = Math.floor(index / group.columns) * groupScreenHeight(group) - viewport.y;
  return uniqueSpawns(sourceData.areaHeaders[area], stageFilter).map((spawn) => {
    const baseX = originX + spawn.x * 16;
    const baseY = originY + spawn.y * 16;
    return buildSpawnRecord(spawn, sourceData, area, group, originX, originY, baseX, baseY);
  });
}

/**
 * Flatten progression-specific sprite sets into unique spawn records with stages merged.
 *
 * Parameters:
 *   header: Normalized area header from source-parser.js.
 * Returns:
 *   Array of unique spawn records with x, y, type, name, and stages.
 */
function uniqueSpawns(header, stageFilter) {
  if (stageFilter !== "all") {
    const spriteSet = header?.spriteSets?.[stageFilter];
    return (spriteSet?.sprites || []).map((spawn, index) => ({
      ...spawn,
      stagePlacements: [{ stage: stageFilter, index }],
      stages: [stageFilter],
    }));
  }
  const byKey = new Map();
  for (const [stage, spriteSet] of Object.entries(header?.spriteSets || {})) {
    for (const [index, sprite] of (spriteSet.sprites || []).entries()) {
      const key = `${sprite.x}:${sprite.y}:${sprite.type}:${sprite.name}`;
      if (!byKey.has(key)) {
        byKey.set(key, { ...sprite, stagePlacements: [], stages: [] });
      }
      byKey.get(key).stagePlacements.push({ stage, index });
      byKey.get(key).stages.push(stage);
    }
  }
  return [...byKey.values()].map((spawn) => ({
    ...spawn,
    stagePlacements: sortPlacements(spawn.stagePlacements),
    stages: sortStages(spawn.stages),
  }));
}

/**
 * Build the selection/render metadata for one sprite placement.
 *
 * Parameters:
 *   spawn: Source sprite placement record.
 *   area: Area-head id.
 *   group: Active atlas group.
 *   originX/originY: Area origin in rendered-world pixels.
 *   baseX/baseY: Sprite spawn origin in rendered-world pixels.
 * Returns:
 *   Sprite selection/render record.
 */
function buildSpawnRecord(spawn, sourceData, area, group, originX, originY, baseX, baseY) {
  const stages = spawn.stages.length ? spawn.stages : ["first"];
  const stage = primaryStage(stages);
  const renderMode = getEditorSpawnSpriteRenderMode(spawn.type, sourceData, area);
  const renderable = renderMode.kind === "oam";
  const dependency = TERRAIN_DEPENDENCIES.get(spawn.type) || null;
  return {
    ...spawn,
    kind: "sprite",
    id: hex(spawn.type, 2),
    displayName: spritePlacementDisplayName(spawn.name, spawn.type),
    area,
    screen: area,
    groupId: group.id,
    originX,
    originY,
    baseX,
    baseY,
    centerX: baseX + 8,
    centerY: baseY + 8,
    bounds: hitBounds(baseX, baseY, renderable),
    stages,
    primaryStage: stage,
    placementRole: spritePlacementRole(spawn.type),
    stageColors: stages.map((stage) => ({ stage, color: STAGE_COLORS[stage] || "#d8f2cf" })),
    renderKind: renderMode.kind,
    renderMode: renderMode.label,
    renderable,
    terrainDependency: dependency,
  };
}

/**
 * Group OAM-renderable spawns by area and stage so each bucket uses its own
 * sprite graphics and palette context.
 */
function renderBuckets(spawns) {
  const buckets = new Map();
  for (const spawn of spawns) {
    if (!spawn.renderable) {
      continue;
    }
    const key = `${spawn.area}:${spawn.primaryStage}`;
    if (!buckets.has(key)) {
      buckets.set(key, {
        area: spawn.area,
        originX: spawn.originX,
        originY: spawn.originY,
        stage: spawn.primaryStage,
        spawns: [],
      });
    }
    buckets.get(key).spawns.push(spawn);
  }
  return buckets.values();
}

/**
 * Return a conservative hit box around the rendered or fallback spawn glyph.
 */
function hitBounds(baseX, baseY, renderable) {
  const padding = renderable ? 12 : 14;
  const width = 16;
  const height = 16;
  return {
    x: baseX + 8 - width / 2 - padding,
    y: baseY + 8 - height / 2 - padding,
    width: width + padding * 2,
    height: height + padding * 2,
  };
}

function pointInBounds(x, y, bounds) {
  return x >= bounds.x && y >= bounds.y && x <= bounds.x + bounds.width && y <= bounds.y + bounds.height;
}

function primaryStage(stages) {
  if (stages.includes("first")) {
    return "first";
  }
  return stages[0] || "first";
}

function sortStages(stages) {
  return [...new Set(stages)].sort((a, b) => STAGE_ORDER.indexOf(a) - STAGE_ORDER.indexOf(b));
}

function sortPlacements(placements) {
  return [...placements].sort((a, b) => STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage));
}

function hex(value, width) {
  return `0x${Number(value).toString(16).toUpperCase().padStart(width, "0")}`;
}
