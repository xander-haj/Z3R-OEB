/**
 * Selection drawing helpers for sprite and interaction markers on the canvas.
 */

/**
 * Draw a visible selection target around a sprite or interaction.
 */
export function drawSelectedSprite(ctx, info) {
  if (info?.kind !== "sprite" && info?.kind !== "enemy" && info?.kind !== "interaction") {
    return;
  }
  const size = 24;
  ctx.save();
  ctx.lineWidth = 2 / ctx.getTransform().a;
  ctx.strokeStyle = "#fff49a";
  ctx.fillStyle = "rgba(255, 231, 105, 0.16)";
  ctx.beginPath();
  ctx.rect(info.centerX - size / 2, info.centerY - size / 2, size, size);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(info.centerX - 15, info.centerY);
  ctx.lineTo(info.centerX + 15, info.centerY);
  ctx.moveTo(info.centerX, info.centerY - 15);
  ctx.lineTo(info.centerX, info.centerY + 15);
  ctx.stroke();
  ctx.restore();
}
