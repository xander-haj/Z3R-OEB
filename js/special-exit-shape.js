/**
 * Shape conversion for special-exit payloads compiled into kSpExit_* tables.
 */

export const SPECIAL_EXIT_FIELDS = [
  { key: "dir", yaml: "dir", label: "Dir", min: 0, max: 3 },
  { key: "sprGfx", yaml: "spr_gfx", label: "Spr GFX", min: 0, max: 0xff },
  { key: "auxGfx", yaml: "aux_gfx", label: "Aux GFX", min: 0, max: 0xff },
  { key: "palBg", yaml: "pal_bg", label: "BG Pal", min: 0, max: 0xff },
  { key: "palSpr", yaml: "pal_spr", label: "Spr Pal", min: 0, max: 0xff },
  { key: "top", yaml: "top", label: "Top", min: 0, max: 0xffff },
  { key: "bottom", yaml: "bottom", label: "Bottom", min: 0, max: 0xffff },
  { key: "left", yaml: "left", label: "Left", min: 0, max: 0xffff },
  { key: "right", yaml: "right", label: "Right", min: 0, max: 0xffff },
  { key: "leftEdgeOfMap", yaml: "left_edge_of_map", label: "Left Edge", min: 0, max: 0xffff },
  { key: "unk4", yaml: "unk4", label: "Unk4", min: -0x8000, max: 0x7fff },
  { key: "unk5", yaml: "unk5", label: "Unk5", min: -0x8000, max: 0x7fff },
  { key: "unk6", yaml: "unk6", label: "Unk6", min: -0x8000, max: 0x7fff },
  { key: "unk7", yaml: "unk7", label: "Unk7", min: -0x8000, max: 0x7fff },
];

/**
 * Normalize YAML-shaped or camel-cased special-exit data to editor keys.
 *
 * Parameters:
 *   value: Special-exit payload from YAML, dump metadata, or editor state.
 * Returns:
 *   Camel-cased payload, or null when absent.
 */
export function normalizeSpecialExit(value) {
  if (!value || typeof value !== "object") {
    return null;
  }
  const result = {};
  for (const field of SPECIAL_EXIT_FIELDS) {
    result[field.key] = numeric(field, value[field.key] ?? value[field.yaml]);
  }
  return result;
}

/**
 * Convert editor special-exit data back to the YAML shape used by compile_resources.py.
 *
 * Parameters:
 *   value: Camel-cased special-exit payload.
 * Returns:
 *   Snake-cased YAML payload.
 */
export function toYamlSpecialExit(value) {
  const source = normalizeSpecialExit(value);
  if (!source) {
    return null;
  }
  const result = {};
  for (const field of SPECIAL_EXIT_FIELDS) {
    result[field.yaml] = source[field.key];
  }
  return result;
}

/**
 * Parse one special-exit input exactly and report fixed-table range errors.
 *
 * Parameters:
 *   field: SPECIAL_EXIT_FIELDS entry describing the target ROM table.
 *   value: User-entered decimal or hex text.
 * Returns:
 *   Object with value on success, or error text on failure.
 */
export function parseSpecialExitField(field, value) {
  const parsed = parseStrictInteger(value);
  if (!Number.isInteger(parsed)) {
    return { error: `${field.label} must be an integer ${specialExitRangeText(field)}` };
  }
  if (parsed < field.min || parsed > field.max) {
    return { error: `${field.label} must be ${specialExitRangeText(field)}` };
  }
  return { value: parsed };
}

/**
 * Format a field's inclusive compiler-backed range for labels and errors.
 *
 * Parameters:
 *   field: SPECIAL_EXIT_FIELDS entry with min and max values.
 * Returns:
 *   Human-readable inclusive range.
 */
export function specialExitRangeText(field) {
  return `${field.min}..${field.max}`;
}

/**
 * Parse decimal, signed decimal, hex, or signed hex without accepting suffix junk.
 */
function parseStrictInteger(value) {
  if (Number.isInteger(value)) {
    return value;
  }
  const match = String(value ?? "").trim().match(/^(-?)(?:0x([0-9a-f]+)|([0-9]+))$/i);
  if (!match) {
    return null;
  }
  const sign = match[1] === "-" ? -1 : 1;
  const digits = match[2] ?? match[3];
  return sign * Number.parseInt(digits, match[2] ? 16 : 10);
}

/**
 * Normalize source values to the fixed range used by the compiled kSpExit table.
 */
function numeric(field, value) {
  const parsed = parseStrictInteger(value);
  const number = Number.isInteger(parsed) ? parsed : field.min;
  return Math.max(field.min, Math.min(field.max, number));
}
