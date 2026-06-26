/**
 * Loads and indexes the editor-facing database emitted by restool.py --editor-assets.
 *
 * The Workbench still renders from assets/overworld_dump. This module supplies
 * supplemental truth from assets/dat-dump so panels and allocation tools can use
 * exported constraints, source ownership, dialogue bindings, and tile/sprite facts.
 */

const DEFAULT_DUMP_PATH = "assets/dat-dump";

const DOCUMENT_KEYS = {
  allocExits: "allocators/exits",
  allocFallHoles: "allocators/fall_holes",
  allocOverworldEntrances: "allocators/overworld_entrances",
  allocSpecialExits: "allocators/special_exits",
  behaviorBindings: "sprites/behavior_bindings",
  collisionAttributes: "tiles/collision_attributes",
  constraints: "constraints",
  dialogueStrings: "dialogue/dialogue_strings",
  entranceGraph: "navigation/entrance_graph",
  exitGraph: "navigation/exit_graph",
  graphicsRequirements: "sprites/graphics_requirements",
  map16Tiles: "tiles/map16_tiles",
  map32Tiles: "tiles/map32_tiles",
  map8Tiles: "tiles/map8_tiles",
  npcDialogueBindings: "dialogue/npc_dialogue_bindings",
  overworldAreas: "overworld/areas",
  paletteRequirements: "sprites/palette_requirements",
  paletteUsage: "tiles/palette_usage",
  placementIndex: "sprites/placement_index",
  signBindings: "dialogue/sign_bindings",
  sourceAreas: "overworld/source_areas",
  spriteOamFrames: "sprites/oam_frames",
  spriteCatalog: "sprites/sprite_catalog",
  tileUsage: "tiles/tile_usage",
  topology: "world/topology",
  travelGraph: "navigation/travel_graph",
  validation: "validation",
};

const OPTIONAL_DOCUMENTS = new Set(["npcDialogueBindings", "sourceAreas", "spriteOamFrames"]);

/**
 * Load the editor database and return an indexed object safe for UI lookups.
 *
 * Parameters:
 *   prefix: Optional URL prefix used by generated preview routes.
 *   dumpPath: Dump root that contains editor_index.json.
 * Returns:
 *   Promise resolving to an available or unavailable database descriptor.
 */
export async function loadEditorDatabase(prefix = "", dumpPath = DEFAULT_DUMP_PATH) {
  const indexResponse = await fetch(assetUrl(prefix, dumpPath, "editor_index.json"));
  if (indexResponse.status === 404) {
    return unavailableDatabase(dumpPath, "editor_index.json is missing");
  }
  if (!indexResponse.ok) {
    throw new Error(`Unable to load editor_index.json: ${indexResponse.status}`);
  }
  const index = await indexResponse.json();
  const docs = await loadDocuments(prefix, dumpPath, index.outputs || {});
  return {
    available: true,
    dumpPath,
    index,
    raw: docs,
    allocators: allocatorDocuments(docs),
    indexes: buildIndexes(docs),
    missingOptionalOutputs: missingOptionalOutputs(index.outputs || {}),
  };
}

/**
 * Build a short status line for the top bar after database load.
 *
 * Parameters:
 *   editorDb: Database descriptor returned by loadEditorDatabase.
 * Returns:
 *   Human-readable status string.
 */
export function editorDatabaseStatus(editorDb) {
  if (!editorDb?.available) {
    return "Ready; editor dat-dump not loaded";
  }
  const issues = editorDb.raw.validation?.issue_count || 0;
  const optional = editorDb.missingOptionalOutputs.length ? "; regenerate optional editor files" : "";
  return issues ? `Ready; editor DB loaded with ${issues} validation issue(s)${optional}` :
    `Ready; editor DB loaded${optional}`;
}

/**
 * Let the newer editor database enrich the renderer's older source-table payload.
 *
 * Parameters:
 *   sourceData: Parsed overworld_dump source data used by the renderer.
 *   editorDb: Database descriptor returned by loadEditorDatabase.
 * Returns:
 *   The same sourceData object after in-place enrichment.
 */
export function applyEditorDatabaseToSourceData(sourceData, editorDb) {
  const oam = editorDb?.raw?.spriteOamFrames?.tables;
  if (sourceData?.spriteOam && oam) {
    sourceData.spriteOam = mergeSpriteOam(sourceData.spriteOam, oam);
  }
  return sourceData;
}

/**
 * Load every document declared in DOCUMENT_KEYS from the indexed output map.
 *
 * Parameters:
 *   prefix: Optional URL prefix.
 *   dumpPath: Dump root that contains editor outputs.
 *   outputs: editor_index.json output map.
 * Returns:
 *   Promise resolving to a property-keyed document map.
 */
async function loadDocuments(prefix, dumpPath, outputs) {
  const entries = await Promise.all(Object.entries(DOCUMENT_KEYS).map(async ([name, outputKey]) => {
    const optional = OPTIONAL_DOCUMENTS.has(name);
    return [name, await loadDocument(prefix, dumpPath, outputs, outputKey, optional)];
  }));
  return Object.fromEntries(entries);
}

/**
 * Load one editor database document by output key.
 *
 * Parameters:
 *   prefix: Optional URL prefix.
 *   dumpPath: Dump root.
 *   outputs: editor_index.json output map.
 *   outputKey: Logical output key such as tiles/map8_tiles.
 *   optional: Whether a missing key or file should resolve to null.
 * Returns:
 *   Promise resolving to parsed JSON or null for optional misses.
 */
