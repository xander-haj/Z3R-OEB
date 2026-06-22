/**
 * Runtime special-overworld visual context shared by terrain and sprite previews.
 */

const TRIFORCE_ROOM = 0x189;
const TRIFORCE_AREAS = new Set([0x88, 0x93]);
const CLOUD_ANIM_PACK = 0x59;
const SPECIAL_MAIN_THEME = 0x20;
const NAMED_SPECIAL_AREA_ROOMS = {
  0x81: 0x182,
  0x82: 0x182,
  0x88: TRIFORCE_ROOM,
  0x89: 0x182,
  0x8a: 0x182,
  0x93: TRIFORCE_ROOM,
  0x94: 0x181,
  0x97: 0x180,
};
const SCENE_ONLY_SPECIAL_AREAS = new Set([0x97]);
const SCENE_ONLY_BASE_SCREENS = new Map([
  [0x97, 0x00],
]);
const OVERLAY_CONTEXT_SCREENS = new Map([
  [0x95, 0x03],
  [0x96, 0x5b],
  [0x9c, 0x43],
  [0x9d, 0x00],
  [0x9e, 0x00],
  [0x9f, 0x00],
]);

/**
 * Match the runtime room slot used by special-overworld named atlas screens.
 */
export function specialAreaRooms(headers) {
  const rooms = [];
  for (const header of headers || []) {
    for (const exit of header.specialExits || []) {
      if (isSpecialExitRoom(exit.room) && !Number.isFinite(rooms[header.area])) {
        rooms[header.area] = exit.room;
      }
    }
  }
  for (const [area, room] of Object.entries(NAMED_SPECIAL_AREA_ROOMS)) {
    rooms[Number(area)] = room;
  }
  return rooms;
}

/**
 * Return the runtime BG context override for one special atlas screen.
 */
export function specialBgContext(sourceData, screen, roomOverride = null, variant = "named") {
  if (screen < 0x80 || screen >= 0xa0) {
    return null;
  }
  const room = Number.isFinite(roomOverride) ? roomOverride : sourceData?.specialAreaRooms?.[screen];
  if (isUnusedSpecialArea(sourceData, screen)) {
    return blankSpecialContext(sourceData, screen, room);
  }
  if (room === TRIFORCE_ROOM || TRIFORCE_AREAS.has(screen)) {
    return {
      animatedPack: false,
      main: 0x24,
      aux: 0x51,
      palette: 14,
      paletteMode: 4,
      backdropRoom: room,
    };
  }
  if (OVERLAY_CONTEXT_SCREENS.has(screen)) {
    return baseScreenContext(sourceData, screen, OVERLAY_CONTEXT_SCREENS.get(screen), room);
  }
  if (SCENE_ONLY_BASE_SCREENS.has(screen)) {
    return baseScreenContext(sourceData, screen, SCENE_ONLY_BASE_SCREENS.get(screen), room);
  }
  return specialExitBgContext(sourceData, screen, room, variant) ||
    baseScreenContext(sourceData, screen, 0x00, room);
}

/**
 * Return true when a special screen's BG context is backed by kSpExit visual fields.
 */
export function specialBgUsesExitVisuals(sourceData, screen) {
  if (screen < 0x80 || screen >= 0xa0) {
    return false;
  }
  const room = sourceData?.specialAreaRooms?.[screen];
  if (room === TRIFORCE_ROOM || TRIFORCE_AREAS.has(screen)) {
    return false;
  }
  if (SCENE_ONLY_SPECIAL_AREAS.has(screen)) {
    return false;
  }
  if (OVERLAY_CONTEXT_SCREENS.has(screen)) {
    return false;
  }
  return Number.isFinite(specialExitSlot(sourceData, screen));
}

/**
 * Return the runtime sprite context override for one special atlas screen.
 */
export function specialSpriteInfo(sourceData, screen) {
  const index = specialExitSlot(sourceData, screen);
  if (!Number.isFinite(index)) {
    return null;
  }
  const gfx = sourceData?.spExitSprGfx?.[index];
  const palette = sourceData?.spExitPalSpr?.[index];
  if (!Number.isFinite(gfx) || !Number.isFinite(palette)) {
    return null;
  }
  return { gfx, palette };
}

/**
 * Resolve a screen to the kSpExit row selected by its special room.
 */
