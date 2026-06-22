/**
 * BG tileset VRAM and overworld palette reconstruction.
 */

import { decompressLz, expand3To4High, expand3To4Low } from "./binary.js";
import { loadSpriteGraphicsVram } from "./sprite-vram.js?v=20260621-render-restore20";

export class TilesetCache {
  constructor(assets, sourceData) {
    this.assets = assets;
    this.sourceData = sourceData;
    this.cache = new Map();
  }

  getVram(mainTheme, auxTheme, screen, spriteStage = "first", includeSprites = false, animatedPack = null) {
    const key = `${mainTheme}:${auxTheme}:${screen}:${spriteStage}:${includeSprites ? 1 : 0}:${animatedPack ?? ""}`;
    if (!this.cache.has(key)) {
      this.cache.set(key, buildVram(this.assets, this.sourceData, mainTheme, auxTheme, screen,
        spriteStage, includeSprites, animatedPack));
    }
    return this.cache.get(key);
  }
}

export function resolveMainTheme(screen) {
  return screen & 0x40 ? 0x21 : 0x20;
}

/**
 * Resolve the area-specific aux graphics group used to patch the main BG tileset.
 */
export function resolveAuxTheme(sourceData, screen, override = null) {
  if (Number.isFinite(override)) {
    return { source: "override", value: override };
  }
  const headerValue = sourceData?.areaHeaders?.[screen]?.gfx;
  if (Number.isFinite(headerValue) && headerValue >= 0) {
    return { source: "area-header", value: headerValue };
  }
  const tableValue = sourceData?.auxTileThemeIndexes?.[screen];
  if (Number.isFinite(tableValue) && tableValue >= 0) {
    return { source: "generated-table", value: tableValue };
  }
  return { source: "fallback", value: 0 };
}

export function buildBgPalette(assets, sourceData, screen, override = null, options = {}) {
  const cgram = new Uint16Array(256);
  const bgDescriptor = bgDescriptorForScreen(sourceData, screen, override) ?? 0;
  const palettes = assets.bgPalettes || {};
  const aux = applyBgDescriptor(sourceData?.owBgPalInfo || [], bgDescriptor);
  const mode = options.modeOverride ?? getScreenPaletteMode(screen);
  loadMultiple(cgram, palettes.overworld_bg_main, mode * 35, 0x42, 6, 4);
  loadMultiple(cgram, palettes.overworld_bg_aux12, aux.aux1 * 21, 0x52, 6, 2);
  loadMultiple(cgram, palettes.overworld_bg_aux12, (options.aux2Override ?? aux.aux2) * 21, 0xb2, 6, 2);
  loadRange(cgram, palettes.overworld_bg_aux3, aux.aux3 * 7, 0xe2, 6);
  applyFixedBackdrop(cgram, options.backdropScreen ?? screen, options.backdropRoom ?? null);
  return cgram;
}

function buildVram(assets, sourceData, mainTheme, auxTheme, screen, spriteStage, includeSprites, animatedPack) {
  const vram = new Uint16Array(0x8000);
  const main = tableRow(sourceData?.mainTilesets, mainTheme);
  const aux = tableRow(sourceData?.auxTilesets, auxTheme);
  const auxResolved = [aux[0] || main[3], aux[1] || main[4], aux[2] || main[5], aux[3] || main[6]];
  const loads = [
    { offset: 0x2000, pack: main[0], slot: 7 },
    { offset: 0x2400, pack: main[1], slot: 6 },
    { offset: 0x2800, pack: main[2], slot: 5 },
    { offset: 0x2c00, pack: auxResolved[0], slot: 4 },
    { offset: 0x3000, pack: auxResolved[1], slot: 3 },
    { offset: 0x3400, pack: auxResolved[2], slot: 2 },
    { offset: 0x3800, pack: auxResolved[3], slot: 1 },
    { offset: 0x3c00, pack: main[7], slot: 0 },
  ];
  for (const load of loads) {
    loadBackgroundPack(assets, vram, load.pack, load.offset, usesHighExpansion(load.slot, mainTheme));
  }
  if (animatedPack !== false) {
    loadAnimatedOverworldPack(assets, vram, animatedPack ?? resolveAnimatedOverworldPack(screen));
  }
  if (includeSprites) {
    loadSpriteGraphicsVram(assets, sourceData, vram, screen, spriteStage);
  }
  return vram;
}

