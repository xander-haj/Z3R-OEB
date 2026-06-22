/**
 * Combined metadata patch apply/export pipeline for Workbench-edited YAML domains.
 */

import {
  applyHeaderPatchDocument,
  exportHeaderPatch,
  snapshotHeaders,
} from "./header-mod-export.js?v=20260621-render-restore20";
import {
  applyNavigationPatchDocument,
  exportNavigationPatch,
  snapshotNavigation,
} from "./navigation-mod-export.js?v=20260621-render-restore20";
import {
  applyInteractionPatchDocument,
  exportInteractionPatch,
  snapshotInteractionItems,
} from "./interaction-mod-export.js?v=20260621-render-restore20";
import {
  applySpritePatchDocument,
  exportSpritePatch,
  snapshotSpriteSets,
} from "./sprite-mod-export.js?v=20260621-render-restore20";
import {
  applyGravestonePatchDocument,
  exportGravestonePatch,
  snapshotGravestones,
} from "./gravestone-mod-export.js?v=20260621-render-restore20";
import {
  applyStaticOverlayPatchDocument,
  exportStaticOverlayPatch,
  snapshotStaticOverlays,
} from "./static-overlay-mod-export.js?v=20260621-render-restore20";

export { applyGravestonePatchDocument, exportGravestonePatch, snapshotGravestones };

/**
 * Snapshot every metadata domain that the Workbench can mutate.
 *
 * Parameters:
 *   sourceData: Parsed source tables from source-parser.js.
 * Returns:
 *   Object containing sparse-diff baselines for metadata domains.
 */
export function snapshotMetadata(sourceData) {
  return {
    headers: snapshotHeaders(sourceData),
    interactions: snapshotInteractionItems(sourceData),
    navigation: snapshotNavigation(sourceData),
    sprites: snapshotSpriteSets(sourceData),
    gravestones: snapshotGravestones(sourceData),
    staticOverlays: snapshotStaticOverlays(sourceData),
  };
}

/**
 * Apply all Workbench-supported metadata operations into the in-memory source data.
 *
 * Parameters:
 *   sourceData: Parsed source tables from source-parser.js.
 *   document: Metadata patch document from a mod package.
 * Returns:
 *   None.
 */
export function applyMetadataPatchDocument(sourceData, document) {
  applyHeaderPatchDocument(sourceData, document);
  applyInteractionPatchDocument(sourceData, document);
  applyNavigationPatchDocument(sourceData, document);
  applySpritePatchDocument(sourceData, document);
  applyStaticOverlayPatchDocument(sourceData, document);
}

/**
 * Export all Workbench-supported metadata operations while preserving unknown operations.
 *
 * Parameters:
 *   base: Snapshot from snapshotMetadata.
 *   sourceData: Current parsed source data.
 *   existing: Metadata patch document from the patch editor.
 * Returns:
 *   Metadata patch document.
 */
export function exportMetadataPatch(base, sourceData, existing) {
  const withHeaders = exportHeaderPatch(base?.headers, sourceData, existing);
  const withInteractions = exportInteractionPatch(base?.interactions, sourceData, withHeaders);
  const withNavigation = exportNavigationPatch(base?.navigation, sourceData, withInteractions);
  const withSprites = exportSpritePatch(base?.sprites, sourceData, withNavigation);
  return exportStaticOverlayPatch(base?.staticOverlays, sourceData, withSprites);
}
