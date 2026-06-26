/**
 * Sub-tabs for the dense Properties panel.
 */

import { selectionHasDialogue } from "./dialogue-selection.js?v=20260625-dialogue-tab";

const STYLE_HREF = "../properties-panel-tabs.css?v=20260626-tab-toggle";
const TAB_DEFS = [
  ["general", "General", "Properties"],
  ["inspect", "Inspect", "Inspect"],
  ["map-header", "Map Header", "Map Header"],
  ["navigation-record", "Navigation Record", "Navigation Record"],
  ["gravestone", "Gravestone", "Gravestone"],
  ["navigation-allocation", "Navigation Allocation", "Navigation Allocation"],
  ["entrance-hole", "Entrance/Hole", "Entrance / Hole"],
  ["secret-item", "Secret Item", "Secret Item"],
  ["sprite-context", "Sprite Context", "Sprite Context"],
  ["special-visuals", "Special Visuals", "Special Visuals"],
  ["sprite-placement", "Sprite Placement", "Sprite Placement"],
  ["static-overlay", "Static Overlay", "Static Overlay"],
  ["tile", "Tile", "Tile"],
  ["dialogue", "Dialogue", "Dialogue"],
];

let boundState = null;

/**
 * Create the sub-tab strip and assign each Properties section to a tab.
 */
export function bindPropertyPanelTabs(state) {
  boundState = state;
  ensureStylesheet();
  prepareSections();
  const sections = sectionMap();
  const tabs = ensureTabStrip();
  const wanted = sections.has(state.propertySubtab) && tabAvailable(state.propertySubtab, state) ?
    state.propertySubtab : "general";
  state.propertySubtab = wanted;
  renderTabs(tabs, sections, state);
  activatePropertySubtab(state, wanted);
}

/**
 * Auto-open the useful tab when a marker selection has one obvious editor.
 */
export function syncPropertyPanelTab(state, info = state?.selected) {
  bindPropertyPanelTabs(state);
  const key = tabForSelection(info);
  if (key) {
    activatePropertySubtab(state, key);
  }
}

function prepareSections() {
  splitInspectorAndTileSections();
  addInlineHeading(".tile-transform-controls", "Transform", "property-transform-heading");
  addInlineHeading("[data-header-music-controls]", "Area Music", "property-area-music-heading");
  for (const [key, , heading] of TAB_DEFS) {
    const section = sectionByHeading(heading);
    if (section) {
      section.classList.add("property-subsection");
      section.dataset.propertyTab = key;
    }
  }
}

function splitInspectorAndTileSections() {
  const inspector = document.querySelector("#inspectorRows");
  const inspectSection = inspector?.closest("section");
  if (!inspectSection) {
    return;
  }
  const heading = inspectSection.querySelector("h2");
  if (heading) {
    heading.textContent = "Inspect";
  }
  inspectSection.dataset.propertyTab = "inspect";
  const tileControls = document.querySelector("[data-tile-attribute-controls]");
  if (!tileControls) {
    return;
  }
  const tileSection = ensureTileSection(inspectSection);
  tileSection.append(tileControls);
}

function ensureTileSection(inspectSection) {
  const panel = propertiesPanel();
  let section = panel.querySelector("[data-property-tile-section]");
  if (section) {
    return section;
  }
  section = document.createElement("section");
  section.dataset.propertyTileSection = "true";
  section.dataset.propertyTab = "tile";
  section.className = "property-subsection";
  const heading = document.createElement("h2");
  heading.textContent = "Tile";
  section.append(heading);
  inspectSection.insertAdjacentElement("afterend", section);
  return section;
}

function addInlineHeading(selector, text, markerClass) {
  const target = document.querySelector(selector);
  if (!target || target.previousElementSibling?.classList.contains(markerClass)) {
    return;
  }
  const heading = document.createElement("h3");
  heading.className = `property-field-heading ${markerClass}`;
  heading.textContent = text;
  target.parentNode.insertBefore(heading, target);
}

function ensureTabStrip() {
  const shell = ensureTabControls();
  let tabs = shell.querySelector("[data-property-tabs]");
  if (tabs) {
    return tabs;
  }
  tabs = document.createElement("div");
  tabs.className = "property-subtabs";
  tabs.dataset.propertyTabs = "true";
  tabs.setAttribute("role", "tablist");
  tabs.setAttribute("aria-label", "Properties sections");
  shell.insertBefore(tabs, shell.firstElementChild);
  tabs.addEventListener("click", (event) => {
    const button = event.target.closest("[data-property-tab-button]");
    if (button) {
      activatePropertySubtab(boundState || {}, button.dataset.propertyTabButton);
    }
  });
  return tabs;
}

