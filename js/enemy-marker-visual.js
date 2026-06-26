/**
 * Semantic marker drawing for overworld sprite placements without source OAM.
 */

const ALWAYS_MARKED_TYPES = new Set([0x25]);

const MARKERS = new Map([
  [0x14, { label: "Grate", accent: "#c5d6aa" }],
  [0x1d, { label: "Flute", accent: "#f2d46b" }],
  [0x25, { label: "Tree", accent: "#94e27f" }],
  [0x33, { label: "Pull", accent: "#f4c35d" }],
  [0x37, { label: "Falls", accent: "#91d9ff" }],
  [0x79, { icon: "bee", label: "Bee", accent: "#f4d05f" }],
  [0xb3, { label: "Plaque", accent: "#d0b287" }],
  [0xd1, { label: "Smoke", accent: "#c5cad5" }],
  [0xf3, { label: "Door", accent: "#f0a3a3" }],
]);

/**
 * Return whether the marker layer should draw a placement badge.
 */
export function shouldDrawSpriteMarker(spawn, showArt) {
  if (!spawn) {
    return false;
  }
  return !showArt || spawn.renderKind !== "oam" || ALWAYS_MARKED_TYPES.has(spawn.type);
}

/**
 * Draw a sprite placement marker without the old numbered diamond fallback.
 */
export function drawSpriteMarker(ctx, spawn) {
  const spec = MARKERS.get(spawn.type) || fallbackSpec(spawn);
  if (spec.icon === "bee") {
    drawBeeMarker(ctx, spawn, spec);
    return;
  }
  drawLabelMarker(ctx, spawn, spec);
}

function fallbackSpec(spawn) {
  return {
    label: String(spawn.id || "0x??").replace(/^0x/i, ""),
    accent: spawn.stageColors?.[0]?.color || "#d8f2cf",
  };
}

function drawLabelMarker(ctx, spawn, spec) {
  const label = String(spec.label || "").slice(0, 6);
  const stroke = spec.accent || spawn.stageColors?.[0]?.color || "#d8f2cf";
  ctx.save();
  ctx.translate(spawn.centerX, spawn.centerY);
  ctx.font = "9px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const width = Math.max(22, Math.ceil(ctx.measureText(label).width) + 10);
  drawBadgeFrame(ctx, width, 14, stroke);
  ctx.fillStyle = "#eef2ec";
  ctx.fillText(label, 0, 1);
  ctx.restore();
}

function drawBeeMarker(ctx, spawn, spec) {
  const stroke = spec.accent || "#f4d05f";
  ctx.save();
  ctx.translate(spawn.centerX, spawn.centerY);
  drawBadgeFrame(ctx, 18, 14, stroke);
  ctx.fillStyle = "rgba(230, 245, 255, 0.75)";
  ctx.beginPath();
  ctx.ellipse(-3, -2, 4, 3, -0.45, 0, Math.PI * 2);
  ctx.ellipse(3, -2, 4, 3, 0.45, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f4d05f";
  ctx.beginPath();
  ctx.ellipse(0, 2, 5, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#161711";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-2, -1);
  ctx.lineTo(-2, 5);
  ctx.moveTo(2, -1);
  ctx.lineTo(2, 5);
  ctx.stroke();
  ctx.restore();
}

function drawBadgeFrame(ctx, width, height, stroke) {
  const x = -width / 2;
  const y = -height / 2;
  roundedRect(ctx, x, y, width, height, 3);
  ctx.fillStyle = "rgba(8, 10, 12, 0.76)";
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = stroke;
  ctx.stroke();
}

function roundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
