/**
 * Adds dat-dump editor database facts to the Properties inspector.
 *
 * These rows are read-only on purpose. They prove the Workbench can consume the
 * richer database before any writeback path starts depending on it.
 */

import { appendNpcDialogueRows } from "./inspector-dialogue-rows.js?v=20260625-dialogue-tab";

/**
 * Append database-backed rows for the current selection.
 *
 * Parameters:
 *   rows: Definition-list element being populated.
 *   info: Current tile, sprite, or interaction selection.
 *   inspectGrid: Active inspection grid key.
 *   editorDb: Database descriptor from editor-database.js.
 *   appendRow: Panel helper used to append a dt/dd pair.
 * Returns:
 *   None.
 */
export function appendEditorDatabaseRows(rows, info, inspectGrid, editorDb, appendRow) {
  if (!editorDb?.available || !info) {
    return;
  }
  appendAreaRows(rows, info, editorDb, appendRow);
  if (info.kind === "tile") {
    appendTileRows(rows, info, inspectGrid, editorDb, appendRow);
  } else if (info.kind === "sprite" || info.kind === "enemy") {
    appendSpriteRows(rows, info, editorDb, appendRow);
  } else if (info.kind === "interaction") {
    appendInteractionRows(rows, info, editorDb, appendRow);
  }
}

/**
 * Append source ownership, topology, and navigation context for the selected area.
 *
 * Parameters:
 *   rows: Definition-list element being populated.
 *   info: Current selection with an area id.
 *   editorDb: Database descriptor from editor-database.js.
 *   appendRow: Panel helper used to append a dt/dd pair.
 * Returns:
 *   None.
 */
function appendAreaRows(rows, info, editorDb, appendRow) {
  const area = editorDb.indexes.areas?.get(info.area);
  const source = editorDb.indexes.sourceAreas?.get(info.area);
  if (!area && !source) {
    return;
  }
  const sourceFile = source?.source_file?.path || area?.source_file?.path || "unknown";
  appendRow(rows, "Area Source", `${source?.source_status || "summary"} ${sourceFile}`);
  appendRow(rows, "Topology", topologySummary(source || area));
  appendRow(rows, "Area Editability", editabilitySummary(source?.editability || area?.editability));
  appendAreaNavigationSummary(rows, info.area, editorDb, appendRow);
}

/**
 * Append graph counts that link this overworld area to rooms and travel edges.
 *
 * Parameters:
 *   rows: Definition-list element.
 *   area: Selected area id.
 *   editorDb: Database descriptor.
 *   appendRow: Panel row helper.
 * Returns:
 *   None.
 */
function appendAreaNavigationSummary(rows, area, editorDb, appendRow) {
  const entrances = (editorDb.raw.entranceGraph?.edges || []).filter((edge) => edge.from_area === area);
  const exitEdges = (editorDb.raw.exitGraph?.edges || []).filter((edge) => edge.to_area === area);
  const roomExits = exitEdges.filter((edge) => (edge.from_room_reference_kind || "normal_room") === "normal_room");
  const specialExits = exitEdges.filter((edge) => edge.from_room_reference_kind === "special_exit_room");
  const engineExits = exitEdges.filter((edge) => edge.from_room_reference_kind === "engine_extended_exit");
  const travel = (editorDb.raw.travelGraph?.edges || []).filter((edge) => (
    edge.to_area === area || edge.from_area === area
  ));
  if (entrances.length || exitEdges.length || travel.length) {
    const exitParts = [`${roomExits.length} room exits`];
    if (specialExits.length) {
      exitParts.push(`${specialExits.length} special exits`);
    }
    if (engineExits.length) {
      exitParts.push(`${engineExits.length} engine exits`);
    }
    appendRow(rows, "Area Links",
      `${entrances.length} entrances, ${exitParts.join(", ")}, ${travel.length} travel`);
  }
}

/**
 * Append tile decode, collision, usage, and palette facts.
 *
 * Parameters:
 *   rows: Definition-list element being populated.
 *   info: Tile selection from OverworldMapCache.inspect.
 *   inspectGrid: Active inspection grid key.
 *   editorDb: Database descriptor.
 *   appendRow: Panel row helper.
 * Returns:
 *   None.
 */
