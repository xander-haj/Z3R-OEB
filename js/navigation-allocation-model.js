/**
 * Fixed-slot allocation rules for overworld navigation metadata.
 */

import { parseNumber } from "./operations.js?v=20260621-render-restore20";
import {
  areaMax as dataAreaMax,
  birdTravelCapacity,
  firstFreeAllocation,
  slotMaxForType,
  specialRoomMax,
} from "./navigation-allocation-capacity.js?v=20260625-editor-db";

export const LISTS = { travel: "travel", entrance: "entrances", hole: "holes", exit: "exits", special: "exits" };

/**
 * Return a mutable navigation list, creating containers when requested.
 */
export function navigationList(state, area, listName, create = false) {
  const header = state?.sourceData?.areaHeaders?.[area];
  if (!header) {
    return null;
  }
  if (create) {
    header.navigation = header.navigation || { travel: [], entrances: [], holes: [], exits: [] };
    header.navigation[listName] = header.navigation[listName] || [];
  }
  return header.navigation?.[listName] || null;
}

/**
 * Return selected navigation markers only.
 */
export function navigationSelection(info) {
  return info?.kind === "interaction" && ["travel", "entrances", "holes", "exits"].includes(info.navigationList) ?
    info : null;
}

/**
 * Clone the backing row for a selected marker.
 */
export function navigationRecord(state, selection) {
  const list = navigationList(state, selection.area, selection.navigationList);
  const record = list?.[selection.navigationIndex];
  return record ? clone(record) : null;
}

/**
 * Find a deleted fixed-slot row that can be reused for an Add operation.
 */
export function deletedSlotLocation(state, type, slot) {
  const listName = LISTS[type === "special" ? "exit" : type];
  const keyType = type === "special" ? "exit" : type;
  for (const [area, header] of (state?.sourceData?.areaHeaders || []).entries()) {
    for (const [index, row] of (header?.navigation?.[listName] || []).entries()) {
      if (row.deleted && keyForType(keyType, row) === slot) {
        return { area, index, value: clone(row), listName };
      }
    }
  }
  return null;
}

/**
 * Resolve the selected area from tile or interaction selections.
 */
export function targetArea(state, info) {
  if (Number.isFinite(info?.area)) {
    return clamp(info.area, 0, areaMax(state));
  }
  return Number.isFinite(state?.selected?.area) ? clamp(state.selected.area, 0, areaMax(state)) : null;
}

/**
 * Return the allocation type represented by a selected marker.
 */
export function typeForSelection(selection, record) {
  if (selection.navigationList === "travel") {
    return "travel";
  }
  if (selection.navigationList === "entrances") {
    return "entrance";
  }
  if (selection.navigationList === "holes") {
    return "hole";
  }
  return record.specialExit ? "special" : "exit";
}

/**
 * Return a copy of the selected record only when its list can back this type.
 */
export function selectedCompatibleRecord(state, selection, type) {
  if (!selection || selection.navigationList !== LISTS[type]) {
    return null;
  }
  return navigationRecord(state, selection);
}

/**
 * Build one allocation request from form values.
 */
export function allocationRequest(fields, forcedArea = null, state = null) {
  const type = fields.navAllocTypeInput.value;
  const area = forcedArea ?? clampNumber(fields.navAllocAreaInput.value, 0, areaMax(state));
  return {
    area,
    birdTravelCapacity: birdTravelCapacity(state),
    type,
    slot: clampNumber(fields.navAllocSlotInput.value, 0, slotMax(type, state)),
    room: clampNumber(fields.navAllocRoomInput.value, 0x180, specialRoomMax(state)),
  };
}

/**
 * Return the slot/source value shown in the allocation input.
 */
export function slotValue(state, type, record) {
  if (!record) {
    return firstFree(state, type === "special" ? "exit" : type);
  }
  if (type === "travel") {
    return record.birdTravelId ?? record.whirlpoolSrcArea ?? firstFree(state, type);
  }
  return record.index ?? firstFree(state, type === "special" ? "exit" : type);
}

