/**
 * Shape conversion for overworld Items rows compiled into kOverworldSecrets.
 */

const ENTRANCE_CODES = new Set([0x80, 0x82, 0x84, 0x86, 0x88]);
const SECRET_SPRITE_CODES = new Set([0x02, 0x03, 0x0e, 0x0f, 0x10, 0x11, 0x12]);
const RANDOM_SECRET_CODES = [0x13, 0x14, 0x15, 0x16];
const SECRET_SPRITE_TYPES = [
  0xd9, 0x3e, 0x79, 0xd9, 0xdc, 0xd8, 0xda, 0xe4, 0xe1, 0xdc, 0xd8,
  0xdf, 0xe0, 0x0b, 0x42, 0xd3, 0x41, 0xd4, 0xd9, 0xe3, 0xd8, 0x00,
];
const SECRET_SPAWN_AI_STATE = [
  0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 3, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0,
];
const SECRET_SPAWN_X_OFFSET = [
  4, 0, 4, 4, 0, 4, 4, 4, 4, 0, 4, 4, 4, 0, 0, 0, 0, 0, 4, 0, 4, 4,
];
const SECRET_IGNORE_PROJECTILE = [
  1, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 1, 1, 1, 1,
];
const SECRET_Z_VELOCITY = [
  16, 0, 0, 16, 0, 0, 16, 16, 16, 16, 0, 16, 10, 16, 0, 0, 0, 0, 16, 0,
  0, 0,
];

export const SECRET_ITEM_NAMES = [
  "00-Nothing",
  "01-Rupee-G",
  "02-RockCrab",
  "03-Bee",
  "04-Random",
  "05-Bomb",
  "06-Heart",
  "07-Rupee-B",
  "08-Key",
  "09-Arrow",
  "0A-Bomb",
  "0B-Heart",
  "0C-Magic",
  "0D-BigMagic",
  "0E-Chicken",
  "0F-GreenSoldier",
  "10-AliveRock",
  "11-BlueSoldier",
  "12-GroundBomb",
  "13-Rupee-G",
  "14-Fairy",
  "15-Heart",
  "16-Raven",
  "80-Hole",
  "82-Warp",
  "84-Staircase",
  "86-Bombable",
  "88-Switch",
];

const DISPLAY_NAMES = {
  0x00: "Nothing",
  0x01: "Green Rupee",
  0x02: "Hoarder",
  0x03: "Bee",
  0x04: "Random",
  0x05: "Bomb",
  0x06: "Heart",
  0x07: "Blue Rupee",
  0x08: "Small Key",
  0x09: "Arrow",
  0x0a: "Bomb",
  0x0b: "Heart",
  0x0c: "Small Magic",
  0x0d: "Big Magic",
  0x0e: "Cucco",
  0x0f: "Green Soldier",
  0x10: "Bush Stal",
  0x11: "Blue Soldier",
  0x12: "Landmine",
  0x13: "Green Rupee",
  0x14: "Fairy",
  0x15: "Heart",
  0x16: "Nothing",
  0x80: "Hole",
  0x82: "Warp",
  0x84: "Staircase",
  0x86: "Bombable",
  0x88: "Switch",
};

const SPRITE_NAMES = {
  0x0b: "0B-Chicken",
  0x3e: "3E-RockCrab",
  0x41: "41-BlueSoldier",
  0x42: "42-GreenSoldier",
  0x79: "79-Bee",
  0xd3: "D3-AliveRock",
  0xd4: "D4-GroundBomb",
  0xd8: "D8-Heart",
  0xd9: "D9-Rupee-G",
  0xda: "DA-Rupee-B",
  0xdc: "DC-Bomb",
  0xdf: "DF-Magic",
  0xe0: "E0-BigMagic",
  0xe1: "E1-Arrow",
  0xe3: "E3-Fairy",
  0xe4: "E4-Key",
};

/**
 * Normalize a YAML row or browser item object to the interaction overlay shape.
 *
 * Parameters:
 *   value: `[x, y, name]` YAML row or normalized item object.
 * Returns:
 *   Browser-friendly item object.
 */