function renderTabs(tabs, sections, state) {
  tabs.innerHTML = "";
  const expanded = tabsExpanded(state);
  tabs.dataset.propertyTabsMode = expanded ? "expanded" : "compact";
  for (const [key, label] of TAB_DEFS) {
    if (!sections.has(key) || !tabAvailable(key, state)) {
      continue;
    }
    if (!expanded && key !== state.propertySubtab) {
      continue;
    }
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.propertyTabButton = key;
    button.textContent = label;
    button.setAttribute("role", "tab");
    button.setAttribute("aria-controls", sectionId(key));
    button.classList.toggle("active", state.propertySubtab === key);
    tabs.append(button);
  }
  updateTabToggle(state);
}

/**
 * Activate a Properties subtab and keep compact tab mode pointed at the active button.
 */
function activatePropertySubtab(state, key) {
  const sections = sectionMap();
  if (!sections.has(key) || !tabAvailable(key, state)) {
    return;
  }
  state.propertySubtab = key;
  for (const [sectionKey, section] of sections) {
    section.hidden = sectionKey !== key;
    section.id = section.id || sectionId(sectionKey);
  }
  for (const button of document.querySelectorAll("[data-property-tab-button]")) {
    const active = button.dataset.propertyTabButton === key;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", active ? "true" : "false");
  }
  if (!tabsExpanded(state)) {
    renderTabs(document.querySelector("[data-property-tabs]"), sections, state);
  }
  updateTabToggle(state);
}

/**
 * Create the sticky tab/toggle shell once at the top of the Properties panel.
 */
function ensureTabControls() {
  const panel = propertiesPanel();
  let shell = panel.querySelector("[data-property-tab-controls]");
  if (shell) {
    return shell;
  }
  shell = document.createElement("div");
  shell.className = "property-tab-controls";
  shell.dataset.propertyTabControls = "true";
  panel.insertBefore(shell, panel.firstElementChild);
  shell.append(tabToggleButton());
  return shell;
}

/**
 * Build the compact/expanded tab visibility toggle.
 */
function tabToggleButton() {
  const button = document.createElement("button");
  button.className = "property-tab-toggle";
  button.dataset.propertyTabToggle = "true";
  button.type = "button";
  button.addEventListener("click", () => {
    if (!boundState) {
      return;
    }
    boundState.propertyTabsExpanded = !tabsExpanded(boundState);
    renderTabs(document.querySelector("[data-property-tabs]"), sectionMap(), boundState);
  });
  return button;
}

/**
 * Keep the toggle label and expanded state synchronized with Workbench state.
 */
function updateTabToggle(state) {
  const button = document.querySelector("[data-property-tab-toggle]");
  if (!button) {
    return;
  }
  const expanded = tabsExpanded(state);
  const label = expanded ? "Compact property tabs" : "Expand property tabs";
  button.replaceChildren(arrowIcon(expanded));
  button.setAttribute("aria-label", label);
  button.setAttribute("aria-expanded", expanded ? "true" : "false");
  button.title = label;
}

/**
 * Default to the current full tab strip unless the user explicitly compacted it.
 */
function tabsExpanded(state) {
  return state?.propertyTabsExpanded !== false;
}

/**
 * Build the up/down arrow glyph for the compact/expanded tab toggle.
 */
function arrowIcon(expanded) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("viewBox", "0 0 24 24");
  path.setAttribute("d", expanded ? "M6 15l6-6 6 6" : "M6 9l6 6 6-6");
  svg.append(path);
  return svg;
}

function tabForSelection(info) {
  if (info?.kind === "sprite" || info?.kind === "enemy") {
    if (selectionHasDialogue(info, boundState?.editorDb)) {
      return "dialogue";
    }
    return "sprite-placement";
  }
  if (info?.kind === "interaction") {
    if (info.layer === "gravestones") {
      return "gravestone";
    }
    if (info.interactionList === "items") {
      return "secret-item";
    }
    if (info.navigationList === "entrances" || info.navigationList === "holes") {
      return "entrance-hole";
    }
    if (info.navigationList === "travel" || info.navigationList === "exits") {
      return "navigation-record";
    }
  }
  if (info?.kind === "tile" && Number.isFinite(info.specialSlot)) {
    return "special-visuals";
  }
  return null;
}

function tabAvailable(key, state) {
  return key !== "dialogue" || selectionHasDialogue(state?.selected, state?.editorDb);
}

function sectionMap() {
  const result = new Map();
  for (const [key] of TAB_DEFS) {
    const section = propertiesPanel().querySelector(`[data-property-tab="${key}"]`);
    if (section) {
      result.set(key, section);
    }
  }
  return result;
}

function sectionByHeading(text) {
  for (const section of propertiesPanel().querySelectorAll(":scope > section")) {
    if (section.querySelector("h2")?.textContent.trim() === text) {
      return section;
    }
  }
  return null;
}

function sectionId(key) {
  return `property-section-${key}`;
}

function propertiesPanel() {
  return document.querySelector("#propertiesPanel");
}

function ensureStylesheet() {
  const href = new URL(STYLE_HREF, import.meta.url).toString();
  if (Array.from(document.querySelectorAll("link[rel='stylesheet']")).some((link) => link.href === href)) {
    return;
  }
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  document.head.append(link);
}
