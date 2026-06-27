"""Validation and defaults for Workbench saved asset libraries."""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

ASSET_LIBRARY_PATH = "assets/map32-library.json"
# The format string stays at v1 so existing mod libraries continue to load after adding map16/map8.
ASSET_LIBRARY_FORMAT = "zelda3-overworld-map32-library-v1"
ASSET_ID_RE = re.compile(r"^[a-z0-9][a-z0-9_-]{0,63}$")
VALID_STAGES = {"beginning", "first", "second"}
# Terrain asset kinds map to the JSON fields written by the browser asset library.
TILE_ASSET_FIELDS = {
    "map32": ("map32",),
    "map16": ("map16",),
    "map8": ("map8Word", "map8"),
}


def default_asset_library() -> dict:
    """Create an empty foldered asset library.

    Parameters: none.
    Returns:
        Asset library document.
    """
    return {
        "format": ASSET_LIBRARY_FORMAT,
        "activeFolderId": "default",
        "selectedTileId": None,
        "folders": [{"id": "default", "name": "Saved Assets", "tiles": []}],
    }


def read_asset_library(mod_dir: Path) -> dict:
    """Read a mod asset library, returning a default document when absent.

    Parameters:
        mod_dir: Mod package directory.
    Returns:
        Validated asset library document.
    """
    path = mod_dir / ASSET_LIBRARY_PATH
    if not path.exists():
        return default_asset_library()
    return validate_asset_library(json.loads(path.read_text(encoding="utf-8")))


def validate_asset_library(data: Any) -> dict:
    """Validate a foldered terrain/sprite asset library document.

    Parameters:
        data: Candidate JSON value.
    Returns:
        Validated asset library dict.
    """
    if not isinstance(data, dict) or data.get("format") != ASSET_LIBRARY_FORMAT:
        raise ValueError("Unsupported map32 asset library format.")
    folders = data.get("folders")
    if not isinstance(folders, list) or not folders:
        raise ValueError("Asset library must contain at least one folder.")
    folder_ids: set[str] = set()
    tile_ids: set[str] = set()
    for folder in folders:
        validate_asset_folder(folder, folder_ids, tile_ids)
    active = data.get("activeFolderId")
    if active is not None and active not in folder_ids:
        raise ValueError("Active asset folder does not exist.")
    selected = data.get("selectedTileId")
    if selected is not None and selected not in tile_ids:
        raise ValueError("Selected asset tile does not exist.")
    return data


def validate_asset_folder(folder: Any, folder_ids: set[str], tile_ids: set[str]) -> None:
    """Validate one asset folder and its entries.

    Parameters are the candidate folder and seen-id sets.
    Returns:
        None.
    """
    if not isinstance(folder, dict):
        raise ValueError("Asset folder must be an object.")
    folder_id = validate_asset_id(folder.get("id"), "asset folder id")
    if folder_id in folder_ids:
        raise ValueError("Duplicate asset folder id: %s" % folder_id)
    folder_ids.add(folder_id)
    validate_text(folder.get("name"), "asset folder name", 80)
    tiles = folder.get("tiles")
    if not isinstance(tiles, list):
        raise ValueError("Asset folder tiles must be a list.")
    for tile in tiles:
        validate_asset_tile(tile, tile_ids)


def validate_asset_tile(tile: Any, tile_ids: set[str]) -> None:
    """Validate one saved terrain tile or sprite asset entry.

    Parameters are the candidate asset and seen-id set.
    Returns:
        None.
    """
    if not isinstance(tile, dict):
        raise ValueError("Asset tile must be an object.")
    tile_id = validate_asset_id(tile.get("id"), "asset tile id")
    if tile_id in tile_ids:
        raise ValueError("Duplicate asset tile id: %s" % tile_id)
    tile_ids.add(tile_id)
    validate_text(tile.get("name"), "asset tile name", 96)
    kind = tile.get("kind", "map32")
    if not isinstance(kind, str):
        raise ValueError("Asset kind must be map32, map16, map8, or sprite.")
    if kind in TILE_ASSET_FIELDS:
        validate_tile_ref(tile_asset_ref(tile, kind), "%s asset reference" % kind)
    elif kind == "sprite":
        validate_sprite_asset(tile.get("sprite"))
    else:
        raise ValueError("Asset kind must be map32, map16, map8, or sprite.")
    preview = tile.get("preview")
    if preview is not None:
        validate_preview(preview)
    source = tile.get("source")
    if source is not None and not isinstance(source, dict):
        raise ValueError("Asset tile source must be an object.")