function loadBackgroundPack(assets, vram, pack, offset, high) {
  const decoded = decodeBackgroundPack(assets.bgGraphics?.get(pack));
  if (high) {
    expand3To4High(vram, offset, decoded, 64);
  } else {
    expand3To4Low(vram, offset, decoded, 64);
  }
}

/**
 * Replace only the first half of sheet 7 with the editor's animated BG sheet.
 */
function loadAnimatedOverworldPack(assets, vram, pack) {
  const decoded = decodeBackgroundPack(assets.bgGraphics?.get(pack));
  expand3To4Low(vram, 0x3c00, decoded, 32);
}

function decodeBackgroundPack(bytes) {
  if (!bytes) {
    return new Uint8Array(0x600);
  }
  try {
    const decoded = decompressLz(bytes, "little");
    if (decoded.length >= 0x600) {
      return decoded.slice(0, 0x600);
    }
  } catch {
    if (bytes.length >= 0x600) {
      return bytes.slice(0, 0x600);
    }
  }
  return bytes;
}

function usesHighExpansion(slot, mainTheme) {
  return mainTheme >= 0x20 ? slot === 7 || slot === 2 || slot === 3 || slot === 4 : slot >= 4;
}

function resolveAnimatedOverworldPack(screen) {
  const masked = screen & 0xbf;
  if (masked === 3 || masked === 5 || masked === 7) {
    return 0x59;
  }
  return 0x5b;
}

function getScreenPaletteMode(screen) {
  const sc = screen & 0x3f;
  return (sc === 3 || sc === 5 || sc === 7 ? 2 : 0) + (screen & 0x40 ? 1 : 0);
}

/**
 * Resolve the palette descriptor that owns a screen's BG aux palette groups.
 */
function bgDescriptorForScreen(sourceData, screen, override = null) {
  if (Number.isFinite(override)) {
    return override;
  }
  const headerValue = sourceData?.areaHeaders?.[screen]?.palette;
  if (Number.isFinite(headerValue) && headerValue >= 0) {
    return headerValue;
  }
  const tableValue = sourceData?.bgPaletteIndexes?.[screen];
  return Number.isFinite(tableValue) && tableValue >= 0 ? tableValue : null;
}

/**
 * Apply one kOwBgPalInfo triple from the same default aux slots used by Overworld_LoadAllPalettes.
 */
function applyBgDescriptor(info, descriptor) {
  const aux = { aux1: 3, aux2: 3, aux3: 0 };
  const base = descriptor * 3;
  aux.aux1 = descriptorChannel(info, base, 0, aux.aux1);
  aux.aux2 = descriptorChannel(info, base, 1, aux.aux2);
  aux.aux3 = descriptorChannel(info, base, 2, aux.aux3);
  return aux;
}

/**
 * Choose the current channel or the engine initial default for independent preview rendering.
 */
function descriptorChannel(info, base, offset, fallback) {
  const value = positiveChannel(info[base + offset]);
  if (Number.isFinite(value)) {
    return value;
  }
  return fallback;
}

/**
 * Convert non-negative palette-table bytes into usable channel ids.
 */
function positiveChannel(value) {
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function applyFixedBackdrop(cgram, screen, room) {
  let color = 0x19c6;
  if (screen === 0x5b) {
    color = 0;
  } else if (screen >= 0x80) {
    color = room === 0x180 || room === 0x182 || room === 0x183 ? 0x19c6 : 0x2669;
  } else {
    color = screen & 0x40 ? 0x2a32 : 0x2669;
  }
  cgram[0] = color;
  cgram[32] = color;
}

function loadMultiple(cgram, source, sourceIndex, dstByte, count, rows) {
  let src = sourceIndex;
  let dst = dstByte >> 1;
  for (let row = 0; row <= rows; row += 1) {
    for (let i = 0; i <= count; i += 1) {
      cgram[dst + i] = source?.[src + i] || 0;
    }
    src += count + 1;
    dst += 16;
  }
}

function loadRange(cgram, source, sourceIndex, dstByte, count) {
  const dst = dstByte >> 1;
  for (let i = 0; i <= count; i += 1) {
    cgram[dst + i] = source?.[sourceIndex + i] || 0;
  }
}

function tableRow(table, index) {
  return Array.isArray(table?.[index]) ? table[index] : [];
}
