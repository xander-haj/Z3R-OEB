/**
 * Editor-only OAM renderer for overworld sprite placement overlays.
 */

import { rgbToImageWord, snesToRgb } from "../viewer/js/palette.js?v=20260621-render-restore20";
import {
  buildCustomSpritePalette,
  buildSpritePalette,
  resolveSpriteSet,
} from "../viewer/js/sprite-vram.js?v=20260621-render-restore20";
import {
  loadEditorCustomSpriteGraphicsVram,
  loadEditorSpriteGraphicsVram,
} from "./editor-sprite-vram.js?v=20260621-secret-item-vram";
import {
  buildEditorSpriteOam,
  ensureEditorEnemySprites as ensureEditorEnemySourceSprites,
  getEditorSpriteRenderMode,
} from "./enemy-source-oam.js?v=20260621-secret-item-vram";

const PALETTE_VERSION = "20260619-custom-sprite-context";
let gearPalettePromise = null;
let gearPalettes = {};

export function ensureEditorEnemySprites() {
  return Promise.all([ensureEditorEnemySourceSprites(), ensureGearPalettes()]).then(() => true);
}

export function getEditorSpawnSpriteRenderMode(type, sourceData = null, screen = null) {
  return getEditorSpriteRenderMode(type, sourceData, screen);
}

export function drawEditorSpawnSpritesToImage(context, image, screen, originX, originY, sprites, options) {
  const renderer = prepareRenderer(context, image, screen, options);
  if (!renderer) {
    return 0;
  }
  let count = 0;
  for (const sprite of sprites) {
    if (drawProvidedSprite(renderer, originX, originY, sprite)) {
      count += 1;
    }
  }
  return count;
}

function prepareRenderer(context, image, screen, options) {
  const { assets, sourceData } = context;
  const spriteStage = options.spriteStage || "first";
  const spriteSet = resolveSpriteSet(sourceData, screen, spriteStage);
  if (!spriteSet) {
    return null;
  }
  const vram = new Uint16Array(0x8000);
  loadEditorSpriteGraphicsVram(assets, sourceData, vram, screen, spriteSet);
  const colors = buildColorCache(buildEditorSpritePalette(assets, sourceData, screen, spriteSet));
  return {
    assets,
    colors,
    customCache: new Map(),
    height: image.height,
    image,
    pixels: new Uint32Array(image.data.buffer),
    screen,
    sourceData,
    vram,
    width: image.width,
  };
}

function buildEditorSpritePalette(assets, sourceData, screen, spriteSet) {
  const cgram = buildSpritePalette(assets, sourceData, screen, spriteSet);
  const palettes = assets.spritePalettes || {};
  repairFixedSpritePaletteRows(cgram, palettes, screen >= 64);
  repairInheritedSpritePaletteRows(cgram, palettes, sourceData, spriteSet);
  loadArbitrary(cgram, gearPalettes.sprite_sword || palettes.sprite_sword, 0, 0x1b2, 2);
  loadArbitrary(cgram, gearPalettes.sprite_shield || palettes.sprite_shield, 0, 0x1b8, 3);
  loadArbitrary(cgram, palettes.sprite_armor, 0, 0x1e2, 14);
  return cgram;
}

function customRendererForSprite(renderer, sprite) {
  if (!sprite.custom) {
    return renderer;
  }
  const key = JSON.stringify(sprite.custom);
  if (!renderer.customCache.has(key)) {
    const vram = new Uint16Array(0x8000);
    loadEditorCustomSpriteGraphicsVram(renderer.assets, renderer.sourceData, vram, sprite.custom);
    const cgram = buildCustomSpritePalette(renderer.assets, renderer.sourceData, sprite.custom);
    repairFixedSpritePaletteRows(cgram, renderer.assets.spritePalettes || {}, Boolean(sprite.custom.darkWorld));
    repairInheritedSpritePaletteRows(cgram, renderer.assets.spritePalettes || {},
      renderer.sourceData, { info: sprite.custom });
    renderer.customCache.set(key, { ...renderer, colors: buildColorCache(cgram), vram });
  }
  return renderer.customCache.get(key);
}

