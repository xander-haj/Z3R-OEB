/**
 * API helpers for the local Overworld Workbench server.
 */

/**
 * Fetch JSON from the local server.
 *
 * Parameters:
 *   url: API route.
 * Returns:
 *   Promise resolving to parsed JSON.
 */
export async function getJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return response.json();
}

/**
 * Post JSON to the local server.
 *
 * Parameters:
 *   url: API route.
 *   payload: JSON-serializable body.
 * Returns:
 *   Promise resolving to parsed JSON.
 */
export async function postJson(url, payload = {}) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return response.json();
}

/**
 * Load the list of known overworld mods.
 *
 * Parameters: none.
 * Returns:
 *   Promise resolving to server mod list.
 */
export function listMods() {
  return getJson("/api/mods");
}

/**
 * Load one mod package.
 *
 * Parameters:
 *   modId: Package id under mods/overworld.
 * Returns:
 *   Promise resolving to manifest and patch JSON.
 */
export function loadMod(modId) {
  return getJson(`/api/mods/${encodeURIComponent(modId)}`);
}

/**
 * Create a new mod package.
 *
 * Parameters:
 *   id: New package id.
 *   name: Display name.
 * Returns:
 *   Promise resolving to the created mod payload.
 */
export function createMod(id, name) {
  return postJson("/api/mods/create", { id, name });
}

/**
 * Save one mod package.
 *
 * Parameters:
 *   modId: Package id.
 *   payload: Manifest and patch documents.
 * Returns:
 *   Promise resolving to saved mod payload.
 */
export function saveMod(modId, payload) {
  return postJson(`/api/mods/${encodeURIComponent(modId)}/save`, payload);
}

/**
 * Load the saved asset library for one mod package.
 *
 * Parameters:
 *   modId: Package id.
 * Returns:
 *   Promise resolving to the asset library document.
 */
export function loadAssetLibrary(modId) {
  return getJson(`/api/mods/${encodeURIComponent(modId)}/assets`);
}

/**
 * Save the saved asset library for one mod package.
 *
 * Parameters:
 *   modId: Package id.
 *   assetLibrary: Foldered saved asset document.
 * Returns:
 *   Promise resolving to the saved asset library document.
 */
export function saveAssetLibrary(modId, assetLibrary) {
  return postJson(`/api/mods/${encodeURIComponent(modId)}/assets/save`, { assetLibrary });
}

/**
 * Return whether the base overworld dump exists on disk.
 */
export function overworldDumpStatus() {
  return getJson("/api/overworld-dump/status");
}

/**
 * Run an allowed local workflow command for one mod package.
 */
export function runModWorkflow(modId, action) {
  return postJson(`/api/mods/${encodeURIComponent(modId)}/${action}`, {});
}

/**
 * Create the base overworld dump through the local server.
 */
export function dumpBaseOverworld() {
  return postJson("/api/overworld-dump/create", {});
}
