/**
 * Strict shape helpers for compiler-backed overworld sprite placement sets.
 */

export function normalizeSpriteSet(value, coordLimits = 63, sourceData = null, area = 0) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Sprite set for area ${area} must be an object`);
  }
  if (!Array.isArray(value.sprites)) {
    throw new Error(`Sprite list for area ${area} must be an array`);
  }
  const limits = normalizeCoordLimits(coordLimits);
  return {
    info: normalizeInfo(value?.info),
    sprites: value.sprites.map((entry) => {
      const row = normalizeSpriteRow(entry, limits, sourceData, area);
      const custom = row.length === 4 ? normalizeCustomVisual(row[3], area) : null;
      const name = row[2];
      return {
        x: gridCoord(row[0], limits.x, area, "x"),
        y: gridCoord(row[1], limits.y, area, "y"),
        type: typeFromName(name, 0),
        name,
        ...(custom ? { custom } : {}),
      };
    }),
  };
}

export function normalizeInfo(info) {
  if (info !== undefined && info !== null && (typeof info !== "object" || Array.isArray(info))) {
    throw new Error("Sprite info must be an object");
  }
  return { gfx: byte(info?.gfx), palette: byte(info?.palette) };
}

export function validateSuppliedInfo(info, area, contextEditable) {
  if (info === undefined) {
    return;
  }
  if (info === null || typeof info !== "object" || Array.isArray(info)) {
    throw new Error(`Sprite info for area ${area} must be an object`);
  }
  if (!contextEditable) {
    if (Object.keys(info).length) {
      throw new Error(`Sprite info for area ${area} is not compiler-backed`);
    }
    return;
  }
  strictByte(info.gfx, "sprite info gfx");
  strictByte(info.palette, "sprite info palette");
}

function normalizeSpriteRow(entry, limits, sourceData, area) {
  if (!Array.isArray(entry) || (entry.length !== 3 && entry.length !== 4)) {
    throw new Error(`Sprite row for area ${area} must be [x, y, name]`);
  }
  gridCoord(entry[0], limits.x, area, "x");
  gridCoord(entry[1], limits.y, area, "y");
  const name = String(entry[2] ?? "");
  if (!byteSpriteName(sourceData, name)) {
    throw new Error(`Unknown overworld sprite name ${name} in area ${area}`);
  }
  return entry;
}

function normalizeCustomVisual(value, area) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Sprite custom visual for area ${area} must be an object`);
  }
  const darkWorld = value.darkWorld ?? false;
  if (typeof darkWorld !== "boolean") {
    throw new Error(`Sprite custom darkWorld for area ${area} must be boolean`);
  }
  return {
    gfx: strictByte(value.gfx, "sprite custom gfx"),
    palette: strictByte(value.palette, "sprite custom palette"),
    darkWorld,
    ...(value.sourceArea !== undefined ? { sourceArea: value.sourceArea } : {}),
  };
}

function normalizeCoordLimits(value) {
  return typeof value === "number" ? { x: value, y: value } : { x: value?.x ?? 63, y: value?.y ?? 63 };
}

function gridCoord(value, maxCoord, area, field) {
  const coord = integer(value, `sprite ${field}`);
  if (coord < 0 || coord > maxCoord) {
    throw new Error(`Sprite ${field} for area ${area} must be 0..${maxCoord}`);
  }
  return coord;
}

function integer(value, label) {
  if (Number.isInteger(value)) {
    return value;
  }
  const text = String(value).trim();
  if (!/^[+-]?(?:0x[0-9a-f]+|\d+)$/i.test(text)) {
    throw new Error(`${label} must be an integer`);
  }
  const sign = text.startsWith("-") ? -1 : 1;
  const unsigned = text.replace(/^[+-]/, "");
  const parsed = unsigned.toLowerCase().startsWith("0x")
    ? sign * Number.parseInt(unsigned.slice(2), 16)
    : Number.parseInt(text, 10);
  if (!Number.isInteger(parsed)) {
    throw new Error(`${label} must be an integer`);
  }
  return parsed;
}

function byte(value) {
  const parsed = numeric(value);
  const number = Number.isFinite(parsed) ? parsed : 0;
  return Math.max(0, Math.min(255, number));
}

function strictByte(value, label) {
  const parsed = integer(value, label);
  if (parsed < 0 || parsed > 255) {
    throw new Error(`${label} must be 0..255`);
  }
  return parsed;
}

function numeric(value) {
  if (Number.isInteger(value)) {
    return value;
  }
  const match = String(value ?? "").trim().match(/^(-?)(?:0x([0-9a-f]+)|([0-9]+))$/i);
  if (!match) {
    return null;
  }
  return (match[1] === "-" ? -1 : 1) * Number.parseInt(match[2] ?? match[3], match[2] ? 16 : 10);
}

function typeFromName(name, fallback) {
  const match = String(name).match(/^([0-9a-f]{2})-/i);
  const parsed = match ? Number.parseInt(match[1], 16) : NaN;
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 0xff ? parsed : fallback;
}

function byteSpriteName(sourceData, name) {
  if (!(sourceData?.spriteNames || []).includes(name)) {
    return false;
  }
  return typeFromName(name, null) !== null;
}
