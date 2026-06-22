/**
 * Coordinate helpers for moving topology-owned metadata rows between areas.
 */

/**
 * Return the child quadrant offset for an object or YAML-list grid row.
 */
export function gridRowOffset(row) {
  const [x, y] = rowGridPair(row);
  return (x >= 32 ? 1 : 0) | (y >= 32 ? 8 : 0);
}

/**
 * Return the child quadrant offset for a pixel-space navigation row.
 */
export function pixelRowOffset(row) {
  const [x, y] = Array.isArray(row?.xy) ? row.xy : [row?.pixelX ?? 0, row?.pixelY ?? 0];
  return (coordinate(x) >= 512 ? 1 : 0) | (coordinate(y) >= 512 ? 8 : 0);
}

/**
 * Move an object or YAML-list grid row into or out of a child area.
 */
export function adjustGridRow(row, offset, step) {
  const moved = clone(row);
  if (Array.isArray(moved)) {
    moved[0] = coordinate(moved[0]) + (offset & 1 ? step : 0);
    moved[1] = coordinate(moved[1]) + (offset & 8 ? step : 0);
    return moved;
  }
  adjustFieldPair(moved, "x", "y", offset, step);
  adjustFieldPair(moved, "gridX", "gridY", offset, step);
  return moved;
}

/**
 * Move pixel-space navigation rows while keeping door grid coordinates aligned.
 */
export function adjustPixelRow(row, offset, pixelStep) {
  const moved = clone(row);
  for (const key of ["xy", "scrollXy", "cameraXy", "scroll_xy", "camera_xy"]) {
    if (Array.isArray(moved[key])) {
      moved[key] = adjustPair(moved[key], offset, pixelStep);
    }
  }
  if (Array.isArray(moved.door) && moved.door.length === 3) {
    moved.door = [moved.door[0], ...adjustPair(moved.door.slice(1), offset, pixelStep / 16)];
  }
  if (Array.isArray(moved.xy)) {
    moved.pixelX = moved.xy[0];
    moved.pixelY = moved.xy[1];
  }
  return moved;
}

/**
 * Clone JSON-compatible metadata rows without sharing sidecar objects.
 */
export function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

/**
 * Read x/y from either normalized object rows or compiler YAML list rows.
 */
function rowGridPair(row) {
  if (Array.isArray(row)) {
    return [coordinate(row[0]), coordinate(row[1])];
  }
  return [coordinate(row?.x ?? row?.gridX), coordinate(row?.y ?? row?.gridY)];
}

/**
 * Adjust a named object coordinate pair when both fields are present.
 */
function adjustFieldPair(row, xKey, yKey, offset, step) {
  if (row[xKey] !== undefined) {
    row[xKey] = coordinate(row[xKey]) + (offset & 1 ? step : 0);
  }
  if (row[yKey] !== undefined) {
    row[yKey] = coordinate(row[yKey]) + (offset & 8 ? step : 0);
  }
}

/**
 * Add or subtract the child quadrant displacement from a coordinate pair.
 */
function adjustPair(pair, offset, step) {
  return [
    coordinate(pair[0]) + (offset & 1 ? step : 0),
    coordinate(pair[1]) + (offset & 8 ? step : 0),
  ];
}

/**
 * Parse patch-friendly numeric values before arithmetic to avoid string concatenation.
 */
function coordinate(value) {
  if (Number.isFinite(value)) {
    return value;
  }
  const match = String(value ?? "").trim().match(/^([+-]?)(?:0x([0-9a-f]+)|(\d+))$/i);
  if (!match) {
    return 0;
  }
  const sign = match[1] === "-" ? -1 : 1;
  return sign * Number.parseInt(match[2] ?? match[3], match[2] ? 16 : 10);
}
