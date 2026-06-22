/**
 * Command application for special-overworld kSpExit visual table edits.
 */

export function applySpecialVisualCommand(sourceData, command, direction) {
  const value = clone(direction === "undo" ? command.before : command.after);
  setSpecialVisualArrays(sourceData, command.slot, value);
  const exit = sourceData?.areaHeaders?.[command.owner?.area]?.navigation?.exits?.[command.owner?.index];
  if (!exit?.specialExit) {
    return;
  }
  exit.specialExit = {
    ...exit.specialExit,
    auxGfx: value.auxGfx,
    palBg: value.palBg,
    palSpr: value.palSpr,
    sprGfx: value.sprGfx,
  };
}

function setSpecialVisualArrays(sourceData, slot, value) {
  if (!Number.isInteger(slot) || slot < 0) {
    return;
  }
  setArrayValue(sourceData, "spExitAuxGfx", slot, value.auxGfx);
  setArrayValue(sourceData, "spExitPalBg", slot, value.palBg);
  setArrayValue(sourceData, "spExitPalSpr", slot, value.palSpr);
  setArrayValue(sourceData, "spExitSprGfx", slot, value.sprGfx);
}

function setArrayValue(sourceData, key, index, value) {
  if (sourceData?.[key]) {
    sourceData[key][index] = value;
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}
