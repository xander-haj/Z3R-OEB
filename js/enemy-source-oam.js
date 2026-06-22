/**
 * Source-backed OAM recipes for the editor overworld sprite overlay.
 */

import { buildFixedGuard } from "./enemy-fixed-guard-oam.js?v=20260621-render-restore20";
import {
  ABSORBABLE_FIRST, ABSORBABLE_LAST, NON_VISUAL_TYPES, SINGLE_LARGE_TYPES,
  SINGLE_SMALL_TYPES, SOLDIER_TYPES, WHIRLPOOL_NO_DRAW_SCREEN,
} from "./enemy-oam-classification.js?v=20260621-render-restore20";
import { CUSTOM_TYPES, DMD_RECIPES } from "./enemy-source-oam-recipes.js?v=20260621-render-restore20";

const CUSTOM_WITHOUT_DUMPED_ARRAYS = new Set([0x08, 0x0a, 0x46, 0x47, 0x48, 0x49, 0x4a,
  0x9f, 0xa0, 0xc5]);
const COVERED_HOARDER_ARRAYS = [
  "kCoveredRupeeCrab_DrawY", "kCoveredRupeeCrab_DrawChar", "kCoveredRupeeCrab_DrawFlags",
];
const CUSTOM_ARRAY_REQUIREMENTS = new Map([
  [0x0d, ["kBuzzBlob_DrawX", "kBuzzBlob_DrawY", "kBuzzBlob_DrawChar",
    "kBuzzBlob_DrawFlags", "kBuzzBlob_DrawExt"]],
  [0x0f, ["kOctoballoon_Draw_X", "kOctoballoon_Draw_Y", "kOctoballoon_Draw_Char",
    "kOctoballoon_Draw_Flags"]],
  [0x17, COVERED_HOARDER_ARRAYS],
  [0x3e, COVERED_HOARDER_ARRAYS],
  [0x3f, ["kTutorialSoldier_X", "kTutorialSoldier_Y", "kTutorialSoldier_Char",
    "kTutorialSoldier_Flags", "kTutorialSoldier_Big"]],
  [0x4b, ["kRecruit_Draw_X", "kRecruit_Draw_Char", "kRecruit_Draw_Flags"]],
  [0x4c, ["kGerudoMan_Draw_X", "kGerudoMan_Draw_Y", "kGerudoMan_Draw_Char",
    "kGerudoMan_Draw_Flags", "kGerudoMan_Draw_Big"]],
  [0x4d, ["kToppo_Draw_X", "kToppo_Draw_Y", "kToppo_Draw_Char",
    "kToppo_Draw_Flags", "kToppo_Draw_Big"]],
  [0x52, ["kZoraKing_Draw_X0", "kZoraKing_Draw_Y0", "kZoraKing_Draw_Char0",
    "kZoraKing_Draw_Flags0"]],
  [0x55, ["kZora_Draw_X", "kZora_Draw_Y", "kZora_Draw_Char",
    "kZora_Draw_Flags", "kZora_Draw_Big"]],
  [0x56, ["kWalkingZora_Draw_Char", "kWalkingZora_Draw_Flags",
    "kWalkingZora_Draw_Char2", "kWalkingZora_Draw_Flags2"]],
  [0x58, ["kCrab_Draw_X", "kCrab_Draw_Char", "kCrab_Draw_Flags"]],
  [0x62, ["kMasterSword_Draw_X", "kMasterSword_Draw_Y", "kMasterSword_Draw_Char"]],
]);
const CUSTOM_ROW_REQUIREMENTS = new Map([
  [0x36, ["kWitch_DrawDataA", "kWitch_DrawDataB", "kWitch_DrawDataC"]],
]);

export function ensureEditorEnemySprites() {
  return Promise.resolve(true);
}

export function getEditorSpriteRenderMode(type, sourceData = null, screen = null) {
  if (isNonVisualSpawn(type, screen)) {
    return { kind: "none", label: "source nonvisual/controller; no paused-game OAM" };
  }
  if (canBuildEditorSpriteOam(sourceData, type, screen)) {
    return { kind: "oam", label: "editor source OAM draw" };
  }
  return { kind: "fallback", label: "spawn marker; unsupported source draw" };
}

