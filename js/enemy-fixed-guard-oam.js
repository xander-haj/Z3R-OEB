/**
 * Fixed OAM recipes for guard-family overworld sprite previews.
 */

const FIXED_GUARD_RECIPES = {
  archer: [
    [0, -7, 0x42, 0x40, 2, "or"],
    [-4, 0, 0x48, 0, 2, "or"],
    [4, 0, 0x49, 0, 2, "or"],
    [11, -2, 0x0b, 0x4d, 0, "fixed"],
    [11, 6, 0x0b, 0xcd, 0, "fixed"],
    [18, 2, 0x3d, 0x28, 0, "fixed"],
    [10, 2, 0x3a, 0x28, 0, "fixed"],
  ],
  bush: [
    [0, 8, 0x20, 0x21, 2, "or"],
    [0, 8, 0x20, 0x23, 2, "fixed"],
  ],
  javelin: [
    [0, -7, 0x42, 0x40, 2, "or"],
    [-4, 0, 0x48, 0, 2, "or"],
    [4, 0, 0x49, 0, 2, "or"],
    [15, -2, 0x6c, 0x48, 0, "fixed"],
    [7, -2, 0x7c, 0x48, 0, "fixed"],
  ],
  bomb: [
    [0, -9, 0x02, 0x40, 2, "or"],
    [-4, 0, 0x46, 0, 2, "or"],
    [4, 0, 0x06, 0, 2, "or"],
    [12, -4, 0x2f, 0, 0, "or"],
    [-1, -12, 0x6e, 0x08, 2, "fixed"],
  ],
};

/**
 * Build source-backed OAM entries for guard sprites with hand-authored props.
 */
export function buildFixedGuard(kind, baseFlags) {
  return FIXED_GUARD_RECIPES[kind].map(([x, y, tile, attr, size, mode]) =>
    entry(x, y, tile, modeAttr(attr, baseFlags, mode), size));
}

function modeAttr(attr, baseFlags, mode) {
  if (mode === "fixed") {
    return attr;
  }
  return attr | baseFlags;
}

function entry(x, y, tile, attr, size) {
  return { x, y, tile: tile & 0xff, attr: attr & 0xff, size };
}
