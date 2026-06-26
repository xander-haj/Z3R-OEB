/**
 * Tabbed guide dialog controls for the Overworld Workbench.
 */

const PROPERTY_GUIDE_URL = "./PROPERTIES_PANEL_GUIDE.md";

const WORKFLOW_SECTIONS = [
  {
    id: "project-menu",
    title: "Project Menu",
    lines: [
      "Use the hamburger button at the left of Undo and Redo to open the Project Menu.",
      "",
      "- `Select mod` chooses the active mod package for save, validate, build, apply, and dump commands.",
      "- `Create new mod` creates a new package id, then the selector switches to that mod.",
      "- `Save` writes the current sparse editor changes into the selected mod package.",
      "- `Load Base` reloads the base dumped overworld assets without selecting a generated preview.",
      "- `Validate Mod` runs mod validation. A green check appears beside it when validation passes.",
      "- `Build Mod` builds the selected mod package into generated local assets.",
      "- `Apply Overworld Mod` applies the selected mod to the ROM asset flow.",
      "- `Dump Base Overworld` refreshes `assets/overworld_dump` from the base ROM asset flow.",
      "- `Dump Editor Assets` runs `python3 assets/restool.py --editor-assets` for `assets/dat-dump`.",
      "- `Dump Selected Mod Overworld` refreshes dumped overworld assets for the selected mod.",
      "",
      "After applying or dumping overworld assets, restart the launcher before reopening the editor.",
    ],
  },
  {
    id: "select-paint",
    title: "Select And Paint",
    lines: [
      "`Select` mode is for inspecting and choosing source tiles, sprites, and markers.",
      "",
      "- Click a terrain tile to inspect it and make it the active Properties selection.",
      "- Right-click a terrain tile in Select mode and choose `Save Tile To Assets` to store it.",
      "- Pick saved terrain or sprite assets from the left Assets tab.",
      "- Use the world buttons to choose Light, Dark, or Special before working in that atlas group.",
      "- Use the Map32, Map16, and Map8 toolbar buttons to choose the inspection grid size.",
      "- Use the sprite and marker buttons above the canvas to make those selectable overlays visible.",
      "",
      "`Paint` mode is for placing the currently selected saved asset.",
      "",
      "- Select a saved terrain tile, sprite, or navigation marker asset first.",
      "- Switch to Paint mode with the brush button.",
      "- Use Project Menu settings to choose right-click confirmation or instant left-click paint.",
      "- In confirmation mode, right-click the destination and choose the paint action.",
      "- Use Undo and Redo before saving if a placement is wrong.",
      "- Press Save in the Project Menu to write the sparse patch JSON into the selected mod.",
    ],
  },
  {
    id: "multi-select",
    title: "Multi-Select",
    lines: [
      "Multi-select is for batch Map32 terrain transforms.",
      "",
      "- Set the inspection grid to `Map32` first.",
      "- Hold Command on macOS, or hold Alt, then drag across map cells on the canvas.",
      "- Multi-selected cells draw with the cyan batch-selection overlay.",
      "- The yellow outline remains the active inspected cell.",
      "- Use `Left`, `Right`, `Flip H`, or `Flip V` in Properties to transform every selected cell.",
      "- A normal single click clears the multi-selection because the editor returns to one active selection.",
      "",
      "Multi-select does not paint terrain directly. It targets the transform buttons only.",
    ],
  },
];

let guideSections = [];
let selectedGuideId = "";
let guideInitialized = false;

/**
 * Bind the guide dialog controls without coupling them to editor state.
 */
export function bindGuideControls() {
  const elements = guideElements();
  if (!elements.button || !elements.overlay || !elements.closeButton) {
    return;
  }
  elements.button.addEventListener("click", openGuide);
  elements.closeButton.addEventListener("click", closeGuide);
  elements.overlay.addEventListener("click", (event) => {
    if (event.target === elements.overlay) {
      closeGuide();
    }
  });
  window.addEventListener("keydown", handleGuideKeydown);
  initializeGuide();
}

function initializeGuide() {
  if (guideInitialized) {
    return;
  }
  guideInitialized = true;
  setGuideSections(WORKFLOW_SECTIONS);
  loadPropertiesGuide();
}

