/**
 * Command application helpers shared by undo and redo.
 */

import { applySpritePlacementCommand } from "./command-sprite-placement.js?v=20260621-render-restore20";
import { applySpriteInfoCommand } from "./command-sprite-info.js?v=20260621-render-restore20";
import { applySpecialVisualCommand } from "./command-special-visual.js?v=20260621-render-restore20";
import {
  applyNavigationMoveCommand,
  applyNavigationRecordCommand,
} from "./command-navigation-record.js?v=20260621-render-restore20";
import { applyHeaderValue } from "./header-mod-export.js?v=20260621-render-restore20";

/**
 * Apply one command in either undo or redo direction.
 *
 * Parameters:
 *   target: ZeldaAssets object or shared Workbench state.
 *   command: Command object to apply.
 *   direction: "undo" or "redo".
 * Returns:
 *   None.
 */
export function applyEdit(target, command, direction) {
  if (command.kind === "terrain.set-map32") {
    const value = direction === "undo" ? command.before : command.after;
    setCell(resolveAssets(target), command.screen, command.x, command.y, value);
    return;
  }
  if (command.kind === "terrain.set-map32-batch") {
    applyMap32BatchCommand(resolveAssets(target), command, direction);
    return;
  }
  if (command.kind === "sprite.add-placement" || command.kind === "metadata.set-sprite-placement") {
    applySpritePlacementCommand(resolveSourceData(target), command, direction);
    return;
  }
  if (command.kind === "metadata.move-navigation") {
    applyNavigationMoveCommand(target, command, direction);
    return;
  }
  if (command.kind === "metadata.set-navigation-record") {
    applyNavigationRecordCommand(target, command, direction);
    return;
  }
  if (command.kind === "metadata.set-item-record") {
    applyItemRecordCommand(target, command, direction);
    return;
  }
  if (command.kind === "metadata.set-static-overlay") {
    applyStaticOverlayCommand(target, command, direction);
    return;
  }
  if (command.kind === "metadata.set-special-visual") {
    applySpecialVisualCommand(resolveSourceData(target), command, direction);
    return;
  }
  if (command.kind === "metadata.set-header") {
    applyHeaderCommand(target, command, direction);
    return;
  }
  if (command.kind === "gravestone.set-record") {
    applyGravestoneCommand(target, command, direction);
    return;
  }
  if (command.kind === "metadata.set-sprite-info") {
    applySpriteInfoCommand(target, command, direction);
  }
}

function applyStaticOverlayCommand(target, command, direction) {
  const sourceData = resolveSourceData(target);
  const header = sourceData?.areaHeaders?.[command.area];
  if (!header) {
    return;
  }
  const list = header.staticOverlays || [];
  header.staticOverlays = list;
  const action = command.action || "replace";
  if (action === "insert") {
    if (direction === "redo") {
      list.splice(clampIndex(command.index, list.length), 0, clone(command.after));
    } else {
      list.splice(command.index, 1);
    }
    return;
  }
  if (action === "delete") {
    if (direction === "undo") {
      list.splice(clampIndex(command.index, list.length), 0, clone(command.before));
    } else {
      list.splice(command.index, 1);
    }
    return;
  }
  const index = adjustedStaticOverlayIndex(command);
  if (!list[index]) {
    return;
  }
  if (direction === "redo") {
    removeStaticOverlayConflict(list, command.conflict);
    if (list[index]) {
      list[index] = clone(command.after);
    }
    return;
  }
  if (list[index]) {
    list[index] = clone(command.before);
  }
  restoreStaticOverlayConflict(list, command.conflict);
}

function adjustedStaticOverlayIndex(command) {
  const conflictIndex = command.conflict?.index;
  return Number.isInteger(conflictIndex) && conflictIndex < command.index ?
    command.index - 1 : command.index;
}

function removeStaticOverlayConflict(list, conflict) {
  if (!conflict) {
    return;
  }
  const index = list.findIndex((row, rowIndex) => (
    rowIndex === conflict.index || sameStaticOverlayCoord(row, conflict.record)
  ));
  if (index >= 0) {
    list.splice(index, 1);
  }
}

function restoreStaticOverlayConflict(list, conflict) {
  if (!conflict) {
    return;
  }
  const index = clampIndex(conflict.index, list.length);
  list.splice(index, 0, clone(conflict.record));
}

function sameStaticOverlayCoord(left, right) {
  return left?.x === right?.x && left?.y === right?.y;
}

function applyGravestoneCommand(target, command, direction) {
  const sourceData = resolveSourceData(target);
  const records = sourceData?.gravestones?.records || [];
  if (!records[command.index]) {
    return;
  }
  const value = clone(direction === "undo" ? command.before : command.after);
  records[command.index] = value;
  syncSelectedGravestone(target, command, value);
}

/**
 * Apply a multi-cell terrain command in one undoable history entry.
 *
 * Parameters:
 *   assets: ZeldaAssets object.
 *   command: terrain.set-map32-batch command.
 *   direction: "undo" restores before values, "redo" writes after values.
 * Returns:
 *   None.
 */
function applyMap32BatchCommand(assets, command, direction) {
  for (const edit of command.edits || []) {
    const value = direction === "undo" ? edit.before : edit.after;
    setCell(assets, edit.screen, edit.x, edit.y, value);
  }
}

