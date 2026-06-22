/**
 * SNES BGR555 palette conversion helpers.
 */

export function snesToRgb(word) {
  const value = Number(word) || 0;
  return {
    r: expand5(value & 0x1f),
    g: expand5((value >> 5) & 0x1f),
    b: expand5((value >> 10) & 0x1f),
  };
}

export function rgbToImageWord(rgb) {
  return (0xff << 24) | ((rgb.b & 0xff) << 16) | ((rgb.g & 0xff) << 8) | (rgb.r & 0xff);
}

export function fixedColorToBgr555(red, green, blue) {
  return (red & 0x1f) | ((green & 0x1f) << 5) | ((blue & 0x1f) << 10);
}

function expand5(value) {
  const channel = value & 0x1f;
  return (channel << 3) | (channel >> 2);
}
