/**
 * Applies saved lower-level tile-definition patches to the browser preview tables.
 */

const QUADRANTS = ["tl", "tr", "bl", "br"];
const QUADRANT_INDEX = { tl: 0, tr: 1, bl: 2, br: 3, 0: 0, 1: 1, 2: 2, 3: 3 };

/**
 * Apply every loaded tile-definition patch document to in-memory viewer assets.
 *
 * Parameters:
 *   state: Shared Workbench state containing assets and map32TransformState.
 *   patches: Loaded patch document map keyed by patch path.
 * Returns:
 *   None.
 */
export function applyTileDefinitionPatches(state, patches = {}) {
  applyMap16Definitions(state, patches["patches/map16-definitions.json"]);
  applyMap32Definitions(state, patches["patches/map32-definitions.json"]);
  applyMap8WordPatches(state, patches["patches/map8-words.json"]);
  applyMap8AttributePatches(state, patches["patches/tile-attributes.json"]);
}

/**
 * Apply map16 definitions from a loaded patch for immediate preview.
 *
 * Parameters:
 *   state: Shared Workbench state.
 *   document: map16 definitions patch document.
 * Returns:
 *   None.
 */
function applyMap16Definitions(state, document) {
  for (const definition of document?.definitions || []) {
    if (definition.kind !== "tile.map16-definition") {
      continue;
    }
    const id = defineLoadedId(
      state.map32TransformState.map16Ids,
      definition.id,
      state.map32TransformState,
      "nextMap16Id",
    );
    const base = definition.from === undefined ? [0, 0, 0, 0] :
      map16Words(state.assets, parseRef(definition.from, state.map32TransformState.map16Ids));
    const words = base.slice();
    for (const [label, value] of Object.entries(definition.setMap8 || {})) {
      words[resolveQuadrant(label)] = parseTileWord({ word: value });
    }
    writeMap16(state, id, words);
  }
}

/**
 * Apply map32 definitions from a loaded patch for immediate preview.
 *
 * Parameters:
 *   state: Shared Workbench state.
 *   document: map32 definitions patch document.
 * Returns:
 *   None.
 */
function applyMap32Definitions(state, document) {
  for (const definition of document?.definitions || []) {
    if (definition.kind !== "tile.map32-definition") {
      continue;
    }
    const id = defineLoadedId(
      state.map32TransformState.map32Ids,
      definition.id,
      state.map32TransformState,
      "nextMap32Id",
    );
    const base = definition.from === undefined ? [0, 0, 0, 0] :
      state.assets.map32ToMap16[parseRef(definition.from, state.map32TransformState.map32Ids)];
    const values = base.slice();
    for (const [label, value] of Object.entries(definition.setMap16 || {})) {
      values[resolveQuadrant(label)] = parseRef(value, state.map32TransformState.map16Ids);
    }
    ensureMap32(state.assets, id, values);
  }
}

/**
 * Apply direct map8 word edits from loaded patches for immediate preview.
 *
 * Parameters:
 *   state: Shared Workbench state.
 *   document: map8 word patch document.
 * Returns:
 *   None.
 */
function applyMap8WordPatches(state, document) {
  for (const operation of document?.edits || []) {
    if (operation.kind !== "tile.map8-word") {
      continue;
    }
    const target = operation.target || {};
    const map16 = parseRef(target.map16, state.map32TransformState.map16Ids);
    const slot = resolveQuadrant(target.slot || "tl");
    growMap16(state, map16, [0, 0, 0, 0]);
    const list = Array.from(state.assets.map16ToMap8);
    const offset = map16 * 4 + slot;
    list[offset] = parseTileWord(operation.set || operation, list[offset] || 0);
    state.assets.map16ToMap8 = list;
    syncMapCache(state);
  }
}

/**
 * Apply map8 tile-type table edits from loaded patches for immediate preview.
 *
 * Parameters:
 *   state: Shared Workbench state.
 *   document: tile attribute patch document.
 * Returns:
 *   None.
 */
