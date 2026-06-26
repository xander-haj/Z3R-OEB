/**
 * Small availability guard for the renderer-facing overworld dump.
 *
 * Keeping this outside app.js leaves the main controller focused on state
 * orchestration while preserving the existing server-side dump-status API.
 */

import { overworldDumpStatus } from "./api.js";

/**
 * Confirm the base overworld dump exists before the renderer tries to load it.
 *
 * Parameters:
 *   setStatus: Callback that writes the user-visible status line.
 * Returns:
 *   Promise resolving to true when assets/overworld_dump is present.
 */
export async function ensureBaseDumpAvailable(setStatus) {
  const dumpStatus = await overworldDumpStatus();
  if (dumpStatus.exists) {
    return true;
  }
  setStatus("Base overworld dump missing. Open Project Menu and dump base overworld.");
  return false;
}