export function specialExitSlot(sourceData, screen) {
  if (screen < 0x80 || screen >= 0xa0) {
    return null;
  }
  if (SCENE_ONLY_SPECIAL_AREAS.has(screen)) {
    return null;
  }
  const room = specialSceneRoom(sourceData, screen);
  if (isSpecialExitRoom(room)) {
    return room - 0x180;
  }
  return null;
}

function specialExitBgContext(sourceData, screen, room, variant) {
  const index = specialSceneSlot(sourceData, screen, room);
  if (!Number.isFinite(index)) {
    return null;
  }
  const aux = sourceData?.spExitAuxGfx?.[index];
  const palette = variant === "room" ? sourceData?.spExitPalBg?.[index] :
    namedAreaPalette(sourceData, screen, index);
  if (!Number.isFinite(aux) && !Number.isFinite(palette)) {
    return null;
  }
  return {
    animatedPack: false,
    main: SPECIAL_MAIN_THEME,
    aux: Number.isFinite(aux) ? aux : null,
    palette: Number.isFinite(palette) ? palette : null,
    backdropScreen: screen,
    backdropRoom: room,
  };
}

/**
 * Match the named Special PNG renderer's palette source for special-exit pages.
 */
function namedAreaPalette(sourceData, screen, index) {
  if (screen < 0x88) {
    return tableBackedHeaderValue(sourceData, screen, "palette", "bgPaletteIndexes");
  }
  const palette = sourceData?.spExitPalBg?.[index];
  if (Number.isFinite(palette)) {
    return palette;
  }
  return tableBackedHeaderValue(sourceData, screen, "palette", "bgPaletteIndexes");
}

/**
 * Return true for filler Special slots that should not expose raw terrain pages.
 */
function isUnusedSpecialArea(sourceData, screen) {
  const name = sourceData?.areaHeaders?.[screen]?.name;
  return typeof name === "string" && name.startsWith("NA ");
}

/**
 * Build a backdrop-only render context for unused Special atlas cells.
 */
function blankSpecialContext(sourceData, screen, room) {
  return {
    animatedPack: false,
    aux: tableBackedHeaderValue(sourceData, screen, "gfx", "auxTileThemeIndexes"),
    backdropRoom: room,
    backdropScreen: screen,
    main: SPECIAL_MAIN_THEME,
    palette: tableBackedHeaderValue(sourceData, screen, "palette", "bgPaletteIndexes"),
    skipTerrain: true,
  };
}

function specialSceneSlot(sourceData, screen, roomOverride = null) {
  const room = specialSceneRoom(sourceData, screen, roomOverride);
  return isSpecialExitRoom(room) ? room - 0x180 : null;
}

function specialSceneRoom(sourceData, screen, roomOverride = null) {
  return Number.isFinite(roomOverride) ? roomOverride : sourceData?.specialAreaRooms?.[screen];
}

function baseScreenContext(sourceData, screen, base, room) {
  return {
    main: mainThemeForScreen(base),
    aux: tableBackedHeaderValue(sourceData, base, "gfx", "auxTileThemeIndexes"),
    palette: tableBackedHeaderValue(sourceData, base, "palette", "bgPaletteIndexes"),
    paletteAux2: screen === 0x96 ? 3 : null,
    paletteMode: paletteModeForScreen(base),
    paletteScreen: base,
    animatedPack: screen === 0x95 ? CLOUD_ANIM_PACK : false,
    backdropScreen: screen === 0x96 ? 0x5b : screen,
    backdropRoom: room,
  };
}

function tableBackedHeaderValue(sourceData, screen, key, tableKey) {
  const headerValue = sourceData?.areaHeaders?.[screen]?.[key];
  if (Number.isFinite(headerValue) && headerValue >= 0) {
    return headerValue;
  }
  const tableValue = sourceData?.[tableKey]?.[screen];
  return Number.isFinite(tableValue) && tableValue >= 0 ? tableValue : null;
}

function paletteModeForScreen(screen) {
  const low = screen & 0x3f;
  return (low === 3 || low === 5 || low === 7 ? 2 : 0) + (screen & 0x40 ? 1 : 0);
}

function mainThemeForScreen(screen) {
  return screen & 0x40 ? 0x21 : 0x20;
}

function isSpecialExitRoom(room) {
  return Number.isFinite(room) && room >= 0x180 && room < 0x190;
}