export function buildEditorSpriteOam(sourceData, type, baseFlags, screen = null) {
  if (isNonVisualSpawn(type, screen)) {
    return null;
  }
  if (DMD_RECIPES.has(type) && dumpedDmd(sourceData, type)?.length) {
    return finalizeDmd(type, buildDmd(sourceData, type, baseFlags));
  }
  if (CUSTOM_TYPES.has(type) && canBuildCustom(sourceData, type)) {
    return buildCustom(type, sourceData, baseFlags);
  }
  if (SOLDIER_TYPES.has(type) && validSoldier(sourceData?.spriteOam?.soldier)) {
    return buildSoldier(sourceData.spriteOam.soldier, type, baseFlags);
  }
  const dumped = sourceData?.spriteOam?.static?.[String(type)];
  if (Array.isArray(dumped)) {
    return dumped.map((row) => fromDumpedStatic(row, baseFlags));
  }
  return hasCommon(sourceData, type, screen) ? buildCommon(sourceData.spriteOam.common, type, baseFlags) : null;
}

function canBuildEditorSpriteOam(sourceData, type, screen) {
  return Boolean(
    DMD_RECIPES.has(type) && dumpedDmd(sourceData, type)?.length ||
    CUSTOM_TYPES.has(type) && canBuildCustom(sourceData, type) ||
    SOLDIER_TYPES.has(type) && validSoldier(sourceData?.spriteOam?.soldier) ||
    hasCommon(sourceData, type, screen) ||
    Array.isArray(sourceData?.spriteOam?.static?.[String(type)]),
  );
}

function isNonVisualSpawn(type, screen) {
  return NON_VISUAL_TYPES.has(type) || (type === 0xba && screen === WHIRLPOOL_NO_DRAW_SCREEN);
}

function buildDmd(sourceData, type, baseFlags) {
  return dumpedDmd(sourceData, type).map((row) => fromDumpedStatic(row, baseFlags));
}

function finalizeDmd(type, entries) {
  if (type === 0x12 && entries[2]) {
    entries[2] = { ...entries[2], tile: 0x88, attr: (entries[2].attr & ~0x40) | 0x40 };
  }
  if (type === 0xc4 && entries[0]) {
    entries[0] = { ...entries[0], tile: 0x02, attr: (entries[0].attr & ~0x40) | 0x40 };
  }
  return entries;
}

function buildCustom(type, sourceData, baseFlags) {
  if (type === 0x08 || type === 0x0a) return buildOctorok(sourceData, type, baseFlags);
  if (type === 0x0d) return buildBuzzBlob(sourceData, baseFlags);
  if (type === 0x0f) return buildOctoballoon(sourceData, baseFlags);
  if (type === 0x17 || type === 0x3e) return buildCoveredHoarder(sourceData, type, baseFlags);
  if (type === 0x36) return buildWitch(sourceData, baseFlags);
  if (type === 0x3f) return parallel(sourceData, "kTutorialSoldier", 10, 5, baseFlags, "or");
  if (type === 0x46) return buildFixedGuard("archer", baseFlags);
  if (type === 0x47 || type === 0x49) return buildFixedGuard("bush", baseFlags);
  if (type === 0x48) return buildFixedGuard("javelin", baseFlags);
  if (type === 0x4a) return buildFixedGuard("bomb", baseFlags);
  if (type === 0x4b) return buildRecruit(sourceData, baseFlags);
  if (type === 0x4c) return parallel(sourceData, "kGerudoMan_Draw", 12, 3, baseFlags, "or");
  if (type === 0x4d) return buildToppo(sourceData, baseFlags);
  if (type === 0x52) return buildKingZora(sourceData, baseFlags);
  if (type === 0x55) return buildZora(sourceData, baseFlags);
  if (type === 0x56) return buildWalkingZora(sourceData, baseFlags);
  if (type === 0x58) return buildCrab(sourceData, baseFlags);
  if (type === 0x62) {
    return parallelNamed(sourceData, {
      x: "kMasterSword_Draw_X", y: "kMasterSword_Draw_Y", tile: "kMasterSword_Draw_Char",
    }, 0, 6, baseFlags, "base").map((o) => ({ ...o, size: 0 }));
  }
  if (type === 0x9f || type === 0xa0) return buildGroveAnimal(sourceData, type, baseFlags);
  if (type === 0xc5) return buildOutdoorMedusa(sourceData);
  return null;
}

