/**
 * Top toolbar tool selection.
 */

import { ensureLayerState, setLayerVisible } from "./layer-state.js?v=20260621-render-restore20";
import { clearTileSelection } from "./tile-selection.js?v=20260621-render-restore20";

const INSPECT_GRID_LABELS = {
  map32: "Map32",
  map16: "Map16",
  map8: "Map8",
};
const GRID_LABEL_EVENT = "workbench:grid-labels-change";
const INSPECT_GRID_EVENT = "workbench:inspect-grid-change";

/**
 * Bind map tool buttons.
 *
 * Parameters:
 *   state: Shared Workbench state.
 * Returns:
 *   None.
 */
export function bindToolbar(state) {
  for (const button of document.querySelectorAll("[data-tool]")) {
    button.addEventListener("click", () => {
      setTool(state, button.dataset.tool);
    });
  }
  bindGridLabelToggle(state);
  bindInspectGridControls(state);
  setTool(state, state.currentTool || "select");
}

/**
 * Bind world-group tabs now hosted in the top toolbar.
 *
 * Parameters:
 *   state: Shared Workbench state.
 *   actions: Rerender and fit-to-view callbacks.
 * Returns:
 *   None.
 */
export function bindWorldTabs(state, actions) {
  for (const button of document.querySelectorAll("[data-group]")) {
    button.addEventListener("click", () => {
      for (const item of document.querySelectorAll("[data-group]")) {
        item.classList.toggle("active", item === button);
      }
      state.group = state.groups[button.dataset.group];
      actions.rerender().then(() => actions.fitToView(state));
    });
  }
}

/**
 * Set the active map editing tool.
 *
 * Parameters:
 *   state: Shared Workbench state.
 *   tool: select or paint.
 * Returns:
 *   None.
 */
export function setTool(state, tool) {
  state.currentTool = tool === "paint" ? "paint" : "select";
  for (const button of document.querySelectorAll("[data-tool]")) {
    const active = button.dataset.tool === state.currentTool;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  }
}

/**
 * Bind the atlas area-label visibility toggle.
 *
 * Parameters:
 *   state: Shared Workbench state.
 * Returns:
 *   None.
 */
function bindGridLabelToggle(state) {
  ensureLayerState(state);
  const buttons = document.querySelectorAll("[data-grid-label-toggle]");
  for (const button of buttons) {
    button.addEventListener("click", () => {
      setLayerVisible(state, "areaLabels", !state.showGridLabels);
      syncGridLabelButtons(buttons, state.showGridLabels);
      window.dispatchEvent(new CustomEvent(GRID_LABEL_EVENT));
    });
  }
  window.addEventListener(GRID_LABEL_EVENT, () => {
    syncGridLabelButtons(buttons, ensureLayerState(state).areaLabels);
  });
  syncGridLabelButtons(buttons, state.showGridLabels);
}

/**
 * Sync pressed and active states on all grid-label toolbar buttons.
 *
 * Parameters:
 *   buttons: Grid-label toggle buttons.
 *   active: Whether labels are visible.
 * Returns:
 *   None.
 */
function syncGridLabelButtons(buttons, active) {
  for (const button of buttons) {
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  }
}

/**
 * Bind the map32/map16/map8 inspection-grid selector.
 *
 * Parameters:
 *   state: Shared Workbench state.
 * Returns:
 *   None.
 */
function bindInspectGridControls(state) {
  state.inspectGrid = normalizeInspectGrid(state.inspectGrid);
  const buttons = document.querySelectorAll("[data-inspect-grid]");
  for (const button of buttons) {
    button.addEventListener("click", () => {
      state.inspectGrid = normalizeInspectGrid(button.dataset.inspectGrid);
      clearTileSelection(state);
      syncInspectGridButtons(buttons, state.inspectGrid);
      window.dispatchEvent(new CustomEvent(INSPECT_GRID_EVENT));
    });
  }
  syncInspectGridButtons(buttons, state.inspectGrid);
}

/**
 * Keep the active state on inspection-grid buttons synchronized.
 */
function syncInspectGridButtons(buttons, activeGrid) {
  for (const button of buttons) {
    const active = button.dataset.inspectGrid === activeGrid;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  }
}

/**
 * Clamp unknown persisted values back to map32.
 */
function normalizeInspectGrid(value) {
  return INSPECT_GRID_LABELS[value] ? value : "map32";
}