function applyMap8AttributePatches(state, document) {
  const attributes = Array.from(state.sourceData?.map8TileAttributes || []);
  let changed = false;
  for (const operation of document?.edits || []) {
    if (operation.kind !== "tile.map8-attribute") {
      continue;
    }
    const target = operation.target || {};
    const index = parseRef(target.index ?? operation.index ?? target.tile ?? operation.tile);
    const value = parseAttributeValue(operation);
    validateRange(index, 0, 0x01ff, "map8 attribute index");
    validateRange(value, 0, 0xff, "map8 tile attribute");
    while (attributes.length < 512) {
      attributes.push(0);
    }
    attributes[index] = value;
    changed = true;
  }
  if (changed) {
    state.sourceData.map8TileAttributes = attributes;
    if (state.app?.mapCache) {
      state.app.mapCache.map8TileAttributes = attributes;
    }
  }
}

/**
 * Return the four map8 words that make up one map16 id.
 *
 * Parameters:
 *   assets: ZeldaAssets object.
 *   map16Id: Source map16 id.
 * Returns:
 *   Four map8 words ordered tl, tr, bl, br.
 */
function map16Words(assets, map16Id) {
  return Array.from(assets.map16ToMap8.slice(map16Id * 4, map16Id * 4 + 4));
}

/**
 * Define a loaded numeric or mod id in the editor-local allocator.
 *
 * Parameters:
 *   ids: Map from mod names to numeric ids.
 *   value: Definition id.
 *   allocator: Transform state holding the next loaded mod id.
 *   nextKey: Property name for the allocator counter.
 * Returns:
 *   Numeric id.
 */
function defineLoadedId(ids, value, allocator, nextKey) {
  if (typeof value === "string" && value.startsWith("mod:")) {
    if (!ids.has(value)) {
      ids.set(value, allocator[nextKey]);
      allocator[nextKey] += 1;
    }
    return ids.get(value);
  }
  return parseRef(value);
}

/**
 * Ensure the loaded map16 table contains one id.
 *
 * Parameters:
 *   state: Shared Workbench state.
 *   id: Numeric map16 id.
 *   words: Four map8 words used when growing the table.
 * Returns:
 *   None.
 */
function writeMap16(state, id, words) {
  const list = Array.from(state.assets.map16ToMap8);
  while (list.length < id * 4 + 4) {
    list.push(...words);
  }
  list.splice(id * 4, 4, ...words);
  state.assets.map16ToMap8 = list;
  syncMapCache(state);
}

/**
 * Grow the map16 table to contain one row without replacing an existing row.
 *
 * Parameters:
 *   state: Shared Workbench state.
 *   id: Numeric map16 id.
 *   words: Four map8 words used only for newly appended rows.
 * Returns:
 *   None.
 */
function growMap16(state, id, words) {
  const list = Array.from(state.assets.map16ToMap8);
  while (list.length < id * 4 + 4) {
    list.push(...words);
  }
  state.assets.map16ToMap8 = list;
  syncMapCache(state);
}

/**
 * Ensure the loaded map32 table contains one id.
 *
 * Parameters:
 *   assets: ZeldaAssets object.
 *   id: Numeric map32 id.
 *   values: Four map16 ids.
 * Returns:
 *   None.
 */
function ensureMap32(assets, id, values) {
  while (assets.map32ToMap16.length <= id) {
    assets.map32ToMap16.push([0, 0, 0, 0]);
  }
  assets.map32ToMap16[id] = values;
}

/**
 * Keep OverworldMapCache pointed at the current map16 table.
 *
 * Parameters:
 *   state: Shared Workbench state.
 * Returns:
 *   None.
 */
function syncMapCache(state) {
  if (state.app?.mapCache) {
    state.app.mapCache.map16ToMap8 = state.assets.map16ToMap8;
  }
}

