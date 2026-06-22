/**
 * Secondary overworld overlay compositing for source-backed atlas rendering.
 */

import { read4BppPixel } from "./binary.js";
import { rgbToImageWord, snesToRgb } from "./palette.js?v=20260621-render-restore20";
import { buildBgPalette, resolveAuxTheme, resolveMainTheme } from "./tilesets.js?v=20260621-render-restore20";

const MAP16_SIZE = 16;
const MAP8_SIZE = 8;
const MAP32_SIZE = 32;
const OVERLAY_RULE_SCREENS = new Set([0x03, 0x05, 0x07]);
const DEFAULT_STREAMS = [
  stream(0x95, 0x03, "underlay", false),
  stream(0x9c, 0x43, "underlay", false),
  stream(0x9d, 0x00, "overlay", true),
  stream(0x9f, 0x70, "overlay", true),
];

/**
 * Draw the runtime secondary map32 overlay over one atlas screen.
 *
 * Parameters:
 *   app: Loaded viewer/editor application state with assets and source tables.
 *   image: Destination ImageData backing the rendered atlas.
 *   group: Atlas group descriptor, used to limit this pass to normal worlds.
 *   screen: Raw screen slot being rendered.
 *   contextScreen: Area-head screen that supplies base map context.
 *   originX: Destination x offset in atlas pixels.
 *   originY: Destination y offset in atlas pixels.
 *   options: Renderer options, including layer toggles and palette overrides.
 * Returns:
 *   Nothing; pixels are composited into image in place.
 */
export function drawStructuralOverlay(app, image, group, screen, contextScreen, originX, originY, options = {}) {
  if (!shouldDrawOverlay(group, options)) {
    return;
  }
  const descriptor = resolveOverlayDescriptor(app?.sourceData?.overlayMetadata, group, screen, contextScreen);
  if (!descriptor) {
    return;
  }
  const map32 = app.assets?.map32Words?.[descriptor.stream];
  if (!Array.isArray(map32) || map32.length === 0) {
    return;
  }
  const renderScreen = numberOr(descriptor.contextScreen, contextScreen);
  const aux = resolveAuxTheme(app.sourceData, renderScreen, options.auxOverride ?? null);
  const vram = app.tilesetCache.getVram(resolveMainTheme(renderScreen), aux.value, renderScreen,
    options.spriteStage || "first", false);
  const colors = colorCache(buildBgPalette(app.assets, app.sourceData, renderScreen, options.paletteOverride));
  const basePalette = buildBgPalette(app.assets, app.sourceData, contextScreen, options.paletteOverride);
  const baseBackdrop = colorCache(basePalette)[0];
  drawOverlayTilemap(image, {
    baseBackdrop,
    blend: descriptor.blend || {},
    colors,
    composite: descriptor.composite || "overlay",
    map16ToMap8: app.assets.map16ToMap8,
    map32,
    map32ToMap16: app.assets.map32ToMap16,
    vram,
  }, originX, originY);
}

/**
 * Return whether the current atlas/layer state should render secondary overlays.
 *
 * Parameters:
 *   group: Atlas group descriptor.
 *   options: Renderer options containing the structural overlay toggle.
 * Returns:
 *   True when this pass should run for Light/Dark atlas screens.
 */
function shouldDrawOverlay(group, options) {
  return Boolean(options.showOverlays) && (group?.id === "light" || group?.id === "dark");
}

/**
 * Resolve the overlay stream and rendering descriptor for one screen.
 *
 * Parameters:
 *   metadata: Dumped overlay metadata, if available.
 *   group: Atlas group descriptor.
 *   screen: Raw screen slot being rendered.
 *   contextScreen: Area-head screen for large-area children.
 * Returns:
 *   Overlay descriptor or null when no runtime secondary overlay applies.
 */
function resolveOverlayDescriptor(metadata, group, screen, contextScreen) {
  const streamId = resolveNormalOverlayStream(group, screen, contextScreen);
  if (streamId === null) {
    return null;
  }
  const streams = metadata?.secondaryOverlayStreams || DEFAULT_STREAMS;
  const descriptor = streams.find((item) => numberOr(item.stream, -1) === streamId);
  return descriptor || stream(streamId, contextScreen, "overlay", true);
}