export function normalizeSecretItem(value, runtimeData = null, names = SECRET_ITEM_NAMES) {
  const row = Array.isArray(value) ? { x: value[0], y: value[1], name: value[2] } : value || {};
  const itemNames = names?.length ? names : SECRET_ITEM_NAMES;
  const name = validName(row.name, itemNames) ? row.name : itemNames[0];
  const code = parseCode(name);
  const runtime = normalizeRuntime(runtimeData);
  const spriteType = secretSpriteType(code, runtime, row.spriteType ?? row.sprite_type);
  return {
    x: numeric(row.x),
    y: numeric(row.y),
    behavior: behavior(code, spriteType),
    code,
    displayName: displayName(code, name),
    layer: layerForCode(code),
    name,
    source: row.source || "metadata.item patch",
    sourceTable: row.sourceTable || row.source_table || "kOverworldSecrets",
    ...spriteFields(spriteType, row.spriteName ?? row.sprite_name),
    ...secretSpawnFields(spriteType, row),
    ...runtimeSpawnFields(code, spriteType, runtime, row),
    ...randomFields(code, runtime),
  };
}

/**
 * Convert a browser item object back to the YAML row shape used by the compiler.
 *
 * Parameters:
 *   value: Normalized item object.
 * Returns:
 *   `[x, y, name]` row.
 */
export function toYamlSecretItem(value, runtimeData = null, names = SECRET_ITEM_NAMES) {
  const item = normalizeSecretItem(value, runtimeData, names);
  return [item.x, item.y, item.name];
}

/**
 * Return compiler-backed secret item names from source data.
 */
export function secretItemNames(sourceData) {
  return sourceData?.secretItemNames?.length ? sourceData.secretItemNames : SECRET_ITEM_NAMES;
}

/**
 * Return parsed Sprite_SpawnSecret runtime tables from source data.
 */
export function secretSpawnRuntime(sourceData) {
  return sourceData?.secretSpawnRuntime || null;
}

/**
 * Return the maximum secret grid coordinates for this area's topology shape.
 *
 * Parameters:
 *   areaHeader: Parsed area header.
 * Returns:
 *   Object with x and y inclusive maxima.
 */
export function secretItemCoordLimits(areaHeader) {
  const size = areaHeader?.size;
  return {
    x: size === "big" || size === "wide" ? 63 : 31,
    y: size === "big" || size === "tall" ? 63 : 31,
  };
}

/**
 * Return true when a name exists in the compiler's kSecretNames mapping.
 */
export function validName(name, names = SECRET_ITEM_NAMES) {
  return names.includes(name);
}

/**
 * Parse the numeric code prefix from a secret name.
 */
function parseCode(name) {
  return Number.parseInt(String(name).slice(0, 2), 16);
}

/**
 * Categorize the runtime behavior from the secret code.
 */
function behavior(code, spriteType) {
  if (ENTRANCE_CODES.has(code)) {
    return "entrance_or_trigger";
  }
  if (code === 4) {
    return "random_sprite_or_empty";
  }
  if (spriteType !== null) {
    return "fixed_sprite_spawn";
  }
  return "no_spawn";
}

/**
 * Return the Workbench layer for a normalized secret code.
 */
function layerForCode(code) {
  if (ENTRANCE_CODES.has(code)) {
    return "secretEntrances";
  }
  if (SECRET_SPRITE_CODES.has(code)) {
    return "secretEnemies";
  }
  return "secretTreasure";
}

/**
 * Return a runtime-oriented display name while preserving the exact YAML name.
 */
function displayName(code, name) {
  return DISPLAY_NAMES[code] || String(name).split("-", 2)[1] || name;
}

/**
 * Return the Sprite_SpawnSecret sprite type for fixed low-code secrets.
 */
function secretSpriteType(code, runtime, existing = null) {
  if (!Number.isInteger(code) || code < 1 || code > runtime.spriteTypes.length || code === 4) {
    return null;
  }
  const spriteType = runtime.spriteTypes[code - 1] ?? existing;
  return spriteType || null;
}

