/**
 * Developer console overlay that records full status/error strings shown in the top bar.
 */

const MAX_LOGS = 500;
const logEntries = [];
let initialized = false;

/**
 * Record one status line and refresh the console output when the panel exists.
 *
 * Parameters:
 *   message: Status or error text to record.
 * Returns:
 *   None.
 */
export function recordStatusLog(message) {
  initializeDevConsole();
  appendLog(String(message ?? ""));
}

/**
 * Append one line to the bounded log buffer.
 *
 * Parameters:
 *   message: Text to append without timestamp decoration.
 * Returns:
 *   None.
 */
function appendLog(message) {
  logEntries.push(`[${timestamp()}] ${message}`);
  while (logEntries.length > MAX_LOGS) {
    logEntries.shift();
  }
  renderLogOutput();
}

/**
 * Create and bind the floating console controls once.
 *
 * Parameters: none.
 * Returns:
 *   None.
 */
function initializeDevConsole() {
  if (initialized || !document.body) {
    return;
  }
  initialized = true;
  document.body.append(buildConsoleButton(), buildConsoleOverlay());
  window.addEventListener("keydown", closeOnEscape);
  window.addEventListener("error", recordWindowError);
  window.addEventListener("unhandledrejection", recordUnhandledRejection);
}

/**
 * Build the floating icon button placed beside the guide button.
 *
 * Parameters: none.
 * Returns:
 *   Button element.
 */
function buildConsoleButton() {
  const button = document.createElement("button");
  button.id = "devConsoleButton";
  button.className = "dev-console-button";
  button.type = "button";
  button.setAttribute("aria-controls", "devConsoleOverlay");
  button.setAttribute("aria-expanded", "false");
  button.setAttribute("aria-label", "Open dev console");
  button.title = "Dev console";
  button.innerHTML = terminalIcon();
  button.addEventListener("click", openConsole);
  return button;
}

/**
 * Build the modal console panel and its copy/close controls.
 *
 * Parameters: none.
 * Returns:
 *   Overlay element.
 */
function buildConsoleOverlay() {
  const overlay = document.createElement("div");
  overlay.id = "devConsoleOverlay";
  overlay.className = "dev-console-overlay";
  overlay.hidden = true;
  overlay.innerHTML = `
    <aside class="dev-console-panel" role="dialog" aria-modal="true" aria-labelledby="devConsoleTitle">
      <header class="dev-console-header">
        <h2 id="devConsoleTitle">Dev Console</h2>
        <div class="dev-console-actions">
          <button class="dev-console-copy" type="button" aria-label="Copy console output" title="Copy logs">
            ${copyIcon()}
          </button>
          <button class="dev-console-close" type="button" aria-label="Close dev console" title="Close">
            ${closeIcon()}
          </button>
        </div>
      </header>
      <pre id="devConsoleOutput" class="dev-console-terminal" tabindex="0"></pre>
    </aside>
  `;
  overlay.addEventListener("pointerdown", closeFromBackdrop);
  overlay.querySelector(".dev-console-copy").addEventListener("click", copyLogs);
  overlay.querySelector(".dev-console-close").addEventListener("click", closeConsole);
  return overlay;
}

/**
 * Open the console overlay and move focus to the terminal output.
 *
 * Parameters: none.
 * Returns:
 *   None.
 */
function openConsole() {
  const overlay = document.querySelector("#devConsoleOverlay");
  const button = document.querySelector("#devConsoleButton");
  if (!overlay || !button) {
    return;
  }
  renderLogOutput();
  overlay.hidden = false;
  button.setAttribute("aria-expanded", "true");
  document.querySelector("#devConsoleOutput")?.focus();
}

/**
 * Close the console overlay and return focus to the floating button.
 *
 * Parameters: none.
 * Returns:
 *   None.
 */
function closeConsole() {
  const overlay = document.querySelector("#devConsoleOverlay");
  const button = document.querySelector("#devConsoleButton");
  if (!overlay || !button) {
    return;
  }
  overlay.hidden = true;
  button.setAttribute("aria-expanded", "false");
  button.focus();
}