/**
 * Restores the fixed overworld OBJ palette rows used by source sprite previews.
 */
function repairFixedSpritePaletteRows(cgram, palettes, darkWorld) {
  loadArbitrary(cgram, palettes.sprite_aux3, (darkWorld ? 3 : 1) * 7, 0x102, 6);
  loadArbitrary(cgram, palettes.sprite_misc, (darkWorld ? 9 : 7) * 7, 0x112, 6);
  loadArbitrary(cgram, palettes.sprite_misc, (darkWorld ? 8 : 6) * 7, 0x1d2, 6);
}

/**
 * Restores source palette rows whose kOwSprPalInfo entries retain live state.
 *
 * Parameters:
 *   cgram: Sprite CGRAM buffer produced by the shared viewer helper.
 *   palettes: Dumped sprite palette tables.
 *   sourceData: Parsed source tables containing owSprPalInfo.
 *   spriteSet: Active overworld sprite-set metadata for the rendered area.
 * Returns:
 *   None; mutates cgram in place.
 */
function repairInheritedSpritePaletteRows(cgram, palettes, sourceData, spriteSet) {
  const paletteIndex = spriteSet?.info?.palette ?? 0;
  const sprInfo = sourceData?.owSprPalInfo || [];
  if ((sprInfo[paletteIndex * 2] ?? -1) < 0) {
    loadArbitrary(cgram, palettes.sprite_aux1, inheritedSpritePaletteRow(sourceData, 0) * 7, 0x1a2, 6);
  }
  if ((sprInfo[paletteIndex * 2 + 1] ?? -1) < 0) {
    loadArbitrary(cgram, palettes.sprite_aux1, inheritedSpritePaletteRow(sourceData, 1) * 7, 0x1c2, 6);
  }
}

/**
 * Finds the first concrete source row for a retained sp5l/sp6l palette slot.
 *
 * Parameters:
 *   sourceData: Parsed source tables containing owSprPalInfo.
 *   slot: Slot offset, 0 for sp5l and 1 for sp6l.
 * Returns:
 *   Palette row index to copy from sprite_aux1.
 */
function inheritedSpritePaletteRow(sourceData, slot) {
  const sprInfo = sourceData?.owSprPalInfo || [];
  for (let i = slot; i < sprInfo.length; i += 2) {
    if (sprInfo[i] >= 0) {
      return sprInfo[i];
    }
  }
  return 0;
}

function ensureGearPalettes() {
  if (!gearPalettePromise) {
    gearPalettePromise = Promise.all([
      fetchOptionalUint16("sprite_sword"),
      fetchOptionalUint16("sprite_shield"),
    ]).then(([sword, shield]) => {
      gearPalettes = {
        ...(sword ? { sprite_sword: sword } : {}),
        ...(shield ? { sprite_shield: shield } : {}),
      };
    });
  }
  return gearPalettePromise;
}

