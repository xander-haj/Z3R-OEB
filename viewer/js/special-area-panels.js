/**
 * PNG-equivalent Special overworld panel descriptors.
 */

export const SPECIAL_PANEL_WIDTH = 256;
export const SPECIAL_PANEL_HEIGHT = 192;
export const SPECIAL_SLOT_WIDTH = 352;
export const SPECIAL_SLOT_HEIGHT = 224;
export const SPECIAL_HUD_HEIGHT = 32;
export const SPECIAL_BUFFER_SIZE = 1024;
export const SPECIAL_AREA_SIZE = 512;
export const TRIFORCE_ROOM = 0x189;

const SPECIAL_ROOM_MIN = 0x180;
const SPECIAL_ROOM_MAX = 0x18f;

/**
 * Build the same Special panel set as assets/special_area_images.py.
 */
export function buildSpecialPanels(sourceData) {
  const headers = sourceData?.areaHeaders || [];
  const roomRecords = specialExitRecords(headers, sourceData);
  const firstRoomByScreen = firstRooms(roomRecords);
  return [
    ...roomRecords.map(roomPanel),
    ...namedAreaPanels(headers, firstRoomByScreen),
  ];
}

function specialExitRecords(headers, sourceData) {
  const records = [];
  for (const header of headers) {
    for (const exit of header?.specialExits || []) {
      if (isSpecialRoom(exit.room)) {
        records.push({
          exit,
          index: numberOr(exit.index, records.length),
          room: exit.room,
          screen: header.area,
          slot: exit.room - SPECIAL_ROOM_MIN,
          sourceData,
        });
      }
    }
  }
  return records.sort((a, b) => a.index - b.index);
}

function firstRooms(records) {
  const result = [];
  for (const record of records) {
    if (!Number.isFinite(result[record.screen])) {
      result[record.screen] = record.room;
    }
  }
  return result;
}

function roomPanel(record) {
  return {
    crop: roomCrop(record),
    index: record.index,
    kind: "room",
    label: `Room ${hex(record.room, 3)} / ${shortName(record.sourceData, record.screen)}`,
    room: record.room,
    screen: record.screen,
    slot: record.slot,
    variant: "room",
    viewport: { x: 0, y: 0, width: SPECIAL_PANEL_WIDTH, height: SPECIAL_PANEL_HEIGHT },
  };
}

function namedAreaPanels(headers, firstRoomByScreen) {
  const panels = [];
  for (let area = 0x80; area < 0xa0; area += 1) {
    const name = headers[area]?.name;
    if (typeof name !== "string" || !name.startsWith("SP ")) {
      continue;
    }
    panels.push({
      kind: "named",
      label: shortAreaLabel(name, area),
      room: firstRoomByScreen[area] ?? null,
      screen: area,
      variant: "named",
      viewport: { x: 0, y: SPECIAL_HUD_HEIGHT, width: SPECIAL_PANEL_WIDTH, height: SPECIAL_PANEL_HEIGHT },
    });
  }
  return panels;
}

function roomCrop(record) {
  const rawScroll = rawScrollXY(record);
  const top = specialWord(record, "top", "spExitTop");
  const leftEdge = specialWord(record, "leftEdgeOfMap", "spExitLeftEdge");
  return {
    x: rawScroll.x - leftEdge,
    y: record.room === TRIFORCE_ROOM ? rawScroll.y + SPECIAL_HUD_HEIGHT :
      rawScroll.y + SPECIAL_HUD_HEIGHT - top,
    width: SPECIAL_PANEL_WIDTH,
    height: SPECIAL_PANEL_HEIGHT,
  };
}

function rawScrollXY(record) {
  const scroll = pair(record.exit?.scrollXy);
  const origin = screenOrigin(record.screen);
  return { x: scroll.x + origin.x, y: scroll.y + origin.y };
}

function screenOrigin(screen) {
  return {
    x: (screen & 7) << 9,
    y: (screen & 56) << 6,
  };
}

function specialWord(record, key, tableKey) {
  const value = record.exit?.[key];
  if (Number.isFinite(value)) {
    return value;
  }
  const fallback = record.sourceData?.[tableKey]?.[record.slot];
  return Number.isFinite(fallback) ? fallback : 0;
}

export function groupPanel(group, row, col) {
  return group?.panels?.[row * group.columns + col] || null;
}

export function panelAtPoint(group, worldX, worldY) {
  if (group?.kind !== "special-panels" || worldX < 0 || worldY < 0) {
    return null;
  }
  const col = Math.floor(worldX / group.screenWidth);
  const row = Math.floor(worldY / group.screenHeight);
  const panel = groupPanel(group, row, col);
  if (!panel) {
    return null;
  }
  const x = worldX - col * group.screenWidth;
  const y = worldY - row * group.screenHeight;
  if (x < 0 || y < 0 || x >= panel.viewport.width || y >= panel.viewport.height) {
    return null;
  }
  return { col, panel, row, x, y };
}

export function roomSourcePoint(panel, x, y) {
  const sx = mod(panel.crop.x + x, SPECIAL_BUFFER_SIZE);
  const sy = mod(panel.crop.y + y, SPECIAL_BUFFER_SIZE);
  return {
    screen: panel.screen + Math.floor(sx / SPECIAL_AREA_SIZE) + Math.floor(sy / SPECIAL_AREA_SIZE) * 8,
    x: sx % SPECIAL_AREA_SIZE,
    y: sy % SPECIAL_AREA_SIZE,
  };
}

export function isSpecialRoom(room) {
  return Number.isFinite(room) && room >= SPECIAL_ROOM_MIN && room <= SPECIAL_ROOM_MAX;
}

function pair(value) {
  return Array.isArray(value) ? { x: numberOr(value[0], 0), y: numberOr(value[1], 0) } : { x: 0, y: 0 };
}

function shortName(sourceData, area) {
  return shortAreaLabel(sourceData?.areaHeaders?.[area]?.name || `Area ${area}`, area);
}

function shortAreaLabel(name, area) {
  return String(name).replace(/^SP\s*/, "").replace(/^\d+\s*:\s*/, `${hex(area, 2)} `);
}

function numberOr(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

function mod(value, size) {
  return ((value % size) + size) % size;
}

function hex(value, width) {
  return Number(value).toString(16).toUpperCase().padStart(width, "0");
}