/**
 * Render all recorded logs into the terminal element.
 *
 * Parameters: none.
 * Returns:
 *   None.
 */
function renderLogOutput() {
  const output = document.querySelector("#devConsoleOutput");
  if (!output) {
    return;
  }
  output.textContent = logEntries.length ? logEntries.join("\n") : "No logs recorded yet.";
  output.scrollTop = output.scrollHeight;
}

/**
 * Copy the terminal text using the browser clipboard API.
 *
 * Parameters: none.
 * Returns:
 *   Promise resolving after the copy attempt.
 */
async function copyLogs() {
  const text = logEntries.join("\n");
  try {
    await copyText(text);
    appendLog("Copied dev console output.");
  } catch (error) {
    appendLog(`Unable to copy dev console output: ${error.message}`);
  }
}

/**
 * Copy text through the Clipboard API or a textarea fallback.
 *
 * Parameters:
 *   text: Text to copy.
 * Returns:
 *   Promise resolving after the copy action.
 */
async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  fallbackCopyText(text);
}

/**
 * Copy text through a temporary hidden textarea for older browser contexts.
 *
 * Parameters:
 *   text: Text to copy.
 * Returns:
 *   None.
 */
function fallbackCopyText(text) {
  const field = document.createElement("textarea");
  field.value = text;
  field.setAttribute("readonly", "true");
  field.style.position = "fixed";
  field.style.left = "-9999px";
  document.body.append(field);
  field.select();
  document.execCommand("copy");
  field.remove();
}

/**
 * Close the console when the user clicks outside the panel.
 *
 * Parameters:
 *   event: Pointer event from the overlay.
 * Returns:
 *   None.
 */
function closeFromBackdrop(event) {
  if (event.target?.id === "devConsoleOverlay") {
    closeConsole();
  }
}

/**
 * Close the console with Escape while it is open.
 *
 * Parameters:
 *   event: Keyboard event.
 * Returns:
 *   None.
 */
function closeOnEscape(event) {
  const overlay = document.querySelector("#devConsoleOverlay");
  if (event.key === "Escape" && overlay && !overlay.hidden) {
    closeConsole();
  }
}

/**
 * Record uncaught browser errors in the same console stream as status messages.
 *
 * Parameters:
 *   event: Window error event.
 * Returns:
 *   None.
 */
function recordWindowError(event) {
  appendLog(`Error: ${event.message || "Unknown browser error"}`);
}

/**
 * Record unhandled Promise failures in the developer console.
 *
 * Parameters:
 *   event: Promise rejection event.
 * Returns:
 *   None.
 */
function recordUnhandledRejection(event) {
  const reason = event.reason?.message || event.reason || "Unknown promise rejection";
  appendLog(`Unhandled rejection: ${reason}`);
}

/**
 * Return a compact local timestamp for log lines.
 *
 * Parameters: none.
 * Returns:
 *   HH:MM:SS timestamp.
 */
function timestamp() {
  return new Date().toLocaleTimeString([], { hour12: false });
}

/**
 * Return the terminal icon used by the floating console button.
 *
 * Parameters: none.
 * Returns:
 *   SVG markup string.
 */
function terminalIcon() {
  return `
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M4 5h16v14H4z"></path>
      <path d="M7 9l3 3-3 3"></path>
      <path d="M12 15h5"></path>
    </svg>
  `;
}

/**
 * Return the copy icon used by the console action button.
 *
 * Parameters: none.
 * Returns:
 *   SVG markup string.
 */
function copyIcon() {
  return `
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <rect x="8" y="8" width="11" height="11" rx="1.5"></rect>
      <path d="M5 15V5h10"></path>
    </svg>
  `;
}

/**
 * Return the close icon used by the console action button.
 *
 * Parameters: none.
 * Returns:
 *   SVG markup string.
 */
function closeIcon() {
  return `
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M6 6l12 12"></path>
      <path d="M18 6L6 18"></path>
    </svg>
  `;
}

initializeDevConsole();
