/**
 * Hidden overworld item, entrance, and shovel interaction overlays.
 */

import {
  groupScreenHeight,
  groupScreenWidth,
  groupViewport,
  resolveGroupContextScreen,
} from "../viewer/js/map-groups.js?v=20260621-render-restore20";
import {
  drawEditorSpawnSpritesToImage,
  getEditorSpawnSpriteRenderMode,
} from "./enemy-sprite-renderer.js?v=20260621-secret-item-vram";
import { layoutInteractionMarkers } from "./interaction-marker-layout.js?v=20260625-dice-icon-only";
import { categoryLabel, drawMarker } from "./interaction-marker-visual.js?v=20260625-dice-icon-only";
import { collectGravestoneRecords } from "./gravestone-overlay.js?v=20260621-render-restore20";
import { layerVisible } from "./layer-state.js?v=20260621-render-restore20";

const ENTRANCE_CODES = new Set([0x80, 0x82, 0x84, 0x86, 0x88]);
const SECRET_SPRITE_CODES = new Set([0x02, 0x03, 0x0e, 0x0f, 0x10, 0x11, 0x12]);

/**
 * Draw hidden interaction markers onto the rendered group canvas.
 *
 * Parameters:
 *   app: Renderer dependency bundle with sourceData.
 *   canvas: Offscreen group canvas returned by the viewer renderer.
 *   group: Active light, dark, or special group descriptor.
 *   layers: Workbench layer visibility state.
 * Returns:
 *   Number of interaction markers drawn.
 */
export function drawInteractionOverlay(app, canvas, group, layers = {}, stageFilter = "first") {
  if (!app?.sourceData || !canvas || group.kind !== "atlas" || !anyInteractionLayer(layers)) {
    return 0;
  }
  const ctx = canvas.getContext("2d");
  const records = layoutInteractionMarkers(collectInteractionRecords(app.sourceData, group, stageFilter)
    .filter((record) => layerVisible(layers, record.layer) && record.layer !== "gravestones"));
  drawInteractionSprites(app, ctx, canvas, records);
  for (const record of records) {
    if (!record.renderable) {
      drawMarker(ctx, record);
    }
  }
  return records.length;
}

export function inspectInteractionAt(state, worldX, worldY) {
  if (!state.app?.sourceData || state.group?.kind !== "atlas" || !anyInteractionLayer(state.layers)) {
    return null;
  }
  let match = null;
  let bestDistance = Infinity;
  const records = layoutInteractionMarkers(collectInteractionRecords(
    state.app.sourceData, state.group, state.enemyStage || "first").filter((record) => (
    layerVisible(state.layers, record.layer)
  )));
  for (const record of records) {
    if (!pointInBounds(worldX, worldY, record.bounds)) {
      continue;
    }
    const distance = Math.hypot(worldX - record.centerX, worldY - record.centerY);
    if (distance < bestDistance) {
      bestDistance = distance;
      match = record;
    }
  }
  return match ? { ...match } : null;
}

function anyInteractionLayer(layers) {
  return layerVisible(layers, "secretTreasure") ||
    layerVisible(layers, "secretEnemies") ||
    layerVisible(layers, "secretEntrances") ||
    layerVisible(layers, "shovelSpots") ||
    layerVisible(layers, "travelPoints") ||
    layerVisible(layers, "entrancePoints") ||
    layerVisible(layers, "holePoints") ||
    layerVisible(layers, "exitPoints") ||
    layerVisible(layers, "gravestones");
}

function collectInteractionRecords(sourceData, group, stageFilter) {
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
      result.push(...collectAreaInteractions(sourceData, group, area, stageFilter));
    }
  }
  result.push(...collectGravestoneRecords(sourceData, group));
  return result;
}

