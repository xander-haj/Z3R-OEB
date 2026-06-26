/**
 * Data-backed capacity helpers for fixed overworld navigation tables.
 *
 * The editor database is authoritative when present. Vanilla constants remain
 * only as a fallback so older local dumps do not break the Workbench UI.
 */

const FALLBACK_CAPACITIES = {
  area: 160,
  birdTravel: 9,
  exits: 79,
  fallHoles: 19,
  overworldEntrances: 129,
  specialExits: 16,
};

const CONSTRAINT_KEYS = {
  exits: "exits",
  fallHoles: "fall_holes",
  overworldEntrances: "overworld_entrances",
  specialExits: "special_exits",
};

/**
 * Return the highest legal slot value for one allocation type.
 *
 * Parameters:
 *   state: Shared Workbench state containing editorDb.
 *   type: Allocation type from the navigation allocation UI.
 * Returns:
 *   Maximum numeric slot/source value.
 */
export function slotMaxForType(state, type) {
  if (type === "travel") {
    return areaMax(state);
  }
  if (type === "entrance") {
    return allocatorCapacity(state, "overworldEntrances") - 1;
  }
  if (type === "hole") {
    return allocatorCapacity(state, "fallHoles") - 1;
  }
  return allocatorCapacity(state, "exits") - 1;
}

/**
 * Return the highest legal overworld area id.
 *
 * Parameters:
 *   state: Shared Workbench state containing editorDb.
 * Returns:
 *   Maximum area id.
 */
export function areaMax(state) {
  return areaCapacity(state) - 1;
}

/**
 * Return the highest legal special-exit room id.
 *
 * Parameters:
 *   state: Shared Workbench state containing editorDb.
 * Returns:
 *   Maximum special room id in the 0x180 range.
 */
export function specialRoomMax(state) {
  return 0x180 + allocatorCapacity(state, "specialExits") - 1;
}

/**
 * Return the number of bird-travel destination slots.
 *
 * Parameters:
 *   state: Shared Workbench state containing editorDb.
 * Returns:
 *   Count of bird travel slots.
 */
export function birdTravelCapacity(state) {
  const edges = state?.editorDb?.raw?.travelGraph?.edges || [];
  const count = edges.filter((edge) => edge.kind === "bird").length;
  return count || FALLBACK_CAPACITIES.birdTravel;
}

/**
 * Return the first unused fixed slot/source value for an allocation family.
 *
 * Parameters:
 *   state: Shared Workbench state.
 *   type: Allocation family used by navigation-allocation-model.
 *   used: Set of keys already used in the current source metadata.
 * Returns:
 *   First free key, or the family base when every slot is used.
 */
export function firstFreeAllocation(state, type, used) {
  const capacity = firstFreeCapacity(state, type);
  const base = type === "special" ? 0x180 : 0;
  for (let value = 0; value < capacity; value += 1) {
    const key = type === "special" ? value + base : value;
    if (!used.has(key)) {
      return key;
    }
  }
  return base;
}

/**
 * Resolve the capacity used by first-free scans.
 *
 * Parameters:
 *   state: Shared Workbench state.
 *   type: Allocation family.
 * Returns:
 *   Number of possible keys in that family.
 */
function firstFreeCapacity(state, type) {
  if (type === "travel") {
    return birdTravelCapacity(state);
  }
  if (type === "special") {
    return allocatorCapacity(state, "specialExits");
  }
  if (type === "hole") {
    return allocatorCapacity(state, "fallHoles");
  }
  if (type === "entrance") {
    return allocatorCapacity(state, "overworldEntrances");
  }
  return allocatorCapacity(state, "exits");
}

/**
 * Resolve allocator capacity from dat-dump, then constraints, then fallback.
 *
 * Parameters:
 *   state: Shared Workbench state.
 *   key: Allocator key in state.editorDb.allocators.
 * Returns:
 *   Capacity for that fixed table.
 */
function allocatorCapacity(state, key) {
  const allocatorValue = state?.editorDb?.allocators?.[key]?.capacity;
  if (Number.isFinite(allocatorValue)) {
    return allocatorValue;
  }
  const constraintKey = CONSTRAINT_KEYS[key];
  const constraintValue = state?.editorDb?.raw?.constraints?.navigation_slots?.[constraintKey];
  return Number.isFinite(constraintValue) ? constraintValue : FALLBACK_CAPACITIES[key];
}

/**
 * Resolve overworld area count from dat-dump constraints, then fallback.
 *
 * Parameters:
 *   state: Shared Workbench state.
 * Returns:
 *   Number of overworld area ids usable as travel source/destination values.
 */
function areaCapacity(state) {
  const value = state?.editorDb?.raw?.constraints?.overworld?.area_count;
  return Number.isFinite(value) ? value : FALLBACK_CAPACITIES.area;
}
