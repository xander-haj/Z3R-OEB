/**
 * Converts edited in-memory map32 state into sparse instruction-only patches.
 */

/**
 * Snapshot map32 words for later sparse diffing.
 *
 * Parameters:
 *   assets: ZeldaAssets object.
 * Returns:
 *   Array of plain arrays copied from map32Words.
 */
export function snapshotMap32(assets) {
  return assets.map32Words.map((words) => Array.from(words));
}

/**
 * Build a sparse terrain patch by comparing base and current map32 words.
 *
 * Parameters:
 *   base: Snapshot from snapshotMap32.
 *   assets: Current ZeldaAssets object.
 * Returns:
 *   Terrain patch document.
 */
export function exportTerrainPatch(base, assets) {
  const patches = [];
  for (let screen = 0; screen < assets.map32Words.length; screen += 1) {
    const edits = [];
    const current = assets.map32Words[screen];
    for (let index = 0; index < current.length; index += 1) {
      if (current[index] === base[screen][index]) {
        continue;
      }
      edits.push({
        x: index % 16,
        y: Math.floor(index / 16),
        expect: formatRef(base[screen][index]),
        map32: formatRef(current[index]),
      });
    }
    if (edits.length) {
      patches.push({ kind: "terrain.map32-placement", screen, set: edits });
    }
  }
  return { format: "zelda3-overworld-terrain-patch-v1", patches };
}

/**
 * Apply a saved terrain patch to loaded map32 arrays.
 *
 * Parameters:
 *   assets: Current ZeldaAssets object.
 *   document: Terrain patch document from a mod package.
 *   map32Ids: Optional map32 mod-id map from loaded tile definitions.
 * Returns:
 *   None.
 */
export function applyTerrainPatchDocument(assets, document, map32Ids = null) {
  if (!document || !assets) {
    return;
  }
  for (const patch of document.patches || []) {
    if (patch.kind !== "terrain.map32-placement") {
      continue;
    }
    const screen = parseInteger(patch.screen);
    const words = assets.map32Words[screen];
    if (!words) {
      throw new Error(`Terrain screen ${screen} is outside the loaded map set`);
    }
    for (const edit of patch.set || []) {
      const x = parseInteger(edit.x);
      const y = parseInteger(edit.y);
      if (x < 0 || x >= 16 || y < 0 || y >= 16) {
        throw new Error(`Terrain edit coordinate ${x},${y} is outside 16x16`);
      }
      const index = y * 16 + x;
      if (edit.expect !== undefined && words[index] !== parseRef(edit.expect)) {
        continue;
      }
      words[index] = parseRef(edit.map32 ?? edit.set, map32Ids);
    }
  }
}

/**
 * Format a base numeric tile id as a recipe reference.
 *
 * Parameters:
 *   value: Numeric tile id.
 * Returns:
 *   base:0x.... reference.
 */
export function formatRef(value) {
  return `base:0x${Number(value).toString(16).padStart(4, "0")}`;
}

/**
 * Parse a recipe reference or numeric JSON value.
 *
 * Parameters:
 *   value: base:0x reference, hex string, decimal string, number, or defined mod reference.
 *   map32Ids: Optional map32 mod-id map from loaded tile definitions.
 * Returns:
 *   Numeric tile id.
 */
function parseRef(value, map32Ids = null) {
  if (typeof value === "string" && value.startsWith("base:")) {
    return validateMap32Id(parseInteger(value.slice(5)));
  }
  if (typeof value === "string" && value.startsWith("mod:")) {
    if (!map32Ids?.has(value)) {
      throw new Error(`Mod map32 id ${value} must be defined before terrain placement`);
    }
    return validateMap32Id(map32Ids.get(value));
  }
  return validateMap32Id(parseInteger(value));
}

/**
 * Validate one unsigned 16-bit map32 id.
 *
 * Parameters:
 *   value: Candidate map32 id.
 * Returns:
 *   Validated map32 id.
 */
function validateMap32Id(value) {
  if (!Number.isInteger(value) || value < 0 || value > 0xffff) {
    throw new Error("Terrain map32 reference must be 0..0xffff");
  }
  return value;
}

/**
 * Parse an integer value from JSON or recipe text.
 *
 * Parameters:
 *   value: Number, decimal string, or 0x-prefixed hexadecimal string.
 * Returns:
 *   Parsed integer.
 */
function parseInteger(value) {
  if (typeof value === "number") {
    if (!Number.isInteger(value)) {
      throw new Error(`Expected integer value, got ${value}`);
    }
    return value;
  }
  const text = String(value);
  if (!/^[+-]?(?:0[xX][0-9a-fA-F]+|\d+)$/.test(text)) {
    throw new Error(`Expected integer value, got ${value}`);
  }
  const body = /^[+-]/.test(text) ? text.slice(1) : text;
  return Number.parseInt(text, body.toLowerCase().startsWith("0x") ? 16 : 10);
}