function collectAreaInteractions(sourceData, group, area, stageFilter) {
  const index = area - group.base;
  if (index < 0 || index >= group.rows * group.columns) {
    return [];
  }
  const header = sourceData.areaHeaders[area];
  const viewport = groupViewport(group);
  const originX = (index % group.columns) * groupScreenWidth(group) - viewport.x;
  const originY = Math.floor(index / group.columns) * groupScreenHeight(group) - viewport.y;
  const records = [];
  for (const [index, item] of (header?.interactions?.items || []).entries()) {
    records.push(buildRecord(sourceData, area, originX, originY, item, classifyItem(item), stageFilter, index));
  }
  for (const spot of header?.interactions?.shovelSpots || []) {
    records.push(buildRecord(sourceData, area, originX, originY, spot, "shovelSpots", stageFilter));
  }
  records.push(...collectNavigationRecords(area, originX, originY, header?.navigation));
  return records;
}

function buildRecord(sourceData, area, originX, originY, item, layer, stageFilter, interactionIndex = null) {
  const spawnXOffset = item.spawnXOffset || 0;
  const x = originX + item.x * 16 + 8 + spawnXOffset;
  const y = originY + item.y * 16 + 8;
  const stage = stageFilter === "all" ? "first" : stageFilter;
  const mode = item.spriteType === null || item.spriteType === undefined ?
    { kind: "fallback", label: "non-sprite secret marker" } :
    getEditorSpawnSpriteRenderMode(item.spriteType, sourceData, area);
  const renderable = mode.kind === "oam";
  return {
    area,
    behavior: item.behavior || "unknown",
    bounds: hitBounds(x, y, renderable),
    category: categoryLabel(layer),
    centerX: x,
    centerY: y,
    code: item.code,
    gridX: item.x,
    gridY: item.y,
    id: item.code === null ? "none" : hex(item.code, 2),
    ignoreProjectile: item.ignoreProjectile ?? null,
    interactionIndex,
    interactionList: interactionIndex === null ? null : "items",
    kind: "interaction",
    layer,
    name: item.name,
    oamFlags: item.oamFlags ?? null,
    originX,
    originY,
    renderable,
    renderMode: mode.label,
    runtimeNote: item.runtimeNote || null,
    randomOptions: item.randomOptions || [],
    source: item.source || null,
    sourceTable: item.sourceTable || null,
    spawnAiState: item.spawnAiState ?? null,
    spawnXOffset,
    spriteGraphics: item.spriteGraphics ?? null,
    displayName: item.displayName || item.name,
    spriteName: item.spriteName || null,
    spriteType: item.spriteType ?? null,
    stage,
    x,
    y,
  };
}

function classifyItem(item) {
  if (item.layer) {
    return item.layer;
  }
  if (ENTRANCE_CODES.has(item.code)) {
    return "secretEntrances";
  }
  if (SECRET_SPRITE_CODES.has(item.code)) {
    return "secretEnemies";
  }
  return "secretTreasure";
}

function collectNavigationRecords(area, originX, originY, navigation) {
  const records = [];
  for (const [index, entry] of (navigation?.travel || []).entries()) {
    pushNavigationRecord(records, area, originX, originY, entry, "travelPoints", "travel", index);
  }
  for (const [index, entry] of (navigation?.entrances || []).entries()) {
    pushNavigationRecord(records, area, originX, originY, entry, "entrancePoints", "entrances", index);
  }
  for (const [index, entry] of (navigation?.holes || []).entries()) {
    pushNavigationRecord(records, area, originX, originY, entry, "holePoints", "holes", index);
  }
  for (const [index, entry] of (navigation?.exits || []).entries()) {
    pushNavigationRecord(records, area, originX, originY, entry, "exitPoints", "exits", index);
  }
  return records;
}

function pushNavigationRecord(records, area, originX, originY, entry, layer, list, index) {
  if (entry && !entry.deleted && (list !== "exits" || entry.room < 0x1000)) {
    records.push(buildNavigationRecord(area, originX, originY, entry, layer, list, index));
  }
}