/**
 * Return optional sprite identity fields.
 */
function spriteFields(spriteType, existingName = null) {
  if (spriteType === null) {
    return {};
  }
  return { spriteType, spriteName: existingName || SPRITE_NAMES[spriteType] || hex(spriteType) };
}

/**
 * Return source-backed Sprite_SpawnSecret visual state overrides.
 */
function secretSpawnFields(spriteType, row = {}) {
  if (spriteType === null) {
    return {};
  }
  const fields = { spriteGraphics: row.spriteGraphics ?? row.sprite_graphics ?? 0 };
  const oamFlags = row.oamFlags ?? row.oam_flags;
  if (oamFlags !== null && oamFlags !== undefined) {
    fields.oamFlags = oamFlags;
  } else if (spriteType === 0x3e) {
    fields.oamFlags = 9;
  }
  return fields;
}

/**
 * Return runtime fields copied by Sprite_SpawnSecret for fixed spawned sprites.
 */
function runtimeSpawnFields(code, spriteType, runtime, row = {}) {
  if (spriteType === null || !Number.isInteger(code) || code < 1 || code > 22 || code === 4) {
    return {};
  }
  const index = code - 1;
  return {
    ignoreProjectile: arrayValue(runtime.ignoreProjectile, index, row.ignoreProjectile ?? row.ignore_projectile),
    spawnAiState: arrayValue(runtime.spawnAiState, index, row.spawnAiState ?? row.spawn_ai_state),
    spawnXOffset: arrayValue(runtime.spawnXOffset, index, row.spawnXOffset ?? row.spawn_x_offset),
    zVelocity: arrayValue(runtime.zVelocity, index, row.zVelocity ?? row.z_velocity),
  };
}

/**
 * Return the exact random secret pool used by Sprite_SpawnSecret for code 0x04.
 */
function randomFields(code, runtime) {
  if (code !== 4) {
    return {};
  }
  return {
    randomOptions: RANDOM_SECRET_CODES.map((optionCode) => ({
      code: optionCode,
      displayName: displayName(optionCode, null),
      ...spriteFields(secretSpriteType(optionCode, runtime)),
    })),
    runtimeNote: "Sprite_SpawnSecret chooses codes 0x13..0x16; outdoors can also drop nothing.",
  };
}

/**
 * Normalize runtime tables from source_tables, with constants for older dumps.
 */
function normalizeRuntime(runtimeData) {
  const data = runtimeData || {};
  return {
    spriteTypes: data.spriteTypes || data.sprite_types || SECRET_SPRITE_TYPES,
    ignoreProjectile: data.ignoreProjectile || data.ignore_projectile || SECRET_IGNORE_PROJECTILE,
    spawnAiState: data.spawnAiState || data.spawn_ai_state || SECRET_SPAWN_AI_STATE,
    spawnXOffset: data.spawnXOffset || data.spawn_x_offset || SECRET_SPAWN_X_OFFSET,
    zVelocity: data.zVelocity || data.z_velocity || SECRET_Z_VELOCITY,
  };
}

function arrayValue(values, index, fallback = null) {
  const value = values?.[index];
  return value === undefined || value === null ? fallback : value;
}

/**
 * Parse decimal, hex, or numeric input into a finite integer.
 */
function numeric(value, fallback = 0) {
  if (Number.isInteger(value)) {
    return value;
  }
  const match = String(value ?? "").trim().match(/^([+-]?)(?:0x([0-9a-f]+)|(\d+))$/i);
  if (!match) {
    return fallback;
  }
  const sign = match[1] === "-" ? -1 : 1;
  return sign * Number.parseInt(match[2] ?? match[3], match[2] ? 16 : 10);
}

/**
 * Format a sprite type as the dumped sprite-name prefix.
 */
function hex(value) {
  return `${Number(value).toString(16).toUpperCase().padStart(2, "0")}-Sprite`;
}
