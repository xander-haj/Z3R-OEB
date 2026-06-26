/**
 * Apply/export helpers for Workbench dialogue text patches.
 */

const FORMAT = "zelda3-overworld-dialogue-v1";

/**
 * Snapshot editor dialogue strings for sparse export.
 *
 * Parameters:
 *   editorDb: Loaded editor database descriptor.
 * Returns:
 *   Map of dialogue id to text.
 */
export function snapshotDialogue(editorDb) {
  const snapshot = new Map();
  for (const record of editorDb?.raw?.dialogueStrings?.strings || []) {
    snapshot.set(record.id, record.text);
  }
  return snapshot;
}

/**
 * Apply saved dialogue.text operations to the loaded editor database.
 *
 * Parameters:
 *   editorDb: Loaded editor database descriptor.
 *   document: Dialogue patch document from a mod package.
 * Returns:
 *   None.
 */
export function applyDialoguePatchDocument(editorDb, document) {
  for (const operation of document?.patches || []) {
    if (operation?.kind !== "dialogue.text") {
      continue;
    }
    setDialogueText(editorDb, integer(operation.id, "dialogue id"), checkedText(operation.text));
  }
}

/**
 * Export changed dialogue rows while preserving unknown dialogue operations.
 *
 * Parameters:
 *   base: Snapshot from snapshotDialogue.
 *   editorDb: Current editor database descriptor.
 *   existing: Existing patch document from the JSON editor.
 * Returns:
 *   Dialogue patch document.
 */
export function exportDialoguePatch(base, editorDb, existing) {
  const patches = (existing?.patches || []).filter((operation) => operation?.kind !== "dialogue.text");
  const current = snapshotDialogue(editorDb);
  const changedIds = [...current.keys()].filter((id) => current.get(id) !== base?.get(id));
  for (const id of changedIds.sort((left, right) => left - right)) {
    patches.push({ kind: "dialogue.text", id, expect: base?.get(id) || "", text: current.get(id) || "" });
  }
  return { format: FORMAT, patches };
}

/**
 * Apply an undoable dialogue edit command.
 *
 * Parameters:
 *   target: Shared Workbench state or editor database descriptor.
 *   command: dialogue.set-text command.
 *   direction: "undo" or "redo".
 * Returns:
 *   None.
 */
export function applyDialogueCommand(target, command, direction) {
  const editorDb = target?.editorDb || target;
  for (const edit of command.edits || []) {
    const value = direction === "undo" ? edit.before : edit.after;
    setDialogueText(editorDb, integer(edit.id, "dialogue id"), checkedText(value));
  }
}

/**
 * Replace one dialogue string in raw arrays and lookup indexes.
 *
 * Parameters:
 *   editorDb: Loaded editor database descriptor.
 *   id: Dialogue id.
 *   text: Replacement source text.
 * Returns:
 *   None.
 */
export function setDialogueText(editorDb, id, text) {
  const checked = checkedText(text);
  const record = editorDb?.indexes?.dialogueById?.get(id);
  if (!record) {
    throw new Error(`Dialogue ${hex(id, 3)} is not available`);
  }
  record.text = checked;
  const raw = (editorDb.raw.dialogueStrings?.strings || []).find((row) => row.id === id);
  if (raw) {
    raw.text = checked;
  }
}

/**
 * Parse integer fields from patch JSON or command objects.
 */
function integer(value, label) {
  if (Number.isInteger(value)) {
    return value;
  }
  const text = String(value ?? "").trim();
  if (!/^[+-]?(?:0x[0-9a-f]+|\d+)$/i.test(text)) {
    throw new Error(`${label} must be an integer`);
  }
  const sign = text.startsWith("-") ? -1 : 1;
  const unsigned = text.replace(/^[+-]/, "");
  return sign * Number.parseInt(
    unsigned.toLowerCase().startsWith("0x") ? unsigned.slice(2) : unsigned,
    unsigned.toLowerCase().startsWith("0x") ? 16 : 10,
  );
}

/**
 * Keep source text to one dialogue.txt line.
 */
function checkedText(text) {
  if (typeof text !== "string") {
    throw new Error("Dialogue text must be a string");
  }
  if (text.includes("\n") || text.includes("\r")) {
    throw new Error("Dialogue text cannot contain literal newlines");
  }
  return text;
}

/**
 * Format dialogue ids for editor diagnostics.
 */
function hex(value, width) {
  return `0x${Number(value).toString(16).toUpperCase().padStart(width, "0")}`;
}