/**
 * Match the runtime's normal-world overlay stream selection used by Overworld_LoadOverlays2.
 *
 * Parameters:
 *   group: Atlas group descriptor.
 *   screen: Raw screen slot being rendered.
 *   contextScreen: Area-head screen for large-area children.
 * Returns:
 *   Overlay stream id, or null when no overlay stream should be shown.
 */
function resolveNormalOverlayStream(group, screen, contextScreen) {
  const lowContext = contextScreen & 0x3f;
  if (screen === 0x70) {
    return 0x9f;
  }
  if (lowContext === 0x00) {
    return 0x9d;
  }
  if (OVERLAY_RULE_SCREENS.has(lowContext)) {
    return group?.id === "dark" ? 0x9c : 0x95;
  }
  return null;
}

/**
 * Draw every nontransparent map8 pixel from an overlay map32 stream.
 *
 * Parameters:
 *   image: Destination atlas ImageData.
 *   context: Overlay render context with tilemaps, VRAM, palette, and blend mode.
 *   originX: Destination x offset in atlas pixels.
 *   originY: Destination y offset in atlas pixels.
 * Returns:
 *   Nothing; pixels are composited into image in place.
 */
function drawOverlayTilemap(image, context, originX, originY) {
  for (let y = 0; y < MAP16_SIZE; y += 1) {
    for (let x = 0; x < MAP16_SIZE; x += 1) {
      const map32 = context.map32[y * MAP16_SIZE + x] || 0;
      const expanded = context.map32ToMap16[map32] || [0, 0, 0, 0];
      const dstX = originX + x * MAP32_SIZE;
      const dstY = originY + y * MAP32_SIZE;
      drawMap16(image, context, expanded[0], dstX, dstY);
      drawMap16(image, context, expanded[1], dstX + MAP16_SIZE, dstY);
      drawMap16(image, context, expanded[2], dstX, dstY + MAP16_SIZE);
      drawMap16(image, context, expanded[3], dstX + MAP16_SIZE, dstY + MAP16_SIZE);
    }
  }
}

/**
 * Expand one map16 entry into its four map8 hardware-tile words.
 *
 * Parameters:
 *   image: Destination atlas ImageData.
 *   context: Overlay render context.
 *   map16: Map16 tile id to expand.
 *   dstX: Destination x coordinate in pixels.
 *   dstY: Destination y coordinate in pixels.
 * Returns:
 *   Nothing; pixels are composited into image in place.
 */
function drawMap16(image, context, map16, dstX, dstY) {
  const base = map16 * 4;
  drawMap8(image, context, context.map16ToMap8[base] || 0, dstX, dstY);
  drawMap8(image, context, context.map16ToMap8[base + 1] || 0, dstX + MAP8_SIZE, dstY);
  drawMap8(image, context, context.map16ToMap8[base + 2] || 0, dstX, dstY + MAP8_SIZE);
  drawMap8(image, context, context.map16ToMap8[base + 3] || 0, dstX + MAP8_SIZE, dstY + MAP8_SIZE);
}

/**
 * Decode and composite one 8x8 tile, respecting map8 flip bits and transparent color zero.
 *
 * Parameters:
 *   image: Destination atlas ImageData.
 *   context: Overlay render context.
 *   word: SNES map8 tile word.
 *   dstX: Destination x coordinate in pixels.
 *   dstY: Destination y coordinate in pixels.
 * Returns:
 *   Nothing; pixels are composited into image in place.
 */
function drawMap8(image, context, word, dstX, dstY) {
  const tileNumber = word & 0x01ff;
  const paletteBase = ((word & 0x1c00) >> 10) * 16;
  const hFlip = Boolean(word & 0x4000);
  const vFlip = Boolean(word & 0x8000);
  const tileBase = 0x2000 + tileNumber * 16;
  const pixels = new Uint32Array(image.data.buffer);
  for (let py = 0; py < MAP8_SIZE; py += 1) {
    const y = dstY + py;
    if (y < 0 || y >= image.height) {
      continue;
    }
    const row = vFlip ? 7 - py : py;
    const plane1 = context.vram[(tileBase + row) & 0x7fff];
    const plane2 = context.vram[(tileBase + 8 + row) & 0x7fff];
    for (let px = 0; px < MAP8_SIZE; px += 1) {
      const x = dstX + px;
      if (x < 0 || x >= image.width) {
        continue;
      }
      const colorIndex = read4BppPixel(plane1, plane2, hFlip ? px : 7 - px);
      if (colorIndex) {
        compositePixel(pixels, y * image.width + x, context, context.colors[paletteBase + colorIndex]);
      }
    }
  }
}

