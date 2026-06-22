/**
 * Atlas group descriptors shared by viewer and editor overlays.
 */

import {
  buildSpecialPanels,
  SPECIAL_SLOT_HEIGHT,
  SPECIAL_SLOT_WIDTH,
} from "./special-area-panels.js?v=20260621-render-restore20";

const SCREEN_PIXELS = 512;

export function buildMapGroups(sourceData) {
  const areaHeads = sourceData?.areaHeads || [];
  const areaParentIds = sourceData?.areaParentIds || [];
  return {
    light: group("light", "Light World", 0, 8, 8, areaHeads, areaParentIds),
    dark: group("dark", "Dark World", 64, 8, 8, areaHeads, areaParentIds),
    special: specialGroup(sourceData, areaHeads, areaParentIds),
  };
}

export function resolveGroupContextScreen(group, screen) {
  if (!Number.isFinite(screen)) {
    return screen;
  }
  const parent = group?.areaParentIds?.[screen];
  if (Number.isFinite(parent)) {
    return parent;
  }
  if (screen >= 128) {
    return screen;
  }
  const head = group?.areaHeads?.[screen & 0x3f];
  if (!Number.isFinite(head)) {
    return screen;
  }
  return (screen & 0x40) | head;
}

function group(id, label, base, columns, rows, areaHeads, areaParentIds, options = {}) {
  const screenWidth = options.screenWidth ?? SCREEN_PIXELS;
  const screenHeight = options.screenHeight ?? SCREEN_PIXELS;
  return {
    areaHeads,
    areaParentIds,
    base,
    columns,
    height: rows * screenHeight,
    id,
    kind: "atlas",
    label,
    rows,
    screenHeight,
    screenWidth,
    viewport: options.viewport || { x: 0, y: 0, width: screenWidth, height: screenHeight },
    width: columns * screenWidth,
  };
}

function specialGroup(sourceData, areaHeads, areaParentIds) {
  const panels = buildSpecialPanels(sourceData);
  const columns = 2;
  const rows = Math.max(1, Math.ceil(panels.length / columns));
  return {
    areaHeads,
    areaParentIds,
    base: 128,
    columns,
    height: rows * SPECIAL_SLOT_HEIGHT,
    id: "special",
    kind: "special-panels",
    label: "Special",
    panels,
    rows,
    screenHeight: SPECIAL_SLOT_HEIGHT,
    screenWidth: SPECIAL_SLOT_WIDTH,
    viewport: { x: 0, y: 0, width: SPECIAL_SLOT_WIDTH, height: SPECIAL_SLOT_HEIGHT },
    width: columns * SPECIAL_SLOT_WIDTH,
  };
}

export function groupScreenWidth(group) {
  return group?.screenWidth ?? SCREEN_PIXELS;
}

export function groupScreenHeight(group) {
  return group?.screenHeight ?? SCREEN_PIXELS;
}

export function groupViewport(group) {
  const width = groupScreenWidth(group);
  const height = groupScreenHeight(group);
  return group?.viewport || { x: 0, y: 0, width, height };
}
