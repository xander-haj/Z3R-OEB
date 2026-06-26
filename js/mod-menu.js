/**
 * Center modal for mod package and local workflow commands.
 */

import {
  dumpBaseOverworld,
  dumpEditorAssets,
  overworldDumpStatus,
  runModWorkflow,
} from "./api.js?v=20260626-menu-polish";
import { bindEditorSettingsControls } from "./editor-settings.js?v=20260626-control-shortcuts";

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
  for (const button of document.querySelectorAll("[data-mod-menu-tab]")) {
    button.addEventListener("click", () => selectModMenuTab(button.dataset.modMenuTab));
  }
  bindEditorSettingsControls({ setStatus });
  for (const [buttonId, label, action] of COMMANDS) {
    document.querySelector(`#${buttonId}`).addEventListener("click", () => runSelectedModCommand(label, action));
  }
  controls().dumpBaseButton.addEventListener("click", runBaseDump);
  controls().dumpEditorAssetsButton.addEventListener("click", runEditorAssetsDump);
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
        <div class="modal-title-block">
          <h2 id="modMenuTitle">Project Menu</h2>
          <p id="baseDumpStatusText" class="modal-header-note"></p>
        </div>
        <div class="modal-header-actions">
          <button id="dumpBaseOverworldButton" class="menu-button-secondary" type="button">
            Dump Base Overworld
          </button>
          <button id="dumpEditorAssetsButton" class="menu-button-secondary" type="button">
            Dump Editor Assets
          </button>
          <button id="modMenuCloseButton" class="menu-button-muted" type="button"
            aria-label="Close project menu">Close</button>
        </div>
      </header>
      <div class="modal-tabs" role="tablist" aria-label="Project menu sections">
        <button id="modMenuModsTab" class="active" data-mod-menu-tab="mods" type="button"
          role="tab" aria-selected="true" aria-controls="modMenuModsPanel">Mods</button>
        <button id="modMenuControlsTab" data-mod-menu-tab="controls" type="button"
          role="tab" aria-selected="false" aria-controls="modMenuControlsPanel">Controls</button>
      </div>
      <div class="mod-menu-content">
        <section id="modMenuModsPanel" class="mod-menu-tab-panel" role="tabpanel"
          aria-labelledby="modMenuModsTab">
          <div class="mod-menu-grid">
            <section class="menu-card">
              <h3>Mod Package</h3>
              <label class="menu-field">
                <span class="menu-field-label">Select mod</span>
                <select id="modSelect"></select>
              </label>
              <label class="menu-field">
                <span class="menu-field-label">Create new mod</span>
                <input id="newModId" placeholder="new_mod_id">
              </label>
              <div class="menu-button-row">
                <button id="createModButton" class="menu-button-primary" type="button">Create</button>
                <button id="saveButton" class="menu-button-secondary" type="button">Save</button>
                <button id="baseButton" class="menu-button-muted" type="button">Load Base</button>
              </div>
            </section>
            <section class="menu-card">
              <h3>Mod Commands</h3>
              <div class="command-stack">
                <div class="command-group">
                  <span class="command-group-title">Check package</span>
                  <div class="command-grid">
                    <div class="command-row">
                      <button id="validateModButton" class="menu-button-secondary" type="button">
                        Validate Mod
                      </button>
                      <span id="validateModIndicator" class="success-indicator" hidden
                        aria-label="Validation passed">
                        <svg aria-hidden="true" viewBox="0 0 24 24">
                          <path d="M6 12.5l4 4L18 8"></path>
                        </svg>
                      </span>
                    </div>
                    <button id="buildModButton" class="menu-button-secondary" type="button">Build Mod</button>
                  </div>
                </div>
                <div class="command-group">
                  <span class="command-group-title">Generate outputs</span>
                  <div class="command-grid">
                    <button id="applyOverworldModButton" class="menu-button-primary" type="button">
                      Apply Overworld
                    </button>
                    <button id="dumpModOverworldButton" class="menu-button-secondary" type="button">
                      Dump Mod Overworld
                    </button>
                  </div>
                </div>
              </div>
              <p class="modal-note">After applying or dumping overworld assets, restart the launcher.</p>
              <pre id="modCommandOutput" class="command-output" aria-live="polite"></pre>
            </section>
          </div>
        </section>
        <section id="modMenuControlsPanel" class="mod-menu-tab-panel" role="tabpanel"
          aria-labelledby="modMenuControlsTab" hidden>
          <div class="controls-grid">
            <section class="menu-card settings-card">
              <h3>Pointer Controls</h3>
              <div class="settings-grid">
                <label class="menu-field">
                  <span class="menu-field-label">Paint click</span>
                  <select id="paintActivationSelect">
                    <option value="confirm">Right-click confirm menu</option>
                    <option value="instant">Instant left-click paint</option>
                  </select>
                </label>
                <label class="menu-field">
                  <span class="menu-field-label">Paint-mode pan</span>
                  <select id="paintPanGestureSelect">
                    <option value="drag">Left drag pans viewport</option>
                    <option value="space-drag">Space + left drag pans viewport</option>
                    <option value="middle-drag">Middle mouse drag pans viewport</option>
                  </select>
                </label>
                <label class="setting-check settings-check-wide">
                  <input id="keyboardPanInput" type="checkbox">
                  <span>WASD and arrow keys pan viewport</span>
                </label>
              </div>
            </section>
            <section class="menu-card shortcuts-card">
              <h3>Keyboard Shortcuts</h3>
              <div class="shortcut-grid">
                <label class="shortcut-field">
                  <span class="menu-field-label">Undo</span>
                  <button data-shortcut-input="undo" class="shortcut-input" type="button"></button>
                </label>
                <label class="shortcut-field">
                  <span class="menu-field-label">Redo</span>
                  <button data-shortcut-input="redo" class="shortcut-input" type="button"></button>
                </label>
                <label class="shortcut-field">
                  <span class="menu-field-label">Zoom in</span>
                  <button data-shortcut-input="zoomIn" class="shortcut-input" type="button"></button>
                </label>
                <label class="shortcut-field">
                  <span class="menu-field-label">Zoom out</span>
                  <button data-shortcut-input="zoomOut" class="shortcut-input" type="button"></button>
                </label>
              </div>
              <button id="resetShortcutsButton" class="menu-button-muted" type="button">Reset Shortcuts</button>
            </section>
          </div>
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
  focusActivePanel();
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

