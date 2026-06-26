/**
 * Default patch envelopes used by the Workbench JSON patch editors.
 *
 * The patch editor panel needs empty documents that match each modding schema
 * so saving an untouched mod still writes valid data-only patch files.
 */

/**
 * Return the default empty patch document for a path.
 *
 * Parameters:
 *   path: Patch path.
 * Returns:
 *   Empty patch envelope.
 */
export function defaultPatch(path) {
  if (path.includes("map32-definitions")) {
    return { format: "zelda3-overworld-map32-definitions-v1", definitions: [] };
  }
  if (path.includes("map16-definitions")) {
    return { format: "zelda3-overworld-map16-definitions-v1", definitions: [] };
  }
  if (path.includes("map8-words")) {
    return { format: "zelda3-overworld-map8-words-v1", edits: [] };
  }
  if (path.includes("tile-attributes")) {
    return { format: "zelda3-overworld-tile-attributes-v1", edits: [] };
  }
  if (path.includes("chr-recipes")) {
    return { format: "zelda3-overworld-chr-recipes-v1", recipes: [] };
  }
  if (path.includes("palettes")) {
    return { format: "zelda3-overworld-palettes-v1", patches: [] };
  }
  if (path.includes("metadata")) {
    return { format: "zelda3-overworld-metadata-v1", patches: [] };
  }
  if (path.includes("dialogue")) {
    return { format: "zelda3-overworld-dialogue-v1", patches: [] };
  }
  throw new Error(`Unsupported patch editor path: ${path}`);
}
