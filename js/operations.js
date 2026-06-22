/**
 * Command-object undo/redo for map32 terrain and sprite placement edits.
 */

import { applyEdit } from "./command-apply.js?v=20260621-render-restore20";

/**
 * Create an empty command history.
 *
 * Parameters: none.
 * Returns:
 *   Mutable history object.
 */
export function createHistory() {
  return { undo: [], redo: [] };
}

/**
 * Apply one command and push it onto undo history.
 *
 * Parameters:
 *   history: Mutable history object.
 *   target: ZeldaAssets object or shared Workbench state.
 *   command: Command object to apply.
 * Returns:
 *   None.
 */
export function applyCommand(history, target, command) {
  applyEdit(target, command, "redo");
  recordCommand(history, command);
}

/**
 * Record an already-applied command and clear stale redo history.
 *
 * Parameters:
 *   history: Mutable history object.
 *   command: Command object that was already applied.
 * Returns:
 *   None.
 */
export function recordCommand(history, command) {
  history.undo.push(command);
  history.redo = [];
}

/**
 * Undo the latest command.
 *
 * Parameters:
 *   history: Mutable history object.
 *   target: ZeldaAssets object or shared Workbench state.
 * Returns:
 *   The undone command, or null.
 */
export function undo(history, target) {
  const command = history.undo.pop();
  if (!command) {
    return null;
  }
  applyEdit(target, command, "undo");
  history.redo.push(command);
  return command;
}

/**
 * Redo the latest undone command.
 *
 * Parameters:
 *   history: Mutable history object.
 *   target: ZeldaAssets object or shared Workbench state.
 * Returns:
 *   The redone command, or null.
 */
export function redo(history, target) {
  const command = history.redo.pop();
  if (!command) {
    return null;
  }
  applyEdit(target, command, "redo");
  history.undo.push(command);
  return command;
}

/**
 * Parse decimal or hex input from a control.
 *
 * Parameters:
 *   value: Input string or number.
 * Returns:
 *   Parsed integer.
 */
export function parseNumber(value) {
  if (Number.isInteger(value)) {
    return value;
  }
  const match = String(value ?? "").trim().match(/^([+-]?)(?:0x([0-9a-f]+)|(\d+))$/i);
  if (!match) {
    throw new Error("Value must be an integer");
  }
  const sign = match[1] === "-" ? -1 : 1;
  return sign * Number.parseInt(match[2] ?? match[3], match[2] ? 16 : 10);
}
