/**
 * Shared canvas zoom helpers for wheel input and keyboard shortcuts.
 */

const MIN_ZOOM = 0.05;
const MAX_ZOOM = 4;
export const ZOOM_IN_FACTOR = 1.15;
export const ZOOM_OUT_FACTOR = 1 / ZOOM_IN_FACTOR;

/**
 * Zoom around one canvas-space point while preserving the world point under it.
 */
export function zoomAtCanvasPoint(state, canvasX, canvasY, factor) {
  const world = {
    x: (canvasX - state.panX) / state.zoom,
    y: (canvasY - state.panY) / state.zoom,
  };
  state.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, state.zoom * factor));
  state.panX = canvasX - world.x * state.zoom;
  state.panY = canvasY - world.y * state.zoom;
}

/**
 * Zoom around the center of the visible canvas for keyboard-driven zoom.
 */
export function zoomAtCanvasCenter(state, factor) {
  const rect = document.querySelector("#mapCanvas").getBoundingClientRect();
  zoomAtCanvasPoint(state, rect.width / 2, rect.height / 2, factor);
}

/**
 * Convert a wheel event into a shared zoom operation.
 */
export function handleWheelZoom(state, event, drawCanvas) {
  event.preventDefault();
  const rect = event.currentTarget.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  zoomAtCanvasPoint(state, x, y, event.deltaY < 0 ? ZOOM_IN_FACTOR : ZOOM_OUT_FACTOR);
  drawCanvas();
}
