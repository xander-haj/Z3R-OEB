/**
 * Sprite placement editing and metadata patch export for the Workbench.
 */

import {
  groupScreenHeight,
  groupScreenWidth,
  groupViewport,
} from "../viewer/js/map-groups.js?v=20260621-render-restore20";
import {
  normalizeInfo,
  normalizeSpriteSet,
  validateSuppliedInfo,
} from "./sprite-shape.js?v=20260621-render-restore20";

const FORMAT = "zelda3-overworld-metadata-v1";
const LIGHT_STAGE_PATHS = {
  beginning: "Sprites.Beginning",
  first: "Sprites.FirstPart",
  second: "Sprites.SecondPart",
};

/**
 * Snapshot current normalized sprite sets for sparse diffing.
 *
 * Parameters:
 *   sourceData: Parsed source tables from source-parser.js.
 * Returns:
 *   Plain JSON snapshot of sprite sets for sparse diffing.
 */
export function snapshotSpriteSets(sourceData) {
  return (sourceData?.areaHeaders || []).map((header) => clone(header?.spriteSets || {}));
}

/**
 * Apply existing metadata.sprite operations to the in-memory source data.
 *
 * Parameters:
 *   sourceData: Parsed source tables to mutate.
 *   document: Metadata patch document from a mod package.
 * Returns:
 *   None.
 */
export function applySpritePatchDocument(sourceData, document) {
  for (const operation of document?.patches || []) {
    if (operation.kind !== "metadata.sprite") {
      continue;
    }
    const area = numeric(operation.area ?? operation.screen);
    if (!spriteAreaEditable(area)) {
      continue;
    }
    const stage = stageFromPath(area, operation.path);
    applySpriteOperation(sourceData, area, stage, operation);
  }
}

/**
 * Paint one saved sprite asset into a target area/stage.
 *
 * Parameters:
 *   state: Shared Workbench state.
 *   info: Tile inspection info at the paint target.
 *   worldPoint: Pointer location in rendered group-space pixels.
 *   asset: Saved sprite asset entry.
 * Returns:
 *   Painted sprite summary, or null.
 */
export function paintSpriteAsset(state, info, worldPoint, asset) {
  const sprite = asset?.sprite;
  const area = info?.contextScreen ?? info?.screen;
  if (!sprite || !spriteAreaEditable(area) || !state.sourceData || state.group?.kind !== "atlas") {
    return null;
  }
  const stages = targetStages(state, area, sprite);
  const coord = spriteCoord(state.sourceData, state.group, area, worldPoint);
  const visualConflicts = [];
  const placements = [];
  for (const stage of stages) {
    const set = ensureSpriteSet(state.sourceData, area, stage);
    const custom = customVisualForSprite(sprite, asset, stage, set.info, area);
    if (custom) {
      visualConflicts.push(stage);
    }
    const entry = { x: coord.x, y: coord.y, type: sprite.type, name: sprite.name, ...(custom ? { custom } : {}) };
    const index = set.sprites.length;
    set.sprites.push(entry);
    placements.push({ area, stage, index, sprite: clone(entry) });
  }
  return { name: sprite.name, area, x: coord.x, y: coord.y, stages, visualConflicts, placements };
}

/**
 * Merge edited sprite sets into a metadata patch document.
 *
 * Parameters:
 *   base: Snapshot from snapshotSpriteSets.
 *   sourceData: Current parsed source data.
 *   existing: Metadata patch document from the patch editor.
 * Returns:
 *   Metadata patch document with refreshed metadata.sprite operations.
 */
export function exportSpritePatch(base, sourceData, existing) {
  const patches = (existing?.patches || []).filter((operation) => operation.kind !== "metadata.sprite");
  for (let area = 0; area < (sourceData?.areaHeaders || []).length; area += 1) {
    if (!spriteAreaEditable(area)) {
      continue;
    }
    const current = sourceData.areaHeaders[area]?.spriteSets || {};
    const original = base?.[area] || {};
    for (const stage of exportStages(area, current)) {
      if (!sameSpriteSet(current[stage], original[stage])) {
        patches.push(buildSpriteOperation(sourceData, area, stage, current[stage], current[stage]?.info));
      }
    }
  }
  return { format: FORMAT, patches };
}

/**
 * Ensure a target normalized sprite set exists without changing its visual context.
 */
