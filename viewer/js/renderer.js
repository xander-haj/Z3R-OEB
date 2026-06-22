/**
 * Source-backed overworld atlas renderer for the editor workbench.
 */

import { read4BppPixel } from "./binary.js";
import { drawStructuralOverlay } from "./overlay-renderer.js?v=20260621-render-restore20";
import { rgbToImageWord, snesToRgb } from "./palette.js?v=20260621-render-restore20";
import {
  groupPanel,
  SPECIAL_AREA_SIZE,
  SPECIAL_BUFFER_SIZE,
  SPECIAL_PANEL_HEIGHT,
  SPECIAL_PANEL_WIDTH,
  TRIFORCE_ROOM,
} from "./special-area-panels.js?v=20260621-render-restore20";
import {
  groupScreenHeight,
  groupScreenWidth,
  groupViewport,
  resolveGroupContextScreen,
} from "./map-groups.js?v=20260621-render-restore20";
import { specialBgContext } from "./special-scene-context.js?v=20260621-render-restore20";
import { buildBgPalette, resolveAuxTheme, resolveMainTheme } from "./tilesets.js?v=20260621-render-restore20";

const MAP32_SIZE = 32;
const MAP16_SIZE = 16;
const MAP8_SIZE = 8;

export function renderGroup(app, group, options = {}) {
  const canvas = document.createElement("canvas");
  canvas.width = group.width;
  canvas.height = group.height;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  const image = ctx.createImageData(canvas.width, canvas.height);
  const cellWidth = groupScreenWidth(group);
  const cellHeight = groupScreenHeight(group);
  for (let row = 0; row < group.rows; row += 1) {
    for (let col = 0; col < group.columns; col += 1) {
      const panel = groupPanel(group, row, col);
      if (group.kind === "special-panels" && !panel) {
        continue;
      }
      const screen = panel?.screen ?? group.base + row * group.columns + col;
      const contextScreen = resolveGroupContextScreen(group, screen);
      renderScreen(app, image, group, screen, contextScreen, col * cellWidth, row * cellHeight, options, panel);
    }
  }
  drawStaticOverlayGroup(app, image, group, options);
  ctx.putImageData(image, 0, 0);
  drawGrids(ctx, group, options);
  drawPanelLabels(ctx, group, options);
  return canvas;
}

function renderScreen(app, image, group, screen, contextScreen, originX, originY, options, panel = null) {
  const renderOptions = contextOptions(app.sourceData, group, screen, options, panel);
  const paletteScreen = renderOptions.paletteScreen ?? contextScreen;
  const colors = colorCache(buildBgPalette(app.assets, app.sourceData, paletteScreen,
    renderOptions.paletteOverride, renderOptions.paletteOptions));
  const viewport = panel?.viewport || groupViewport(group);
  fillScreen(image, originX, originY, viewport.width, viewport.height, colors[0]);
  if (renderOptions.skipTerrain) {
    return;
  }
  const aux = resolveAuxTheme(app.sourceData, contextScreen, renderOptions.auxOverride ?? null);
  const mainTheme = renderOptions.mainOverride ?? resolveMainTheme(contextScreen);
  const vram = app.tilesetCache.getVram(mainTheme, aux.value, contextScreen,
    renderOptions.spriteStage || "first", Boolean(renderOptions.showSprites),
    renderOptions.animatedPackOverride ?? null);
  const context = {
    clip: {
      bottom: originY + viewport.height,
      left: originX,
      right: originX + viewport.width,
      top: originY,
    },
    colors,
    map16ToMap8: app.assets.map16ToMap8,
    map32ToMap16: app.assets.map32ToMap16,
    vram,
  };
  if (panel?.kind === "room") {
    drawRoomPanel(app, image, context, panel, originX, originY, renderOptions);
  } else {
    drawAreaPage(app, image, context, screen, originX - viewport.x, originY - viewport.y, renderOptions);
  }
  if (group.kind === "atlas") {
    drawStructuralOverlay(app, image, group, screen, contextScreen, originX, originY, renderOptions);
  }
}

