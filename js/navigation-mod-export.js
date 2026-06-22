/**
 * Navigation metadata editing and sparse patch export for grid-based overworld entities.
 */

import { applyCommand } from "./operations.js?v=20260621-render-restore20";
import {
  clone,
  normalizeNavigationList,
  normalizeNavigationRow,
  numeric,
  toYamlNavigationList,
} from "./navigation-row-shape.js?v=20260621-render-restore20";

const FORMAT = "zelda3-overworld-metadata-v1";
const EDITABLE_LAYER_LISTS = {
  entrancePoints: "entrances",
  holePoints: "holes",
};
const YAML_PATHS = { travel: "Travel", entrances: "Entrances", holes: "Holes", exits: "Exits" };
const PATCH_KINDS = {
  travel: "metadata.travel", entrances: "metadata.entrance", holes: "metadata.hole", exits: "metadata.exit",
};

export function snapshotNavigation(sourceData) {
  return (sourceData?.areaHeaders || []).map((header) => ({
    travel: toYamlNavigationList("travel", header?.navigation?.travel || []),
    entrances: toYamlNavigationList("entrances", header?.navigation?.entrances || []),
    holes: toYamlNavigationList("holes", header?.navigation?.holes || []),
    exits: toYamlNavigationList("exits", header?.navigation?.exits || []),
  }));
}

export function applyNavigationPatchDocument(sourceData, document) {
  for (const operation of document?.patches || []) {
    const listName = listNameFromOperation(operation);
    if (!listName) {
      continue;
    }
    const area = numeric(operation.area ?? operation.screen);
    const header = sourceData?.areaHeaders?.[area];
    if (!header) {
      continue;
    }
    header.navigation = header.navigation || { travel: [], entrances: [], holes: [], exits: [] };
    applyNavigationOperation(header.navigation, listName, operation);
  }
}

export function exportNavigationPatch(base, sourceData, existing) {
  const patches = (existing?.patches || []).filter((operation) => {
    const listName = listNameFromOperation(operation);
    return !PATCH_KINDS[listName];
  });
  for (let area = 0; area < (sourceData?.areaHeaders || []).length; area += 1) {
    appendListPatch(patches, base, sourceData.areaHeaders[area], area, "travel");
    appendListPatch(patches, base, sourceData.areaHeaders[area], area, "entrances");
    appendListPatch(patches, base, sourceData.areaHeaders[area], area, "holes");
    appendListPatch(patches, base, sourceData.areaHeaders[area], area, "exits");
  }
  return { format: FORMAT, patches };
}

/**
 * Return the selected marker when paint mode can move it.
 *
 * Parameters:
 *   state: Shared Workbench state.
 * Returns:
 *   Selected navigation marker, or null.
 */
export function selectedNavigationMove(state) {
  const selected = state?.selected;
  const listName = EDITABLE_LAYER_LISTS[selected?.layer];
  return selected?.kind === "interaction" && listName ? selected : null;
}

/**
 * Move the selected entrance or hole marker to a paint-mode target.
 *
 * Parameters:
 *   state: Shared Workbench state.
 *   selection: Marker returned by selectedNavigationMove.
 *   info: Tile inspection info at the right-click target.
 *   worldPoint: Pointer location in rendered group-space pixels.
 *   actions: Status and render callbacks.
 * Returns:
 *   None.
 */
export function paintNavigationSelection(state, selection, info, worldPoint, actions) {
  const move = createNavigationMoveCommand(state, selection, info, worldPoint);
  if (move.error) {
    actions.setStatus(move.error);
    return;
  }
  applyCommand(state.history, state, move.command);
  syncSelectedMarker(selection, move.command.after);
  actions.setStatus(`Moved ${selection.category} to ${move.command.after.x},${move.command.after.y}`);
  actions.rerender();
}

/**
 * Build an undoable move command without mutating source data.
 *
 * Parameters mirror paintNavigationSelection.
 * Returns:
 *   Object with command, or object with error.
 */
function createNavigationMoveCommand(state, selection, info, worldPoint) {
  const listName = EDITABLE_LAYER_LISTS[selection?.layer];
  const area = numeric(info?.area ?? info?.screen, -1);
  if (!listName || area !== selection?.area) {
    return { error: "Move entrance and hole markers within their current area" };
  }
  const header = state.sourceData?.areaHeaders?.[selection.area];
  const list = header?.navigation?.[listName] || [];
  const before = list[selection.navigationIndex];
  if (!before) {
    return { error: "Selected navigation marker is no longer available" };
  }
  const grid = pointToAreaGrid(header, selection, worldPoint, listName);
  if (before.x === grid.x && before.y === grid.y) {
    return { error: `Marker is already at ${grid.x},${grid.y}` };
  }
  const after = { ...before, x: grid.x, y: grid.y, gridX: grid.x, gridY: grid.y };
  return {
    command: {
      kind: "metadata.move-navigation",
      area: selection.area,
      list: listName,
      index: selection.navigationIndex,
      before: clone(before),
      after: clone(after),
    },
  };
}

/**
 * Convert a rendered point to the area-local 16px grid used by entrance and hole metadata.
 */
