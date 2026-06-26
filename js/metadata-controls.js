/**
 * Coordinates metadata editing controls hosted in the Properties panel.
 */

import {
  bindEntranceHoleControls,
  syncEntranceHoleControls,
} from "./entrance-hole-controls.js?v=20260621-render-restore20";
import {
  bindDialogueControls,
  syncDialogueControls,
} from "./dialogue-controls.js?v=20260625-dialogue-tab";
import {
  bindHeaderControls,
  syncHeaderControls,
} from "./header-controls.js?v=20260621-render-restore20";
import { bindInteractionMarkerToggle } from "./interaction-toggle.js?v=20260621-properties-tabs";
import {
  bindGravestoneControls,
  syncGravestoneControls,
} from "./gravestone-controls.js?v=20260621-render-restore20";
import {
  bindNavigationAllocationControls,
  syncNavigationAllocationControls,
} from "./navigation-allocation-controls.js?v=20260621-render-restore20";
import {
  bindNavigationRecordControls,
  syncNavigationRecordControls,
} from "./navigation-record-controls.js?v=20260621-render-restore20";
import {
  bindSecretItemControls,
  syncSecretItemControls,
} from "./secret-item-controls.js?v=20260621-render-restore20";
import {
  bindSpriteInfoControls,
  syncSpriteInfoControls,
} from "./sprite-info-controls.js?v=20260621-render-restore20";
import {
  bindSpecialVisualControls,
  syncSpecialVisualControls,
} from "./special-visual-controls.js?v=20260621-render-restore20";
import {
  bindSpritePlacementControls,
  syncSpritePlacementControls,
} from "./sprite-placement-controls.js?v=20260621-secret-item-vram";
import {
  bindStaticOverlayControls,
  syncStaticOverlayControls,
} from "./static-overlay-controls.js?v=20260621-render-restore20";
import {
  bindTileAttributeControls,
  syncTileAttributeControls,
} from "./tile-attribute-controls.js?v=20260621-render-restore20";
import {
  bindPropertyPanelTabs,
  syncPropertyPanelTab,
} from "./property-panel-tabs.js?v=20260626-tab-toggle";

/**
 * Bind all metadata controls to shared Workbench state.
 *
 * Parameters:
 *   state: Shared Workbench state.
 *   actions: Rerender and status callbacks.
 * Returns:
 *   None.
 */
export function bindMetadataControls(state, actions) {
  bindHeaderControls(state, actions);
  bindGravestoneControls(state, actions);
  bindNavigationAllocationControls(state, actions);
  bindNavigationRecordControls(state, actions);
  bindEntranceHoleControls(state, actions);
  bindDialogueControls(state, actions);
  bindSecretItemControls(state, actions);
  bindSpriteInfoControls(state, actions);
  bindSpecialVisualControls(state, actions);
  bindSpritePlacementControls(state, actions);
  bindStaticOverlayControls(state, actions);
  bindTileAttributeControls(state, actions);
  bindInteractionMarkerToggle(state, actions);
  bindPropertyPanelTabs(state);
}

/**
 * Refresh every metadata control group from the current selection.
 *
 * Parameters:
 *   state: Shared Workbench state.
 *   info: Current selection.
 * Returns:
 *   None.
 */
export function syncMetadataControls(state, info = state?.selected) {
  syncHeaderControls(state, info);
  syncGravestoneControls(state, info);
  syncNavigationAllocationControls(state, info);
  syncNavigationRecordControls(state, info);
  syncEntranceHoleControls(state, info);
  syncDialogueControls(state, info);
  syncSecretItemControls(state, info);
  syncSpriteInfoControls(state, info);
  syncSpecialVisualControls(state, info);
  syncSpritePlacementControls(state, info);
  syncStaticOverlayControls(state, info);
  syncTileAttributeControls(state, info);
  syncPropertyPanelTab(state, info);
}
