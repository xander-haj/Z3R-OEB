/**
 * Paint-mode execution helpers for terrain, navigation markers, and sprite assets.
 */

import { applyCommand } from "./operations.js?v=20260621-render-restore20";
import { paintedMap32Id } from "./tile-asset-paint.js?v=20260626-tile-asset-paint";

/**
 * Paint the selected asset or marker move into a clicked map cell.
 */
export function paintSelectedAsset(state, info, handlers, point) {
  if (info.readOnly) {
    return;
  }
  const navigation = handlers.getPaintNavigation?.();
  if (navigation) {
    handlers.onPaintNavigation?.(navigation, info, point);
    return;
  }
  const sprite = handlers.getPaintSprite?.();
  if (sprite) {
    handlers.onPaintSprite?.(sprite, info, point);
    return;
  }
  paintTerrainAsset(state, info, handlers);
}

/**
 * Paint the selected saved terrain asset into the inspected map32 cell.
 */
function paintTerrainAsset(state, info, handlers) {
  const after = paintedMap32Id(state, info, handlers.getPaintTerrain?.());
  if (after === null) {
    handlers.onPaintMissing();
    return;
  }
  if (after === info.map32) {
    return;
  }
  applyCommand(state.history, state.assets, {
    kind: "terrain.set-map32",
    screen: info.screen,
    x: info.map32X,
    y: info.map32Y,
    before: info.map32,
    after,
  });
  handlers.rerender();
}