function buildOctorok(sourceData, type, baseFlags) {
  const body = singleLarge(sourceData.spriteOam.common, type, baseFlags, 2);
  return [entry(8, 6, 0xbb, 0x65 | baseFlags, 0), body];
}

function buildBuzzBlob(sourceData, baseFlags) {
  return parallelNamed(sourceData, {
    x: "kBuzzBlob_DrawX", y: "kBuzzBlob_DrawY", tile: "kBuzzBlob_DrawChar",
    attr: "kBuzzBlob_DrawFlags", size: "kBuzzBlob_DrawExt",
  }, 0, 3, baseFlags, "or");
}

function buildOctoballoon(sourceData, baseFlags) {
  return parallelNamed(sourceData, {
    x: "kOctoballoon_Draw_X", y: "kOctoballoon_Draw_Y", tile: "kOctoballoon_Draw_Char",
    attr: "kOctoballoon_Draw_Flags",
  }, 0, 4, baseFlags, "or");
}

function buildCoveredHoarder(sourceData, type, baseFlags) {
  const ys = nums(sourceData, "kCoveredRupeeCrab_DrawY");
  const ch = nums(sourceData, "kCoveredRupeeCrab_DrawChar");
  const fl = nums(sourceData, "kCoveredRupeeCrab_DrawFlags");
  return [1, 0].map((i) => {
    const tile = ch[i] + (type === 0x17 && ch[i] === 0x44 ? 2 : 0);
    return entry(0, ys[i], tile, (baseFlags & ~1) | fl[i], 2);
  });
}

function buildWitch(sourceData, baseFlags) {
  const a = rows(sourceData, "kWitch_DrawDataA");
  const b = rows(sourceData, "kWitch_DrawDataB");
  const c = rows(sourceData, "kWitch_DrawDataC");
  return [
    entry(a[0][0], a[0][1], a[0][2], baseFlags, 0),
    entry(a[1][0], a[1][1], a[1][2], baseFlags, 0),
    ...b.map((r) => entry(r[0], r[1], r[2], baseFlags ^ r[3], 2)),
    entry(c[0][0], c[0][1], c[0][2], baseFlags, 2),
  ];
}

function buildRecruit(sourceData, baseFlags) {
  const s = sourceData?.spriteOam?.soldier;
  const x = nums(sourceData, "kRecruit_Draw_X");
  const ch = nums(sourceData, "kRecruit_Draw_Char");
  const fl = nums(sourceData, "kRecruit_Draw_Flags");
  if (!validSoldier(s) || !x.length) return null;
  return [
    entry(0, -11, s.draw1Char[0], s.draw1Flags[0] | baseFlags, 2),
    entry(x[0], 0, ch[0], fl[0] | baseFlags, 2),
  ];
}

function buildToppo(sourceData, baseFlags) {
  const out = parallel(sourceData, "kToppo_Draw", 6, 3, baseFlags, "or");
  return out.map((o) => o.size === 0 ? { ...o, attr: (o.attr & ~0x0f) | 2 } : o);
}

function buildZora(sourceData, baseFlags) {
  return parallelNamed(sourceData, {
    x: "kZora_Draw_X", y: "kZora_Draw_Y", tile: "kZora_Draw_Char",
    attr: "kZora_Draw_Flags", size: "kZora_Draw_Big",
  }, 10, 2, baseFlags, "zora");
}

