/**
 * Map header metadata normalization, patch application, and sparse export.
 */

import {
  refreshSourceTopology,
  resizeSourceTopologyRecords,
} from "./topology-model.js?v=20260621-render-restore20";

const FORMAT = "zelda3-overworld-metadata-v1";
const HEADER_PATH = ["Header"];
const MUSIC_TAGS = ["beginning", "zelda", "sword", "agahnim"];
const SIZE_OPTIONS = ["small", "big", "wide", "tall"];

/**
 * Snapshot full editable Header blocks for sparse diffing.
 *
 * Parameters:
 *   sourceData: Parsed source tables from source-parser.js.
 * Returns:
 *   Array keyed by area id with YAML-shaped Header objects or null.
 */
export function snapshotHeaders(sourceData) {
  return (sourceData?.areaHeaders || []).map((header) => toYamlHeader(editableHeaderFromArea(header)));
}

/**
 * Apply existing metadata.header operations to the live source data.
 *
 * Parameters:
 *   sourceData: Parsed source tables from source-parser.js.
 *   document: Metadata patch document from a mod package.
 * Returns:
 *   None.
 */
export function applyHeaderPatchDocument(sourceData, document) {
  for (const operation of document?.patches || []) {
    if (!isHeaderOperation(operation)) {
      continue;
    }
    const area = numeric(operation.area ?? operation.screen, -1);
    if (Array.isArray(operation.path) && operation.path.length > 1) {
      applyNestedHeaderValue(sourceData, area, operation.path.slice(1), operation.value);
    } else {
      applyHeaderValue(sourceData, area, operation.value);
    }
  }
}

/**
 * Merge edited Header blocks into a metadata patch document.
 *
 * Parameters:
 *   base: Snapshot from snapshotHeaders.
 *   sourceData: Current parsed source data.
 *   existing: Metadata patch document from the patch editor.
 * Returns:
 *   Metadata patch document with refreshed metadata.header operations.
 */
export function exportHeaderPatch(base, sourceData, existing) {
  if (!hasEditableHeaders(sourceData)) {
    return { format: FORMAT, patches: existing?.patches || [] };
  }
  const patches = (existing?.patches || []).filter((operation) => !isHeaderOperation(operation));
  for (let area = 0; area < (sourceData?.areaHeaders || []).length; area += 1) {
    const current = toYamlHeader(editableHeaderFromArea(sourceData.areaHeaders[area]));
    const original = base?.[area] || null;
    if (current && JSON.stringify(current) !== JSON.stringify(original)) {
      patches.push({ kind: "metadata.header", area, path: HEADER_PATH, value: current });
    }
  }
  return { format: FORMAT, patches };
}

/**
 * Return the full editable Header for one area, or null when the dump is stale.
 *
 * Parameters:
 *   sourceData: Parsed source tables from source-parser.js.
 *   area: Area head id.
 * Returns:
 *   Camel-cased Header object, or null.
 */
export function editableHeaderValue(sourceData, area) {
  return editableHeaderFromArea(sourceData?.areaHeaders?.[area]);
}

/**
 * Apply a full Header object to one normalized area header.
 *
 * Parameters:
 *   sourceData: Parsed source tables from source-parser.js.
 *   area: Area head id.
 *   value: YAML-shaped or camel-cased Header object.
 * Returns:
 *   None.
 */
export function applyHeaderValue(sourceData, area, value) {
  const target = sourceData?.areaHeaders?.[area];
  const header = normalizeHeader(value);
  if (!target || !header) {
    return;
  }
  const previousSize = target.size;
  writeHeaderToArea(target, sanitizeHeaderForArea(area, editableHeaderFromArea(target), header));
  if (target.size !== previousSize) {
    resizeSourceTopologyRecords(sourceData, area, previousSize, target.size);
    refreshSourceTopology(sourceData);
  }
}

/**
 * Apply a nested Header path such as Header.gfx or Header.music.beginning.
 *
 * Parameters:
 *   sourceData: Parsed source tables from source-parser.js.
 *   area: Area head id.
 *   path: Header-local path after the top-level Header key.
 *   value: Value to set.
 * Returns:
 *   None.
 */
function applyNestedHeaderValue(sourceData, area, path, value) {
  const current = editableHeaderValue(sourceData, area);
  if (!current || !path.length) {
    return;
  }
  setHeaderPath(current, path, value);
  applyHeaderValue(sourceData, area, current);
}

/**
 * Return a clone of a Header with direct map-property edits applied.
 *
 * Parameters:
 *   header: Camel-cased Header object from editableHeaderValue.
 *   edits: Partial direct-field edits.
 * Returns:
 *   New Header object preserving untouched fields.
 */
export function editHeaderValue(header, edits) {
  return normalizeHeader({
    ...header,
    ambient: clone(edits.ambient ?? header.ambient),
    gfx: edits.gfx ?? header.gfx,
    music: clone(edits.music ?? header.music),
    palette: edits.palette ?? header.palette,
    size: edits.size ?? header.size,
    signText: edits.signText ?? header.signText,
  });
}

