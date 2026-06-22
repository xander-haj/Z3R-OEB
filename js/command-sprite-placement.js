/**
 * Undo/redo helpers for overworld sprite placement rows.
 */

/**
 * Apply a sprite placement command in either direction.
 *
 * Parameters:
 *   sourceData: Parsed source tables from source-parser.js.
 *   command: Sprite placement command.
 *   direction: "undo" or "redo".
 * Returns:
 *   None.
 */
export function applySpritePlacementCommand(sourceData, command, direction) {
  if (command.action === "replace") {
    replaceSpritePlacements(sourceData, command, direction);
    return;
  }
  if (command.action === "delete") {
    deleteSpritePlacements(sourceData, command, direction);
    return;
  }
  for (const placement of command.placements || []) {
    if (direction === "undo") {
      removeSpritePlacement(sourceData, placement);
    } else {
      insertSpritePlacement(sourceData, placement);
    }
  }
}

/**
 * Replace one or more selected sprite rows.
 */
function replaceSpritePlacements(sourceData, command, direction) {
  for (const placement of command.placements || []) {
    const sprites = spriteList(sourceData, placement);
    if (!sprites?.[placement.index]) {
      continue;
    }
    sprites[placement.index] = clone(direction === "undo" ? placement.before : placement.after);
  }
}

/**
 * Delete or restore one or more selected sprite rows.
 */
function deleteSpritePlacements(sourceData, command, direction) {
  for (const placement of command.placements || []) {
    if (direction === "undo") {
      insertSpritePlacement(sourceData, { ...placement, sprite: placement.before });
    } else {
      removeSpritePlacement(sourceData, { ...placement, sprite: placement.before });
    }
  }
}

/**
 * Remove one exact sprite placement from a stage.
 */
function removeSpritePlacement(sourceData, placement) {
  const sprites = spriteList(sourceData, placement);
  if (!sprites) {
    return;
  }
  const expected = JSON.stringify(placement.sprite);
  const exact = sprites[placement.index] && JSON.stringify(sprites[placement.index]) === expected;
  const index = exact ? placement.index : findLastMatchingSprite(sprites, expected);
  if (index >= 0) {
    sprites.splice(index, 1);
  }
}

/**
 * Find the latest sprite entry matching a serialized placement.
 */
function findLastMatchingSprite(sprites, expected) {
  for (let index = sprites.length - 1; index >= 0; index -= 1) {
    if (JSON.stringify(sprites[index]) === expected) {
      return index;
    }
  }
  return -1;
}

/**
 * Reinsert one sprite placement at its original stage position.
 */
function insertSpritePlacement(sourceData, placement) {
  const sprites = spriteList(sourceData, placement);
  if (!sprites) {
    return;
  }
  const index = Math.max(0, Math.min(placement.index, sprites.length));
  sprites.splice(index, 0, clone(placement.sprite));
}

/**
 * Return the mutable sprite array for one placement descriptor.
 */
function spriteList(sourceData, placement) {
  return sourceData?.areaHeaders?.[placement.area]?.spriteSets?.[placement.stage]?.sprites || null;
}

/**
 * Clone JSON-compatible values.
 */
function clone(value) {
  return JSON.parse(JSON.stringify(value));
}
