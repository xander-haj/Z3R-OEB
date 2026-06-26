/**
 * Properties-panel controls for editing selected NPC dialogue text.
 */

import { dialogueMessagesForSelection } from "./dialogue-selection.js?v=20260625-dialogue-tab";
import { applyCommand } from "./operations.js?v=20260625-dialogue-tab";

let boundState = null;
let boundActions = null;

/**
 * Bind dialogue controls to the shared Workbench state.
 *
 * Parameters:
 *   state: Shared Workbench state.
 *   actions: Rerender/status/inspector callbacks.
 * Returns:
 *   None.
 */
export function bindDialogueControls(state, actions) {
  boundState = state;
  boundActions = actions;
  ensureControls();
  document.querySelector("#applyDialogueButton").addEventListener("click", applyDialogueEdit);
  syncDialogueControls(state, null);
}

/**
 * Refresh the Dialogue tab from the selected sprite.
 *
 * Parameters:
 *   state: Shared Workbench state.
 *   info: Current selection.
 * Returns:
 *   None.
 */
export function syncDialogueControls(state, info = state?.selected) {
  const messages = dialogueMessagesForSelection(info, state?.editorDb);
  state.dialogueSelection = messages;
  renderMessages(messages);
}

/**
 * Apply changed text fields as one undoable command.
 */
function applyDialogueEdit() {
  let edits;
  try {
    edits = changedEdits();
  } catch (error) {
    boundActions.setStatus(error.message);
    return;
  }
  if (!edits.length) {
    boundActions.setStatus("Dialogue unchanged");
    return;
  }
  try {
    applyCommand(boundState.history, boundState, { kind: "dialogue.set-text", edits });
  } catch (error) {
    boundActions.setStatus(error.message);
    return;
  }
  boundActions.setStatus(`Updated ${edits.length} dialogue line(s)`);
  boundActions.updateInspector?.(boundState.selected);
  syncDialogueControls(boundState);
}

/**
 * Compare visible fields to current editorDb text and return changed rows.
 */
function changedEdits() {
  const edits = [];
  for (const field of document.querySelectorAll("[data-dialogue-text-id]")) {
    const id = Number(field.dataset.dialogueTextId);
    const before = boundState.editorDb?.indexes?.dialogueById?.get(id)?.text || "";
    const after = field.value;
    if (after.includes("\n") || after.includes("\r")) {
      throwStatus("Dialogue text cannot contain literal newlines");
    }
    if (before !== after) {
      edits.push({ id, before, after });
    }
  }
  return edits;
}

/**
 * Create the Dialogue section without growing index.html.
 */
function ensureControls() {
  if (document.querySelector("[data-dialogue-controls]")) {
    return;
  }
  const section = document.createElement("section");
  section.dataset.dialogueControls = "true";
  section.dataset.propertyTab = "dialogue";
  section.append(heading(), body(), buttonRow());
  const inspector = document.querySelector("#inspectorRows").closest("section");
  inspector.parentNode.insertBefore(section, inspector);
}

/**
 * Render all selected dialogue messages into editable textareas.
 */
function renderMessages(messages) {
  const container = document.querySelector("[data-dialogue-message-list]");
  container.innerHTML = "";
  if (!messages.length) {
    container.textContent = "No dialogue on this selection.";
    document.querySelector("#applyDialogueButton").disabled = true;
    return;
  }
  for (const message of messages) {
    container.append(messageEditor(message));
  }
  document.querySelector("#applyDialogueButton").disabled = false;
}

/**
 * Build one editable dialogue text control.
 */
function messageEditor(message) {
  const wrapper = document.createElement("label");
  wrapper.className = "dialogue-editor";
  wrapper.append(labelText(message), textarea(message));
  return wrapper;
}

/**
 * Build a compact source label for one dialogue id.
 */
function labelText(message) {
  const span = document.createElement("span");
  span.textContent = `${hex(message.dialogue_id, 3)} ${message.handler || ""}`.trim();
  return span;
}

/**
 * Build one source-line textarea.
 */
function textarea(message) {
  const field = document.createElement("textarea");
  field.dataset.dialogueTextId = String(message.dialogue_id);
  field.value = message.text || "";
  field.rows = 4;
  return field;
}

/**
 * Convert validation failures into status text and abort the apply path.
 */
function throwStatus(message) {
  boundActions.setStatus(message);
  throw new Error(message);
}

function heading() {
  const title = document.createElement("h2");
  title.textContent = "Dialogue";
  return title;
}

function body() {
  const container = document.createElement("div");
  container.dataset.dialogueMessageList = "true";
  return container;
}

function buttonRow() {
  const row = document.createElement("div");
  row.className = "row";
  const button = document.createElement("button");
  button.id = "applyDialogueButton";
  button.type = "button";
  button.textContent = "Apply Dialogue";
  row.append(button);
  return row;
}

function hex(value, width) {
  return `0x${Number(value).toString(16).toUpperCase().padStart(width, "0")}`;
}
