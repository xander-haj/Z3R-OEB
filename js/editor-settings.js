/**
 * Persisted local editor input settings for the Overworld Workbench.
 */

const STORAGE_KEY = "zelda3.overworldEditor.settings.v1";

const DEFAULT_SHORTCUTS = {
  redo: "Ctrl + Shift + Z",
  undo: "Ctrl + Z",
  zoomIn: "Ctrl + =",
  zoomOut: "Ctrl + -",
};

const DEFAULT_SETTINGS = {
  keyboardPan: true,
  paintActivation: "confirm",
  paintPanGesture: "drag",
  shortcuts: DEFAULT_SHORTCUTS,
};

/**
 * Return normalized editor settings from localStorage.
 */
export function currentEditorSettings() {
  try {
    return normalizeSettings(JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"));
  } catch (error) {
    return normalizeSettings({});
  }
}

/**
 * Bind the settings controls hosted by the Project Menu.
 */
export function bindEditorSettingsControls(actions = {}) {
  const form = controls();
  if (!form.paintActivation || form.paintActivation.dataset.settingsBound) {
    return;
  }
  syncControls(form, currentEditorSettings());
  form.paintActivation.addEventListener("change", () => saveFromControls(form, actions));
  form.paintPanGesture.addEventListener("change", () => saveFromControls(form, actions));
  form.keyboardPan.addEventListener("change", () => saveFromControls(form, actions));
  for (const [action, button] of Object.entries(form.shortcutButtons)) {
    button.addEventListener("click", () => startShortcutCapture(button));
    button.addEventListener("keydown", (event) => captureShortcut(event, action, form, actions));
  }
  form.resetShortcuts.addEventListener("click", () => resetShortcuts(form, actions));
  form.paintActivation.dataset.settingsBound = "true";
}

/**
 * Return the default shortcut map without exposing the shared constant for mutation.
 */
export function defaultShortcuts() {
  return { ...DEFAULT_SHORTCUTS };
}

/**
 * Convert a KeyboardEvent into the same canonical string stored in settings.
 */
export function shortcutFromEvent(event) {
  const key = shortcutKey(event);
  if (!key) {
    return "";
  }
  const parts = [];
  if (event.ctrlKey) parts.push("Ctrl");
  if (event.metaKey) parts.push("Meta");
  if (event.altKey) parts.push("Alt");
  if (event.shiftKey) parts.push("Shift");
  parts.push(key);
  return parts.join(" + ");
}

/**
 * Return whether a KeyboardEvent matches one saved shortcut string.
 */
export function shortcutMatches(event, shortcut) {
  return shortcutFromEvent(event) === normalizeShortcut(shortcut);
}

/**
 * Convert an optional shortcut value into display text.
 */
export function shortcutLabel(shortcut) {
  return normalizeShortcut(shortcut) || "Unassigned";
}

/**
 * Normalize partially missing or old saved settings.
 */
function normalizeSettings(settings) {
  const savedShortcuts = settings?.shortcuts || {};
  const result = {
    ...DEFAULT_SETTINGS,
    ...(settings || {}),
    shortcuts: { ...DEFAULT_SHORTCUTS },
  };
  if (!["confirm", "instant"].includes(result.paintActivation)) {
    result.paintActivation = DEFAULT_SETTINGS.paintActivation;
  }
  if (!["drag", "space-drag", "middle-drag"].includes(result.paintPanGesture)) {
    result.paintPanGesture = DEFAULT_SETTINGS.paintPanGesture;
  }
  for (const action of Object.keys(DEFAULT_SHORTCUTS)) {
    result.shortcuts[action] = normalizeShortcut(savedShortcuts[action] ?? result.shortcuts[action]) ||
      DEFAULT_SHORTCUTS[action];
  }
  result.keyboardPan = result.keyboardPan !== false;
  return result;
}

/**
 * Save current controls to localStorage and give the user lightweight feedback.
 */
function saveFromControls(form, actions) {
  const settings = normalizeSettings({
    keyboardPan: form.keyboardPan.checked,
    paintActivation: form.paintActivation.value,
    paintPanGesture: form.paintPanGesture.value,
    shortcuts: readShortcutControls(form),
  });
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    actions.setStatus?.("Editor settings saved");
  } catch (error) {
    actions.setStatus?.("Unable to save editor settings");
  }
}

/**
 * Populate DOM controls from normalized settings.
 */
function syncControls(form, settings) {
  form.paintActivation.value = settings.paintActivation;
  form.paintPanGesture.value = settings.paintPanGesture;
  form.keyboardPan.checked = settings.keyboardPan;
  for (const [action, button] of Object.entries(form.shortcutButtons)) {
    button.dataset.shortcut = settings.shortcuts[action];
    button.dataset.recording = "false";
    button.textContent = shortcutLabel(settings.shortcuts[action]);
  }
}