def validate_sprite_asset(sprite: Any) -> None:
    """Validate one saved overworld sprite placement recipe.

    Parameters:
        sprite: Candidate sprite asset payload.
    Returns:
        None.
    """
    if not isinstance(sprite, dict):
        raise ValueError("Sprite asset payload must be an object.")
    if type(sprite.get("type")) is not int or not 0 <= sprite["type"] <= 0xff:
        raise ValueError("Sprite asset type must be 0x00-0xff.")
    validate_text(sprite.get("name"), "sprite asset name", 96)
    stages = sprite.get("stages", [])
    if not isinstance(stages, list) or any(stage not in VALID_STAGES for stage in stages):
        raise ValueError("Sprite asset stages are invalid.")
    primary = sprite.get("primaryStage")
    if primary is not None and primary not in VALID_STAGES:
        raise ValueError("Sprite asset primary stage is invalid.")
    stage_info = sprite.get("stageInfo", {})
    if not isinstance(stage_info, dict):
        raise ValueError("Sprite asset stageInfo must be an object.")
    for stage, info in stage_info.items():
        if stage not in VALID_STAGES or not isinstance(info, dict):
            raise ValueError("Sprite asset stageInfo entries are invalid.")
        validate_byte(info.get("gfx"), "sprite asset gfx")
        validate_byte(info.get("palette"), "sprite asset palette")
        if "darkWorld" in info and not isinstance(info.get("darkWorld"), bool):
            raise ValueError("Sprite asset darkWorld must be boolean.")
        if "sourceArea" in info:
            validate_area_ref(info.get("sourceArea"), "sprite asset sourceArea")


def validate_asset_id(value: Any, label: str) -> str:
    """Validate a portable id used inside an asset library."""
    if not isinstance(value, str) or not ASSET_ID_RE.fullmatch(value):
        raise ValueError("%s must be lowercase letters, digits, underscores, or hyphens." % label)
    return value


def validate_text(value: Any, label: str, limit: int) -> None:
    """Validate a short user-facing string."""
    if not isinstance(value, str) or not value.strip() or len(value) > limit:
        raise ValueError("%s must be a non-empty string up to %d characters." % (label, limit))


def tile_asset_ref(tile: dict, kind: str) -> Any:
    """Return the saved reference field for a terrain asset kind.

    Parameters:
        tile: Saved asset entry.
        kind: Terrain asset kind.
    Returns:
        Stored reference value, or None when missing.
    """
    for field in TILE_ASSET_FIELDS[kind]:
        if field in tile:
            return tile[field]
    return None


def validate_tile_ref(value: Any, label: str) -> None:
    """Validate a saved unsigned 16-bit terrain reference.

    Parameters:
        value: Candidate reference as a number, decimal string, hex string, or base-prefixed string.
        label: Human-readable field name for validation errors.
    Returns:
        None.
    """
    if type(value) is int and 0 <= value <= 0xffff:
        return
    if isinstance(value, str):
        raw = value[5:] if value.startswith("base:") else value
        try:
            parsed = int(raw, 16 if raw.lower().startswith("0x") else 10)
        except ValueError as error:
            raise ValueError("Invalid %s." % label) from error
        if 0 <= parsed <= 0xffff:
            return
    raise ValueError("%s must resolve to 0x0000-0xffff." % label)


def validate_byte(value: Any, label: str) -> None:
    """Validate a byte-sized integer field."""
    if type(value) is not int or not 0 <= value <= 0xff:
        raise ValueError("%s must be 0x00-0xff." % label)


def validate_area_ref(value: Any, label: str) -> None:
    """Validate a decimal or hex overworld area reference."""
    if type(value) is int:
        parsed = value
    elif isinstance(value, str):
        try:
            parsed = int(value, 16 if value.lower().startswith("0x") else 10)
        except ValueError as error:
            raise ValueError("%s must be an overworld area reference." % label) from error
    else:
        raise ValueError("%s must be an overworld area reference." % label)
    if not 0 <= parsed <= 0x9f:
        raise ValueError("%s must be 0x00-0x9f." % label)


def validate_preview(value: Any) -> None:
    """Validate a compact data URL preview image."""
    valid = isinstance(value, str) and value.startswith("data:image/png;base64,")
    if not valid or len(value) > 12000:
        raise ValueError("Asset tile preview is too large.")