function appendTileRows(rows, info, inspectGrid, editorDb, appendRow) {
  const map8 = editorDb.indexes.map8ByWord?.get(info.map8Word);
  const collision = editorDb.indexes.collisionByMap8Tile?.get(info.map8Tile);
  const map16Usage = editorDb.indexes.map16Usage?.get(info.map16);
  const map32Usage = editorDb.indexes.map32Usage?.get(info.map32);
  const palette = editorDb.indexes.paletteByMap16?.get(info.map16);
  if (map8) {
    appendRow(rows, "DB Map8", map8Summary(map8));
  }
  if (collision) {
    appendRow(rows, "Collision Attr", hex(collision.attribute, 2));
  }
  appendRow(rows, "Tile Usage", tileUsageSummary(map16Usage, map32Usage, inspectGrid));
  if (palette?.palettes?.length) {
    appendRow(rows, "Map16 Palettes", palette.palettes.join(", "));
  }
}

/**
 * Append sprite catalog, placement, graphics, palette, and behavior facts.
 *
 * Parameters:
 *   rows: Definition-list element being populated.
 *   info: Sprite selection from the sprite overlay.
 *   editorDb: Database descriptor.
 *   appendRow: Panel row helper.
 * Returns:
 *   None.
 */
function appendSpriteRows(rows, info, editorDb, appendRow) {
  const spriteId = Number.isFinite(info.type) ? info.type : parseHex(info.id);
  const catalog = editorDb.indexes.spriteById?.get(spriteId);
  const behavior = editorDb.indexes.behaviorBySprite?.get(spriteId);
  const placement = primaryPlacement(info, editorDb);
  if (catalog) {
    appendRow(rows, "DB Sprite", `${catalog.kind}; init flags ${hexOrUnknown(catalog.init_flags3, 2)}`);
  }
  if (placement) {
    appendRow(rows, "Placement Source", placementSummary(placement));
  }
  appendNpcDialogueRows(rows, info, catalog, placement, editorDb, appendRow);
  appendSpriteContextRow(rows, info, editorDb, appendRow);
  if (behavior) {
    appendRow(rows, "Behavior", editabilitySummary(behavior.editability));
    appendRow(rows, "Behavior Source", sourceSummary(behavior.behavior_source));
  }
}

/**
 * Append navigation graph details for selected interaction markers.
 *
 * Parameters:
 *   rows: Definition-list element being populated.
 *   info: Interaction selection from the interaction overlay.
 *   editorDb: Database descriptor.
 *   appendRow: Panel row helper.
 * Returns:
 *   None.
 */
function appendInteractionRows(rows, info, editorDb, appendRow) {
  const edge = navigationEdge(info, editorDb);
  if (!edge) {
    return;
  }
  if (info.navigationList === "entrances" || info.navigationList === "holes") {
    appendRow(rows, "Graph Link", `to room ${edge.to_room ?? "unknown"} via entrance ${edge.entrance_id}`);
  } else if (info.navigationList === "exits") {
    appendRow(rows, "Graph Link", `room ${edge.from_room} to area ${hex(edge.to_area, 2)}`);
    appendRow(rows, "Room Ref", edge.from_room_reference_kind || "normal_room");
  }
}

/**
 * Return one placement record matching the selected sprite's primary stage row.
 *
 * Parameters:
 *   info: Sprite selection.
 *   editorDb: Database descriptor.
 * Returns:
 *   Placement record or null.
 */
function primaryPlacement(info, editorDb) {
  const placement = (info.stagePlacements || [])[0];
  if (!placement) {
    return null;
  }
  return editorDb.indexes.spritePlacements?.get(`${info.area}:${placement.stage}:${placement.index}`) || null;
}

/**
 * Append the shared sprite graphics/palette context from source_areas when present.
 *
 * Parameters:
 *   rows: Definition-list element being populated.
 *   info: Sprite selection from the sprite overlay.
 *   editorDb: Database descriptor.
 *   appendRow: Panel row helper.
 * Returns:
 *   None.
 */
function appendSpriteContextRow(rows, info, editorDb, appendRow) {
  const source = editorDb.indexes.sourceAreas?.get(info.area);
  const stage = info.primaryStage || (info.stages || [])[0] || "first";
  const context = source?.sprite_sets?.[stage]?.info;
  if (context && Number.isFinite(context.gfx) && Number.isFinite(context.palette)) {
    appendRow(rows, "Sprite Context",
      `gfx ${hexOrUnknown(context.gfx, 2)}, palette ${hexOrUnknown(context.palette, 2)}`);
  }
}

