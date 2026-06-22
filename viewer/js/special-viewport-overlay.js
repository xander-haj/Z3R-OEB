/**
 * Special-overworld viewport overlay placeholder for the editor atlas.
 *
 * The runtime overlay ids 0x93 and 0x97 are secondary BG1 streams, not editable
 * terrain map32 pages. Until the dump has real decoded BG1 overlay tilemaps,
 * this module must not draw `map32Words[stream]`; those pages are unrelated
 * terrain and can place stair/cave/tree tiles where no overlay belongs.
 */

/**
 * Intentionally skip Special viewport overlays when only terrain map32 pages
 * are available.
 *
 * Parameters:
 *   app: Loaded viewer/editor application state.
 *   image: Destination ImageData backing the rendered atlas.
 *   group: Atlas group descriptor.
 *   screen: Raw special screen slot being rendered.
 *   originX: Destination x offset in atlas pixels.
 *   originY: Destination y offset in atlas pixels.
 *   options: Renderer options with layer toggles.
 * Returns:
 *   Nothing; the destination image is left unchanged.
 */
export function drawSpecialViewportOverlay(_app, _image, _group, _screen, _originX, _originY, _options = {}) {
  return undefined;
}
