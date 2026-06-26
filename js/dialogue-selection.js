/**
 * Resolves selected overworld sprite placements to exported dialogue bindings.
 */

/**
 * Return whether the current sprite selection has source-backed dialogue.
 *
 * Parameters:
 *   info: Current Workbench selection.
 *   editorDb: Loaded editor database descriptor.
 * Returns:
 *   True when a matching npc_dialogue_bindings row has messages.
 */
export function selectionHasDialogue(info, editorDb) {
  return dialogueMessagesForSelection(info, editorDb).length > 0;
}

/**
 * Return the first matching dialogue binding for compatibility with inspector code.
 *
 * Parameters:
 *   info: Current Workbench selection.
 *   editorDb: Loaded editor database descriptor.
 * Returns:
 *   Binding record or null.
 */
export function dialogueBindingForSelection(info, editorDb) {
  return matchingBindings(info, editorDb)[0] || null;
}

/**
 * Return unique editable dialogue messages for the selected sprite placement.
 *
 * Parameters:
 *   info: Current Workbench sprite/enemy selection.
 *   editorDb: Loaded editor database descriptor.
 * Returns:
 *   Message rows enriched with current dialogue text.
 */
export function dialogueMessagesForSelection(info, editorDb) {
  const messages = [];
  const seen = new Set();
  for (const binding of matchingBindings(info, editorDb)) {
    for (const message of binding.messages || []) {
      const id = message.dialogue_id ?? message.dialogueId;
      if (!Number.isInteger(id) || seen.has(id)) {
        continue;
      }
      seen.add(id);
      messages.push({
        ...message,
        dialogue_id: id,
        text: editorDb?.indexes?.dialogueById?.get(id)?.text || "",
        binding,
      });
    }
  }
  return messages;
}

/**
 * Find all binding rows whose area, stage, placement index, and sprite type match.
 */
function matchingBindings(info, editorDb) {
  if ((info?.kind !== "sprite" && info?.kind !== "enemy") || !editorDb?.available) {
    return [];
  }
  const candidates = candidatePlacements(info);
  return (editorDb.raw.npcDialogueBindings?.bindings || []).filter((binding) => (
    candidates.some((candidate) => bindingMatchesPlacement(binding, info, candidate))
  ));
}

/**
 * Build placement match candidates from the overlay's linked-stage selection rows.
 */
function candidatePlacements(info) {
  const placements = info.stagePlacements?.length ? info.stagePlacements : [];
  if (placements.length) {
    return placements;
  }
  return [{ stage: info.primaryStage, index: info.placementIndex }];
}

/**
 * Compare a binding row to one selected source placement candidate.
 */
function bindingMatchesPlacement(binding, info, placement) {
  const area = binding.area ?? binding.overworld_area ?? binding.overworldArea;
  const stage = binding.stage ?? binding.sprite_stage ?? binding.spriteStage;
  const index = binding.index ?? binding.placement_index ?? binding.placementIndex;
  const type = binding.sprite ?? binding.type ?? binding.sprite_type ?? binding.spriteType;
  const sourceArea = binding.source_area ?? binding.sourceArea;
  const areaMatches = sameOptional(area, info.area) ||
    (sourceArea !== undefined && sourceArea !== null && sameOptional(sourceArea, info.area));
  return areaMatches &&
    sameOptional(stage, placement.stage || info.primaryStage) &&
    sameOptional(index, placement.index) &&
    sameOptional(type, info.type);
}

/**
 * Treat missing fields as wildcards for forward-compatible binding schemas.
 */
function sameOptional(left, right) {
  return left === undefined || left === null || right === undefined || right === null ||
    String(left) === String(right);
}
