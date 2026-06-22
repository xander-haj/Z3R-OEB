/**
 * Status text helpers for terrain inspection grid modes.
 */

export function selectionStatus(info, gridLevel) {
  if (gridLevel === "map8") {
    return `Selected map8 ${hex(info.map8Word)} @ ${info.map8X},${info.map8Y}`;
  }
  if (gridLevel === "map16") {
    return `Selected map16 ${hex(info.map16)} @ ${info.map16X},${info.map16Y}`;
  }
  return `Selected map32 ${hex(info.map32)} @ ${info.map32X},${info.map32Y}`;
}

function hex(value, width = 4) {
  return `0x${Number(value).toString(16).toUpperCase().padStart(width, "0")}`;
}
