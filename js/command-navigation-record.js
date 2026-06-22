/**
 * Undo/redo helpers for overworld navigation metadata commands.
 */

/**
 * Apply a grid-marker move inside one navigation list.
 *
 * Parameters:
 *   target: Parsed source data or shared Workbench state.
 *   command: metadata.move-navigation command.
 *   direction: "undo" restores the before row, "redo" writes the after row.
 * Returns:
 *   None.
 */
export function applyNavigationMoveCommand(target, command, direction) {
  const sourceData = resolveSourceData(target);
  const list = sourceData?.areaHeaders?.[command.area]?.navigation?.[command.list];
  if (!list || !list[command.index]) {
    return;
  }
  const value = clone(direction === "undo" ? command.before : command.after);
  list[command.index] = value;
  syncSelectedNavigation(target, command, value, {
    area: command.area,
    index: command.index,
  });
}

/**
 * Apply a navigation replacement, insertion, deletion, or area move.
 *
 * Parameters:
 *   target: Parsed source data or shared Workbench state.
 *   command: metadata.set-navigation-record command.
 *   direction: "undo" or "redo".
 * Returns:
 *   None.
 */
export function applyNavigationRecordCommand(target, command, direction) {
  const action = command.action || "replace";
  if (action === "insert") {
    applyNavigationInsert(target, command, direction);
    return;
  }
  if (action === "delete") {
    applyNavigationDelete(target, command, direction);
    return;
  }
  if (action === "move-area") {
    applyNavigationAreaMove(target, command, direction);
    return;
  }
  applyNavigationReplace(target, command, direction);
}

/**
 * Replace one existing navigation row in place.
 */
function applyNavigationReplace(target, command, direction) {
  const list = navigationList(target, command.area, command.list);
  if (!list || !list[command.index]) {
    return;
  }
  const value = clone(direction === "undo" ? command.before : command.after);
  list[command.index] = value;
  syncSelectedNavigation(target, command, value, {
    area: command.area,
    index: command.index,
  });
}

/**
 * Insert or undo-insert one navigation row.
 */
function applyNavigationInsert(target, command, direction) {
  const list = navigationList(target, command.area, command.list, true);
  if (!list) {
    return;
  }
  if (direction === "redo") {
    list.splice(clampIndex(command.index, list.length), 0, clone(command.after));
  } else {
    list.splice(command.index, 1);
    clearDeletedSelection(target, command.area, command.list, command.index);
  }
}

/**
 * Delete or undo-delete one navigation row.
 */
function applyNavigationDelete(target, command, direction) {
  const list = navigationList(target, command.area, command.list);
  if (!list || !list[command.index]) {
    return;
  }
  if (direction === "undo") {
    list[command.index] = clone(command.before);
    syncSelectedNavigation(target, command, command.before, {
      area: command.area,
      index: command.index,
    });
  } else {
    list[command.index] = clone(command.after);
    clearDeletedSelection(target, command.area, command.list, command.index);
  }
}

/**
 * Move a row between area-owned navigation lists while preserving its slot identity.
 */
function applyNavigationAreaMove(target, command, direction) {
  const from = direction === "redo" ? command.from : command.to;
  const to = direction === "redo" ? command.to : command.from;
  const fromList = navigationList(target, from.area, command.list);
  const toList = navigationList(target, to.area, command.list, true);
  if (!fromList || !toList || !fromList[from.index]) {
    return;
  }
  fromList.splice(from.index, 1);
  toList.splice(clampIndex(to.index, toList.length), 0, clone(to.value));
  syncSelectedNavigation(target, command, to.value, {
    area: to.area,
    index: clampIndex(to.index, toList.length - 1),
  });
}

/**
 * Return a mutable navigation list, creating containers when requested.
 */
function navigationList(target, area, listName, create = false) {
  const sourceData = resolveSourceData(target);
  const header = sourceData?.areaHeaders?.[area];
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
 * Keep a selected navigation marker aligned when undo or redo changes it.
 */
function syncSelectedNavigation(target, command, value, location) {
  const selected = target?.selected;
  if (selected?.kind !== "interaction" || selected.navigationList !== command.list) {
    return;
  }
  if (!selectionMatchesCommand(selected, command, location)) {
    return;
  }
  selected.area = location.area;
  selected.navigationIndex = location.index;
  selected.gridX = value.gridX ?? value.x;
  selected.gridY = value.gridY ?? value.y;
  selected.code = value.index ?? value.entranceId ?? value.room ?? selected.code;
  selected.displayName = value.displayName || selected.displayName;
  selected.id = String(value.index ?? value.entranceId ?? value.room ?? selected.id);
  selected.name = selected.displayName;
  selected.x = selected.originX + (selected.gridX ?? 0) * 16 + 8;
  selected.y = selected.originY + (selected.gridY ?? 0) * 16 + 8;
  selected.centerX = selected.x;
  selected.centerY = selected.y;
  selected.pixelX = value.pixelX ?? value.xy?.[0] ?? null;
  selected.pixelY = value.pixelY ?? value.xy?.[1] ?? null;
  if (selected.pixelX !== null && selected.pixelY !== null) {
    selected.x = selected.originX + selected.pixelX;
    selected.y = selected.originY + selected.pixelY;
    selected.centerX = selected.x;
    selected.centerY = selected.y;
  }
}

/**
 * Match either in-place commands or the source side of a move-area command.
 */
function selectionMatchesCommand(selected, command, location) {
  if (command.action === "move-area") {
    return selected.area === command.from.area && selected.navigationIndex === command.from.index ||
      selected.area === location.area && selected.navigationIndex === location.index;
  }
  return selected.area === command.area && selected.navigationIndex === command.index;
}

/**
 * Clear selection when the selected row is removed from its list.
 */
function clearDeletedSelection(target, area, listName, index) {
  const selected = target?.selected;
  if (selected?.kind === "interaction" &&
      selected.area === area &&
      selected.navigationList === listName &&
      selected.navigationIndex === index) {
    target.selected = null;
  }
}

/**
 * Resolve sourceData from either the parsed sourceData object or shared app state.
 */
function resolveSourceData(target) {
  return target?.areaHeaders ? target : target?.sourceData;
}

/**
 * Clamp an insertion index to the valid array splice range.
 */
function clampIndex(index, length) {
  return Math.max(0, Math.min(index, length));
}

/**
 * Clone JSON-compatible navigation metadata.
 */
function clone(value) {
  return JSON.parse(JSON.stringify(value));
}
