/**
 * Side panel tab and collapse behavior for the Workbench.
 */

let redrawLayout = null;

/**
 * Bind left tabs and both side-panel minimize controls.
 *
 * Parameters:
 *   redraw: Optional callback used after layout-affecting changes.
 * Returns:
 *   None.
 */
export function bindSidePanels(redraw = null) {
  redrawLayout = redraw;
  for (const button of document.querySelectorAll("[data-left-tab]")) {
    button.addEventListener("click", () => openLeftPanel(button.dataset.leftTab));
  }
  for (const button of document.querySelectorAll("[data-right-tab]")) {
    button.addEventListener("click", () => openRightPanel(button.dataset.rightTab));
  }
  document.querySelector("#leftPanelToggle").addEventListener("click", closeLeftPanel);
  document.querySelector("#rightPanelToggle").addEventListener("click", closeRightPanel);
  document.querySelector("#openPropertiesButton").addEventListener("click", () => openRightPanel("properties"));
  document.querySelector("#openAssetsButton").addEventListener("click", () => openLeftPanel("assets"));
  document.querySelector("#openLayersButton").addEventListener("click", () => openLeftPanel("layers"));
  openLeftPanel("assets");
  openRightPanel("properties");
}

/**
 * Open the left side menu on a specific tab.
 *
 * Parameters:
 *   tab: assets or layers.
 * Returns:
 *   None.
 */
export function openLeftPanel(tab) {
  const workspace = document.querySelector("#workspace");
  workspace.classList.remove("left-collapsed");
  for (const button of document.querySelectorAll("[data-left-tab]")) {
    button.classList.toggle("active", button.dataset.leftTab === tab);
  }
  for (const panel of document.querySelectorAll("[data-left-panel]")) {
    panel.hidden = panel.dataset.leftPanel !== tab;
  }
  refreshLayout();
}

/**
 * Open the left side menu on the Assets tab.
 *
 * Parameters: none.
 * Returns:
 *   None.
 */
export function openAssetsPanel() {
  openLeftPanel("assets");
}

/**
 * Open the right side menu on the Properties tab.
 *
 * Parameters: none.
 * Returns:
 *   None.
 */
export function openPropertiesPanel() {
  openRightPanel("properties");
}

/**
 * Hide the left side menu and expose canvas overlay buttons.
 *
 * Parameters: none.
 * Returns:
 *   None.
 */
function closeLeftPanel() {
  document.querySelector("#workspace").classList.add("left-collapsed");
  refreshLayout();
}

/**
 * Hide the right side menu and expose its canvas overlay button.
 *
 * Parameters: none.
 * Returns:
 *   None.
 */
function closeRightPanel() {
  document.querySelector("#workspace").classList.add("right-collapsed");
  refreshLayout();
}

/**
 * Open the right side menu on a specific tab.
 *
 * Parameters:
 *   tab: properties or patches.
 * Returns:
 *   None.
 */
function openRightPanel(tab = "properties") {
  const workspace = document.querySelector("#workspace");
  workspace.classList.remove("right-collapsed");
  for (const button of document.querySelectorAll("[data-right-tab]")) {
    button.classList.toggle("active", button.dataset.rightTab === tab);
  }
  for (const panel of document.querySelectorAll("[data-right-panel]")) {
    panel.hidden = panel.dataset.rightPanel !== tab;
  }
  refreshLayout();
}

/**
 * Redraw after the browser applies a side-panel layout change.
 *
 * Parameters: none.
 * Returns:
 *   None.
 */
function refreshLayout() {
  if (redrawLayout) {
    requestAnimationFrame(redrawLayout);
  }
}
