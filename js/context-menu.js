/**
 * Small context menu for map tile and sprite actions.
 */

import { normalizeTileAssetGrid, tileAssetKindLabel } from "./asset-tile-model.js?v=20260626-tile-asset-paint";

let currentTile = null;
let currentPaint = null;
let saveHandler = null;

/**
 * Bind context menu button and dismissal behavior.
 *
 * Parameters:
 *   handlers: Save and optional paint callbacks for context-menu actions.
 * Returns:
 *   None.
 */
export function bindTileContextMenu(handlers) {
  saveHandler = typeof handlers === "function" ? handlers : handlers?.onSave;
  document.querySelector("#saveTileAssetButton").addEventListener("click", handleSave);
  document.querySelector("#paintAssetButton").addEventListener("click", handlePaint);
  window.addEventListener("pointerdown", (event) => {
    const menu = document.querySelector("#tileContextMenu");
    if (!menu.hidden && !menu.contains(event.target)) {
      hideTileContextMenu();
    }
  });
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      hideTileContextMenu();
    }
  });
}

/**
 * Show the context menu for a map tile.
 *
 * Parameters:
 *   info: Tile information from the inspector.
 *   event: Mouse contextmenu event.
 *   gridLevel: Active terrain inspection grid for tile saves.
 * Returns:
 *   None.
 */
export function showTileContextMenu(info, event, gridLevel = "map32") {
  const menu = document.querySelector("#tileContextMenu");
  const host = menu.closest(".canvas-wrap");
  if (!host) {
    return;
  }
  const assetGrid = normalizeTileAssetGrid(gridLevel);
  const rect = host.getBoundingClientRect();
  currentTile = info.kind === "sprite" || info.kind === "enemy" ? info : { ...info, inspectGrid: assetGrid };
  currentPaint = null;
  menu.hidden = false;
  const saveButton = document.querySelector("#saveTileAssetButton");
  const paintButton = document.querySelector("#paintAssetButton");
  saveButton.hidden = false;
  paintButton.hidden = true;
  saveButton.textContent = saveButtonLabel(info, assetGrid);
  menu.style.left = `${event.clientX - rect.left}px`;
  menu.style.top = `${event.clientY - rect.top}px`;
  keepMenuInBounds(menu, rect);
  saveButton.focus();
}

/**
 * Show the context menu confirmation for a paint-mode target.
 *
 * Parameters:
 *   info: Tile information from the inspector.
 *   event: Mouse contextmenu event.
 *   onPaint: Deferred callback that performs the paint operation.
 * Returns:
 *   None.
 */
export function showPaintContextMenu(info, event, onPaint, label = "Paint") {
  const menu = document.querySelector("#tileContextMenu");
  const host = menu.closest(".canvas-wrap");
  if (!host) {
    return;
  }
  const rect = host.getBoundingClientRect();
  currentTile = null;
  currentPaint = { info, onPaint };
  menu.hidden = false;
  const saveButton = document.querySelector("#saveTileAssetButton");
  const paintButton = document.querySelector("#paintAssetButton");
  saveButton.hidden = true;
  paintButton.hidden = false;
  paintButton.textContent = label;
  menu.style.left = `${event.clientX - rect.left}px`;
  menu.style.top = `${event.clientY - rect.top}px`;
  keepMenuInBounds(menu, rect);
  paintButton.focus();
}

/**
 * Hide the tile context menu.
 *
 * Parameters: none.
 * Returns:
 *   None.
 */
export function hideTileContextMenu() {
  document.querySelector("#tileContextMenu").hidden = true;
  currentTile = null;
  currentPaint = null;
}

/**
 * Save the current menu tile through the bound callback.
 *
 * Parameters: none.
 * Returns:
 *   None.
 */
async function handleSave() {
  const tile = currentTile;
  hideTileContextMenu();
  if (tile && saveHandler) {
    await saveHandler(tile);
  }
}

/**
 * Run the deferred paint callback selected from paint-mode context menu.
 *
 * Parameters: none.
 * Returns:
 *   Promise resolving after the paint handler completes.
 */
async function handlePaint() {
  const paint = currentPaint;
  hideTileContextMenu();
  if (paint?.onPaint) {
    await paint.onPaint();
  }
}

/**
 * Keep a visible menu within the canvas overlay region.
 *
 * Parameters:
 *   menu: Context menu element.
 *   rect: Offset parent bounds.
 * Returns:
 *   None.
 */
function keepMenuInBounds(menu, rect) {
  const maxLeft = Math.max(0, rect.width - menu.offsetWidth - 8);
  const maxTop = Math.max(0, rect.height - menu.offsetHeight - 8);
  menu.style.left = `${Math.min(Number.parseFloat(menu.style.left), maxLeft)}px`;
  menu.style.top = `${Math.min(Number.parseFloat(menu.style.top), maxTop)}px`;
}

/**
 * Choose the context-menu save label for sprite or terrain selections.
 *
 * Parameters:
 *   info: Tile or sprite selection object.
 *   gridLevel: Normalized terrain grid level.
 * Returns:
 *   Button text.
 */
function saveButtonLabel(info, gridLevel) {
  if (info.kind === "sprite" || info.kind === "enemy") {
    return "Save Sprite To Assets";
  }
  return `Save ${tileAssetKindLabel(gridLevel)} To Assets`;
}
