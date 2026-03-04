/**
 * CatanSight - Resource Scarcity Analyzer
 * Shows per-resource pip totals in a collapsible side panel.
 */

CatanSight.ScarcityAnalyzer = {
  panel: null,
  enabled: true,
  collapsed: false,

  RESOURCE_COLORS: {
    lumber: "#2d6a1e",
    brick: "#c45a2c",
    wool: "#8bc34a",
    grain: "#ffc107",
    ore: "#78909c"
  },

  RESOURCE_ICONS: {
    lumber: "\u{1F332}",
    brick: "\u{1F9F1}",
    wool: "\u{1F411}",
    grain: "\u{1F33E}",
    ore: "\u{26F0}\uFE0F"
  },

  /**
   * Analyze board and render scarcity panel.
   */
  analyze(boardHexes) {
    const totals = { lumber: 0, brick: 0, wool: 0, grain: 0, ore: 0 };
    const pipValues = CatanSight.PipCalculator.PIP_VALUES;

    boardHexes.forEach(hex => {
      if (hex.resource === "desert") return;
      if (totals.hasOwnProperty(hex.resource)) {
        totals[hex.resource] += pipValues[hex.number] || 0;
      }
    });

    this._renderPanel(totals);
    return totals;
  },

  _renderPanel(totals) {
    if (!this.panel) this._createPanel();
    if (!this.enabled) return;

    const maxPips = Math.max(...Object.values(totals), 1);
    const sorted = Object.entries(totals).sort((a, b) => a[1] - b[1]);

    const body = this.panel.querySelector(".catansight-panel-body");
    body.innerHTML = sorted.map(([resource, pips]) => {
      const pct = (pips / maxPips) * 100;
      const label = pips <= 8 ? "SCARCE" : pips >= 14 ? "ABUNDANT" : "";
      const labelClass = pips <= 8 ? "catansight-scarce" : pips >= 14 ? "catansight-abundant" : "";

      return `
        <div class="catansight-scarcity-row">
          <span class="catansight-res-icon">${this.RESOURCE_ICONS[resource] || ""}</span>
          <span class="catansight-res-name">${resource.charAt(0).toUpperCase() + resource.slice(1)}</span>
          <div class="catansight-bar-track">
            <div class="catansight-bar-fill" style="width:${pct}%;background:${this.RESOURCE_COLORS[resource]}"></div>
          </div>
          <span class="catansight-res-pips">${pips}</span>
          ${label ? `<span class="catansight-res-label ${labelClass}">${label}</span>` : ""}
        </div>
      `;
    }).join("");
  },

  _createPanel() {
    this.panel = document.createElement("div");
    this.panel.className = "catansight-side-panel catansight-scarcity-panel";
    this.panel.innerHTML = `
      <div class="catansight-panel-header" data-panel="scarcity">
        <span class="catansight-panel-title">Resource Scarcity</span>
        <span class="catansight-panel-toggle">\u25BC</span>
      </div>
      <div class="catansight-panel-body"></div>
    `;

    // Collapse toggle
    const header = this.panel.querySelector(".catansight-panel-header");
    header.addEventListener("click", () => {
      this.collapsed = !this.collapsed;
      this.panel.classList.toggle("catansight-collapsed", this.collapsed);
      header.querySelector(".catansight-panel-toggle").textContent =
        this.collapsed ? "\u25B6" : "\u25BC";
    });

    this._getPanelContainer().appendChild(this.panel);
  },

  _getPanelContainer() {
    let container = document.getElementById("catansight-panels");
    if (!container) {
      container = document.createElement("div");
      container.id = "catansight-panels";
      container.className = "catansight-panels-container";
      document.body.appendChild(container);
    }
    return container;
  },

  setEnabled(enabled) {
    this.enabled = enabled;
    if (this.panel) {
      this.panel.style.display = enabled ? "" : "none";
    }
  },

  destroy() {
    if (this.panel) this.panel.remove();
    this.panel = null;
  }
};