function buildNavigationRecord(area, originX, originY, entry, layer, navigationList, navigationIndex) {
  const point = navigationPoint(entry);
  const x = originX + point.x;
  const y = originY + point.y;
  return {
    area,
    behavior: entry.type || layer,
    bounds: hitBounds(x, y, false),
    category: categoryLabel(layer),
    centerX: x,
    centerY: y,
    code: entry.index ?? entry.entranceId ?? entry.room ?? null,
    displayName: entry.displayName,
    door: entry.door || null,
    gridX: entry.gridX ?? null,
    gridY: entry.gridY ?? null,
    id: navigationId(entry),
    kind: "interaction",
    layer,
    name: entry.displayName,
    navigationIndex,
    navigationList,
    originX,
    originY,
    pixelX: entry.pixelX ?? null,
    pixelY: entry.pixelY ?? null,
    renderable: false,
    renderMode: "metadata marker",
    runtimeNote: navigationNote(entry),
    source: entry.source || null,
    sourceTable: entry.sourceTable || null,
    x,
    y,
  };
}

function navigationPoint(entry) {
  if (entry.pixelX !== null && entry.pixelX !== undefined) {
    return { x: entry.pixelX, y: entry.pixelY };
  }
  return { x: entry.gridX * 16 + 8, y: entry.gridY * 16 + 8 };
}

function navigationId(entry) {
  if (entry.index !== null && entry.index !== undefined) {
    return String(entry.index);
  }
  if (entry.entranceId !== null && entry.entranceId !== undefined) {
    return String(entry.entranceId);
  }
  if (entry.room !== null && entry.room !== undefined) {
    return `room ${entry.room}`;
  }
  return "none";
}

function navigationNote(entry) {
  const parts = [];
  if (entry.birdTravelId !== null && entry.birdTravelId !== undefined) {
    parts.push(`bird slot ${entry.birdTravelId}`);
  }
  if (entry.whirlpoolSrcArea !== null && entry.whirlpoolSrcArea !== undefined) {
    parts.push(`source area ${hex(entry.whirlpoolSrcArea, 2)}`);
  }
  if (entry.doorDisplay) {
    parts.push(`door ${entry.doorDisplay}`);
  }
  if (entry.specialExit) {
    parts.push("special exit override");
  }
  return parts.join(", ") || null;
}

function drawInteractionSprites(app, ctx, canvas, records) {
  const buckets = Array.from(renderBuckets(records));
  if (!buckets.length) {
    return;
  }
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  for (const bucket of buckets) {
    drawEditorSpawnSpritesToImage(app, image, bucket.area, bucket.originX, bucket.originY,
      bucket.records.map(spriteRecord), { spriteStage: bucket.stage });
  }
  ctx.putImageData(image, 0, 0);
}

function renderBuckets(records) {
  const buckets = new Map();
  for (const record of records) {
    if (!record.renderable) {
      continue;
    }
    const key = `${record.area}:${record.stage}`;
    if (!buckets.has(key)) {
      buckets.set(key, {
        area: record.area,
        originX: record.originX,
        originY: record.originY,
        records: [],
        stage: record.stage,
      });
    }
    buckets.get(key).records.push(record);
  }
  return buckets.values();
}

function spriteRecord(record) {
  return {
    x: record.gridX,
    y: record.gridY,
    graphics: record.spriteGraphics,
    pixelXOffset: record.spawnXOffset,
    type: record.spriteType,
    name: record.spriteName || record.name,
    oamFlags: record.oamFlags,
  };
}

function hitBounds(x, y, renderable) {
  const padding = renderable ? 14 : 8;
  return { x: x - padding, y: y - padding, width: padding * 2, height: padding * 2 };
}

function pointInBounds(x, y, bounds) {
  return x >= bounds.x && y >= bounds.y && x <= bounds.x + bounds.width && y <= bounds.y + bounds.height;
}

function hex(value, width) {
  return `0x${Number(value).toString(16).toUpperCase().padStart(width, "0")}`;
}
