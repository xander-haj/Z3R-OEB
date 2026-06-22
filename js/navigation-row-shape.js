/**
 * Shape conversion helpers for overworld navigation YAML and editor rows.
 */

import { normalizeSpecialExit, toYamlSpecialExit } from "./special-exit-shape.js?v=20260621-render-restore20";

/**
 * Convert YAML-shaped navigation rows to the normalized editor shape.
 */
export function normalizeNavigationList(listName, rows) {
  return (rows || []).map((row, rowIndex) => normalizeNavigationRow(listName, row, rowIndex));
}

/**
 * Normalize one YAML navigation row with the right fixed-slot fallback.
 */
export function normalizeNavigationRow(listName, row, index) {
  return { travel: normalizeTravel, entrances: normalizeEntrance, holes: normalizeHole, exits: normalizeExit }[
    listName](row, index);
}

/**
 * Convert normalized editor rows back into the extracted YAML structure.
 */
export function toYamlNavigationList(listName, rows) {
  return (rows || []).map((row) => {
    if (row.deleted && listName !== "travel") {
      return { index: numeric(row.index), deleted: true };
    }
    if (listName === "travel") {
      return yamlTravel(row);
    }
    if (listName === "exits") {
      return yamlExit(row);
    }
    return yamlGridDestination(row);
  });
}

/**
 * Parse decimal, hex, or numeric input into a finite integer.
 */
export function numeric(value, fallback = 0) {
  if (Number.isInteger(value)) {
    return value;
  }
  const match = String(value ?? "").trim().match(/^([+-]?)(?:0x([0-9a-f]+)|(\d+))$/i);
  if (!match) {
    return fallback;
  }
  const sign = match[1] === "-" ? -1 : 1;
  return sign * Number.parseInt(match[2] ?? match[3], match[2] ? 16 : 10);
}

/**
 * Clone JSON-compatible navigation metadata.
 */
export function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

/**
 * Normalize one bird or whirlpool travel row while preserving its slot identity.
 */
function normalizeTravel(row) {
  const birdTravelId = row.bird_travel_id ?? row.birdTravelId;
  const whirlpoolSrcArea = row.whirlpool_src_area ?? row.whirlpoolSrcArea;
  return {
    ...(birdTravelId !== undefined ? { birdTravelId: numeric(birdTravelId) } : {}),
    ...(whirlpoolSrcArea !== undefined ? { whirlpoolSrcArea: numeric(whirlpoolSrcArea) } : {}),
    xy: pair(row.xy),
    scrollXy: pair(row.scroll_xy ?? row.scrollXy),
    cameraXy: pair(row.camera_xy ?? row.cameraXy),
    loadXy: pair(row.load_xy ?? row.loadXy),
    unk: pair(row.unk),
    pixelX: pair(row.xy)[0],
    pixelY: pair(row.xy)[1],
    type: birdTravelId !== undefined ? "bird_travel" : "whirlpool",
    displayName: travelDisplayName(birdTravelId, whirlpoolSrcArea),
    source: "metadata.travel patch",
    sourceTable: birdTravelId !== undefined ? "kBirdTravel_*" : "kBirdTravel_* / kWhirlpoolAreas",
  };
}

/**
 * Normalize one entrance row while preserving the slot and target entrance id.
 */
function normalizeEntrance(row) {
  const index = numeric(row.index);
  if (row.deleted) {
    return deletedNavigationRow(index, "entrance", `Entrance ${index} DELETED`, "kOverworld_Entrance_*");
  }
  const entranceId = numeric(row.entrance_id ?? row.entranceId);
  const x = numeric(row.x);
  const y = numeric(row.y);
  return {
    index, x, y, entranceId, gridX: x, gridY: y, type: "entrance",
    displayName: `Entrance ${index} -> ${entranceId}`,
    source: "metadata.entrance patch",
    sourceTable: "kOverworld_Entrance_*",
  };
}

/**
 * Normalize one fall-hole row while preserving the destination entrance id.
 */