/**
 * Return the special room shown in the room input.
 */
export function roomValue(state, type, record) {
  if (type === "special") {
    return record?.room ?? firstFree(state, "special");
  }
  return record?.room ?? 0;
}

/**
 * Apply slot/source/room fields to one normalized navigation record.
 */
export function recordForAllocation(record, request) {
  const result = clone(record);
  if (request.type === "travel" && result.whirlpoolSrcArea === undefined) {
    if (request.slot >= request.birdTravelCapacity) {
      throw new Error(`Bird travel slots must be 0..${request.birdTravelCapacity - 1}`);
    }
    result.birdTravelId = request.slot;
    result.displayName = `Bird travel ${request.slot}`;
    result.sourceTable = "kBirdTravel_*";
  } else if (request.type === "travel") {
    result.whirlpoolSrcArea = request.slot;
    result.displayName = `Whirlpool from area ${hex(request.slot, 2)}`;
    result.sourceTable = "kBirdTravel_* / kWhirlpoolAreas";
  }
  if (request.type === "entrance") {
    result.index = request.slot;
    result.displayName = `Entrance ${request.slot} -> ${result.entranceId}`;
  }
  if (request.type === "hole") {
    result.index = request.slot;
    result.displayName = `Fall hole ${request.slot} -> ${result.entranceId}`;
  }
  if (request.type === "exit" || request.type === "special") {
    result.index = request.slot;
    result.room = request.type === "special" ? request.room : result.room;
    if (request.type === "special" && !result.specialExit) {
      throw new Error("Select an existing special-exit row before allocating a special room");
    }
    result.displayName = `Exit ${result.index} from room ${result.room}`;
    result.sourceTable = result.specialExit ? "kExitData_* / kSpExit_*" : "kExitData_*";
  }
  return result;
}

/**
 * Reject duplicate fixed slots before the patch reaches Python validation.
 */
export function allocationError(state, request, record, currentSelection) {
  try {
    duplicateCheck(state, request, record, currentSelection);
  } catch (error) {
    return error.message;
  }
  return null;
}

/**
 * Create a valid entrance or fall-hole row from the selected map tile target.
 */
export function defaultGridRecord(state, request) {
  const coord = tileTargetCoord(state, state?.selected, request.type);
  const entranceId = 0;
  if (request.type === "hole") {
    return withGridDisplay({ index: request.slot, x: coord.x, y: Math.max(8, coord.y), entranceId }, "hole");
  }
  return withGridDisplay({ index: request.slot, x: coord.x, y: coord.y, entranceId }, "entrance");
}

/**
 * Keep grid rows inside the target area's topology bounds when moved.
 */
export function clampRecordToArea(state, record, area) {
  const result = clone(record);
  const limits = coordLimits(state?.sourceData?.areaHeaders?.[area]);
  if (result.x !== undefined) {
    result.x = clamp(result.x, 0, limits.x);
    result.y = clamp(result.y, result.type === "hole" ? 8 : 0, limits.y);
    result.gridX = result.x;
    result.gridY = result.y;
  }
  return result;
}

/**
 * Return the highest legal slot/source value for one type.
 */
export function slotMax(type, state = null) {
  return slotMaxForType(state, type);
}

/**
 * Return the highest legal overworld area id.
 *
 * Parameters:
 *   state: Shared Workbench state containing editorDb.
 * Returns:
 *   Maximum overworld area id.
 */
export function areaMax(state = null) {
  return dataAreaMax(state);
}

/**
 * Parse and clamp a numeric control value.
 */
export function clampNumber(value, min, max) {
  return clamp(parseNumber(value), min, max);
}

/**
 * Format a numeric value as uppercase hex.
 */
export function hex(value, width) {
  return `0x${Number(value).toString(16).toUpperCase().padStart(width, "0")}`;
}

/**
 * Throw when a requested slot/source/room already belongs to another row.
 */
