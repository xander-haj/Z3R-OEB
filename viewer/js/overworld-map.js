/**
 * Map32/map16/map8 inspection for rendered overworld atlas groups.
 */

import {
  groupScreenHeight,
  groupScreenWidth,
  groupViewport,
  resolveGroupContextScreen,
} from "./map-groups.js?v=20260621-render-restore20";
import { panelAtPoint, roomSourcePoint } from "./special-area-panels.js?v=20260621-render-restore20";

export const SCREEN_PIXELS = 512;

export class OverworldMapCache {
  constructor(assets, sourceData = {}) {
    this.assets = assets;
    this.cache = new Map();
    this.areaHeaders = sourceData.areaHeaders || [];
    this.map16ToMap8 = assets.map16ToMap8;
    this.map8TileAttributes = sourceData.map8TileAttributes || [];
  }

  inspect(group, worldX, worldY) {
    if (group?.kind === "special-panels") {
      return this.inspectSpecialPanel(group, worldX, worldY);
    }
    if (group?.kind !== "atlas" || worldX < 0 || worldY < 0) {
      return null;
    }
    const cellWidth = groupScreenWidth(group);
    const cellHeight = groupScreenHeight(group);
    const col = Math.floor(worldX / cellWidth);
    const row = Math.floor(worldY / cellHeight);
    if (col < 0 || row < 0 || col >= group.columns || row >= group.rows) {
      return null;
    }
    const screen = group.base + row * group.columns + col;
    const viewport = groupViewport(group);
    const panelX = Math.floor(worldX - col * cellWidth);
    const panelY = Math.floor(worldY - row * cellHeight);
    const localX = panelX + viewport.x;
    const localY = panelY + viewport.y;
    const map32X = clamp(Math.floor(localX / 32), 0, 15);
    const map32Y = clamp(Math.floor(localY / 32), 0, 15);
    const map16X = clamp(Math.floor(localX / 16), 0, 31);
    const map16Y = clamp(Math.floor(localY / 16), 0, 31);
    const map8X = clamp(Math.floor(localX / 8), 0, 63);
    const map8Y = clamp(Math.floor(localY / 8), 0, 63);
    const map32 = this.assets.map32Words[screen]?.[map32Y * 16 + map32X] ?? 0;
    const map16 = this.map16FromMap32(map32, map16X & 1, map16Y & 1);
    const map8Word = this.map8FromMap16(map16, map8X & 1, map8Y & 1);
    const map8Tile = map8Word & 0x01ff;
    const tileTypeIndex = map8Tile;
    const tileType = this.map8TileAttributes[tileTypeIndex];
    const area = resolveGroupContextScreen(group, screen);
    return {
      area,
      areaSize: this.areaHeaders[area]?.size || null,
      kind: "tile",
      map8Tile,
      map8Word,
      map8X,
      map8Y,
      tileTypeIndex,
      map16,
      map16X,
      map16Y,
      map32,
      map32X,
      map32Y,
      map8HFlip: Boolean(map8Word & 0x4000),
      map8VFlip: Boolean(map8Word & 0x8000),
      palette: (map8Word >> 10) & 7,
      priority: Boolean(map8Word & 0x2000),
      screen,
      tileType: Number.isFinite(tileType) ? tileType : null,
      displayMap32X: col * cellWidth + map32X * 32 - viewport.x,
      displayMap32Y: row * cellHeight + map32Y * 32 - viewport.y,
      displayMap16X: col * cellWidth + map16X * 16 - viewport.x,
      displayMap16Y: row * cellHeight + map16Y * 16 - viewport.y,
      displayTileX: col * cellWidth + map8X * 8 - viewport.x,
      displayTileY: row * cellHeight + map8Y * 8 - viewport.y,
      worldTileX: col * cellWidth,
      worldTileY: row * cellHeight,
    };
  }