/**
 * Return all settings controls when the Project Menu has been created.
 */
function controls() {
  return {
    keyboardPan: document.querySelector("#keyboardPanInput"),
    paintActivation: document.querySelector("#paintActivationSelect"),
    paintPanGesture: document.querySelector("#paintPanGestureSelect"),
    resetShortcuts: document.querySelector("#resetShortcutsButton"),
    shortcutButtons: shortcutButtons(),
  };
}

/**
 * Return shortcut recorder buttons keyed by settings action id.
 */
function shortcutButtons() {
  return Object.fromEntries(
    Array.from(document.querySelectorAll("[data-shortcut-input]"))
      .map((button) => [button.dataset.shortcutInput, button]),
  );
}

/**
 * Put one shortcut button into capture mode until the next keydown.
 */
function startShortcutCapture(button) {
  button.dataset.recording = "true";
  button.textContent = "Press shortcut";
  button.focus();
}

/**
 * Store a captured shortcut unless it collides with another action.
 */
function captureShortcut(event, action, form, actions) {
  const button = form.shortcutButtons[action];
  if (button.dataset.recording !== "true") {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      startShortcutCapture(button);
    }
    return;
  }
  if (event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation();
    syncControls(form, currentEditorSettings());
    return;
  }
  const shortcut = shortcutFromEvent(event);
  if (!shortcut) {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  if (shortcutInUse(action, shortcut, form)) {
    actions.setStatus?.("Shortcut is already assigned");
    syncControls(form, currentEditorSettings());
    return;
  }
  button.dataset.shortcut = shortcut;
  saveFromControls(form, actions);
  syncControls(form, currentEditorSettings());
}

/**
 * Restore shortcut controls to the built-in defaults.
 */
function resetShortcuts(form, actions) {
  for (const [action, shortcut] of Object.entries(DEFAULT_SHORTCUTS)) {
    form.shortcutButtons[action].dataset.shortcut = shortcut;
  }
  saveFromControls(form, actions);
  syncControls(form, currentEditorSettings());
}

/**
 * Read shortcut values from recorder buttons.
 */
function readShortcutControls(form) {
  return Object.fromEntries(
    Object.entries(form.shortcutButtons)
      .map(([action, button]) => [action, button.dataset.shortcut || DEFAULT_SHORTCUTS[action]]),
  );
}

/**
 * Prevent two actions from claiming the same keyboard shortcut.
 */
function shortcutInUse(action, shortcut, form) {
  return Object.entries(form.shortcutButtons)
    .some(([otherAction, button]) => otherAction !== action && button.dataset.shortcut === shortcut);
}

/**
 * Normalize shortcut strings to the same ordering produced by KeyboardEvent capture.
 */
function normalizeShortcut(shortcut) {
  const value = String(shortcut || "").trim();
  if (!value) {
    return "";
  }
  const tokens = value.split("+").map((part) => part.trim()).filter(Boolean);
  const modifiers = new Set();
  let key = "";
  for (const token of tokens) {
    const normalized = normalizeToken(token);
    if (["Ctrl", "Meta", "Alt", "Shift"].includes(normalized)) {
      modifiers.add(normalized);
    } else {
      key = normalized;
    }
  }
  return [...["Ctrl", "Meta", "Alt", "Shift"].filter((part) => modifiers.has(part)), key]
    .filter(Boolean)
    .join(" + ");
}

/**
 * Convert one user-facing token into canonical casing.
 */
function normalizeToken(token) {
  const lower = token.toLowerCase();
  return {
    cmd: "Meta",
    command: "Meta",
    control: "Ctrl",
    ctrl: "Ctrl",
    option: "Alt",
  }[lower] || (token.length === 1 ? token.toUpperCase() : token);
}

/**
 * Return the non-modifier key portion of a KeyboardEvent shortcut.
 */
function shortcutKey(event) {
  if (["Alt", "Control", "Meta", "Shift"].includes(event.key)) {
    return "";
  }
  if (event.code?.startsWith("Key")) {
    return event.code.slice(3);
  }
  if (event.code?.startsWith("Digit")) {
    return event.code.slice(5);
  }
  const codeKey = {
    Backquote: "`",
    Backslash: "\\",
    BracketLeft: "[",
    BracketRight: "]",
    Comma: ",",
    Equal: "=",
    Minus: "-",
    Period: ".",
    Quote: "'",
    Semicolon: ";",
    Slash: "/",
  }[event.code];
  if (codeKey) {
    return codeKey;
  }
  return { " ": "Space" }[event.key] || event.key;
}
