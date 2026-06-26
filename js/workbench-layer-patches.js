/**
 * Coordinates non-terrain Workbench patch apply/export flows.
 */

import {
  applyDialoguePatchDocument,
  exportDialoguePatch,
  snapshotDialogue,
} from "./dialogue-mod-export.js?v=20260625-dialogue-tab";
import {
  applyGravestonePatchDocument,
  applyMetadataPatchDocument,
  exportGravestonePatch,
  exportMetadataPatch,
  snapshotMetadata,
} from "./metadata-mod-export.js?v=20260621-render-restore20";

/**
 * Snapshot source-backed layer data for sparse save export.
 *
 * Parameters:
 *   state: Shared Workbench state.
 * Returns:
 *   None.
 */
export function snapshotLayerBaselines(state) {
  state.baseMetadataSnapshot = snapshotMetadata(state.sourceData);
  state.baseDialogueSnapshot = snapshotDialogue(state.editorDb);
}

/**
 * Apply loaded mod patch documents into in-memory Workbench state.
 *
 * Parameters:
 *   state: Shared Workbench state.
 *   patches: Patch document map from the server.
 * Returns:
 *   None.
 */
export function applyLayerPatchDocuments(state, patches) {
  applyMetadataPatchDocument(state.sourceData, patches?.["patches/metadata.json"]);
  applyGravestonePatchDocument(state.sourceData, patches?.["patches/gravestones.json"]);
  applyDialoguePatchDocument(state.editorDb, patches?.["patches/dialogue.json"]);
}

/**
 * Export edited source-backed layers into the outgoing patch map.
 *
 * Parameters:
 *   state: Shared Workbench state.
 *   patches: Mutable patch document map from readPatchEditors.
 * Returns:
 *   None.
 */
export function exportLayerPatchDocuments(state, patches) {
  patches["patches/metadata.json"] = exportMetadataPatch(
    state.baseMetadataSnapshot,
    state.sourceData,
    patches["patches/metadata.json"],
  );
  patches["patches/gravestones.json"] = exportGravestonePatch(
    state.baseMetadataSnapshot?.gravestones,
    state.sourceData,
    patches["patches/gravestones.json"],
  );
  patches["patches/dialogue.json"] = exportDialoguePatch(
    state.baseDialogueSnapshot,
    state.editorDb,
    patches["patches/dialogue.json"],
  );
}