function buildKingZora(sourceData, baseFlags) {
  return parallelNamed(sourceData, {
    x: "kZoraKing_Draw_X0", y: "kZoraKing_Draw_Y0", tile: "kZoraKing_Draw_Char0",
    attr: "kZoraKing_Draw_Flags0",
  }, 16, 4, baseFlags, "zora").map((o) => ({ ...o, attr: o.attr | 0x20, size: 2 }));
}

function buildWalkingZora(sourceData, baseFlags) {
  const ch = nums(sourceData, "kWalkingZora_Draw_Char");
  const fl = nums(sourceData, "kWalkingZora_Draw_Flags");
  const ch2 = nums(sourceData, "kWalkingZora_Draw_Char2");
  const fl2 = nums(sourceData, "kWalkingZora_Draw_Flags2");
  return [
    entry(0, -7, ch[0], baseFlags | fl[0], 2),
    entry(0, 1, ch2[0], baseFlags | fl2[0], 2),
  ];
}

function buildCrab(sourceData, baseFlags) {
  const x = nums(sourceData, "kCrab_Draw_X");
  const ch = nums(sourceData, "kCrab_Draw_Char");
  const fl = nums(sourceData, "kCrab_Draw_Flags");
  return [1, 0].map((i) => entry(x[i], 0, ch[i], fl[i] | baseFlags, 2));
}

function buildGroveAnimal(sourceData, type, baseFlags) {
  const common = sourceData?.spriteOam?.common;
  if (!validCommon(common)) return null;
  const attr = baseFlags | 0x40, body = singleLarge(common, type, attr, 2, 0, 3);
  return type === 0xa0 ? [entry(8, 0, 0xae, attr, 0), body] : [body];
}

function buildOutdoorMedusa(sourceData) {
  const common = sourceData?.spriteOam?.common;
  if (!validCommon(common)) return null;
  const tile = singleLargeTile(common, 0x19);
  const attr = sourceData.spriteInitFlags3[0x19] & 0xf;
  return [entry(8, -8, tile, attr, 2)];
}

function parallel(sourceData, prefix, start, count, baseFlags, mode) {
  return parallelNamed(sourceData, {
    x: `${prefix}_X`, y: `${prefix}_Y`, tile: `${prefix}_Char`,
    attr: `${prefix}_Flags`, size: `${prefix}_Big`,
  }, start, count, baseFlags, mode);
}

function parallelNamed(sourceData, names, start, count, baseFlags, mode) {
  const x = nums(sourceData, names.x), y = nums(sourceData, names.y), tile = nums(sourceData, names.tile);
  const attr = names.attr ? nums(sourceData, names.attr) : [];
  const size = names.size ? nums(sourceData, names.size) : [];
  const out = [];
  for (let i = 0; i < count; i += 1) {
    const j = start + i;
    const f = attr[j] || 0;
    out.push(entry(x[j] || 0, y[j] || 0, tile[j] || 0, modeAttr(f, baseFlags, mode), size[j] ?? 2));
  }
  return out;
}