/**
 * Composite one source pixel over the destination according to runtime overlay metadata.
 *
 * Parameters:
 *   pixels: Destination atlas pixels as packed image words.
 *   index: Destination pixel index.
 *   context: Overlay render context with blend/composite settings.
 *   source: Packed overlay pixel word.
 * Returns:
 *   Nothing; one destination pixel may be replaced.
 */
function compositePixel(pixels, index, context, source) {
  const destination = pixels[index];
  if (context.composite === "underlay" && destination !== context.baseBackdrop) {
    return;
  }
  const operation = context.blend.operation || "add";
  if (operation === "add") {
    pixels[index] = context.blend.half ? halfAdd(destination, source) : saturatingAdd(destination, source);
  } else {
    pixels[index] = source;
  }
}

/**
 * Add two image words and halve the result, matching CGADSUB half-add intent.
 *
 * Parameters:
 *   destination: Existing packed image word.
 *   source: Overlay packed image word.
 * Returns:
 *   Packed image word after half-add blending.
 */
function halfAdd(destination, source) {
  return packColor(
    (red(destination) + red(source)) >> 1,
    (green(destination) + green(source)) >> 1,
    (blue(destination) + blue(source)) >> 1,
  );
}

/**
 * Add two image words with per-channel saturation.
 *
 * Parameters:
 *   destination: Existing packed image word.
 *   source: Overlay packed image word.
 * Returns:
 *   Packed image word after additive blending.
 */
function saturatingAdd(destination, source) {
  return packColor(
    Math.min(255, red(destination) + red(source)),
    Math.min(255, green(destination) + green(source)),
    Math.min(255, blue(destination) + blue(source)),
  );
}

/**
 * Convert a BGR555 palette into packed image words once for pixel loops.
 *
 * Parameters:
 *   cgram: SNES BGR555 palette words.
 * Returns:
 *   Uint32Array of packed browser image words.
 */
function colorCache(cgram) {
  const result = new Uint32Array(256);
  for (let index = 0; index < result.length; index += 1) {
    result[index] = rgbToImageWord(snesToRgb(cgram[index]));
  }
  return result;
}

/**
 * Build a fallback stream descriptor when older dumps lack overlay metadata.
 *
 * Parameters:
 *   id: Overlay stream screen id.
 *   contextScreen: Screen that supplies graphics and palette context.
 *   composite: Overlay composition mode.
 *   half: Whether additive blending should halve the result.
 * Returns:
 *   Overlay stream descriptor.
 */
function stream(id, contextScreen, composite, half) {
  return {
    blend: { half, operation: "add" },
    composite,
    contextScreen,
    stream: id,
  };
}

/**
 * Return a number when finite, otherwise the provided fallback.
 *
 * Parameters:
 *   value: Candidate numeric value.
 *   fallback: Replacement when value is not finite.
 * Returns:
 *   Numeric value.
 */
function numberOr(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

/**
 * Pack red, green, and blue bytes into the ImageData Uint32 layout used by the renderer.
 *
 * Parameters:
 *   r: Red channel.
 *   g: Green channel.
 *   b: Blue channel.
 * Returns:
 *   Packed image word.
 */
function packColor(r, g, b) {
  return (0xff << 24) | ((b & 0xff) << 16) | ((g & 0xff) << 8) | (r & 0xff);
}

/**
 * Extract the red byte from a packed image word.
 *
 * Parameters:
 *   word: Packed image word.
 * Returns:
 *   Red channel byte.
 */
function red(word) {
  return word & 0xff;
}

/**
 * Extract the green byte from a packed image word.
 *
 * Parameters:
 *   word: Packed image word.
 * Returns:
 *   Green channel byte.
 */
function green(word) {
  return (word >> 8) & 0xff;
}

/**
 * Extract the blue byte from a packed image word.
 *
 * Parameters:
 *   word: Packed image word.
 * Returns:
 *   Blue channel byte.
 */
function blue(word) {
  return (word >> 16) & 0xff;
}