/**
 * Resolve a graph edge for one selected navigation marker.
 *
 * Parameters:
 *   info: Interaction selection from interaction-overlay.js.
 *   editorDb: Database descriptor.
 * Returns:
 *   Matching graph edge or null.
 */
function navigationEdge(info, editorDb) {
  if (info.navigationList === "entrances") {
    return editorDb.indexes.entranceEdges?.get(`overworld_entrance:${info.code}`) || null;
  }
  if (info.navigationList === "holes") {
    return editorDb.indexes.entranceEdges?.get(`fall_hole:${info.code}`) || null;
  }
  if (info.navigationList === "exits") {
    return editorDb.indexes.exitEdges?.get(String(info.code)) || null;
  }
  return null;
}

/**
 * Summarize topology without expanding long child lists.
 *
 * Parameters:
 *   record: Area or source-area database record.
 * Returns:
 *   Compact topology summary.
 */
function topologySummary(record) {
  const children = record?.topology_children || [];
  return `parent ${hex(record?.topology_parent ?? record?.source_area ?? 0, 2)}, ${children.length} child area(s)`;
}

/**
 * Summarize an editability record.
 *
 * Parameters:
 *   editability: Dat-dump editability object.
 * Returns:
 *   Human-readable status and reason.
 */
function editabilitySummary(editability) {
  return editability ? `${editability.status}: ${editability.reason}` : "unknown";
}

/**
 * Summarize a decoded Map8 word record.
 *
 * Parameters:
 *   map8: Map8 database record.
 * Returns:
 *   Compact decode summary.
 */
function map8Summary(map8) {
  return `tile ${hex(map8.tile_id, 3)}, palette ${map8.palette}, attr ${hex(map8.collision_attr, 2)}, ` +
    `${map8.used_by_map16_count} map16 uses`;
}

/**
 * Summarize tile usage with active grid context.
 *
 * Parameters:
 *   map16Usage: Map16 usage record.
 *   map32Usage: Map32 usage record.
 *   inspectGrid: Active inspection grid key.
 * Returns:
 *   Usage summary string.
 */
function tileUsageSummary(map16Usage, map32Usage, inspectGrid) {
  const map16 = map16Usage?.use_count ?? 0;
  const map32 = map32Usage?.use_count ?? 0;
  return inspectGrid === "map32" ? `map32 ${map32}, map16 ${map16}` : `map16 ${map16}, map32 ${map32}`;
}

/**
 * Summarize a sprite placement source record.
 *
 * Parameters:
 *   placement: Placement index record.
 * Returns:
 *   Source file and shared visual context summary.
 */
function placementSummary(placement) {
  return `${placement.source_file?.path || "unknown"}; gfx ${hexOrUnknown(placement.graphics_set, 2)}, ` +
    `palette ${hexOrUnknown(placement.palette_set, 2)}`;
}

/**
 * Summarize a source reference and optional symbol list.
 *
 * Parameters:
 *   source: Source reference record.
 * Returns:
 *   File path plus symbol list when available.
 */
function sourceSummary(source) {
  const symbols = source?.symbols?.length ? ` ${source.symbols.join(", ")}` : "";
  return source ? `${source.path}${symbols}` : "unknown";
}

/**
 * Format a numeric value as uppercase hex.
 *
 * Parameters:
 *   value: Numeric value.
 *   width: Minimum hex digit count.
 * Returns:
 *   Uppercase hex string.
 */
function hex(value, width = 4) {
  return `0x${Number(value).toString(16).toUpperCase().padStart(width, "0")}`;
}

/**
 * Format a numeric value as hex, preserving unknown optional values.
 *
 * Parameters:
 *   value: Optional numeric value.
 *   width: Minimum hex digit count.
 * Returns:
 *   Uppercase hex string or unknown.
 */
function hexOrUnknown(value, width = 4) {
  return Number.isFinite(value) ? hex(value, width) : "unknown";
}

/**
 * Parse a hex-looking id string from older selection objects.
 *
 * Parameters:
 *   value: String or numeric id.
 * Returns:
 *   Parsed sprite id, or zero when parsing fails.
 */
function parseHex(value) {
  const parsed = Number.parseInt(String(value || "0").replace(/^0x/i, ""), 16);
  return Number.isFinite(parsed) ? parsed : 0;
}
