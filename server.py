#!/usr/bin/env python3
"""Local server for the Overworld Workbench mod editor."""

from __future__ import annotations

import argparse
import json
import mimetypes
import subprocess
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

import sys

ASSETS_DIR = Path(__file__).resolve().parents[2] / "assets"
if str(ASSETS_DIR) not in sys.path:
    sys.path.insert(0, str(ASSETS_DIR))

from asset_library_store import (
    ASSET_LIBRARY_PATH,
    default_asset_library,
    read_asset_library,
    validate_asset_library,
)
from modding.overworld_builder import list_mods
from modding.paths import GENERATED_ROOT, MODS_ROOT, generated_dir_for, safe_join, validate_mod_id
from modding.schema import MOD_FORMAT, PATCH_FORMATS, validate_manifest, validate_patch_document, write_json

PATCH_FILES = {
    "terrain": "patches/terrain.json",
    "map32-definitions": "patches/map32-definitions.json",
    "map16-definitions": "patches/map16-definitions.json",
    "map8-words": "patches/map8-words.json",
    "tile-attributes": "patches/tile-attributes.json",
    "chr-recipes": "patches/chr-recipes.json",
    "palettes": "patches/palettes.json",
    "metadata": "patches/metadata.json",
    "gravestones": "patches/gravestones.json",
}


