/**
 * Shared layer visibility state for the Overworld Workbench renderer and UI.
 */

export const LAYER_GROUPS = [
  {
    title: "Terrain",
    items: [
      layer("bgLow", "BG Low", "Low-priority terrain tiles", "render", true),
      layer("bgHigh", "BG High", "High-priority terrain tiles", "render", true),
      layer("staticOverlays", "Static Overlays", "Editable map16 overlay writes", "render", false),
      layer("structuralOverlays", "Overlays", "Secondary map streams", "render", false),
    ],
  },
  {
    title: "Special",
    items: [
      layer("panelBackgrounds", "Panel BG", "Special panel backing fill", "render", true),
      layer("panelLabels", "Labels", "Special panel labels", "render", true),
    ],
  },
  {
    title: "Sprites",
    items: [
      layer("sourceSprites", "Source Sprites", "Viewer sprite draw pass", "render", false),
      layer("enemySpriteArt", "Sprite Art", "Source-backed overworld sprite art", "render", true),
      layer("enemyMarkers", "Sprite Markers", "Fallback sprite placement markers", "render", true),
      layer("enemySelection", "Sprite Select", "Selected sprite outline", "draw", true),
    ],
  },
  {
    title: "Interactions",
    items: [
      layer("secretTreasure", "Secret Treasure", "Hidden item and prize drops", "render", false),
      layer("secretEnemies", "Secret Sprites", "Spawned sprites hidden under terrain", "render", false),
      layer("secretEntrances", "Secret Entrances", "Hidden holes, warps, stairs, and switches", "render", false),
      layer("shovelSpots", "Shovel Spots", "Hard-coded shovel rewards", "render", false),
      layer("gravestones", "Gravestones", "Movable grave records", "render", false),
    ],
  },
  {
    title: "Navigation",
    items: [
      layer("travelPoints", "Travel Points", "Bird and whirlpool travel destinations", "render", false),
      layer("entrancePoints", "Entrances", "Overworld door and stair entrance slots", "render", false),
      layer("holePoints", "Fall Holes", "Overworld holes that drop into entrances", "render", false),
      layer("exitPoints", "Dungeon Exits", "Dungeon-to-overworld exit positions", "render", false),
    ],
  },
  {
    title: "Editor",
    items: [
      layer("map32Grid", "Map32 Grid", "32x32 tile grid", "render", true),
      layer("map16Grid", "Map16 Grid", "16x16 tile grid", "render", false),
      layer("map8Grid", "Map8 Grid", "8x8 tile grid", "render", false),
      layer("screenGrid", "Screen Grid", "Area and quadrant grid", "render", true),
      layer("areaLabels", "Area Labels", "Atlas row/column labels", "draw", true),
      layer("tileSelection", "Tile Select", "Active tile outline", "draw", true),
      layer("multiSelection", "Multi Select", "Batch selection outline", "draw", true),
    ],
  },
];

const DEFAULT_LAYERS = Object.fromEntries(
  LAYER_GROUPS.flatMap((group) => group.items.map((item) => [item.key, item.defaultValue])),
);

/**
 * Ensure the Workbench state has every known layer visibility flag.
 *
 * Parameters:
 *   state: Shared Workbench state.
 * Returns:
 *   Mutable layer visibility object.
 */
export function ensureLayerState(state) {
  state.layers = { ...DEFAULT_LAYERS, ...(state.layers || {}) };
  state.showGridLabels = state.layers.areaLabels;
  return state.layers;
}

/**
 * Return whether a layer is currently visible.
 *
 * Parameters:
 *   layers: Layer visibility object.
 *   key: Layer key from LAYER_GROUPS.
 * Returns:
 *   True unless the layer was explicitly disabled.
 */
export function layerVisible(layers, key) {
  return layers?.[key] !== false;
}

/**
 * Set one layer flag and keep legacy state aliases synchronized.
 *
 * Parameters:
 *   state: Shared Workbench state.
 *   key: Layer key.
 *   visible: New visibility state.
 * Returns:
 *   Updated layer visibility object.
 */
export function setLayerVisible(state, key, visible) {
  const layers = ensureLayerState(state);
  layers[key] = Boolean(visible);
  if (key === "areaLabels") {
    state.showGridLabels = layers.areaLabels;
  }
  return layers;
}

/**
 * Build one declarative layer-control descriptor.
 *
 * Parameters:
 *   key: Stable layer state key.
 *   label: Short UI label.
 *   description: Tooltip text.
 *   mode: "render" for offscreen rerender, "draw" for visible redraw.
 *   defaultValue: Initial visibility state.
 * Returns:
 *   Layer descriptor.
 */
function layer(key, label, description, mode, defaultValue) {
  return { key, label, description, mode, defaultValue };
}