async function fetchOptionalUint16(name) {
  const response = await fetch(`/assets/overworld_dump/palettes/${name}.bin?v=${PALETTE_VERSION}`);
  if (!response.ok) {
    return null;
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  const words = new Uint16Array(bytes.length / 2);
  for (let i = 0; i < words.length; i += 1) {
    words[i] = bytes[i * 2] | (bytes[i * 2 + 1] << 8);
  }
  return words;
}

function loadArbitrary(cgram, source, sourceIndex, dstByte, count) {
  if (!source) {
    return;
  }
  let src = sourceIndex;
  let dst = dstByte >> 1;
  for (let i = 0; i <= count; i += 1) {
    cgram[dst] = source[src] || 0;
    src += 1;
    dst += 1;
  }
}

function drawProvidedSprite(renderer, originX, originY, sprite) {
  const activeRenderer = customRendererForSprite(renderer, sprite);
  const recipeScreen = sprite.custom?.sourceArea !== undefined
    ? numeric(sprite.custom.sourceArea, renderer.screen)
    : renderer.screen;
  const defaultFlags = renderer.sourceData.spriteInitFlags3[sprite.type] & 0x0f;
  const baseFlags = sprite.oamFlags === null || sprite.oamFlags === undefined ? defaultFlags : sprite.oamFlags;
  let sourceDraw = null;
  try {
    sourceDraw = buildEditorSpriteOam(renderer.sourceData, sprite.type, baseFlags, recipeScreen);
  } catch (error) {
    console.warn("Unable to draw editor overworld sprite", sprite.type, error);
  }
  if (!sourceDraw?.length) {
    return false;
  }
  const prep = spritePrepOffset(sprite.type, recipeScreen);
  const x = originX + sprite.x * 16 + prep.x + (sprite.pixelXOffset || 0);
  const y = originY + sprite.y * 16 + prep.y;
  for (const oam of sourceDraw) {
    drawOamTile(activeRenderer.pixels, activeRenderer.width, activeRenderer.height,
      activeRenderer.vram, activeRenderer.colors,
      oam.tile, oam.attr, oam.size === 2 ? 16 : 8, x + oam.x, y + oam.y);
  }
  return true;
}

function spritePrepOffset(type, screen) {
  if (type === 0x2e) return (screen & 0x40) ? { x: 8, y: -8 } : { x: 7, y: 0 };
  return { x: 0, y: 0 };
}

function numeric(value, fallback = 0) {
  if (Number.isInteger(value)) {
    return value;
  }
  const match = String(value ?? "").trim().match(/^(-?)(?:0x([0-9a-f]+)|([0-9]+))$/i);
  if (!match) {
    return fallback;
  }
  return (match[1] === "-" ? -1 : 1) * Number.parseInt(match[2] ?? match[3], match[2] ? 16 : 10);
}

function buildColorCache(cgram) {
  const colors = new Uint32Array(256);
  for (let i = 0; i < colors.length; i += 1) {
    colors[i] = rgbToImageWord(snesToRgb(cgram[i]));
  }
  return colors;
}

function drawOamTile(pixels, width, height, vram, colors, tileNumber, attr, size, dstX, dstY) {
  const objAdr = attr & 1 ? 0x5000 : 0x4000;
  const paletteBase = 0x80 + 16 * ((attr & 0x0e) >> 1);
  const hFlip = Boolean(attr & 0x40);
  const vFlip = Boolean(attr & 0x80);
  for (let py = 0; py < size; py += 1) {
    const row = vFlip ? size - 1 - py : py;
    const y = dstY + py;
    if (y < 0 || y >= height) {
      continue;
    }
    for (let col = 0; col < size; col += 8) {
      const usedCol = hFlip ? size - 1 - col : col;
      const usedTile = ((((tileNumber >> 4) + (row >> 3)) << 4) |
        (((tileNumber & 0x0f) + (usedCol >> 3)) & 0x0f));
      const tileBase = objAdr + usedTile * 16 + (row & 7);
      const plane1 = vram[tileBase & 0x7fff];
      const plane2 = vram[(tileBase + 8) & 0x7fff];
      for (let px = 0; px < 8; px += 1) {
        const x = dstX + col + px;
        if (x < 0 || x >= width) {
          continue;
        }
        const colorIndex = read4BppPixel(plane1, plane2, hFlip ? px : 7 - px);
        if (colorIndex !== 0) {
          pixels[y * width + x] = colors[paletteBase + colorIndex];
        }
      }
    }
  }
}

function read4BppPixel(plane1, plane2, col) {
  let pixel = (plane1 >> col) & 1;
  pixel |= ((plane1 >> (8 + col)) & 1) << 1;
  pixel |= ((plane2 >> col) & 1) << 2;
  pixel |= ((plane2 >> (8 + col)) & 1) << 3;
  return pixel;
}