async function loadPropertiesGuide() {
  try {
    const response = await fetch(PROPERTY_GUIDE_URL, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Unable to load ${PROPERTY_GUIDE_URL}`);
    }
    const markdown = await response.text();
    setGuideSections([...WORKFLOW_SECTIONS, ...propertySections(markdown)]);
  } catch (error) {
    setGuideSections([...WORKFLOW_SECTIONS, {
      id: "properties-guide-error",
      title: "Properties Guide",
      lines: [`The properties guide could not be loaded: ${error.message}`],
    }]);
  }
}

function setGuideSections(sections) {
  guideSections = sections;
  if (!selectedGuideId || !guideSections.some((section) => section.id === selectedGuideId)) {
    selectedGuideId = guideSections[0]?.id || "";
  }
  renderGuideTabs();
  renderGuideContent();
}

function renderGuideTabs() {
  const { tabs } = guideElements();
  if (!tabs) {
    return;
  }
  tabs.innerHTML = "";
  tabs.setAttribute("role", "tablist");
  for (const section of guideSections) {
    const button = document.createElement("button");
    const active = section.id === selectedGuideId;
    button.type = "button";
    button.className = active ? "guide-tab active" : "guide-tab";
    button.id = `guideTab-${section.id}`;
    button.setAttribute("role", "tab");
    button.setAttribute("aria-selected", active ? "true" : "false");
    button.setAttribute("aria-controls", "guideContent");
    button.textContent = section.title;
    button.addEventListener("click", () => selectGuideSection(section.id));
    tabs.append(button);
  }
}

function selectGuideSection(sectionId) {
  selectedGuideId = sectionId;
  renderGuideTabs();
  renderGuideContent();
  guideElements().content?.focus();
}

function renderGuideContent() {
  const { content } = guideElements();
  const section = guideSections.find((item) => item.id === selectedGuideId);
  if (!content || !section) {
    return;
  }
  content.innerHTML = "";
  content.setAttribute("role", "tabpanel");
  content.setAttribute("aria-labelledby", `guideTab-${section.id}`);
  const title = document.createElement("h3");
  title.textContent = section.title;
  content.append(title);
  renderMarkdownLines(section.lines, content);
  content.scrollTop = 0;
}

function propertySections(markdown) {
  const lines = markdown.replace(/\r/g, "").split("\n");
  const sections = [];
  let current = { title: "Overview", lines: [] };
  for (const line of lines) {
    const heading = line.match(/^##\s+(.+)$/);
    if (heading) {
      pushPropertySection(sections, current);
      current = { title: propertyTabTitle(heading[1].trim()), lines: [] };
    } else {
      current.lines.push(line);
    }
  }
  pushPropertySection(sections, current);
  return sections;
}

function propertyTabTitle(title) {
  return title === "Properties" ? "General Properties" : title;
}

function pushPropertySection(sections, section) {
  if (!section.lines.some((line) => line.trim())) {
    return;
  }
  sections.push({
    id: slug(`properties-${section.title}`),
    title: section.title,
    lines: section.lines,
  });
}

function renderMarkdownLines(lines, target) {
  for (let index = 0; index < lines.length;) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
    } else if (/^#{1,4}\s+/.test(line)) {
      target.append(markdownHeading(line));
      index += 1;
    } else if (line.startsWith("- ")) {
      const result = markdownList(lines, index);
      target.append(result.node);
      index = result.nextIndex;
    } else {
      const result = markdownParagraph(lines, index);
      target.append(result.node);
      index = result.nextIndex;
    }
  }
}

function markdownHeading(line) {
  const heading = document.createElement("h4");
  appendInline(heading, line.replace(/^#{1,4}\s+/, ""));
  return heading;
}

function markdownList(lines, startIndex) {
  const list = document.createElement("ul");
  let index = startIndex;
  while (index < lines.length && lines[index].startsWith("- ")) {
    const item = document.createElement("li");
    let text = lines[index].slice(2).trim();
    index += 1;
    while (index < lines.length && isContinuation(lines[index])) {
      text += ` ${lines[index].trim()}`;
      index += 1;
    }
    appendInline(item, text);
    list.append(item);
  }
  return { node: list, nextIndex: index };
}

function markdownParagraph(lines, startIndex) {
  const paragraph = document.createElement("p");
  let text = "";
  let index = startIndex;
  while (index < lines.length && canContinueParagraph(lines[index])) {
    text = text ? `${text} ${lines[index].trim()}` : lines[index].trim();
    index += 1;
  }
  appendInline(paragraph, text);
  return { node: paragraph, nextIndex: index };
}

function isContinuation(line) {
  return Boolean(line.trim()) && !line.startsWith("- ") && !/^#{1,4}\s+/.test(line);
}

function canContinueParagraph(line) {
  return Boolean(line.trim()) && !line.startsWith("- ") && !/^#{1,4}\s+/.test(line);
}

function appendInline(parent, text) {
  for (const part of text.split(/(`[^`]+`)/g)) {
    if (!part) {
      continue;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      const code = document.createElement("code");
      code.textContent = part.slice(1, -1);
      parent.append(code);
    } else {
      parent.append(document.createTextNode(part));
    }
  }
}

function slug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function openGuide() {
  const { button, overlay, closeButton } = guideElements();
  initializeGuide();
  overlay.hidden = false;
  button.setAttribute("aria-expanded", "true");
  closeButton.focus();
}

function closeGuide() {
  const { button, overlay } = guideElements();
  overlay.hidden = true;
  button.setAttribute("aria-expanded", "false");
  button.focus();
}

function handleGuideKeydown(event) {
  const { overlay } = guideElements();
  if (!overlay || overlay.hidden) {
    return;
  }
  if (event.key === "Escape") {
    closeGuide();
  } else if (event.key === "Tab") {
    trapGuideFocus(event, overlay);
  }
}

function trapGuideFocus(event, overlay) {
  const selector = "button, [href], input, select, textarea, [tabindex]";
  const focusable = [...overlay.querySelectorAll(selector)];
  const available = focusable.filter((element) => !element.disabled && element.tabIndex >= 0);
  if (!available.length) {
    event.preventDefault();
    return;
  }
  const first = available[0];
  const last = available[available.length - 1];
  if (!overlay.contains(document.activeElement)) {
    event.preventDefault();
    first.focus();
  } else if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function guideElements() {
  return {
    button: document.querySelector("#guideButton"),
    closeButton: document.querySelector("#guideCloseButton"),
    content: document.querySelector("#guideContent"),
    overlay: document.querySelector("#guideOverlay"),
    tabs: document.querySelector("#guideTabs"),
  };
}
