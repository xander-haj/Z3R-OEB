/**
 * Builds and binds the Workbench layer visibility panel.
 */

import { ensureLayerState, LAYER_GROUPS, setLayerVisible } from "./layer-state.js?v=20260621-render-restore20";

const GRID_LABEL_EVENT = "workbench:grid-labels-change";

/**
 * Render layer toggles and bind changes to redraw or rerender actions.
 *
 * Parameters:
 *   state: Shared Workbench state.
 *   actions: Rerender, draw, and status callbacks.
 * Returns:
 *   None.
 */
export function bindLayerControls(state, actions) {
  ensureLayerState(state);
  renderLayerControls(state);
  document.querySelector("#layerControls").addEventListener("change", (event) => {
    const input = event.target.closest("[data-layer-key]");
    if (!input) {
      return;
    }
    setLayerVisible(state, input.dataset.layerKey, input.checked);
    syncLayerCheckboxes(state);
    applyLayerChange(input.dataset.layerKey, input.dataset.layerMode, actions);
    actions.setStatus(`${input.dataset.layerLabel} ${input.checked ? "shown" : "hidden"}`);
  });
  window.addEventListener(GRID_LABEL_EVENT, () => syncLayerCheckboxes(state));
}

/**
 * Draw every configured layer group into the Layers side-panel tab.
 *
 * Parameters:
 *   state: Shared Workbench state.
 * Returns:
 *   None.
 */
function renderLayerControls(state) {
  const root = document.querySelector("#layerControls");
  root.innerHTML = "";
  for (const group of LAYER_GROUPS) {
    const section = document.createElement("section");
    section.className = "layer-group";
    const title = document.createElement("h2");
    title.textContent = group.title;
    const list = document.createElement("div");
    list.className = "layer-toggle-list";
    for (const item of group.items) {
      list.append(layerToggle(state, item));
    }
    section.append(title, list);
    root.append(section);
  }
}

/**
 * Create one checkbox row for a layer descriptor.
 *
 * Parameters:
 *   state: Shared Workbench state.
 *   item: Layer descriptor from LAYER_GROUPS.
 * Returns:
 *   Label element containing a checkbox and text.
 */
function layerToggle(state, item) {
  const label = document.createElement("label");
  label.className = "layer-toggle";
  label.title = item.description;
  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = ensureLayerState(state)[item.key] !== false;
  input.dataset.layerKey = item.key;
  input.dataset.layerMode = item.mode;
  input.dataset.layerLabel = item.label;
  const text = document.createElement("span");
  text.textContent = item.label;
  label.append(input, text);
  return label;
}

/**
 * Sync checkbox state after a layer change from any control surface.
 *
 * Parameters:
 *   state: Shared Workbench state.
 * Returns:
 *   None.
 */
export function syncLayerCheckboxes(state) {
  const layers = ensureLayerState(state);
  for (const input of document.querySelectorAll("[data-layer-key]")) {
    input.checked = layers[input.dataset.layerKey] !== false;
  }
}

/**
 * Trigger the least expensive redraw path for a changed layer.
 *
 * Parameters:
 *   key: Layer key that changed.
 *   mode: "render" or "draw".
 *   actions: Rerender and draw callbacks.
 * Returns:
 *   None.
 */
function applyLayerChange(key, mode, actions) {
  if (mode === "render") {
    actions.rerender();
    return;
  }
  if (key === "areaLabels") {
    window.dispatchEvent(new CustomEvent(GRID_LABEL_EVENT));
    return;
  }
  actions.draw();
}
