/**
 * Shared visual helpers for interaction marker labels and canvas drawing.
 */

const COLORS = {
  entrancePoints: { fill: "rgba(18, 39, 48, 0.9)", stroke: "#56d4dd" },
  exitPoints: { fill: "rgba(42, 25, 48, 0.9)", stroke: "#d2a8ff" },
  holePoints: { fill: "rgba(43, 28, 14, 0.9)", stroke: "#ffa657" },
  secretTreasure: { fill: "rgba(10, 38, 24, 0.86)", stroke: "#7ee787" },
  secretEnemies: { fill: "rgba(52, 18, 20, 0.88)", stroke: "#ff7b72" },
  secretEntrances: { fill: "rgba(14, 30, 58, 0.88)", stroke: "#79c0ff" },
  shovelSpots: { fill: "rgba(52, 42, 14, 0.9)", stroke: "#d29922" },
  travelPoints: { fill: "rgba(30, 40, 18, 0.9)", stroke: "#a5d65a" },
};

const CATEGORY_LABELS = {
  secretTreasure: "secret treasure",
  secretEnemies: "secret sprite",
  secretEntrances: "secret entrance/trigger",
  shovelSpots: "shovel spot",
  travelPoints: "travel point",
  entrancePoints: "overworld entrance",
  holePoints: "fall hole",
  exitPoints: "dungeon exit",
};

/**
 * Draw one non-sprite interaction marker onto the overlay canvas.
 *
 * Parameters:
 *   ctx: Canvas 2D context for the offscreen overworld render.
 *   record: Laid-out interaction record with label-space x/y coordinates.
 * Returns:
 *   None.
 */
export function drawMarker(ctx, record) {
  const color = COLORS[record.layer] || COLORS.secretTreasure;
  const randomSecret = isRandomSecret(record);
  ctx.save();
  ctx.translate(record.x, record.y);
  ctx.font = "8px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
  const width = markerFrameWidth(record, (label) => ctx.measureText(label).width);
  if (!randomSecret) {
    drawMarkerFrame(ctx, color, width);
  }
  if (randomSecret) {
    drawDiceIcon(ctx);
  } else {
    drawMarkerText(ctx, markerLabel(record));
  }
  ctx.restore();
}

/**
 * Return the user-facing category label for a marker layer.
 *
 * Parameters:
 *   layer: Internal layer id from the interaction overlay.
 * Returns:
 *   Human-readable category string.
 */
export function categoryLabel(layer) {
  return CATEGORY_LABELS[layer] || "interaction";
}

/**
 * Return the marker frame width used by drawing and hit-testing.
 *
 * Parameters:
 *   record: Interaction marker record.
 *   measureText: Optional function returning the pixel width for a label.
 * Returns:
 *   Clamped marker width in canvas pixels.
 */
export function markerFrameWidth(record, measureText = null) {
  if (isRandomSecret(record)) {
    return 16;
  }
  const label = markerLabel(record);
  const textWidth = measureText ? measureText(label) : label.length * 7;
  return Math.max(26, Math.min(88, textWidth + 10));
}

/**
 * Draw the colored marker frame behind text or icons.
 *
 * Parameters:
 *   ctx: Canvas 2D context translated to marker center.
 *   color: Fill and stroke color pair for the marker layer.
 *   width: Frame width in canvas pixels.
 * Returns:
 *   None.
 */
function drawMarkerFrame(ctx, color, width) {
  ctx.fillStyle = color.fill;
  ctx.strokeStyle = color.stroke;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.rect(-width / 2, -8, width, 16);
  ctx.fill();
  ctx.stroke();
}

/**
 * Draw centered text in a marker frame.
 *
 * Parameters:
 *   ctx: Canvas 2D context translated to marker center.
 *   label: Text label to draw.
 * Returns:
 *   None.
 */
function drawMarkerText(ctx, label) {
  ctx.fillStyle = "#f8fff5";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, 0, 0);
}

/**
 * Draw a small five-pip die for the random secret treasure marker.
 *
 * Parameters:
 *   ctx: Canvas 2D context translated to marker center.
 * Returns:
 *   None.
 */
function drawDiceIcon(ctx) {
  ctx.fillStyle = "#f8fff5";
  ctx.strokeStyle = "#0a2618";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.rect(-5.5, -5.5, 11, 11);
  ctx.fill();
  ctx.stroke();
  drawPip(ctx, -2.8, -2.8);
  drawPip(ctx, 2.8, -2.8);
  drawPip(ctx, 0, 0);
  drawPip(ctx, -2.8, 2.8);
  drawPip(ctx, 2.8, 2.8);
}

/**
 * Draw one circular die pip.
 *
 * Parameters:
 *   ctx: Canvas 2D context translated to marker center.
 *   x: Pip center x relative to the die.
 *   y: Pip center y relative to the die.
 * Returns:
 *   None.
 */
function drawPip(ctx, x, y) {
  ctx.fillStyle = "#0a2618";
  ctx.beginPath();
  ctx.arc(x, y, 1.1, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Return true when a marker is the compiler's random secret treasure code.
 *
 * Parameters:
 *   record: Interaction marker record.
 * Returns:
 *   True only for code 0x04 secret treasure records.
 */
function isRandomSecret(record) {
  return record.layer === "secretTreasure" && (Number(record.code) === 0x04 || record.name === "04-Random");
}

/**
 * Return the text label for non-icon marker types.
 *
 * Parameters:
 *   record: Interaction marker record.
 * Returns:
 *   Short marker text.
 */
function markerLabel(record) {
  if (record.layer === "shovelSpots") {
    return "Flute";
  }
  if (record.layer === "entrancePoints") {
    return `Ent ${record.id}`;
  }
  if (record.layer === "holePoints") {
    return `Hole ${record.id}`;
  }
  if (record.layer === "exitPoints") {
    return `Exit ${record.id}`;
  }
  if (record.layer === "travelPoints") {
    return String(record.displayName || "Travel").slice(0, 10);
  }
  return String(record.displayName || record.name || "?").slice(0, 10);
}