class OverworldEditorHandler(SimpleHTTPRequestHandler):
    """Serves static Workbench files plus a narrow data-only mod API."""

    static_dir: Path
    repo_root: Path
    viewer_dir: Path

    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def translate_path(self, path: str) -> str:
        """Resolve static editor/shared-renderer/assets URLs without traversal."""
        clean = path.split("?", 1)[0].split("#", 1)[0]
        if clean in ("", "/"):
            return str((self.static_dir / "index.html").resolve())
        if clean.startswith("/viewer/"):
            return str(safe_join(self.viewer_dir, clean.removeprefix("/viewer/")))
        if clean.startswith(("/assets/", "/src/")):
            return str(safe_join(self.repo_root, clean.removeprefix("/")))
        return str(safe_join(self.static_dir, clean.lstrip("/")))

    def do_GET(self) -> None:
        """Route API reads before falling back to static files."""
        route = self.path.split("?", 1)[0]
        if route == "/favicon.ico":
            self.send_response(HTTPStatus.NO_CONTENT)
            self.end_headers()
            return
        if route == "/api/info":
            self.send_json({"modsRoot": str(MODS_ROOT), "generatedRoot": str(GENERATED_ROOT)})
            return
        if route == "/api/mods":
            self.send_json({"mods": list_mods()})
            return
        if route == "/api/overworld-dump/status":
            self.send_dump_status()
            return
        if route.startswith("/api/mods/") and route.endswith("/assets"):
            self.send_asset_library(route.split("/")[3])
            return
        if route.startswith("/api/mods/"):
            self.send_mod_payload(route.split("/", 3)[3])
            return
        if route.startswith("/api/generated-preview/"):
            self.send_generated_file(route.removeprefix("/api/generated-preview/"))
            return
        super().do_GET()

    def do_POST(self) -> None:
        """Route API writes for mods and local workflow commands."""
        try:
            if self.path == "/api/mods/create":
                self.create_mod(json.loads(self.read_body()))
                return
            if self.path.startswith("/api/mods/") and self.path.endswith("/assets/save"):
                mod_id = self.path.split("/")[3]
                self.save_asset_library(mod_id, json.loads(self.read_body()))
                return
            if self.path.startswith("/api/mods/") and self.path.endswith("/save"):
                mod_id = self.path.split("/")[3]
                self.save_mod(mod_id, json.loads(self.read_body()))
                return
            if self.path.startswith("/api/mods/") and self.path.endswith("/validate"):
                mod_id = self.path.split("/")[3]
                self.run_modtool(mod_id, "validate")
                return
            if self.path.startswith("/api/mods/") and self.path.endswith("/build"):
                mod_id = self.path.split("/")[3]
                self.run_modtool(mod_id, "build")
                return
            if self.path.startswith("/api/mods/") and self.path.endswith("/apply-overworld"):
                mod_id = self.path.split("/")[3]
                self.run_restool_apply(mod_id)
                return
            if self.path.startswith("/api/mods/") and self.path.endswith("/dump-overworld"):
                mod_id = self.path.split("/")[3]
                self.run_restool_mod_dump(mod_id)
                return
            if self.path == "/api/overworld-dump/create":
                self.run_restool_base_dump()
                return
            self.send_error(HTTPStatus.NOT_FOUND, "Unknown API route")
        except (OSError, ValueError, json.JSONDecodeError) as error:
            self.send_text(str(error), HTTPStatus.BAD_REQUEST)

    def read_body(self) -> str:
        """Read the full request body using Content-Length."""
        length = int(self.headers.get("Content-Length", "0"))
        return self.rfile.read(length).decode("utf-8")

    def create_mod(self, payload: dict[str, Any]) -> None:
        """Create a new mod package with every supported patch file."""
        mod_id = validate_mod_id(payload.get("id", ""))
        mod_dir = safe_join(MODS_ROOT, mod_id)
        if (mod_dir / "mod.json").exists():
            raise ValueError("Mod already exists: %s" % mod_id)
        manifest = default_manifest(mod_id, payload.get("name") or mod_id)
        write_json(mod_dir / "mod.json", manifest)
        for key, relative in PATCH_FILES.items():
            write_json(mod_dir / relative, default_patch(key))
        write_json(mod_dir / ASSET_LIBRARY_PATH, default_asset_library())
        self.send_json({"ok": True, "mod": read_mod(mod_dir)})

    def save_mod(self, mod_id: str, payload: dict[str, Any]) -> None:
        """Validate and save a mod manifest plus patch documents."""
        mod_dir = safe_join(MODS_ROOT, validate_mod_id(mod_id))
        manifest = payload.get("manifest") or default_manifest(mod_id, mod_id)
        manifest["id"] = mod_id
        patch_docs = payload.get("patches", {})
        for relative, document in patch_docs.items():
            if relative not in PATCH_FILES.values():
                raise ValueError("Unsupported patch path: %s" % relative)
            validate_patch_document(document, relative)
        patch_paths = list(dict.fromkeys([*manifest.get("patches", []), *patch_docs.keys()]))
        for relative in patch_paths:
            if relative not in PATCH_FILES.values():
                raise ValueError("Unsupported patch path: %s" % relative)
        manifest["patches"] = patch_paths
        write_json(mod_dir / "mod.json", manifest)
        validate_manifest(mod_dir)
        for relative, document in patch_docs.items():
            write_json(mod_dir / relative, document)
        self.send_json({"ok": True, "mod": read_mod(mod_dir)})

    def save_asset_library(self, mod_id: str, payload: dict[str, Any]) -> None:
        """Validate and save one mod's saved asset library."""
        mod_dir = safe_join(MODS_ROOT, validate_mod_id(mod_id))
        if not (mod_dir / "mod.json").exists():
            raise ValueError("Unknown mod: %s" % mod_id)
        asset_library = validate_asset_library(payload.get("assetLibrary"))
        write_json(mod_dir / ASSET_LIBRARY_PATH, asset_library)
        self.send_json({"ok": True, "assetLibrary": asset_library})

    def run_modtool(self, mod_id: str, command: str) -> None:
        """Run one allowed modtool command for the selected overworld mod."""
        mod_id = validate_mod_id(mod_id)
        if command not in ("validate", "build"):
            raise ValueError("Unsupported modtool command: %s" % command)
        self.send_json(self.run_tool_command([
            "python3",
            "assets/modtool.py",
            command,
            "mods/overworld/%s" % mod_id,
        ]))

    def run_restool_apply(self, mod_id: str) -> None:
        """Run the allowed restool apply command for one overworld mod."""
        mod_id = validate_mod_id(mod_id)
        self.send_json(self.run_tool_command([
            "python3",
            "assets/restool.py",
            "--apply-overworld-mods",
            mod_id,
        ], restart_launcher=True))

    def run_restool_mod_dump(self, mod_id: str) -> None:
        """Run the allowed restool mod dump command for one overworld mod."""
        mod_id = validate_mod_id(mod_id)
        self.send_json(self.run_tool_command([
            "python3",
            "assets/restool.py",
            "--dump-overworld",
            "--mod",
            mod_id,
        ], restart_launcher=True))

    def run_restool_base_dump(self) -> None:
        """Run the allowed restool base overworld dump command."""
        self.send_json(self.run_tool_command([
            "python3",
            "assets/restool.py",
            "--dump-overworld",
        ], restart_launcher=True))

    def run_tool_command(self, args: list[str], restart_launcher: bool = False) -> dict[str, Any]:
        """Run one fixed local workflow command and return captured output."""
        try:
            completed = subprocess.run(
                args,
                cwd=self.repo_root,
                capture_output=True,
                check=False,
                text=True,
                timeout=900,
            )
        except subprocess.TimeoutExpired as error:
            return {
                "ok": False,
                "command": args,
                "returncode": None,
                "stdout": error.stdout or "",
                "stderr": (error.stderr or "") + "\nCommand timed out.",
                "restartLauncher": restart_launcher,
            }
        return {
            "ok": completed.returncode == 0,
            "command": args,
            "returncode": completed.returncode,
            "stdout": completed.stdout,
            "stderr": completed.stderr,
            "restartLauncher": restart_launcher,
        }

    def send_dump_status(self) -> None:
        """Return whether the base overworld dump folder is present."""
        path = self.repo_root / "assets" / "overworld_dump"
        self.send_json({"exists": path.is_dir(), "path": str(path)})

    def send_mod_payload(self, mod_id: str) -> None:
        """Return manifest and patch JSON for one mod id."""
        try:
            mod_dir = safe_join(MODS_ROOT, validate_mod_id(mod_id))
            if not (mod_dir / "mod.json").exists():
                self.send_error(HTTPStatus.NOT_FOUND, "Unknown mod")
                return
            self.send_json({"mod": read_mod(mod_dir)})
        except (OSError, ValueError, json.JSONDecodeError) as error:
            self.send_text(str(error), HTTPStatus.BAD_REQUEST)

    def send_asset_library(self, mod_id: str) -> None:
        """Return the saved asset library for one mod id."""
        mod_dir = safe_join(MODS_ROOT, validate_mod_id(mod_id))
        if not (mod_dir / "mod.json").exists():
            self.send_error(HTTPStatus.NOT_FOUND, "Unknown mod")
            return
        self.send_json({"assetLibrary": read_asset_library(mod_dir)})

    def send_generated_file(self, relative: str) -> None:
        """Serve generated preview files from assets/generated."""
        parts = relative.split("/", 1)
        mod_id = validate_mod_id(parts[0])
        if len(parts) == 1:
            self.send_json({"generated": str(generated_dir_for([mod_id]))})
            return
        path = safe_join(generated_dir_for([mod_id]), parts[1])
        if not path.is_file():
            self.send_error(HTTPStatus.NOT_FOUND, "Generated preview file not found")
            return
        self.send_file(path)

    def send_file(self, path: Path) -> None:
        """Send a static file with a guessed MIME type."""
        body = path.read_bytes()
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", mimetypes.guess_type(str(path))[0] or "application/octet-stream")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def send_json(self, payload: dict[str, Any], status: HTTPStatus = HTTPStatus.OK) -> None:
        """Send compact JSON to the browser."""
        body = json.dumps(payload, separators=(",", ":")).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def send_text(self, text: str, status: HTTPStatus) -> None:
        """Send a plain-text error response."""
        body = text.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def default_manifest(mod_id: str, name: str) -> dict:
    """Create a complete default manifest for a new mod."""
    return {
        "format": MOD_FORMAT,
        "id": mod_id,
        "name": name,
        "version": "0.1.0",
        "author": "local-user",
        "target": {"game": "zelda3-us", "requiresExtractedAssets": True, "baseHashes": {}},
        "patches": list(PATCH_FILES.values()),
        "loadAfter": [],
        "loadBefore": [],
    }


