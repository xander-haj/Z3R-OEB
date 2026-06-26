/**
 * Dialogue-related dat-dump rows for sprite inspector selections.
 */

import { selectionHasDialogue } from "./dialogue-selection.js?v=20260625-dialogue-tab";

/**
 * Append the dialogue availability row for selected sprite placements.
 *
 * Parameters:
 *   rows: Definition-list element being populated.
 *   info: Sprite selection from the overlay.
 *   catalog: Sprite catalog record, when available.
 *   placement: Placement-index record, when available.
 *   editorDb: Loaded editor database descriptor.
 *   appendRow: Panel row helper.
 * Returns:
 *   None.
 */
export function appendNpcDialogueRows(rows, info, catalog, placement, editorDb, appendRow) {
  void catalog;
  void placement;
  appendRow(rows, "Dialogue", selectionHasDialogue(info, editorDb) ? "true" : "false");
}
