/**
 * Presentation layout for interaction labels that should not cover their anchor point.
 */

import { markerFrameWidth } from "./interaction-marker-visual.js?v=20260625-dice-icon-only";

const LABEL_LAYERS = new Set([
  "entrancePoints", "exitPoints", "holePoints", "secretEnemies", "secretEntrances",
  "secretTreasure", "shovelSpots", "travelPoints",
]);
const DEFAULT_OFFSETS = {
  entrancePoints: [0, -28],
  exitPoints: [0, 28],
  holePoints: [0, -28],
  travelPoints: [0, 28],
};
const LABEL_SPREAD = 64;

/**
 * Return records with display-space label positions and hit bounds.
 *
 * Parameters:
 *   records: Visible interaction records from interaction-overlay.js.
 * Returns:
 *   Records safe for drawing and hit-testing.
 */
export function layoutInteractionMarkers(records) {
  const laidOut = records.map(layoutRecord);
  for (const group of exactPositionGroups(laidOut)) {
    spreadExactOverlap(group);
  }
  return laidOut;
}

function layoutRecord(record) {
  if (record.renderable || !LABEL_LAYERS.has(record.layer)) {
    return record;
  }
  const [dx, dy] = DEFAULT_OFFSETS[record.layer] || [0, 0];
  return moveLabel(record, record.x + dx, record.y + dy);
}

function exactPositionGroups(records) {
  const groups = new Map();
  for (const record of records) {
    if (record.renderable || !LABEL_LAYERS.has(record.layer)) {
      continue;
    }
    const key = `${Math.round(record.x)}:${Math.round(record.y)}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(record);
  }
  return groups.values();
}

function spreadExactOverlap(group) {
  if (group.length < 2) {
    return;
  }
  const start = (group.length - 1) / 2;
  for (let index = 0; index < group.length; index += 1) {
    const record = group[index];
    const x = record.x + (index - start) * LABEL_SPREAD;
    Object.assign(record, moveLabel(record, x, record.y));
  }
}

function moveLabel(record, x, y) {
  return {
    ...record,
    anchorX: record.anchorX ?? record.x,
    anchorY: record.anchorY ?? record.y,
    bounds: markerBounds(record, x, y),
    centerX: x,
    centerY: y,
    x,
    y,
  };
}

function markerBounds(record, x, y) {
  const width = markerFrameWidth(record);
  return { x: x - width / 2, y: y - 8, width, height: 16 };
}