function modeAttr(attr, baseFlags, mode) {
  if (mode === "base") return baseFlags;
  if (mode === "fixed") return attr;
  if (mode === "zora") return attr | (attr & 0x0f ? 0 : baseFlags);
  if (mode === "xor") return attr ^ baseFlags;
  return attr | baseFlags;
}
function hasCommon(sourceData, type, screen) {
  return validCommon(sourceData?.spriteOam?.common) &&
    (isAbsorbable(type) || SINGLE_LARGE_TYPES.has(type) && !(type === 0xba && screen === WHIRLPOOL_NO_DRAW_SCREEN));
}
function buildCommon(tables, type, baseFlags) {
  if (SINGLE_SMALL_TYPES.has(type)) return [entry(0, -16, singleLargeTile(tables, type), baseFlags, 0)];
  if (!isAbsorbable(type)) return [singleLarge(tables, type, baseFlags, 2, type === 0xba ? -5 : 0)];
  const index = type - ABSORBABLE_FIRST;
  const numbered = tables.absorbableNumber[index] || 0;
  if (numbered) return buildNumbered(tables, numbered, baseFlags);
  if (tables.absorbableMode[index] === 0) return [singleLarge(tables, type, baseFlags, 0)];
  if (tables.absorbableMode[index] === 2) return [singleLarge(tables, type, baseFlags, 2)];
  const tile = singleLargeTile(tables, type);
  return [entry(0, 0, tile, baseFlags, 0), entry(0, 8, tile + 0x10, baseFlags, 0)];
}
function buildNumbered(tables, numbered, baseFlags) {
  const base = (numbered - 1) * 3;
  return [2, 1, 0].map((i) => {
    const j = base + i;
    return entry(tables.numberedX[j], tables.numberedY[j],
      tables.numberedChar[j], baseFlags, tables.numberedSize[j]);
  });
}
function singleLarge(tables, type, baseFlags, size, x = 0, graphics = 0) {
  return entry(x, 0, singleLargeTile(tables, type, graphics), baseFlags, size);
}
function singleLargeTile(tables, type, graphics = 0) {
  return tables.singleLargeTiles[(tables.singleLargeBase[type] || 0) + graphics] || 0;
}
function isAbsorbable(type) {
  return type >= ABSORBABLE_FIRST && type <= ABSORBABLE_LAST;
}
function validCommon(t) {
  return Boolean(t?.singleLargeBase && t?.singleLargeTiles && t?.absorbableMode && t?.absorbableNumber);
}
function validSoldier(t) {
  return Boolean(t?.gfx && t?.draw1Char && t?.draw2Char && t?.draw3Char);
}
function buildSoldier(t, type, baseFlags) {
  const d = 1, g = t.gfx[d], slots = [];
  slots.push({
    slot: 0,
    oam: entry(0, -t.draw1Yd[g], t.draw1Char[d], t.draw1Flags[d] | baseFlags, 2),
  });
  for (let i = 3; i >= 0; i -= 1) {
    const j = g * 4 + i, tile = t.draw2Char[j];
    let attr = t.draw2Flags[j] | baseFlags;
    if (tile === 0x20) attr = (attr & 0xf1) | 2;
    else if (t.draw2Big[j] === 0) attr = (attr & 0xf1) | 8;
    slots.push({
      slot: (t.draw2OamIdx[d] >> 2) + 3 - i,
      oam: entry(t.draw2Xd[j], t.draw2Yd[j], tile, attr, t.draw2Big[j]),
    });
  }
  for (let i = 1; i >= 0; i -= 1) {
    const j = g * 2 + i;
    slots.push({
      slot: (t.draw3OamIdx[d] >> 2) + 1 - i,
      oam: entry(t.draw3Xd[j], t.draw3Yd[j],
        t.draw3Char[j] + (type < 0x43 ? 3 : 0), t.draw3Flags[j] | baseFlags, 0),
    });
  }
  return slots.sort((a, b) => b.slot - a.slot).map((slot) => slot.oam);
}
function fromDumpedStatic(row, baseFlags = 0) {
  const charFlags = row.charFlags ?? row.char_flags;
  return entry(row.x || 0, row.y || 0, charFlags & 0xff, (charFlags >> 8) ^ baseFlags, row.size || 0);
}
function dumpedDmd(sourceData, type) {
  return sourceData?.spriteOam?.dmd?.[String(type)] || [];
}
function canBuildCustom(sourceData, type) {
  if (CUSTOM_WITHOUT_DUMPED_ARRAYS.has(type)) {
    return true;
  }
  const arrays = CUSTOM_ARRAY_REQUIREMENTS.get(type) || [];
  const rowsNeeded = CUSTOM_ROW_REQUIREMENTS.get(type) || [];
  return arrays.every((name) => Array.isArray(sourceData?.spriteOam?.arrays?.[name])) &&
    rowsNeeded.every((name) => Array.isArray(sourceData?.spriteOam?.rows?.[name]));
}
function nums(sourceData, symbol) {
  return sourceData?.spriteOam?.arrays?.[symbol] || [];
}
function rows(sourceData, symbol) {
  return sourceData?.spriteOam?.rows?.[symbol] || [];
}
function entry(x, y, tile, attr, size) {
  return { x, y, tile: tile & 0xff, attr: attr & 0xff, size };
}
