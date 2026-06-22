/**
 * Offscreen render orchestration for the Overworld Workbench.
 */

import { renderGroup } from "../viewer/js/renderer.js?v=20260621-render-restore20";
import { draw } from "./canvas-view.js?v=20260621-render-restore20";
import {
  drawEnemyOverlay as drawSpriteOverlay,
} from "./enemy-overlay.js?v=20260621-secret-item-vram";
import { drawGravestoneOverlay } from "./gravestone-overlay.js?v=20260621-render-restore20";
import { drawInteractionOverlay } from "./interaction-overlay.js?v=20260621-secret-item-vram";
import { ensureLayerState, layerVisible } from "./layer-state.js?v=20260621-render-restore20";

/**
 * Create the Workbench rerender function bound to shared editor state.
 *
 * Parameters:
 *   state: Shared Workbench state.
 * Returns:
 *   Async rerender function.
 */
export function createWorkbenchRenderer(state) {
  return async function rerender() {
    if (!state.app || !state.group) {
      return;
    }
    const layers = ensureLayerState(state);
    state.app.mapCache.cache.clear();
    state.worldCanvas = renderGroup(state.app, state.group, renderOptions(state, layers));
    if (state.showEnemies && spriteLayersVisible(layers)) {
      drawSpriteOverlay(state.app, state.worldCanvas, state.group, state.enemyStage, layers);
    }
    drawInteractionOverlay(state.app, state.worldCanvas, state.group, layers, state.enemyStage);
    drawGravestoneOverlay(state.app, state.worldCanvas, state.group, layers);
    draw(state);
  };
}

/**
 * Build viewer renderer options from Workbench layer state.
 *
 * Parameters:
 *   state: Shared Workbench state.
 *   layers: Layer visibility object.
 * Returns:
 *   renderGroup options.
 */
function renderOptions(state, layers) {
  return {
    paletteOverride: null,
    auxOverride: null,
    layers,
    showMap32Grid: layerVisible(layers, "map32Grid"),
    showMap16Grid: layerVisible(layers, "map16Grid"),
    showMap8Grid: layerVisible(layers, "map8Grid"),
    showGrid: layerVisible(layers, "screenGrid"),
    showOverlays: layerVisible(layers, "structuralOverlays"),
    showSprites: layerVisible(layers, "sourceSprites"),
    spriteStage: state.enemyStage,
  };
}

/**
 * Return whether any sprite overlay drawing layer is enabled.
 *
 * Parameters:
 *   layers: Layer visibility object.
 * Returns:
 *   True when sprite art or markers should draw.
 */
function spriteLayersVisible(layers) {
  return layerVisible(layers, "enemySpriteArt") || layerVisible(layers, "enemyMarkers");
}
