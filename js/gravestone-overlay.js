/**
 * Source-backed movable gravestone overlay.
 */

import {
  groupScreenHeight,
  groupScreenWidth,
  groupViewport,
} from "../viewer/js/map-groups.js?v=20260621-render-restore20";
import { layerVisible } from "./layer-state.js?v=20260621-render-restore20";

const GRAVE_FILL = "rgba(33, 22, 40, 0.3)";
const GRAVE_STROKE = "#ff8bd2";
const SPECIAL_STROKE = "#7ee787";

/**
 * Draw ZScream-style gravestone boxes onto the rendered group canvas.
 *
 * Parameters:
 *   app: Renderer dependency bundle with sourceData.
 *   canvas: Offscreen group canvas returned by the viewer renderer.
 *   group: Active light, dark, or special group descriptor.
 *   layers: Workbench layer visibility state.
 * Returns:
 *   Number of gravestones drawn.
 */
export function drawGravestoneOverlay(app, canvas, group, layers = {}) {
  if (!app?.sourceData?.gravestones || !canvas || group?.kind !== "atlas") {
    return 0;
  }
  if (!layerVisible(layers, "gravestones")) {
    return 0;
  }
  const ctx = canvas.getContext("2d");
  const records = collectGravestoneRecords(app.sourceData, group);
  for (const record of records) {
    drawGravestone(ctx, record);
  }
  return records.length;
}

export function collectGravestoneRecords(sourceData, group) {
  const records = [];
  for (const grave of sourceData?.gravestones?.records || []) {
    const point = groupPoint(grave, group);
    if (point) {
      records.push(recordFromGrave(grave, point));
    }
  }
  return records;
}

function groupPoint(grave, group) {
  const area = grave.area;
  const index = area - group.base;
  if (index < 0 || index >= group.rows * group.columns) {
    return null;
  }
  const viewport = groupViewport(group);
  const x = (index % group.columns) * groupScreenWidth(group) + grave.localX - viewport.x;
  const y = Math.floor(index / group.columns) * groupScreenHeight(group) + grave.localY - viewport.y;
  return { drawX: x, drawY: y };
}

function recordFromGrave(grave, point) {
  const width = grave.width || 32;
  const height = grave.height || 32;
  const x = point.drawX + width / 2;
  const y = point.drawY + height / 2;
  return {
    ...grave,
    bounds: { x: point.drawX, y: point.drawY, width, height },
    category: "gravestone",
    centerX: x,
    centerY: y,
    displayName: grave.special ? specialLabel(grave) : `Grave ${hex(grave.index, 2)}`,
    drawX: point.drawX,
    drawY: point.drawY,
    gravestoneIndex: grave.index,
    id: hex(grave.index, 2),
    kind: "interaction",
    layer: "gravestones",
    name: "Gravestone",
    originX: point.drawX - grave.localX,
    originY: point.drawY - grave.localY,
    renderable: false,
    x,
    y,
  };
}

function drawGravestone(ctx, grave) {
  const width = grave.width || 32;
  const height = grave.height || 32;
  ctx.save();
  ctx.lineWidth = 2;
  ctx.fillStyle = GRAVE_FILL;
  ctx.strokeStyle = grave.special ? SPECIAL_STROKE : GRAVE_STROKE;
  ctx.fillRect(grave.drawX, grave.drawY, width, height);
  ctx.strokeRect(grave.drawX + 0.5, grave.drawY + 0.5, width - 1, height - 1);
  drawLabel(ctx, grave);
  ctx.restore();
}

function drawLabel(ctx, grave) {
  const label = grave.special ? specialLabel(grave) : `G${hex(grave.index, 2)}`;
  ctx.font = "8px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const width = Math.max(18, ctx.measureText(label).width + 8);
  const x = grave.drawX + (grave.width || 32) / 2;
  const y = grave.drawY + (grave.height || 32) / 2;
  ctx.fillStyle = grave.special ? "rgba(6, 42, 24, 0.92)" : "rgba(33, 22, 40, 0.92)";
  ctx.fillRect(x - width / 2, y - 7, width, 14);
  ctx.fillStyle = "#f8fff5";
  ctx.fillText(label, x, y);
}

function specialLabel(grave) {
  if (grave.special === "stairs") {
    return "Stairs";
  }
  if (grave.special === "hole") {
    return "Hole";
  }
  return `G${hex(grave.index, 2)}`;
}

function hex(value, width) {
  return Number(value).toString(16).toUpperCase().padStart(width, "0");
}