def default_patch(key: str) -> dict:
    """Create an empty patch document for one layer key."""
    format_value = PATCH_FORMATS[key]
    collection = "recipes" if key == "chr-recipes" else "patches"
    if "definitions" in key:
        collection = "definitions"
    if key == "map8-words" or key == "tile-attributes":
        collection = "edits"
    return {"format": format_value, collection: []}


def read_mod(mod_dir: Path) -> dict:
    """Read and validate one mod manifest plus all existing patch files."""
    manifest = validate_manifest(mod_dir)
    patches = {}
    for relative in manifest.get("patches", []):
        path = mod_dir / relative
        if path.exists():
            document = json.loads(path.read_text(encoding="utf-8"))
            patches[relative] = validate_patch_document(document, relative)
    return {"manifest": manifest, "patches": patches, "assetLibrary": read_asset_library(mod_dir)}


def make_handler(static_dir: Path, repo_root: Path) -> type[OverworldEditorHandler]:
    """Bind concrete paths onto the request handler class."""
    class BoundOverworldEditorHandler(OverworldEditorHandler):
        pass

    BoundOverworldEditorHandler.static_dir = static_dir
    BoundOverworldEditorHandler.repo_root = repo_root
    BoundOverworldEditorHandler.viewer_dir = static_dir / "viewer"
    return BoundOverworldEditorHandler


def parse_args() -> argparse.Namespace:
    """Parse server CLI flags."""
    parser = argparse.ArgumentParser(description="Run the Overworld Workbench server.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8060)
    return parser.parse_args()


def main() -> None:
    """Start the local Workbench server."""
    args = parse_args()
    static_dir = Path(__file__).resolve().parent
    repo_root = static_dir.parents[1]
    handler = make_handler(static_dir, repo_root)
    server = ThreadingHTTPServer((args.host, args.port), handler)
    host, port = server.server_address
    print("Overworld Workbench: http://%s:%d" % (host, port))
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nOverworld Workbench stopped.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