/**
 * Undo or redo one overworld secret item replacement.
 *
 * Parameters:
 *   target: Parsed source data or shared Workbench state.
 *   command: metadata.set-item-record command.
 *   direction: "undo" restores before, "redo" writes after.
 * Returns:
 *   None.
 */
function applyItemRecordCommand(target, command, direction) {
  const sourceData = resolveSourceData(target);
  const header = sourceData?.areaHeaders?.[command.area];
  if (!header) {
    return;
  }
  header.interactions = header.interactions || { items: [], shovelSpots: [] };
  const list = header.interactions.items || [];
  header.interactions.items = list;
  const action = command.action || "replace";
  if (action === "insert") {
    if (direction === "redo") {
      list.splice(clampIndex(command.index, list.length), 0, clone(command.after));
    } else {
      list.splice(command.index, 1);
    }
    return;
  }
  if (action === "delete") {
    if (direction === "undo") {
      list.splice(clampIndex(command.index, list.length), 0, clone(command.before));
    } else {
      list.splice(command.index, 1);
    }
    return;
  }
  if (!list[command.index]) {
    return;
  }
  const value = clone(direction === "undo" ? command.before : command.after);
  list[command.index] = value;
  syncSelectedItem(target, command, value);
}

/**
 * Undo or redo one overworld Header metadata edit.
 *
 * Parameters:
 *   target: Parsed source data or shared Workbench state.
 *   command: metadata.set-header command.
 *   direction: "undo" restores before, "redo" writes after.
 * Returns:
 *   None.
 */
function applyHeaderCommand(target, command, direction) {
  const sourceData = resolveSourceData(target);
  const value = clone(direction === "undo" ? command.before : command.after);
  applyHeaderValue(sourceData, command.area, value);
}

/**
 * Keep a selected secret item aligned after undo or redo changes it.
 *
 * Parameters:
 *   target: Shared Workbench state, when available.
 *   command: metadata.set-item-record command.
 *   value: Item row just written to source data.
 * Returns:
 *   None.
 */
function syncSelectedItem(target, command, value) {
  const selected = target?.selected;
  if (selected?.kind !== "interaction" ||
      selected.area !== command.area ||
      selected.interactionList !== "items" ||
      selected.interactionIndex !== command.index) {
    return;
  }
  selected.gridX = value.x;
  selected.gridY = value.y;
  selected.code = value.code;
  selected.name = value.name;
  selected.behavior = value.behavior || selected.behavior;
  selected.displayName = value.displayName || value.name;
  selected.ignoreProjectile = value.ignoreProjectile ?? null;
  selected.layer = value.layer || selected.layer;
  selected.oamFlags = value.oamFlags ?? null;
  selected.randomOptions = value.randomOptions || [];
  selected.runtimeNote = value.runtimeNote || null;
  selected.source = value.source || selected.source;
  selected.sourceTable = value.sourceTable || selected.sourceTable;
  selected.spawnAiState = value.spawnAiState ?? null;
  selected.x = selected.originX + value.x * 16 + 8 + (value.spawnXOffset || 0);
  selected.y = selected.originY + value.y * 16 + 8;
  selected.centerX = selected.x;
  selected.centerY = selected.y;
  selected.spawnXOffset = value.spawnXOffset || 0;
  selected.spriteGraphics = value.spriteGraphics ?? null;
  selected.spriteName = value.spriteName || null;
  selected.spriteType = value.spriteType ?? null;
  selected.zVelocity = value.zVelocity ?? null;
}

function syncSelectedGravestone(target, command, value) {
  const selected = target?.selected;
  if (selected?.layer !== "gravestones" || selected.gravestoneIndex !== command.index) {
    return;
  }
  Object.assign(selected, value);
  selected.drawX = selected.originX + value.localX;
  selected.drawY = selected.originY + value.localY;
  selected.centerX = selected.drawX + (value.width || 32) / 2;
  selected.centerY = selected.drawY + (value.height || 32) / 2;
  selected.x = selected.centerX;
  selected.y = selected.centerY;
  selected.bounds = {
    x: selected.drawX,
    y: selected.drawY,
    width: value.width || 32,
    height: value.height || 32,
  };
}

/**
 * Resolve map32 assets from either the assets object or shared app state.
 *
 * Parameters:
 *   target: ZeldaAssets object or shared Workbench state.
 * Returns:
 *   ZeldaAssets object.
 */
function resolveAssets(target) {
  return target?.map32Words ? target : target?.assets;
}

/**
 * Resolve sourceData from either the parsed sourceData object or shared app state.
 *
 * Parameters:
 *   target: Parsed sourceData object or shared Workbench state.
 * Returns:
 *   Parsed sourceData object.
 */
function resolveSourceData(target) {
  return target?.areaHeaders ? target : target?.sourceData;
}

/**
 * Set one map32 cell in the loaded asset table.
 *
 * Parameters:
 *   assets: ZeldaAssets object.
 *   screen: Overworld screen id.
 *   x: Map32 x coordinate.
 *   y: Map32 y coordinate.
 *   value: New map32 id.
 * Returns:
 *   None.
 */
function setCell(assets, screen, x, y, value) {
  assets.map32Words[screen][y * 16 + x] = value;
}

function clampIndex(index, length) {
  return Math.max(0, Math.min(index, length));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}
