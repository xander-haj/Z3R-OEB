/**
 * OBJ VRAM and sprite palette reconstruction for editor sprite previews.
 */

import { expand3To4High, expand3To4Low } from "./binary.js";
import { specialSpriteInfo } from "./special-scene-context.js?v=20260621-render-restore20";

const HIGH_FORMAT_PACKS = new Set([0x52, 0x53, 0x5a, 0x5b, 0x5c, 0x5e, 0x5f]);
const COMMON_LOADS = [
  { pack: 0x00, offset: 0x4000 },
  { pack: 0x0b, offset: 0x4400 },
  { pack: 0x06, offset: 0x4800 },
  { pack: 0x07, offset: 0x4c00 },
];
const AREA_OFFSETS = [0x5000, 0x5400, 0x5800, 0x5c00];

export function resolveSpriteSet(sourceData, screen, stage = "first") {
  const header = sourceData?.areaHeaders?.[screen];
  const sets = header?.spriteSets || {};
  const key = stage === "all" ? "first" : stage;
  const spriteSet = sets[key] || sets.first || sets.second || sets.beginning || null;
  return withSpecialSpriteInfo(sourceData, screen, spriteSet);
}

export function loadSpriteGraphicsVram(assets, sourceData, vram, screen, stage = "first") {
  for (const load of COMMON_LOADS) {
    loadSpritePack(assets, vram, load.pack, load.offset);
  }
  const spriteSet = resolveSpriteSet(sourceData, screen, stage);
  loadAreaSpriteGraphics(assets, sourceData, vram, spriteSet?.info?.gfx ?? 0);
}

export function loadCustomSpriteGraphicsVram(assets, sourceData, vram, custom) {
  for (const load of COMMON_LOADS) {
    loadSpritePack(assets, vram, load.pack, load.offset);
  }
  loadAreaSpriteGraphics(assets, sourceData, vram, custom?.gfx ?? 0);
}

export function buildSpritePalette(assets, sourceData, screen, spriteSet) {
  return buildPalette(assets, sourceData, spriteSet?.info?.palette ?? 0, screen >= 64);
}

export function buildCustomSpritePalette(assets, sourceData, custom) {
  return buildPalette(assets, sourceData, custom?.palette ?? 0, Boolean(custom?.darkWorld));
}

function loadAreaSpriteGraphics(assets, sourceData, vram, gfxIndex) {
  const row = sourceData?.spriteTilesets?.[gfxIndex] || [];
  for (let slot = 0; slot < AREA_OFFSETS.length; slot += 1) {
    const pack = row[slot] || 0;
    if (pack) {
      loadSpritePack(assets, vram, pack, AREA_OFFSETS[slot]);
    }
  }
}

/**
 * Apply the kSpExit sprite context used by runtime special rooms without editing Sprites.info.
 */
function withSpecialSpriteInfo(sourceData, screen, spriteSet) {
  const info = specialSpriteInfo(sourceData, screen);
  if (!info || !spriteSet) {
    return spriteSet;
  }
  return { ...spriteSet, info };
}

function loadSpritePack(assets, vram, pack, offset) {
  const bytes = assets.spriteGraphics?.get(pack);
  if (!bytes) {
    return;
  }
  if (HIGH_FORMAT_PACKS.has(pack)) {
    expand3To4High(vram, offset, bytes, 64);
  } else {
    expand3To4Low(vram, offset, bytes, 64);
  }
}

function buildPalette(assets, sourceData, paletteIndex, darkWorld) {
  const cgram = new Uint16Array(256);
  const palettes = assets.spritePalettes || {};
  loadRange(cgram, palettes.sprite_aux3, 0, 0x102, 6);
  loadRange(cgram, palettes.sprite_misc, darkWorld ? 7 : 0, 0x112, 6);
  loadRows(cgram, palettes.sprite_main, 0, 0x122, 14, 3);
  const pair = spritePalettePair(sourceData, paletteIndex);
  loadRange(cgram, palettes.sprite_aux1, pair.sp5l * 7, 0x1a2, 6);
  loadRange(cgram, palettes.sprite_aux1, pair.sp6l * 7, 0x1c2, 6);
  loadRange(cgram, palettes.sprite_misc, darkWorld ? 21 : 14, 0x1d2, 6);
  return cgram;
}

function spritePalettePair(sourceData, paletteIndex) {
  const info = sourceData?.owSprPalInfo || [];
  const base = paletteIndex * 2;
  const sp5l = info[base] ?? -1;
  const sp6l = info[base + 1] ?? -1;
  return {
    sp5l: sp5l >= 0 ? sp5l : firstConcreteSpritePalette(sourceData, 0),
    sp6l: sp6l >= 0 ? sp6l : firstConcreteSpritePalette(sourceData, 1),
  };
}

function firstConcreteSpritePalette(sourceData, slot) {
  const info = sourceData?.owSprPalInfo || [];
  for (let index = slot; index < info.length; index += 2) {
    if (info[index] >= 0) {
      return info[index];
    }
  }
  return 0;
}

function loadRows(cgram, source, sourceIndex, dstByte, count, rows) {
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