function duplicateCheck(state, request, record, currentSelection) {
  if (request.type === "special") {
    rejectUsed(state, "exit", record.index, currentSelection, "exit");
    rejectUsed(state, "special", record.room, currentSelection, "special room");
    return;
  }
  if (request.type === "hole") {
    rejectUsed(state, "hole", record.index, currentSelection, "fall-hole");
    return;
  }
  rejectUsed(state, request.type, keyForType(request.type, record), currentSelection, request.type);
}

/**
 * Reject one duplicate key after excluding the row currently being edited.
 */
function rejectUsed(state, type, key, currentSelection, label) {
  if (usedNavigationKeys(state, type, currentSelection).has(key)) {
    throw new Error(`${label} slot/source ${key} is already allocated`);
  }
}

/**
 * Return all allocated keys for one fixed-slot family, excluding the edited row.
 */
function usedNavigationKeys(state, type, currentSelection) {
  const used = new Set();
  for (const [area, header] of (state?.sourceData?.areaHeaders || []).entries()) {
    for (const [index, row] of (header?.navigation?.[LISTS[type]] || []).entries()) {
      if (currentSelection?.area === area &&
          currentSelection?.navigationList === LISTS[type] &&
          currentSelection?.navigationIndex === index) {
        continue;
      }
      if (row.deleted) {
        continue;
      }
      used.add(keyForType(type, row));
    }
  }
  return used;
}

/**
 * Resolve the key that must be unique for one navigation type.
 */
function keyForType(type, row) {
  if (type === "travel") {
    return row.birdTravelId ?? `w${row.whirlpoolSrcArea}`;
  }
  if (type === "entrance" || type === "hole" || type === "exit") {
    return row.index;
  }
  if (type === "special") {
    return row.room;
  }
  return `${row.x},${row.y},${row.entranceId}`;
}

/**
 * Find the first free slot/source for one allocation type.
 */
function firstFree(state, type) {
  const used = usedNavigationKeys(state, type, null);
  return firstFreeAllocation(state, type, used);
}

/**
 * Convert a selected map tile into area-local 16px navigation coordinates.
 */
function tileTargetCoord(state, info, type) {
  if (info?.kind !== "tile") {
    return { x: 0, y: type === "hole" ? 8 : 0 };
  }
  const group = state.group;
  const screenOffset = info.screen - group.base;
  const areaOffset = info.area - group.base;
  const dx = screenOffset % group.columns - areaOffset % group.columns;
  const dy = Math.floor(screenOffset / group.columns) - Math.floor(areaOffset / group.columns);
  const limits = coordLimits(state.sourceData?.areaHeaders?.[info.area]);
  return {
    x: clamp(info.map16X + dx * 32, 0, limits.x),
    y: clamp(info.map16Y + dy * 32, type === "hole" ? 8 : 0, limits.y),
  };
}

/**
 * Return x/y coordinate bounds for small, wide, tall, or big maps.
 */
function coordLimits(header) {
  const size = header?.size;
  return {
    x: size === "big" || size === "wide" ? 63 : 31,
    y: size === "big" || size === "tall" ? 63 : 31,
  };
}

/**
 * Add display fields expected by overlays to a grid navigation row.
 */
function withGridDisplay(row, type) {
  if (type === "hole") {
    return {
      ...row,
      gridX: row.x,
      gridY: row.y,
      type,
      displayName: `Fall hole ${row.index} -> ${row.entranceId}`,
    };
  }
  return { ...row, gridX: row.x, gridY: row.y, type, displayName: `Entrance ${row.index} -> ${row.entranceId}` };
}

/**
 * Clamp a number to an inclusive range.
 */
function clamp(value, min, max) {
  const safe = Number.isFinite(value) ? value : min;
  return Math.max(min, Math.min(max, safe));
}

/**
 * Clone JSON-compatible navigation metadata.
 */
function clone(value) {
  return JSON.parse(JSON.stringify(value));
}