/**
 * Parse a packed word or individual SNES BG tile-word fields.
 *
 * Parameters:
 *   fields: Object with `word` or tile/palette/priority/hFlip/vFlip fields.
 *   current: Existing word used for omitted fields.
 * Returns:
 *   Packed 16-bit map8 word.
 */
function parseTileWord(fields, current = 0) {
  if (fields.word !== undefined) {
    const word = parseRef(fields.word);
    validateRange(word, 0, 0xffff, "tile word");
    return word;
  }
  const tile = parseRef(fields.tile ?? (current & 0x03ff));
  const palette = parseRef(fields.palette ?? ((current >> 10) & 7));
  const priority = parseBooleanField(fields, "priority", Boolean(current & 0x2000));
  const hFlip = parseBooleanField(fields, "hFlip", Boolean(current & 0x4000));
  const vFlip = parseBooleanField(fields, "vFlip", Boolean(current & 0x8000));
  validateRange(tile, 0, 0x03ff, "CHR tile id");
  validateRange(palette, 0, 7, "palette row");
  return tile | (palette << 10) | (priority << 13) | (hFlip << 14) | (vFlip << 15);
}

/**
 * Read one explicit boolean bit flag from a tile-word patch object.
 *
 * Parameters:
 *   fields: Patch object containing tile-word fields.
 *   key: Flag field name.
 *   defaultValue: Current bit value when the field is omitted.
 * Returns:
 *   Boolean flag value.
 */
function parseBooleanField(fields, key, defaultValue) {
  if (!(key in fields)) {
    return defaultValue;
  }
  if (typeof fields[key] !== "boolean") {
    throw new Error(`${key} must be boolean`);
  }
  return fields[key];
}

/**
 * Resolve the tile-type byte from the supported patch operation shapes.
 *
 * Parameters:
 *   operation: Patch operation containing `set`, `attribute`, or `type`.
 * Returns:
 *   Parsed tile-type byte.
 */
function parseAttributeValue(operation) {
  const setValue = operation.set;
  if (setValue && typeof setValue === "object") {
    return parseRef(setValue.attribute ?? setValue.type);
  }
  if (setValue !== undefined) {
    return parseRef(setValue);
  }
  return parseRef(operation.attribute ?? operation.type);
}

/**
 * Resolve a quadrant label to the 0..3 map16/map8 slot index.
 *
 * Parameters:
 *   value: tl/tr/bl/br or numeric 0..3.
 * Returns:
 *   Integer quadrant index.
 */
function resolveQuadrant(value) {
  if (!(value in QUADRANT_INDEX)) {
    throw new Error(`Unknown quadrant ${value}`);
  }
  return QUADRANT_INDEX[value];
}

/**
 * Parse a numeric, base, hex, decimal, or loaded mod reference.
 *
 * Parameters:
 *   value: Reference value.
 *   ids: Optional loaded mod-id map.
 * Returns:
 *   Numeric id.
 */
function parseRef(value, ids = null) {
  if (typeof value === "number") {
    return parseInteger(value);
  }
  if (typeof value === "string" && value.startsWith("base:")) {
    return parseInteger(value.slice(5));
  }
  if (typeof value === "string" && value.startsWith("mod:")) {
    if (!ids?.has(value)) {
      throw new Error(`Unresolved mod reference ${value}`);
    }
    return ids.get(value);
  }
  return parseInteger(value);
}

/**
 * Parse an integer value using the same accepted shapes as the Python resolver.
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

/**
 * Validate an integer field against the compiler's accepted range.
 *
 * Parameters:
 *   value: Parsed integer.
 *   min: Inclusive lower bound.
 *   max: Inclusive upper bound.
 *   label: Human-readable field label.
 * Returns:
 *   None.
 */
function validateRange(value, min, max, label) {
  if (value < min || value > max) {
    throw new Error(`${label} is outside ${min}..${max}`);
  }
}