function drawAreaPage(app, image, context, area, originX, originY, options, blend = null) {
  context.map32 = app.assets.map32Words[area] || [];
  if (options.layers?.bgLow !== false) {
    drawScreenLayer(image, context, originX, originY, false, Boolean(blend), blend);
  }
  if (options.layers?.bgHigh !== false) {
    drawScreenLayer(image, context, originX, originY, true, true, blend);
  }
}

function drawRoomPanel(app, image, context, panel, originX, originY, options) {
  const left = mod(panel.crop.x, SPECIAL_BUFFER_SIZE);
  const top = mod(panel.crop.y, SPECIAL_BUFFER_SIZE);
  for (let qy = 0; qy < 2; qy += 1) {
    for (let qx = 0; qx < 2; qx += 1) {
      drawRoomArea(app, image, context, panel.screen + qx + qy * 8, qx * SPECIAL_AREA_SIZE,
        qy * SPECIAL_AREA_SIZE, left, top, originX, originY, options);
    }
  }
  if (panel.room === TRIFORCE_ROOM) {
    drawRoomArea(app, image, context, 0x93, 0, 0, left, top, originX, originY, options, "half-add");
  }
}

function drawRoomArea(app, image, context, area, bufferX, bufferY, left, top, originX, originY, options, blend = null) {
  if (!app.assets.map32Words[area]) {
    return;
  }
  for (let ry = -1; ry <= 1; ry += 1) {
    for (let rx = -1; rx <= 1; rx += 1) {
      const dx = bufferX - left + rx * SPECIAL_BUFFER_SIZE;
      const dy = bufferY - top + ry * SPECIAL_BUFFER_SIZE;
      if (intersectsPanel(dx, dy)) {
        drawAreaPage(app, image, context, area, originX + dx, originY + dy, options, blend);
      }
    }
  }
}

/**
 * Draw static overlay writes after base pages so 64x64 runtime writes can cross atlas cell edges.
 */
function drawStaticOverlayGroup(app, image, group, options) {
  if (group.kind !== "atlas" || options.layers?.staticOverlays !== true) {
    return;
  }
  const cellWidth = groupScreenWidth(group), cellHeight = groupScreenHeight(group);
  const viewport = groupViewport(group);
  for (let row = 0; row < group.rows; row += 1) {
    for (let col = 0; col < group.columns; col += 1) {
      const screen = group.base + row * group.columns + col;
      const records = app.sourceData?.areaHeaders?.[screen]?.staticOverlays || [];
      if (!records.length) {
        continue;
      }
      const contextScreen = resolveGroupContextScreen(group, screen);
      const renderOptions = contextOptions(app.sourceData, group, screen, options);
      const paletteScreen = renderOptions.paletteScreen ?? contextScreen;
      const colors = colorCache(buildBgPalette(app.assets, app.sourceData, paletteScreen,
        renderOptions.paletteOverride, renderOptions.paletteOptions));
      const aux = resolveAuxTheme(app.sourceData, contextScreen, renderOptions.auxOverride ?? null);
      const mainTheme = renderOptions.mainOverride ?? resolveMainTheme(contextScreen);
      const context = {
        clip: { bottom: image.height, left: 0, right: image.width, top: 0 },
        colors,
        map16ToMap8: app.assets.map16ToMap8,
        vram: app.tilesetCache.getVram(mainTheme, aux.value, contextScreen,
          renderOptions.spriteStage || "first", Boolean(renderOptions.showSprites),
          renderOptions.animatedPackOverride ?? null),
      };
      drawStaticOverlayRecords(image, context, records, col * cellWidth - viewport.x, row * cellHeight - viewport.y);
    }
  }
}

function drawStaticOverlayRecords(image, context, records, originX, originY) {
  for (const record of records) {
    if (record.x < 0 || record.x >= 64 || record.y < 0 || record.y >= 64) {
      continue;
    }
    const dstX = originX + record.x * MAP16_SIZE;
    const dstY = originY + record.y * MAP16_SIZE;
    drawMap16(image, context, record.tile, dstX, dstY, false, false);
    drawMap16(image, context, record.tile, dstX, dstY, true, true);
  }
}