function ensureSpriteSet(sourceData, area, stage) {
  const header = sourceData.areaHeaders[area];
  const contextBacked = spriteContextEditable(area);
  header.spriteSets = header.spriteSets || {};
  const set = header.spriteSets[stage] || {
    info: contextBacked ? fallbackSpriteInfo(header.spriteSets) : {},
    sprites: [],
  };
  set.info = contextBacked ? normalizeInfo(set.info || fallbackSpriteInfo(header.spriteSets)) : {};
  set.sprites = Array.isArray(set.sprites) ? set.sprites : [];
  header.spriteSets[stage] = set;
  if (area >= 64) {
    header.spriteSets.beginning = set;
    header.spriteSets.first = set;
    header.spriteSets.second = set;
  }
  return set;
}

/**
 * Apply one YAML-shaped sprite-set value to normalized source data.
 */
function applySpriteSet(sourceData, area, stage, value) {
  const header = sourceData.areaHeaders[area];
  if (!header) {
    return;
  }
  validateSuppliedInfo(value?.info, area, spriteContextEditable(area));
  const set = normalizeSpriteSet(value, coordLimits(sourceData, area), sourceData, area);
  const existingInfo = header.spriteSets?.[stage]?.info;
  set.info = spriteContextEditable(area) ?
    normalizeInfo(value?.info || existingInfo || set.info) :
    (existingInfo || {});
  header.spriteSets = header.spriteSets || {};
  header.spriteSets[stage] = set;
  if (area >= 64) {
    header.spriteSets.beginning = set;
    header.spriteSets.first = set;
    header.spriteSets.second = set;
  }
}

/**
 * Apply a whole-set or nested Sprites metadata patch to normalized source data.
 */
function applySpriteOperation(sourceData, area, stage, operation) {
  const path = Array.isArray(operation.path) ? operation.path : [area >= 64 ? "Sprites" : LIGHT_STAGE_PATHS[stage]];
  if (path.length <= 1) {
    applySpriteSet(sourceData, area, stage, operation.value);
    return;
  }
  const header = sourceData.areaHeaders[area];
  if (!header) {
    return;
  }
  const current = header.spriteSets?.[stage] || { info: fallbackSpriteInfo(header.spriteSets || {}), sprites: [] };
  const yamlSet = toYamlSpriteSet(current, current.info, coordLimits(sourceData, area), spriteContextEditable(area));
  setNestedValue(yamlSet, path.slice(1), operation.value);
  applySpriteSet(sourceData, area, stage, yamlSet);
}

/**
 * Set a nested value using the same path semantics as yaml_patch.py.
 */
function setNestedValue(target, path, value) {
  if (!path.length) {
    return;
  }
  let current = target;
  for (const key of path.slice(0, -1)) {
    current = current?.[key];
    if (!current || typeof current !== "object") {
      return;
    }
  }
  current[path[path.length - 1]] = value;
}

/**
 * Convert a normalized sprite set into the YAML structure used by compile_resources.py.
 */
function toYamlSpriteSet(set, info, limits = { x: 63, y: 63 }, contextBacked = true) {
  return {
    info: contextBacked ? normalizeInfo(info) : {},
    sprites: (set?.sprites || []).map((sprite) => {
      const row = [
        clamp(numeric(sprite.x), 0, limits.x),
        clamp(numeric(sprite.y), 0, limits.y),
        sprite.name,
      ];
      if (sprite.custom) {
        row.push(clone(sprite.custom));
      }
      return row;
    }),
  };
}

/**
 * Build one metadata.sprite operation for an edited area/stage.
 */
function buildSpriteOperation(sourceData, area, stage, set, info) {
  return {
    kind: "metadata.sprite",
    area,
    path: area >= 64 ? ["Sprites"] : [LIGHT_STAGE_PATHS[stage]],
    value: toYamlSpriteSet(set, info, coordLimits(sourceData, area), spriteContextEditable(area)),
  };
}

/**
 * Return stages that should be exported for one area.
 */
function exportStages(area, sets) {
  if (!spriteAreaEditable(area)) {
    return [];
  }
  if (area >= 64) {
    return sets.first ? ["first"] : [];
  }
  return ["beginning", "first", "second"].filter((stage) => sets[stage]);
}

function spriteAreaEditable(area) {
  return Number.isInteger(area) && area >= 0 && area < 160;
}

function spriteContextEditable(area) {
  return Number.isInteger(area) && area >= 0 && area < 128;
}

/**
 * Pick target stages from the UI and saved asset.
 */
