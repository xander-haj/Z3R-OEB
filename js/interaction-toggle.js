/**
 * One-click visibility toggle for selectable interaction and navigation markers.
 */

import { ensureLayerState, setLayerVisible } from "./layer-state.js?v=20260621-render-restore20";
import { syncLayerCheckboxes } from "./layer-controls.js?v=20260621-render-restore20";

const MARKER_LAYERS = [
  "secretTreasure",
  "secretEnemies",
  "secretEntrances",
  "shovelSpots",
  "gravestones",
  "travelPoints",
  "entrancePoints",
  "holePoints",
  "exitPoints",
];

let bound = false;

/**
 * Add marker toggle buttons beside the sprite toggle and bind them to layer state.
 */
export function bindInteractionMarkerToggle(state, actions) {
  ensureButtons();
  syncButtons(state);
  if (bound) {
    return;
  }
  bound = true;
  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-interaction-toggle]");
    if (button) {
      toggleMarkers(state, actions);
    }
  });
  document.querySelector("#layerControls")?.addEventListener("change", () => syncButtons(state));
}

function toggleMarkers(state, actions) {
  const visible = !anyMarkerLayerVisible(state);
  for (const key of MARKER_LAYERS) {
    setLayerVisible(state, key, visible);
  }
  syncLayerCheckboxes(state);
  syncButtons(state);
  actions.rerender();
}

function ensureButtons() {
  for (const spriteButton of document.querySelectorAll("[data-enemy-toggle]")) {
    if (spriteButton.nextElementSibling?.matches("[data-interaction-toggle]")) {
      continue;
    }
    spriteButton.insertAdjacentElement("afterend", markerButton(spriteButton));
  }
}

function markerButton(spriteButton) {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.interactionToggle = "true";
  button.title = "Show or hide interaction markers";
  button.setAttribute("aria-label", "Show or hide interaction markers");
  button.setAttribute("aria-pressed", "false");
  if (spriteButton.classList.contains("overlay-icon")) {
    button.className = "overlay-icon interaction-toggle";
    button.innerHTML = markerIcon();
    return button;
  }
  button.className = "tab-button interaction-toggle";
  button.innerHTML = `${markerIcon()}<span>Markers</span>`;
  return button;
}

function syncButtons(state) {
  const active = anyMarkerLayerVisible(state);
  for (const button of document.querySelectorAll("[data-interaction-toggle]")) {
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  }
}

function anyMarkerLayerVisible(state) {
  const layers = ensureLayerState(state);
  return MARKER_LAYERS.some((key) => layers[key] !== false);
}

function markerIcon() {
  return `
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M12 3l6 4v7l-6 7-6-7V7l6-4z"></path>
      <path d="M9 9h6"></path>
      <path d="M9 13h6"></path>
      <circle cx="12" cy="17" r="1"></circle>
    </svg>
  `;
}