function contextOptions(sourceData, group, screen, options, panel = null) {
  const special = group?.id === "special" ?
    specialBgContext(sourceData, screen, panel?.room, panel?.variant) : null;
  if (!special) {
    return options;
  }
  return {
    ...options,
    animatedPackOverride: options.animatedPackOverride ?? special.animatedPack,
    auxOverride: options.auxOverride ?? special.aux,
    mainOverride: options.mainOverride ?? special.main,
    paletteOptions: mergePaletteOptions(options.paletteOptions, special),
    paletteOverride: options.paletteOverride ?? special.palette,
    paletteScreen: options.paletteScreen ?? special.paletteScreen,
    skipTerrain: Boolean(options.skipTerrain || special.skipTerrain),
  };
}

function mergePaletteOptions(current, special) {
  return {
    ...(current || {}),
    aux2Override: current?.aux2Override ?? special.paletteAux2,
    backdropScreen: current?.backdropScreen ?? special.backdropScreen,
    backdropRoom: current?.backdropRoom ?? special.backdropRoom,
    modeOverride: current?.modeOverride ?? special.paletteMode,
  };
}

function fillScreen(image, originX, originY, width, height, color) {
  const pixels = new Uint32Array(image.data.buffer);
  for (let y = 0; y < height; y += 1) {
    const offset = (originY + y) * image.width + originX;
    pixels.fill(color, offset, offset + width);
  }
}

function drawScreenLayer(image, context, originX, originY, priority, transparent, blend = null) {
  for (let y = 0; y < 16; y += 1) {
    for (let x = 0; x < 16; x += 1) {
      const map32 = context.map32[y * 16 + x] || 0;
      const expanded = context.map32ToMap16[map32] || [0, 0, 0, 0];
      const dstX = originX + x * MAP32_SIZE;
      const dstY = originY + y * MAP32_SIZE;
      drawMap16(image, context, expanded[0], dstX, dstY, priority, transparent, blend);
      drawMap16(image, context, expanded[1], dstX + MAP16_SIZE, dstY, priority, transparent, blend);
      drawMap16(image, context, expanded[2], dstX, dstY + MAP16_SIZE, priority, transparent, blend);
      drawMap16(image, context, expanded[3], dstX + MAP16_SIZE, dstY + MAP16_SIZE, priority, transparent, blend);
    }
  }
}

function drawMap16(image, context, map16, dstX, dstY, priority, transparent, blend = null) {
  const base = map16 * 4;
  drawMap8(image, context, context.map16ToMap8[base] || 0, dstX, dstY, priority, transparent, blend);
  drawMap8(image, context, context.map16ToMap8[base + 1] || 0,
    dstX + MAP8_SIZE, dstY, priority, transparent, blend);
  drawMap8(image, context, context.map16ToMap8[base + 2] || 0,
    dstX, dstY + MAP8_SIZE, priority, transparent, blend);
  drawMap8(image, context, context.map16ToMap8[base + 3] || 0,
    dstX + MAP8_SIZE, dstY + MAP8_SIZE, priority, transparent, blend);
}

