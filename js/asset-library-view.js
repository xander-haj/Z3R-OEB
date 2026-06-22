/**
 * DOM rendering for the foldered editor asset library.
 */

import { folderPathOptions } from "./asset-folder-model.js";

/**
 * Render the asset library folder and tile controls.
 *
 * Parameters:
 *   state: Shared Workbench state.
 *   library: Asset library document.
 * Returns:
 *   None.
 */
export function renderAssetLibraryView(state, library) {
  const container = document.querySelector("#assetFolders");
  document.querySelector("#createFolderButton").disabled = false;
  document.querySelector("#assetFolderName").disabled = false;
  container.innerHTML = "";
  for (const folder of rootFolders(library)) {
    container.append(renderFolder(library, folder, 0));
  }
}

/**
 * Render one asset folder section.
 *
 * Parameters:
 *   library: Current asset library.
 *   folder: Folder to render.
 *   depth: Nesting depth.
 * Returns:
 *   DOM element for the folder.
 */
function renderFolder(library, folder, depth) {
  const section = document.createElement("section");
  section.className = "asset-folder";
  section.style.setProperty("--folder-depth", depth);
  const header = document.createElement("div");
  header.className = "asset-folder-header";
  const title = document.createElement("h3");
  title.textContent = folder.name;
  const target = document.createElement("button");
  target.type = "button";
  target.dataset.useFolderId = folder.id;
  target.className = folder.id === library.activeFolderId ? "active" : "";
  target.textContent = folder.id === library.activeFolderId ? "Target" : "Use";
  header.append(title, target);
  section.append(header);
  const list = document.createElement("div");
  list.className = "asset-tile-list";
  for (const tile of folder.tiles || []) {
    list.append(renderTile(library, folder, tile));
  }
  if (!folder.tiles?.length) {
    list.append(emptyState("No saved tiles in this folder."));
  }
  section.append(list);
  for (const child of childFolders(library, folder.id)) {
    section.append(renderFolder(library, child, depth + 1));
  }
  return section;
}

/**
 * Render one saved asset row.
 *
 * Parameters:
 *   library: Current asset library.
 *   folder: Folder containing the tile.
 *   tile: Saved asset.
 * Returns:
 *   DOM element for the tile.
 */
function renderTile(library, folder, tile) {
  const item = document.createElement("div");
  item.className = "asset-tile-row";
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.tileId = tile.id;
  button.className = tile.id === library.selectedTileId ? "asset-tile active" : "asset-tile";
  button.append(renderPreview(tile), renderTileLabel(tile));
  const move = document.createElement("select");
  move.dataset.moveTileId = tile.id;
  move.dataset.sourceFolderId = folder.id;
  for (const { folder: target, label } of folderPathOptions(library)) {
    const option = document.createElement("option");
    option.value = target.id;
    option.textContent = label;
    option.selected = target.id === folder.id;
    move.append(option);
  }
  item.append(button, move);
  return item;
}

/**
 * Render the compact preview for one saved asset.
 *
 * Parameters:
 *   tile: Saved asset.
 * Returns:
 *   DOM element for the preview.
 */
function renderPreview(tile) {
  const preview = document.createElement("span");
  preview.className = "asset-preview";
  if (tile.preview) {
    const image = document.createElement("img");
    image.alt = "";
    image.src = tile.preview;
    preview.append(image);
  }
  return preview;
}

/**
 * Render a compact asset label.
 *
 * Parameters:
 *   tile: Saved asset.
 * Returns:
 *   DOM element for the label.
 */
function renderTileLabel(tile) {
  const label = document.createElement("span");
  label.className = "asset-tile-label";
  label.textContent = tile.kind === "sprite" ? `${tile.name} sprite` : `${tile.name} ${tile.map32}`;
  return label;
}

/**
 * Return root-level folders.
 *
 * Parameters:
 *   library: Asset library document.
 * Returns:
 *   Root folder list.
 */
function rootFolders(library) {
  return library.folders.filter((folder) => !folder.parentId);
}

/**
 * Return child folders for one parent.
 *
 * Parameters:
 *   library: Asset library document.
 *   parentId: Parent folder id.
 * Returns:
 *   Child folder list.
 */
function childFolders(library, parentId) {
  return library.folders.filter((folder) => folder.parentId === parentId);
}

/**
 * Build a small empty-state paragraph.
 *
 * Parameters:
 *   text: Message.
 * Returns:
 *   DOM element.
 */
function emptyState(text) {
  const paragraph = document.createElement("p");
  paragraph.className = "empty-state";
  paragraph.textContent = text;
  return paragraph;
}
