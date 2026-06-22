/**
 * Metadata apply/export for overworld Items rows shown by the interaction overlay.
 */

import {
  normalizeSecretItem,
  secretItemNames,
  secretSpawnRuntime,
  toYamlSecretItem,
} from "./secret-item-shape.js?v=20260621-render-restore20";

const FORMAT = "zelda3-overworld-metadata-v1";
const ITEMS_PATH = ["Items"];

/**
 * Snapshot current overworld Items rows in compiler YAML shape.
 *
 * Parameters:
 *   sourceData: Parsed source tables from source-parser.js.
 * Returns:
 *   Array keyed by area id with YAML-shaped item rows.
 */
export function snapshotInteractionItems(sourceData) {
  const runtime = secretSpawnRuntime(sourceData);
  const names = secretItemNames(sourceData);
  return (sourceData?.areaHeaders || []).map((header) => (
    (header?.interactions?.items || []).map((row) => toYamlSecretItem(row, runtime, names))
  ));
}

/**
 * Apply existing metadata.item operations to sourceData interaction items.
 *
 * Parameters:
 *   sourceData: Parsed source tables from source-parser.js.
 *   document: Metadata patch document from a mod package.
 * Returns:
 *   None.
 */
export function applyInteractionPatchDocument(sourceData, document) {
  const runtime = secretSpawnRuntime(sourceData);
  const names = secretItemNames(sourceData);
  for (const operation of document?.patches || []) {
    if (!isItemOperation(operation)) {
      continue;
    }
    const area = numeric(operation.area ?? operation.screen, -1);
    if (!itemAreaEditable(area)) {
      continue;
    }
    const header = sourceData?.areaHeaders?.[area];
    if (!header) {
      continue;
    }
    header.interactions = header.interactions || { items: [], shovelSpots: [] };
    applyItemOperation(header.interactions, operation, runtime, names);
  }
}

/**
 * Merge changed Items rows into the metadata patch document.
 *
 * Parameters:
 *   base: Snapshot from snapshotInteractionItems.
 *   sourceData: Current parsed source data.
 *   existing: Metadata patch document from the patch editor.
 * Returns:
 *   Metadata patch document with refreshed metadata.item operations.
 */
export function exportInteractionPatch(base, sourceData, existing) {
  const patches = (existing?.patches || []).filter((operation) => !isOwnedItemOperation(operation));
  const areaCount = Math.min(128, (sourceData?.areaHeaders || []).length);
  const runtime = secretSpawnRuntime(sourceData);
  const names = secretItemNames(sourceData);
  for (let area = 0; area < areaCount; area += 1) {
    const current = (sourceData.areaHeaders[area]?.interactions?.items || [])
      .map((row) => toYamlSecretItem(row, runtime, names));
    const original = base?.[area] || [];
    if (JSON.stringify(current) !== JSON.stringify(original)) {
      patches.push({ kind: "metadata.item", area, path: ITEMS_PATH, value: current });
    }
  }
  return { format: FORMAT, patches };
}

/**
 * Return a cloned, normalized item row for command payloads.
 *
 * Parameters:
 *   value: Browser or YAML-shaped item row.
 * Returns:
 *   Normalized browser item row.
 */
export function cloneItemRecord(value, runtimeData = null, names = null) {
  return normalizeSecretItem(value, runtimeData, names);
}

/**
 * Convert one item list from YAML rows to browser rows.
 */
function normalizeItemList(rows, runtime, names) {
  return (rows || []).map((row) => normalizeSecretItem(row, runtime, names));
}

/**
 * Apply a whole-list or nested YAML Items patch to one interaction block.
 */
function applyItemOperation(interactions, operation, runtime, names) {
  const path = Array.isArray(operation.path) ? operation.path : ITEMS_PATH;
  if (path.length <= 1) {
    interactions.items = normalizeItemList(operation.value || [], runtime, names);
    return;
  }
  const index = numeric(path[1], -1);
  if (index < 0) {
    return;
  }
  const items = interactions.items || [];
  if (path.length === 2) {
    items[index] = normalizeSecretItem(operation.value, runtime, names);
  } else if (items[index]) {
    const row = toYamlSecretItem(items[index], runtime, names);
    setNestedValue(row, path.slice(2), operation.value);
    items[index] = normalizeSecretItem(row, runtime, names);
  }
  interactions.items = items;
}

/**
 * Set a nested list/object value using the same path semantics as yaml_patch.py.
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
 * Return whether a metadata operation targets overworld Items.
 */
function isItemOperation(operation) {
  const pathKey = Array.isArray(operation?.path) ? operation.path[0] : operation?.path;
  return operation?.kind === "metadata.item" || pathKey === "Items";
}

/**
 * Return whether the Workbench can safely refresh this item operation.
 */
function isOwnedItemOperation(operation) {
  const area = numeric(operation?.area ?? operation?.screen, -1);
  return isItemOperation(operation) && itemAreaEditable(area);
}

function itemAreaEditable(area) {
  return Number.isInteger(area) && area >= 0 && area < 128;
}

/**
 * Parse decimal, hex, or numeric input into a finite integer.
 */
function numeric(value, fallback = 0) {
  if (Number.isInteger(value)) {
    return value;
  }
  const match = String(value ?? "").trim().match(/^([+-]?)(?:0x([0-9a-f]+)|(\d+))$/i);
  if (!match) {
    return fallback;
  }
  const sign = match[1] === "-" ? -1 : 1;
  return sign * Number.parseInt(match[2] ?? match[3], match[2] ? 16 : 10);
}
