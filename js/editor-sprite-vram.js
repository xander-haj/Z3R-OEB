/**
 * Editor OBJ VRAM reconstruction backed only by dumped overworld assets.
 */

import { expand3To4High, expand3To4Low } from "../viewer/js/binary.js?v=20260621-render-restore20";

const AREA_OFFSETS = [0x5000, 0x5400, 0x5800, 0x5c00];
const AREA_FALLBACK_PACK = 70;
const HIGH_FORMAT_PACKS = new Set([0x52, 0x53, 0x5a, 0x5b, 0x5c, 0x5e, 0x5f]);
const ITEM_RUPEE_PACK = 96;

export function loadEditorSpriteGraphicsVram(assets, sourceData, vram, screen, spriteSet) {
  const darkWorld = screen >= 64;
  loadCommonSpriteSlots(assets, sourceData, vram, darkWorld);
  loadAreaSpriteSlots(assets, sourceData, vram, spriteSet?.info?.gfx ?? 0);
  loadRuntimeRupeeStrips(assets, vram);
}

export function loadEditorCustomSpriteGraphicsVram(assets, sourceData, vram, custom) {
  loadCommonSpriteSlots(assets, sourceData, vram, Boolean(custom?.darkWorld));
  loadAreaSpriteSlots(assets, sourceData, vram, custom?.gfx ?? 0);
  loadRuntimeRupeeStrips(assets, vram);
}

function loadCommonSpriteSlots(assets, sourceData, vram, darkWorld) {
  const various = sourceData?.rawSourceTables?.various_packs || sourceData?.variousPacks || [];
  loadSpritePack(assets, vram, 0, 0x4000, true);
  loadSpritePack(assets, vram, various[6 + (darkWorld ? 8 : 0)] ?? (darkWorld ? 0x0b : 1), 0x4400, true);
  loadSpritePack(assets, vram, 6, 0x4800, false);
  loadSpritePack(assets, vram, 7, 0x4c00, false);
}

function loadAreaSpriteSlots(assets, sourceData, vram, gfxIndex) {
  const row = sourceData?.spriteTilesets?.[gfxIndex] || [];
  for (let slot = 0; slot < AREA_OFFSETS.length; slot += 1) {
    const pack = row[slot] || AREA_FALLBACK_PACK;
    loadSpritePack(assets, vram, pack, AREA_OFFSETS[slot], HIGH_FORMAT_PACKS.has(pack));
  }
}

function loadRuntimeRupeeStrips(assets, vram) {
  const bytes = assets.spriteGraphics?.get(ITEM_RUPEE_PACK);
  if (!bytes) {
    return;
  }
  // The game stages rupee item tiles from pack 96, then NMI copies them into
  // OBJ tiles 0x0b/0x1b. Secret rupees use those character numbers directly.
  expand3To4High(vram, 0x40b0, bytes, 3);
  expand3To4High(vram, 0x41b0, bytes.slice(0x180), 3);
}

function loadSpritePack(assets, vram, pack, offset, high) {
  const bytes = assets.spriteGraphics?.get(pack);
  if (!bytes) {
    return;
  }
  if (high) {
    expand3To4High(vram, offset, bytes, 64);
  } else {
    expand3To4Low(vram, offset, bytes, 64);
  }
}