function normalizeHole(row, rowIndex = 0) {
  const index = numeric(row.index, rowIndex);
  if (row.deleted) {
    return deletedNavigationRow(index, "hole", `Fall hole ${index} DELETED`, "kFallHole_*");
  }
  const entranceId = numeric(row.entrance_id ?? row.entranceId);
  const x = numeric(row.x);
  const y = numeric(row.y);
  return {
    index, x, y, entranceId, gridX: x, gridY: y, type: "hole",
    displayName: `Fall hole ${index} -> ${entranceId}`,
    source: "metadata.hole patch",
    sourceTable: "kFallHole_*",
  };
}

/**
 * Normalize one dungeon exit row while preserving optional door and special-exit payloads.
 */
function normalizeExit(row) {
  const index = numeric(row.index);
  if (row.deleted) {
    return deletedNavigationRow(index, "exit", `Exit ${index} DELETED`, "kExitData_*");
  }
  const room = numeric(row.room);
  const specialExit = normalizeSpecialExit(row.special_exit ?? row.specialExit);
  return {
    index, room, xy: pair(row.xy), scrollXy: pair(row.scroll_xy ?? row.scrollXy),
    cameraXy: pair(row.camera_xy ?? row.cameraXy), loadXy: pair(row.load_xy ?? row.loadXy),
    unk: pair(row.unk), ...(row.door ? { door: clone(row.door) } : {}),
    ...(specialExit ? { specialExit } : {}), pixelX: pair(row.xy)[0], pixelY: pair(row.xy)[1],
    type: "exit", displayName: `Exit ${index} from room ${room}`,
    source: "metadata.exit patch",
    sourceTable: row.special_exit || row.specialExit ? "kExitData_* / kSpExit_*" : "kExitData_*",
  };
}

/**
 * Convert a travel row to compiler YAML keys.
 */
function yamlTravel(row) {
  return {
    ...(row.birdTravelId !== undefined ? { bird_travel_id: numeric(row.birdTravelId) } : {}),
    ...(row.whirlpoolSrcArea !== undefined ? { whirlpool_src_area: numeric(row.whirlpoolSrcArea) } : {}),
    xy: pair(row.xy), scroll_xy: pair(row.scrollXy), camera_xy: pair(row.cameraXy),
    load_xy: pair(row.loadXy), unk: pair(row.unk),
  };
}

/**
 * Convert an entrance or hole row to compiler YAML keys.
 */
function yamlGridDestination(row) {
  return {
    index: numeric(row.index),
    x: numeric(row.x ?? row.gridX),
    y: numeric(row.y ?? row.gridY),
    entrance_id: numeric(row.entranceId),
  };
}

/**
 * Convert an exit row to compiler YAML keys, including optional special payloads.
 */
function yamlExit(row) {
  return {
    index: numeric(row.index), room: numeric(row.room), xy: pair(row.xy),
    scroll_xy: pair(row.scrollXy), camera_xy: pair(row.cameraXy), load_xy: pair(row.loadXy),
    unk: pair(row.unk), ...(row.door ? { door: clone(row.door) } : {}),
    ...(row.specialExit ? { special_exit: toYamlSpecialExit(row.specialExit) } : {}),
  };
}

/**
 * Return the user-facing transport identity label for a travel row.
 */
function travelDisplayName(birdTravelId, whirlpoolSrcArea) {
  if (birdTravelId !== undefined) {
    return `Bird travel ${numeric(birdTravelId)}`;
  }
  const area = numeric(whirlpoolSrcArea).toString(16).toUpperCase().padStart(2, "0");
  return `Whirlpool from area 0x${area}`;
}

/**
 * Normalize a two-number YAML tuple.
 */
function pair(value) {
  return [numeric(value?.[0]), numeric(value?.[1])];
}

/**
 * Return an editor row for a deleted fixed navigation slot.
 */
function deletedNavigationRow(index, type, displayName, sourceTable) {
  return { index, deleted: true, type, displayName, source: "metadata deleted slot", sourceTable };
}