async function loadDocument(prefix, dumpPath, outputs, outputKey, optional) {
  const relative = outputs[outputKey];
  if (!relative) {
    if (optional) {
      return null;
    }
    throw new Error(`Editor database output missing: ${outputKey}`);
  }
  const response = await fetch(assetUrl(prefix, dumpPath, relative));
  if (response.status === 404 && optional) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Unable to load ${relative}: ${response.status}`);
  }
  return response.json();
}

/**
 * Return the allocator documents under names used by navigation tools.
 *
 * Parameters:
 *   docs: Loaded document map.
 * Returns:
 *   Allocator document map.
 */
function allocatorDocuments(docs) {
  return {
    exits: docs.allocExits,
    fallHoles: docs.allocFallHoles,
    overworldEntrances: docs.allocOverworldEntrances,
    specialExits: docs.allocSpecialExits,
  };
}

/**
 * Merge OAM frame tables without discarding camel-cased data from source-parser.js.
 */
function mergeSpriteOam(base = {}, extra = {}) {
  const normalized = camelizeDeep(extra);
  return {
    ...base,
    ...normalized,
    arrays: { ...(base.arrays || {}), ...(normalized.arrays || {}) },
    common: { ...(base.common || {}), ...(normalized.common || {}) },
    dmd: { ...(base.dmd || {}), ...(normalized.dmd || {}) },
    rows: { ...(base.rows || {}), ...(normalized.rows || {}) },
    soldier: { ...(base.soldier || {}), ...(normalized.soldier || {}) },
    static: { ...(base.static || {}), ...(normalized.static || {}) },
  };
}

/**
 * Build all fast lookup maps used by inspector and allocation panels.
 *
 * Parameters:
 *   docs: Loaded document map.
 * Returns:
 *   Object containing Map instances keyed by numeric ids or compound keys.
 */
function buildIndexes(docs) {
  return {
    areas: indexBy(docs.overworldAreas?.areas, "area"),
    behaviorBySprite: indexBy(docs.behaviorBindings?.bindings, "sprite"),
    collisionByMap8Tile: indexBy(docs.collisionAttributes?.attributes, "map8_tile_id"),
    dialogueById: indexBy(docs.dialogueStrings?.strings, "id"),
    entranceEdges: indexEdges(docs.entranceGraph?.edges, (edge) => `${edge.kind}:${edge.slot}`),
    exitEdges: indexEdges(docs.exitGraph?.edges, (edge) => String(edge.slot)),
    map16Usage: indexBy(docs.tileUsage?.map16, "map16"),
    map32Usage: indexBy(docs.tileUsage?.map32, "map32"),
    map8ByWord: indexBy(docs.map8Tiles?.tiles, "word"),
    paletteByMap16: indexBy(docs.paletteUsage?.map16_palettes, "map16"),
    signByArea: indexBy(docs.signBindings?.bindings, "area"),
    sourceAreas: indexBy(docs.sourceAreas?.areas, "area"),
    spriteById: indexBy(docs.spriteCatalog?.sprites, "sprite"),
    spritePlacements: indexSpritePlacements(docs.placementIndex?.all),
    travelEdges: indexEdges(docs.travelGraph?.edges, (edge) => `${edge.kind}:${edge.slot}`),
  };
}

/**
 * Index records by one numeric or string property.
 *
 * Parameters:
 *   records: Array of records.
 *   key: Property name to use as the map key.
 * Returns:
 *   Map from property value to record.
 */
function indexBy(records, key) {
  const result = new Map();
  for (const record of records || []) {
    result.set(record[key], record);
  }
  return result;
}

/**
 * Index graph edges by a caller-provided compound key.
 *
 * Parameters:
 *   edges: Array of graph edges.
 *   keyFn: Function that returns a stable string key for one edge.
 * Returns:
 *   Map from compound key to edge.
 */
function indexEdges(edges, keyFn) {
  const result = new Map();
  for (const edge of edges || []) {
    result.set(keyFn(edge), edge);
  }
  return result;
}

/**
 * Index sprite placements by area, stage, and row index.
 *
 * Parameters:
 *   placements: Placement records from sprites/placement_index.json.
 * Returns:
 *   Map keyed as area:stage:index.
 */
function indexSpritePlacements(placements) {
  const result = new Map();
  for (const placement of placements || []) {
    result.set(`${placement.area}:${placement.stage}:${placement.index}`, placement);
  }
  return result;
}

/**
 * Report optional outputs that an older editor dump does not contain yet.
 *
 * Parameters:
 *   outputs: editor_index.json output map.
 * Returns:
 *   List of missing optional output keys.
 */
function missingOptionalOutputs(outputs) {
  return [...OPTIONAL_DOCUMENTS]
    .map((name) => DOCUMENT_KEYS[name])
    .filter((outputKey) => !outputs[outputKey]);
}

/**
 * Build a consistent unavailable database descriptor.
 *
 * Parameters:
 *   dumpPath: Dump root that was attempted.
 *   reason: Human-readable missing/unavailable reason.
 * Returns:
 *   Unavailable database descriptor.
 */
function unavailableDatabase(dumpPath, reason) {
  return { available: false, dumpPath, reason, raw: {}, indexes: {}, allocators: {} };
}

/**
 * Convert dump path parts into the same absolute URL style used by viewer loaders.
 *
 * Parameters:
 *   prefix: Optional URL prefix.
 *   dumpPath: Dump root.
 *   path: Relative path inside the dump root.
 * Returns:
 *   Browser URL.
 */
function assetUrl(prefix, dumpPath, path) {
  const base = [prefix, dumpPath, path].filter(Boolean).join("/").replace(/\/+/g, "/");
  return base.startsWith("/") ? base : `/${base}`;
}

function camelizeDeep(value) {
  if (Array.isArray(value)) {
    return value.map(camelizeDeep);
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  const result = {};
  for (const [key, child] of Object.entries(value)) {
    result[camelKey(key)] = camelizeDeep(child);
  }
  return result;
}

function camelKey(key) {
  return key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}