function drawMap8(image, context, word, dstX, dstY, priority, transparent, blend = null) {
  if (Boolean(word & 0x2000) !== priority) {
    return;
  }
  const tileNumber = word & 0x01ff;
  const paletteBase = ((word & 0x1c00) >> 10) * 16;
  const hFlip = Boolean(word & 0x4000);
  const vFlip = Boolean(word & 0x8000);
  const tileBase = 0x2000 + tileNumber * 16;
  const pixels = new Uint32Array(image.data.buffer);
  for (let py = 0; py < MAP8_SIZE; py += 1) {
    const y = dstY + py;
    if (y < 0 || y >= image.height || y < context.clip.top || y >= context.clip.bottom) {
      continue;
    }
    const row = vFlip ? 7 - py : py;
    const plane1 = context.vram[(tileBase + row) & 0x7fff];
    const plane2 = context.vram[(tileBase + 8 + row) & 0x7fff];
    for (let px = 0; px < MAP8_SIZE; px += 1) {
      const x = dstX + px;
      if (x < 0 || x >= image.width || x < context.clip.left || x >= context.clip.right) {
        continue;
      }
      const colorIndex = read4BppPixel(plane1, plane2, hFlip ? px : 7 - px);
      if (!transparent || colorIndex) {
        const paletteIndex = colorIndex === 0 ? 0 : paletteBase + colorIndex;
        writePixel(pixels, y * image.width + x, context.colors[paletteIndex], blend);
      }
    }
  }
}

function writePixel(pixels, index, color, blend) {
  pixels[index] = blend === "half-add" ? halfAdd(pixels[index], color) : color;
}

function colorCache(cgram) {
  const result = new Uint32Array(256);
  for (let index = 0; index < result.length; index += 1) {
    result[index] = rgbToImageWord(snesToRgb(cgram[index]));
  }
  return result;
}

function intersectsPanel(x, y) {
  return x < SPECIAL_PANEL_WIDTH && y < SPECIAL_PANEL_HEIGHT &&
    x + SPECIAL_AREA_SIZE > 0 && y + SPECIAL_AREA_SIZE > 0;
}

function mod(value, size) {
  return ((value % size) + size) % size;
}

function halfAdd(destination, source) {
  return packColor(
    (red(destination) + red(source)) >> 1,
    (green(destination) + green(source)) >> 1,
    (blue(destination) + blue(source)) >> 1,
  );
}

function packColor(r, g, b) {
  return (0xff << 24) | ((b & 0xff) << 16) | ((g & 0xff) << 8) | (r & 0xff);
}

function red(word) {
  return word & 0xff;
}

function green(word) {
  return (word >> 8) & 0xff;
}

function blue(word) {
  return (word >> 16) & 0xff;
}

function drawGrids(ctx, group, options) {
  if (options.showMap8Grid) {
    drawGrid(ctx, group, MAP8_SIZE, "rgba(255,255,255,0.07)");
  }
  if (options.showMap16Grid) {
    drawGrid(ctx, group, MAP16_SIZE, "rgba(255,255,255,0.12)");
  }
  if (options.showMap32Grid) {
    drawGrid(ctx, group, MAP32_SIZE, "rgba(255,255,255,0.18)");
  }
  if (options.showGrid) {
    drawScreenGrid(ctx, group, "rgba(255,255,255,0.32)");
  }
}

function drawPanelLabels(ctx, group, options) {
  if (group.kind !== "special-panels" || options.layers?.panelLabels === false) {
    return;
  }
  ctx.save();
  ctx.font = "700 12px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
  ctx.fillStyle = "rgba(250, 255, 245, 0.96)";
  ctx.textBaseline = "top";
  for (let row = 0; row < group.rows; row += 1) {
    for (let col = 0; col < group.columns; col += 1) {
      const panel = groupPanel(group, row, col);
      if (panel) {
        ctx.fillText(panel.label, col * group.screenWidth, row * group.screenHeight + SPECIAL_PANEL_HEIGHT + 8);
      }
    }
  }
  ctx.restore();
}

function drawScreenGrid(ctx, group, color) {
  const cellWidth = groupScreenWidth(group);
  const cellHeight = groupScreenHeight(group);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= group.width; x += cellWidth) {
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, group.height);
  }
  for (let y = 0; y <= group.height; y += cellHeight) {
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(group.width, y + 0.5);
  }
  ctx.stroke();
  ctx.restore();
}

function drawGrid(ctx, group, step, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= group.width; x += step) {
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, group.height);
  }
  for (let y = 0; y <= group.height; y += step) {
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(group.width, y + 0.5);
  }
  ctx.stroke();
  ctx.restore();
}