function targetStages(state, area, sprite) {
  if (area >= 64) {
    return ["first"];
  }
  if (state.enemyStage && state.enemyStage !== "all") {
    return [state.enemyStage];
  }
  return sprite.stages?.length ? sprite.stages : ["first"];
}

/**
 * Pick an existing destination sprite-set info block for a new stage.
 */
function fallbackSpriteInfo(sets) {
  return sets.first?.info || sets.second?.info || sets.beginning?.info || { gfx: 0, palette: 0 };
}

/**
 * Return the isolated source visual context for a pasted sprite, when needed.
 */
function customVisualForSprite(sprite, asset, stage, targetInfo, targetArea) {
  const source = sprite.stageInfo?.[stage] || sprite.stageInfo?.[sprite.primaryStage];
  const sourceArea = source?.sourceArea ?? asset?.source?.area;
  const sourceDark = source?.darkWorld ?? (numeric(sourceArea) >= 64);
  if (!spriteContextEditable(targetArea)) {
    return source ? customVisualFromSource(source, sourceDark, sourceArea) : null;
  }
  if (!source || (sameInfo(source, targetInfo) && sourceDark === (targetArea >= 64))) {
    return null;
  }
  return customVisualFromSource(source, sourceDark, sourceArea);
}

/**
 * Convert saved source context into the per-placement custom sidecar payload.
 */
function customVisualFromSource(source, darkWorld, sourceArea) {
  return {
    gfx: source.gfx,
    palette: source.palette,
    darkWorld,
    ...(sourceArea !== undefined ? { sourceArea } : {}),
  };
}

/**
 * Compare two sprite info blocks.
 */
function sameInfo(a, b) {
  return normalizeInfo(a).gfx === normalizeInfo(b).gfx && normalizeInfo(a).palette === normalizeInfo(b).palette;
}

/**
 * Resolve a pointer to the 16px sprite placement grid relative to the area head.
 */
function spriteCoord(sourceData, group, area, point) {
  const index = area - group.base;
  const viewport = groupViewport(group);
  const originX = (index % group.columns) * groupScreenWidth(group) - viewport.x;
  const originY = Math.floor(index / group.columns) * groupScreenHeight(group) - viewport.y;
  const limits = coordLimits(sourceData, area);
  return {
    x: clamp(Math.floor((point.x - originX) / 16), 0, limits.x),
    y: clamp(Math.floor((point.y - originY) / 16), 0, limits.y),
  };
}

/**
 * Return the last valid 16px sprite grid coordinates for an overworld area.
 */
function coordLimits(sourceData, area) {
  const size = sourceData?.areaHeaders?.[area]?.size;
  return {
    x: size === "big" || size === "wide" ? 63 : 31,
    y: size === "big" || size === "tall" ? 63 : 31,
  };
}

/**
 * Clamp a numeric value to an inclusive range.
 */
function clamp(value, min, max) {
  const number = Number.isFinite(value) ? value : min;
  return Math.max(min, Math.min(max, number));
}

/**
 * Infer a normalized stage from a metadata patch YAML path.
 */
function stageFromPath(area, path) {
  if (area >= 64) {
    return "first";
  }
  const key = path?.[0];
  return Object.entries(LIGHT_STAGE_PATHS).find((entry) => entry[1] === key)?.[0] || "first";
}

/**
 * Parse decimal or hex-like values.
 */
function numeric(value) {
  if (Number.isInteger(value)) {
    return value;
  }
  const match = String(value ?? "").trim().match(/^([+-]?)(?:0x([0-9a-f]+)|(\d+))$/i);
  if (!match) {
    return NaN;
  }
  const sign = match[1] === "-" ? -1 : 1;
  return sign * Number.parseInt(match[2] ?? match[3], match[2] ? 16 : 10);
}

function typeFromName(name, fallback) {
  const match = String(name).match(/^([0-9a-f]{2})-/i);
  const parsed = match ? Number.parseInt(match[1], 16) : NaN;
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 0xff ? parsed : fallback;
}

/**
 * Clone JSON-compatible values.
 */
function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

/**
 * Compare placements and shared sprite gfx/palette context.
 */
function sameSpriteSet(a, b) {
  return JSON.stringify(comparableSpriteSet(a)) === JSON.stringify(comparableSpriteSet(b));
}

function comparableSpriteSet(set) {
  return {
    info: normalizeInfo(set?.info),
    sprites: set?.sprites || [],
  };
}
