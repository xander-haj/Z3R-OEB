/**
 * Undo/redo helper for shared overworld sprite-set gfx/palette metadata.
 */

/**
 * Apply one sprite context command in either undo or redo direction.
 *
 * Parameters:
 *   target: Parsed source data or shared Workbench state.
 *   command: metadata.set-sprite-info command.
 *   direction: "undo" or "redo".
 * Returns:
 *   None.
 */
export function applySpriteInfoCommand(target, command, direction) {
  const sourceData = target?.areaHeaders ? target : target?.sourceData;
  const header = sourceData?.areaHeaders?.[command.area];
  if (!header) {
    return;
  }
  header.spriteSets = header.spriteSets || {};
  const stage = command.area >= 64 ? "first" : command.stage;
  const set = header.spriteSets[stage] || fallbackSet(header.spriteSets);
  set.info = clone(direction === "undo" ? command.before : command.after);
  set.sprites = Array.isArray(set.sprites) ? set.sprites : [];
  header.spriteSets[stage] = set;
  if (command.area >= 64) {
    header.spriteSets.beginning = set;
    header.spriteSets.first = set;
    header.spriteSets.second = set;
  }
}

/**
 * Reuse an existing stage when a stale dump is missing the requested key.
 */
function fallbackSet(sets) {
  return sets.first || sets.second || sets.beginning || { info: { gfx: 0, palette: 0 }, sprites: [] };
}

/**
 * Clone a JSON-compatible info block.
 */
function clone(value) {
  return JSON.parse(JSON.stringify(value));
}
