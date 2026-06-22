/**
 * Source-backed asset loader used by the overworld editor.
 */

const SCREEN_COUNT = 160;
const PALETTE_FILES = [
  "overworld_bg_main",
  "overworld_bg_aux12",
  "overworld_bg_aux3",
  "sprite_aux3",
  "sprite_misc",
  "sprite_main",
  "sprite_aux1",
  "sprite_sword",
  "sprite_shield",
  "sprite_armor",
];

export class ZeldaAssets {
  constructor(parts) {
    Object.assign(this, parts);
  }

  static async load(prefix = "", dumpPath = "assets/overworld_dump") {
    const [
      map32Words,
      map32ToMap16,
      map16ToMap8,
      bgGraphics,
      spriteGraphics,
      palettes,
    ] = await Promise.all([
      loadMap32Words(prefix, dumpPath),
      loadJson(prefix, dumpPath, "tables/map32_to_map16.json").then((data) => data.entries || []),
      loadJson(prefix, dumpPath, "tables/map16_to_map8.json").then((data) => data.words || []),
      loadIndexedGraphics(prefix, dumpPath, "gfx/bg/manifest.json", "gfx/bg/%03d.bin"),
      loadIndexedGraphics(prefix, dumpPath, "gfx/sprite/manifest.json", "gfx/sprite/%03d.bin"),
      loadPalettes(prefix, dumpPath),
    ]);
    return new ZeldaAssets({
      bgGraphics,
      bgPalettes: {
        overworld_bg_main: palettes.overworld_bg_main,
        overworld_bg_aux12: palettes.overworld_bg_aux12,
        overworld_bg_aux3: palettes.overworld_bg_aux3,
      },
      map16ToMap8,
      map32ToMap16,
      map32Words,
      spriteGraphics,
      spritePalettes: {
        sprite_aux3: palettes.sprite_aux3,
        sprite_misc: palettes.sprite_misc,
        sprite_main: palettes.sprite_main,
        sprite_aux1: palettes.sprite_aux1,
        sprite_sword: palettes.sprite_sword,
        sprite_shield: palettes.sprite_shield,
        sprite_armor: palettes.sprite_armor,
      },
    });
  }
}

async function loadMap32Words(prefix, dumpPath) {
  return Promise.all(Array.from({ length: SCREEN_COUNT }, (_, screen) => (
    loadJson(prefix, dumpPath, `map32/decoded/${pad(screen)}.json`).then((data) => data.map32 || [])
  )));
}

async function loadIndexedGraphics(prefix, dumpPath, manifestPath, pattern) {
  const manifest = await loadJson(prefix, dumpPath, manifestPath);
  const pairs = await Promise.all((manifest.entries || []).map(async (entry) => {
    const bytes = await loadBytes(prefix, dumpPath, pattern.replace("%03d", pad(entry.index)));
    return [entry.index, bytes];
  }));
  return new Map(pairs);
}

async function loadPalettes(prefix, dumpPath) {
  const entries = await Promise.all(PALETTE_FILES.map(async (name) => {
    const data = await loadJson(prefix, dumpPath, `palettes/${name}.json`);
    return [name, Uint16Array.from(data.words || [])];
  }));
  return Object.fromEntries(entries);
}

async function loadJson(prefix, dumpPath, path) {
  const response = await fetch(assetUrl(prefix, dumpPath, path));
  if (!response.ok) {
    throw new Error(`Unable to load ${path}: ${response.status}`);
  }
  return response.json();
}

async function loadBytes(prefix, dumpPath, path) {
  const response = await fetch(assetUrl(prefix, dumpPath, path));
  if (!response.ok) {
    throw new Error(`Unable to load ${path}: ${response.status}`);
  }
  return new Uint8Array(await response.arrayBuffer());
}

function assetUrl(prefix, dumpPath, path) {
  const base = [prefix, dumpPath, path].filter(Boolean).join("/").replace(/\/+/g, "/");
  return base.startsWith("/") ? base : `/${base}`;
}

function pad(value) {
  return String(value).padStart(3, "0");
}