function pointToAreaGrid(header, selection, worldPoint, listName) {
  const size = header?.size;
  const xMax = size === "big" || size === "wide" ? 63 : 31, yMax = size === "big" || size === "tall" ? 63 : 31;
  const minY = listName === "holes" ? 8 : 0;
  return {
    x: clamp(Math.floor((worldPoint.x - selection.originX) / 16), 0, xMax),
    y: clamp(Math.floor((worldPoint.y - selection.originY) / 16), minY, yMax),
  };
}

/**
 * Append one changed navigation list to the outgoing patch list.
 */
function appendListPatch(patches, base, header, area, listName) {
  const current = toYamlNavigationList(listName, header?.navigation?.[listName] || []);
  const original = base?.[area]?.[listName] || [];
  if (JSON.stringify(current) === JSON.stringify(original)) {
    return;
  }
  patches.push({
    kind: PATCH_KINDS[listName],
    area,
    path: [YAML_PATHS[listName]],
    value: current,
  });
}

/**
 * Determine which navigation list a metadata operation edits.
 */
function listNameFromOperation(operation) {
  const pathKey = Array.isArray(operation?.path) ? operation.path[0] : operation?.path;
  if (pathKey && !Object.values(YAML_PATHS).includes(pathKey)) {
    return null;
  }
  if ((!pathKey && operation?.kind === "metadata.travel") || pathKey === "Travel") {
    return "travel";
  }
  if ((!pathKey && operation?.kind === "metadata.entrance") || pathKey === "Entrances") {
    return "entrances";
  }
  if ((!pathKey && operation?.kind === "metadata.hole") || pathKey === "Holes") {
    return "holes";
  }
  if ((!pathKey && operation?.kind === "metadata.exit") || pathKey === "Exits") {
    return "exits";
  }
  return null;
}

/**
 * Apply a whole-list, row, or nested navigation patch to normalized source data.
 */
function applyNavigationOperation(navigation, listName, operation) {
  const path = Array.isArray(operation.path) ? operation.path : [YAML_PATHS[listName]];
  navigation[listName] = navigation[listName] || [];
  if (path.length <= 1) {
    navigation[listName] = normalizeNavigationList(listName, navigationListValue(listName, operation.value));
    return;
  }
  const index = navigationRowIndex(listName, path[1]);
  const current = existingNavigationRow(navigation, listName, index);
  if (path.length === 2) {
    navigation[listName][index] = normalizeNavigationRow(
      listName, navigationRowValue(listName, operation.value), index);
  } else {
    const row = toYamlNavigationList(listName, [current])[0];
    setNestedValue(row, path.slice(2), operation.value, listName, index);
    navigation[listName][index] = normalizeNavigationRow(listName, row, index);
  }
}

/**
 * Validate a whole-list replacement before normalizing it.
 */
function navigationListValue(listName, value) {
  const rows = value == null ? [] : value;
  if (!Array.isArray(rows)) {
    throw new Error(`${YAML_PATHS[listName]} patch value must be a list`);
  }
  return rows;
}

/**
 * Validate a whole-row replacement before normalizing it.
 */
function navigationRowValue(listName, value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${YAML_PATHS[listName]} row patch value must be an object`);
  }
  return value;
}

/**
 * Resolve a patch row index without allowing sparse array writes.
 */
function navigationRowIndex(listName, value) {
  const index = numeric(value, -1);
  if (!Number.isInteger(index) || index < 0) {
    throw new Error(`${YAML_PATHS[listName]} patch row index is invalid`);
  }
  return index;
}

/**
 * Return an existing row or reject the operation like yaml_patch.py indexing would.
 */
function existingNavigationRow(navigation, listName, index) {
  const row = navigation[listName]?.[index];
  if (!row) {
    throw new Error(`${YAML_PATHS[listName]} row ${index} does not exist`);
  }
  return row;
}

/**
 * Set a nested value using the same path semantics as yaml_patch.py.
 */
function setNestedValue(target, path, value, listName, index) {
  if (!path.length) {
    return;
  }
  let current = target;
  for (const key of path.slice(0, -1)) {
    if (!current || typeof current !== "object" || !(key in current)) {
      throw new Error(`${YAML_PATHS[listName]} row ${index} path cannot descend through ${key}`);
    }
    current = current[key];
  }
  if (!current || typeof current !== "object") {
    throw new Error(`${YAML_PATHS[listName]} row ${index} path has no editable target`);
  }
  current[path[path.length - 1]] = value;
}

/**
 * Keep the current selection rectangle aligned after a successful move.
 */
function syncSelectedMarker(selection, entry) {
  selection.gridX = entry.gridX ?? entry.x;
  selection.gridY = entry.gridY ?? entry.y;
  selection.x = selection.originX + selection.gridX * 16 + 8;
  selection.y = selection.originY + selection.gridY * 16 + 8;
  selection.centerX = selection.x;
  selection.centerY = selection.y;
  selection.pixelX = null;
  selection.pixelY = null;
}

/**
 * Clamp a coordinate to the local editable bounds.
 */
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