/**
 * Convert one normalized Header back to the extracted YAML key shape.
 */
function toYamlHeader(header) {
  if (!header) {
    return null;
  }
  return {
    name: header.name,
    size: header.size,
    gfx: header.gfx,
    palette: header.palette,
    sign_text: header.signText,
    music: clone(header.music),
    ambient: clone(header.ambient),
  };
}

/**
 * Keep unsupported area-specific Header fields unchanged during patch import.
 */
function sanitizeHeaderForArea(area, previous, next) {
  const result = clone(next);
  const backed = compilerBackedHeaderFields(area);
  for (const key of ["gfx", "palette", "signText"]) {
    if (!backed[key] && previous) {
      result[key] = previous[key];
    }
  }
  validateBackedHeaderRanges(area, backed, result);
  result.music = sanitizeTagMap(area, previous?.music, result.music);
  result.ambient = sanitizeTagMap(area, previous?.ambient, result.ambient);
  return result;
}

function validateBackedHeaderRanges(area, backed, header) {
  const ranges = {
    gfx: [0, 0xff, "Header.gfx"],
    palette: [0, 0xff, "Header.palette"],
    signText: [0, 0xffff, "Header.sign_text"],
  };
  for (const [key, [min, max, label]] of Object.entries(ranges)) {
    if (backed[key] && (header[key] < min || header[key] > max)) {
      throw new Error(`${label} in area ${area} must be ${min}..${max}`);
    }
  }
}

function sanitizeTagMap(area, previous, next) {
  const result = clone(next || {});
  for (const tag of MUSIC_TAGS) {
    if (!tagEditable(area, tag)) {
      if (previous && Object.prototype.hasOwnProperty.call(previous, tag)) {
        result[tag] = previous[tag];
      } else {
        delete result[tag];
      }
    }
  }
  return result;
}

function compilerBackedHeaderFields(area) {
  return {
    gfx: Number.isFinite(area) && area < 128,
    palette: Number.isFinite(area) && area < 128,
    signText: Number.isFinite(area) && area < 128,
  };
}

function tagEditable(area, tag) {
  return Number.isFinite(area) && (area < 64 || tag === "agahnim");
}

function writeHeaderToArea(target, header) {
  target.header = header;
  target.name = header.name;
  target.size = header.size;
  target.gfx = header.gfx;
  target.palette = header.palette;
}

/**
 * Return a Header only when the dump contains the complete YAML-backed fields.
 */
function editableHeaderFromArea(areaHeader) {
  return normalizeHeader(areaHeader?.header);
}

/**
 * Return true when the dump has full Header blocks that can be safely refreshed.
 */
function hasEditableHeaders(sourceData) {
  return (sourceData?.areaHeaders || []).some((header) => editableHeaderFromArea(header));
}

/**
 * Set a nested Header field using YAML or camel-case path segments.
 */
function setHeaderPath(header, path, value) {
  let target = header;
  for (const key of path.slice(0, -1)) {
    target = target[camelKey(key)];
    if (!target || typeof target !== "object") {
      return;
    }
  }
  target[camelKey(path[path.length - 1])] = value;
}

/**
 * Normalize YAML-shaped or camel-cased Header data into the editor shape.
 */
function normalizeHeader(value) {
  if (!value || !value.music || !value.ambient) {
    return null;
  }
  const signText = value.signText ?? value.sign_text;
  if (signText === undefined || signText === null) {
    return null;
  }
  return {
    name: value.name || "",
    size: SIZE_OPTIONS.includes(value.size) ? value.size : "big",
    gfx: strictInteger(value.gfx, "Header.gfx"),
    palette: strictInteger(value.palette, "Header.palette"),
    signText: strictInteger(signText, "Header.sign_text"),
    music: clone(value.music),
    ambient: clone(value.ambient),
  };
}

/**
 * Return whether a metadata operation targets the top-level YAML Header.
 */
function isHeaderOperation(operation) {
  const pathKey = Array.isArray(operation?.path) ? operation.path[0] : operation?.path;
  return operation?.kind === "metadata.header" || pathKey === "Header";
}

/**
 * Convert a YAML key segment to the source-parser camel-case convention.
 */
function camelKey(key) {
  return String(key).replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Parse decimal, hex, or numeric input into a finite integer.
 */
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

function strictInteger(value, label) {
  if (Number.isInteger(value)) {
    return value;
  }
  const match = String(value ?? "").trim().match(/^(-?)(?:0x([0-9a-f]+)|([0-9]+))$/i);
  if (!match) {
    throw new Error(`${label} must be an integer`);
  }
  return (match[1] === "-" ? -1 : 1) * Number.parseInt(match[2] ?? match[3], match[2] ? 16 : 10);
}

/**
 * Clone JSON-compatible Header fields.
 */
function clone(value) {
  return JSON.parse(JSON.stringify(value));
}
