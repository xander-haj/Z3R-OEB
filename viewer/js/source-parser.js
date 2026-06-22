/**
 * Normalizes dumped overworld metadata into the editor's camelCase contract.
 */

import { specialAreaRooms } from "./special-scene-context.js?v=20260621-render-restore20";

const SCREEN_COUNT = 160;

export async function loadSourceData(prefix = "", dumpPath = "assets/overworld_dump") {
  const [areaMetadata, sourceTables, overlayMetadata] = await Promise.all([
    loadJson(prefix, dumpPath, "tables/area_metadata.json"),
    loadJson(prefix, dumpPath, "tables/source_tables.json"),
    loadOptionalJson(prefix, dumpPath, "tables/overlay_metadata.json"),
  ]);
  const headers = normalizeHeaders(areaMetadata.headers || []);
  return {
    areaHeads: areaMetadata.area_heads || [],
    areaParentIds: areaMetadata.area_parent_ids || areaMetadata.area_heads || [],
    areaSizes: areaMetadata.area_sizes || [],
    areaHeaders: headers,
    ambientSoundNames: sourceTables.ambient_sound_names || {},
    auxTileThemeIndexes: areaMetadata.aux_tile_theme_indexes || [],
    bgPaletteIndexes: areaMetadata.bg_palette_indexes || [],
    gravestones: camelizeDeep(sourceTables.gravestones || {}),
    mainTilesets: sourceTables.main_tilesets || [],
    map8TileAttributes: sourceTables.map8_tile_attributes || [],
    musicNames: sourceTables.music_names || {},
    overlayMetadata: camelizeDeep(overlayMetadata || {}),
    auxTilesets: sourceTables.aux_tilesets || [],
    owBgPalInfo: sourceTables.ow_bg_pal_info || [],
    owSprPalInfo: sourceTables.ow_spr_pal_info || [],
    rawAreaMetadata: areaMetadata,
    rawSourceTables: sourceTables,
    secretItemNames: sourceTables.secret_item_names || [],
    secretSpawnRuntime: camelizeDeep(sourceTables.secret_spawn_runtime || {}),
    spriteInitFlags3: sourceTables.sprite_init_flags3 || [],
    spriteNames: (sourceTables.sprite_names || []).filter(isByteSpriteName),
    spriteOam: camelizeDeep(sourceTables.sprite_oam || {}),
    spriteTilesets: sourceTables.sprite_tilesets || [],
    specialAreaRooms: specialAreaRooms(headers),
    spExitAuxGfx: specialExitTable(sourceTables.sp_exit_aux_gfx, headers, "auxGfx"),
    spExitLeftEdge: specialExitTable(sourceTables.sp_exit_left_edge, headers, "leftEdgeOfMap"),
    spExitPalBg: specialExitTable(sourceTables.sp_exit_pal_bg, headers, "palBg"),
    spExitPalSpr: specialExitTable(sourceTables.sp_exit_pal_spr, headers, "palSpr"),
    spExitSprGfx: specialExitTable(sourceTables.sp_exit_spr_gfx, headers, "sprGfx"),
    spExitTop: specialExitTable(sourceTables.sp_exit_top, headers, "top"),
    specialVisualTables: {
      bgGfx: sourceTables.overworld_special_gfx_group || sourceTables.sp_exit_aux_gfx || [],
      bgPalette: sourceTables.overworld_special_pal_group || sourceTables.sp_exit_pal_bg || [],
      spriteGfx: sourceTables.overworld_special_sprite_gfx_group || sourceTables.sp_exit_spr_gfx || [],
      spritePalette: sourceTables.overworld_special_sprite_palette || sourceTables.sp_exit_pal_spr || [],
    },
  };
}

/**
 * Load a JSON file that may be absent in older dumps.
 *
 * Parameters:
 *   prefix: Optional URL prefix used by editor preview routes.
 *   dumpPath: Dump root containing table files.
 *   path: Relative JSON path inside the dump root.
 * Returns:
 *   Parsed JSON, or null only when the server reports a missing file.
 */
async function loadOptionalJson(prefix, dumpPath, path) {
  const response = await fetch(assetUrl(prefix, dumpPath, path));
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Unable to load ${path}: ${response.status}`);
  }
  return response.json();
}

function normalizeHeaders(headers) {
  const result = Array.from({ length: SCREEN_COUNT }, (_, area) => emptyHeader(area));
  for (let index = 0; index < headers.length; index += 1) {
    const header = camelizeDeep(headers[index] || {});
    const area = numberOr(header.area, index);
    result[area] = {
      ...emptyHeader(area),
      ...header,
      area,
      interactions: normalizeInteractions(header.interactions),
      spriteSets: normalizeSpriteSets(header.spriteSets, area),
      staticOverlays: normalizeStaticOverlays(header.staticOverlays),
      specialExits: header.specialExits || [],
    };
  }
  return result;
}

function isByteSpriteName(name) {
  const type = Number.parseInt(String(name).split("-", 1)[0], 16);
  return Number.isFinite(type) && type >= 0 && type <= 0xff;
}

function emptyHeader(area) {
  return {
    area,
    exists: false,
    interactions: { items: [], shovelSpots: [] },
    navigation: { travel: [], entrances: [], holes: [], exits: [] },
    size: null,
    specialExits: [],
    spriteSets: {},
    staticOverlays: [],
  };
}

function normalizeStaticOverlays(rows) {
  return (rows || []).map((row) => ({
    tile: numberOr(row.tile ?? row.tileId, 0),
    x: numberOr(row.x, 0),
    y: numberOr(row.y, 0),
  }));
}

function normalizeInteractions(value) {
  return {
    ...(value || {}),
    items: value?.items || [],
    shovelSpots: value?.shovelSpots || [],
  };
}

function normalizeSpriteSets(value, area = 0) {
  const result = {};
  for (const [stage, set] of Object.entries(value || {})) {
    result[stage] = {
      info: normalizeSpriteInfo(set?.info),
      sprites: (set?.sprites || []).map((sprite) => ({ ...sprite })),
    };
  }
  if (area >= 64 && (result.beginning || result.first || result.second)) {
    const shared = result.first || result.second || result.beginning;
    result.beginning = shared;
    result.first = shared;
    result.second = shared;
  }
  return result;
}

function normalizeSpriteInfo(info) {
  if (!Number.isFinite(info?.gfx) || !Number.isFinite(info?.palette)) {
    return {};
  }
  return {
    gfx: info.gfx,
    palette: info.palette,
  };
}

/**
 * Return special-exit table rows, preferring compiler/YAML metadata over parsed fallback tables.
 */
function specialExitTable(sourceRows, headers, key) {
  const rows = Array.isArray(sourceRows) ? [...sourceRows] : [];
  for (const header of headers || []) {
    for (const exit of header.specialExits || []) {
      const index = Number(exit.room) - 0x180;
      if (index >= 0 && index < 16 && Number.isFinite(exit[key])) {
        rows[index] = exit[key];
      }
    }
  }
  return rows;
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

async function loadJson(prefix, dumpPath, path) {
  const response = await fetch(assetUrl(prefix, dumpPath, path));
  if (!response.ok) {
    throw new Error(`Unable to load ${path}: ${response.status}`);
  }
  return response.json();
}

function assetUrl(prefix, dumpPath, path) {
  const base = [prefix, dumpPath, path].filter(Boolean).join("/").replace(/\/+/g, "/");
  return base.startsWith("/") ? base : `/${base}`;
}

function numberOr(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}
