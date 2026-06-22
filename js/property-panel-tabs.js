/**
 * Sub-tabs for the dense Properties panel.
 */

const STYLE_HREF = "../properties-panel-tabs.css?v=20260621-properties-tabs";
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
  renderTabs(tabs, sections, state);
  const wanted = sections.has(state.propertySubtab) ? state.propertySubtab : "general";
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
  const panel = propertiesPanel();
  let tabs = panel.querySelector("[data-property-tabs]");
  if (tabs) {
    return tabs;
  }
  tabs = document.createElement("div");
  tabs.className = "property-subtabs";
  tabs.dataset.propertyTabs = "true";
  tabs.setAttribute("role", "tablist");
  tabs.setAttribute("aria-label", "Properties sections");
  panel.insertBefore(tabs, panel.firstElementChild);
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
  for (const [key, label] of TAB_DEFS) {
    if (!sections.has(key)) {
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
}

function activatePropertySubtab(state, key) {
  const sections = sectionMap();
  if (!sections.has(key)) {
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
}

function tabForSelection(info) {
  if (info?.kind === "sprite" || info?.kind === "enemy") {
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
