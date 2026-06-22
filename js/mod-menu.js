/**
 * Center modal for mod package and local workflow commands.
 */

import { dumpBaseOverworld, overworldDumpStatus, runModWorkflow } from "./api.js";

const COMMANDS = [
  ["validateModButton", "Validate mod", "validate"],
  ["buildModButton", "Build mod", "build"],
  ["applyOverworldModButton", "Apply overworld mod", "apply-overworld"],
  ["dumpModOverworldButton", "Dump selected mod overworld", "dump-overworld"],
];

let statusCallback = null;

/**
 * Bind the project-menu modal and command buttons.
 */
export function bindModMenu(actions) {
  statusCallback = actions.setStatus;
  ensureModMenu();
  controls().openButton.addEventListener("click", openModMenu);
  controls().closeButton.addEventListener("click", closeModMenu);
  controls().overlay.addEventListener("pointerdown", closeOnBackdrop);
  window.addEventListener("keydown", closeOnEscape);
  controls().modSelect.addEventListener("change", clearValidateIndicator);
  controls().newModInput.addEventListener("input", clearValidateIndicator);
  for (const [buttonId, label, action] of COMMANDS) {
    document.querySelector(`#${buttonId}`).addEventListener("click", () => runSelectedModCommand(label, action));
  }
  controls().dumpBaseButton.addEventListener("click", runBaseDump);
  refreshDumpStatus();
}

function ensureModMenu() {
  if (document.querySelector("#modMenuOverlay")) {
    return;
  }
  const overlay = document.createElement("div");
  overlay.id = "modMenuOverlay";
  overlay.className = "modal-overlay";
  overlay.hidden = true;
  overlay.innerHTML = `
    <aside class="mod-menu-panel" role="dialog" aria-modal="true" aria-labelledby="modMenuTitle">
      <header class="modal-header">
        <h2 id="modMenuTitle">Project Menu</h2>
        <button id="modMenuCloseButton" type="button" aria-label="Close project menu">Close</button>
      </header>
      <div class="mod-menu-content">
        <section>
          <h3>Mod Package</h3>
          <label>Select mod
            <select id="modSelect"></select>
          </label>
          <label>Create new mod
            <input id="newModId" placeholder="new_mod_id">
          </label>
          <div class="row">
            <button id="createModButton" type="button">Create</button>
            <button id="saveButton" type="button">Save</button>
            <button id="baseButton" type="button">Load Base</button>
          </div>
        </section>
        <section id="baseDumpSection" hidden>
          <h3>Base Dump Missing</h3>
          <p class="modal-note">Create the base overworld dump, then restart the launcher.</p>
          <button id="dumpBaseOverworldButton" type="button">Dump Base Overworld</button>
        </section>
        <section>
          <h3>Mod Commands</h3>
          <div class="command-row">
            <button id="validateModButton" type="button">Validate Mod</button>
            <span id="validateModIndicator" class="success-indicator" hidden aria-label="Validation passed">
              <svg aria-hidden="true" viewBox="0 0 24 24">
                <path d="M6 12.5l4 4L18 8"></path>
              </svg>
            </span>
          </div>
          <button id="buildModButton" type="button">Build Mod</button>
          <button id="applyOverworldModButton" type="button">Apply Overworld Mod</button>
          <button id="dumpModOverworldButton" type="button">Dump Selected Mod Overworld</button>
          <p class="modal-note">After applying or dumping overworld assets, restart the launcher.</p>
          <pre id="modCommandOutput" class="command-output" aria-live="polite"></pre>
        </section>
      </div>
    </aside>
  `;
  document.body.append(overlay);
}

function openModMenu() {
  controls().overlay.hidden = false;
  controls().openButton.setAttribute("aria-expanded", "true");
  refreshDumpStatus();
  controls().modSelect.focus();
}

function closeModMenu() {
  controls().overlay.hidden = true;
  controls().openButton.setAttribute("aria-expanded", "false");
  controls().openButton.focus();
}

function closeOnBackdrop(event) {
  if (event.target === controls().overlay) {
    closeModMenu();
  }
}

function closeOnEscape(event) {
  if (event.key === "Escape" && !controls().overlay.hidden) {
    closeModMenu();
  }
}

async function refreshDumpStatus() {
  try {
    const status = await overworldDumpStatus();
    controls().baseDumpSection.hidden = Boolean(status.exists);
  } catch (error) {
    controls().baseDumpSection.hidden = false;
    setOutput(`Unable to check base dump status:\n${error.message}`);
  }
}

async function runSelectedModCommand(label, action) {
  const modId = selectedModId();
  if (!modId) {
    setOutput("Select a mod first.");
    setStatus("Select a mod first");
    return;
  }
  await runCommand(label, () => runModWorkflow(modId, action), action === "validate");
}

async function runBaseDump() {
  await runCommand("Dump base overworld", dumpBaseOverworld, false);
  await refreshDumpStatus();
}

async function runCommand(label, task, validates) {
  if (validates) {
    clearValidateIndicator();
  }
  const buttons = commandButtons();
  setDisabled(buttons, true);
  setOutput(`Running ${label}...`);
  setStatus(`Running ${label}`);
  try {
    const result = await task();
    if (validates && result.ok) {
      controls().validateIndicator.hidden = false;
    }
    renderCommandResult(label, result);
    setStatus(result.ok ? `${label} complete` : `${label} failed`);
  } catch (error) {
    setOutput(`${label} failed before it could start:\n${error.message}`);
    setStatus(`${label} failed`);
  } finally {
    setDisabled(buttons, false);
  }
}

function renderCommandResult(label, result) {
  const lines = [
    `${label}: ${result.ok ? "OK" : "FAILED"}`,
    `Command: ${(result.command || []).join(" ")}`,
    `Return code: ${result.returncode ?? "none"}`,
  ];
  if (result.stdout) {
    lines.push("", "stdout:", result.stdout.trimEnd());
  }
  if (result.stderr) {
    lines.push("", "stderr:", result.stderr.trimEnd());
  }
  if (result.restartLauncher) {
    lines.push("", "Restart the launcher before reopening the editor.");
  }
  setOutput(lines.join("\n"));
}

function selectedModId() {
  return controls().modSelect.value.trim();
}

function commandButtons() {
  return [
    ...COMMANDS.map(([id]) => document.querySelector(`#${id}`)),
    controls().dumpBaseButton,
  ];
}

function setDisabled(buttons, disabled) {
  for (const button of buttons) {
    button.disabled = disabled;
  }
}

function clearValidateIndicator() {
  controls().validateIndicator.hidden = true;
}

function setOutput(text) {
  controls().output.textContent = text;
}

function setStatus(text) {
  if (statusCallback) {
    statusCallback(text);
  }
}

function controls() {
  return {
    baseDumpSection: document.querySelector("#baseDumpSection"),
    closeButton: document.querySelector("#modMenuCloseButton"),
    dumpBaseButton: document.querySelector("#dumpBaseOverworldButton"),
    modSelect: document.querySelector("#modSelect"),
    newModInput: document.querySelector("#newModId"),
    openButton: document.querySelector("#modMenuButton"),
    output: document.querySelector("#modCommandOutput"),
    overlay: document.querySelector("#modMenuOverlay"),
    validateIndicator: document.querySelector("#validateModIndicator"),
  };
}
