/**
 * Labels for vanilla overworld sprite placement records.
 */

export function spritePlacementRole(type) {
  if (type === 0xf3) {
    return "overlord position target";
  }
  if (type === 0xf4) {
    return "falling rocks marker";
  }
  if (type > 0xf4) {
    return "overlord placement";
  }
  return "regular sprite placement";
}

export function spritePlacementDisplayName(name, type) {
  if (type === 0xf3) {
    return "F3-PositionTarget(OW)";
  }
  return name;
}
