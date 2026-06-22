/**
 * Major overworld area grid labels for the editor canvas.
 */

import { groupScreenHeight, groupScreenWidth } from "../viewer/js/map-groups.js?v=20260621-render-restore20";

const FONT_FAMILY = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
export const AREA_GRID_LABEL_GUTTER = 32;

/**
 * Draw atlas-area labels, not map32 tile-grid labels.
 *
 * Parameters:
 *   ctx: 2D canvas context already transformed into world coordinates.
 *   state: Shared Workbench state.
 * Returns:
 *   None.
 */
export function drawAreaGridLabels(ctx, state) {
  const group = state.group;
  if (state.showGridLabels === false || group?.kind !== "atlas") {
    return;
  }

  const transform = ctx.getTransform();
  const scaleX = transform.a;
  const scaleY = transform.d;
  const mapLeft = transform.e;
  const mapTop = transform.f;

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.font = `700 14px ${FONT_FAMILY}`;
  ctx.textBaseline = "middle";
  ctx.lineWidth = 1;
  const cellWidth = groupScreenWidth(group);
  const cellHeight = groupScreenHeight(group);

  for (let col = 0; col < group.columns; col += 1) {
    const x = mapLeft + (col * cellWidth + cellWidth / 2) * scaleX;
    drawBadge(ctx, String(col + 1), x, mapTop - 16, "center");
  }

  for (let row = 0; row < group.rows; row += 1) {
    const y = mapTop + (row * cellHeight + cellHeight / 2) * scaleY;
    drawBadge(ctx, rowLabel(row), mapLeft - 16, y, "center");
  }

  for (let row = 0; row < group.rows; row += 1) {
    for (let col = 0; col < group.columns; col += 1) {
      const x = mapLeft + col * cellWidth * scaleX + 8;
      const y = mapTop + row * cellHeight * scaleY + 16;
      drawBadge(ctx, `${rowLabel(row)}${col + 1}`, x, y, "left");
    }
  }

  ctx.restore();
}

/**
 * Convert a zero-based row index to A, B, ... Z, AA labels.
 *
 * Parameters:
 *   index: Zero-based row index.
 * Returns:
 *   Spreadsheet-style row label.
 */
function rowLabel(index) {
  let label = "";
  let value = index;
  do {
    label = String.fromCharCode(65 + (value % 26)) + label;
    value = Math.floor(value / 26) - 1;
  } while (value >= 0);
  return label;
}

/**
 * Draw a compact text badge over the map.
 *
 * Parameters:
 *   ctx: 2D canvas context.
 *   text: Label text.
 *   x: Canvas x anchor.
 *   y: Canvas y anchor.
 *   align: left or center.
 * Returns:
 *   None.
 */
function drawBadge(ctx, text, x, y, align) {
  const padX = 5;
  const padY = 3;
  const metrics = ctx.measureText(text);
  const width = metrics.width + padX * 2;
  const height = 14 + padY * 2;
  const left = align === "center" ? x - width / 2 : x;
  const top = y - height / 2;

  ctx.fillStyle = "rgba(6, 10, 7, 0.72)";
  ctx.fillRect(left, top, width, height);
  ctx.strokeStyle = "rgba(238, 242, 236, 0.5)";
  ctx.strokeRect(left, top, width, height);
  ctx.fillStyle = "rgba(250, 255, 245, 0.96)";
  ctx.fillText(text, left + padX, y);
}