function selectModMenuTab(tab) {
  const activeTab = tab === "controls" ? "controls" : "mods";
  for (const button of document.querySelectorAll("[data-mod-menu-tab]")) {
    const active = button.dataset.modMenuTab === activeTab;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", active ? "true" : "false");
  }
  for (const panel of document.querySelectorAll(".mod-menu-tab-panel")) {
    panel.hidden = panel.id !== `modMenu${capitalize(activeTab)}Panel`;
  }
  focusActivePanel();
}

function focusActivePanel() {
  const visiblePanel = document.querySelector(".mod-menu-tab-panel:not([hidden])");
  const target = visiblePanel?.querySelector("select, input, button");
  target?.focus();
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

async function refreshDumpStatus() {
  try {
    const status = await overworldDumpStatus();
    controls().baseDumpStatus.textContent = status.exists ?
      "Base overworld dump exists. Run again after changing extracted overworld assets." :
      "Base overworld dump is missing. Run this before opening the editor data.";
  } catch (error) {
    controls().baseDumpStatus.textContent = "Unable to check base dump status.";
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

async function runEditorAssetsDump() {
  await runCommand("Dump editor assets", dumpEditorAssets, false);
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
    controls().dumpEditorAssetsButton,
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
    baseDumpStatus: document.querySelector("#baseDumpStatusText"),
    closeButton: document.querySelector("#modMenuCloseButton"),
    dumpBaseButton: document.querySelector("#dumpBaseOverworldButton"),
    dumpEditorAssetsButton: document.querySelector("#dumpEditorAssetsButton"),
    modSelect: document.querySelector("#modSelect"),
    newModInput: document.querySelector("#newModId"),
    openButton: document.querySelector("#modMenuButton"),
    output: document.querySelector("#modCommandOutput"),
    overlay: document.querySelector("#modMenuOverlay"),
    validateIndicator: document.querySelector("#validateModIndicator"),
  };
}