  inspectSpecialPanel(group, worldX, worldY) {
    const hit = panelAtPoint(group, worldX, worldY);
    if (!hit) {
      return null;
    }
    const source = hit.panel.kind === "room" ? roomSourcePoint(hit.panel, hit.x, hit.y) : {
      screen: hit.panel.screen,
      x: hit.x + hit.panel.viewport.x,
      y: hit.y + hit.panel.viewport.y,
    };
    const info = this.inspectSourceTile(source.screen, source.x, source.y);
    const display = panelDisplayFields(group, hit, info);
    return {
      ...info,
      ...display,
      panelKind: hit.panel.kind,
      panelLabel: hit.panel.label,
      readOnly: hit.panel.kind === "room",
      screen: source.screen,
      specialRoom: hit.panel.room,
      specialSlot: hit.panel.slot,
      worldTileX: hit.col * group.screenWidth,
      worldTileY: hit.row * group.screenHeight,
    };
  }

  inspectSourceTile(screen, localX, localY) {
    const map32X = clamp(Math.floor(localX / 32), 0, 15);
    const map32Y = clamp(Math.floor(localY / 32), 0, 15);
    const map16X = clamp(Math.floor(localX / 16), 0, 31);
    const map16Y = clamp(Math.floor(localY / 16), 0, 31);
    const map8X = clamp(Math.floor(localX / 8), 0, 63);
    const map8Y = clamp(Math.floor(localY / 8), 0, 63);
    const map32 = this.assets.map32Words[screen]?.[map32Y * 16 + map32X] ?? 0;
    const map16 = this.map16FromMap32(map32, map16X & 1, map16Y & 1);
    const map8Word = this.map8FromMap16(map16, map8X & 1, map8Y & 1);
    const map8Tile = map8Word & 0x01ff;
    const tileType = this.map8TileAttributes[map8Tile];
    return {
      area: screen,
      areaSize: this.areaHeaders[screen]?.size || null,
      kind: "tile",
      map8Tile,
      map8Word,
      map8X,
      map8Y,
      tileTypeIndex: map8Tile,
      map16,
      map16X,
      map16Y,
      map32,
      map32X,
      map32Y,
      map8HFlip: Boolean(map8Word & 0x4000),
      map8VFlip: Boolean(map8Word & 0x8000),
      palette: (map8Word >> 10) & 7,
      priority: Boolean(map8Word & 0x2000),
      tileType: Number.isFinite(tileType) ? tileType : null,
    };
  }

  map16FromMap32(map32, subX, subY) {
    const entry = this.assets.map32ToMap16[map32] || [0, 0, 0, 0];
    return entry[subY * 2 + subX] || 0;
  }

  map8FromMap16(map16, subX, subY) {
    const base = map16 * 4 + subY * 2 + subX;
    return this.map16ToMap8[base] || 0;
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function panelDisplayFields(group, hit, info) {
  const baseX = hit.col * group.screenWidth;
  const baseY = hit.row * group.screenHeight;
  if (hit.panel.kind === "room") {
    const sourceX = hit.panel.crop.x + hit.x;
    const sourceY = hit.panel.crop.y + hit.y;
    return {
      displayMap32X: baseX + hit.x - mod(sourceX, 32),
      displayMap32Y: baseY + hit.y - mod(sourceY, 32),
      displayMap16X: baseX + hit.x - mod(sourceX, 16),
      displayMap16Y: baseY + hit.y - mod(sourceY, 16),
      displayTileX: baseX + hit.x - mod(sourceX, 8),
      displayTileY: baseY + hit.y - mod(sourceY, 8),
    };
  }
  return {
    displayMap32X: baseX + info.map32X * 32 - hit.panel.viewport.x,
    displayMap32Y: baseY + info.map32Y * 32 - hit.panel.viewport.y,
    displayMap16X: baseX + info.map16X * 16 - hit.panel.viewport.x,
    displayMap16Y: baseY + info.map16Y * 16 - hit.panel.viewport.y,
    displayTileX: baseX + info.map8X * 8 - hit.panel.viewport.x,
    displayTileY: baseY + info.map8Y * 8 - hit.panel.viewport.y,
  };
}

function mod(value, size) {
  return ((value % size) + size) % size;
}
