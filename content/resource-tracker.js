/**
 * CatanSight - Resource Income Tracker
 * Tracks per-player resource income based on settlements/cities and dice rolls.
 */

CatanSight.ResourceTracker = {
  panel: null,
  enabled: true,
  collapsed: false,

  // Player data: { playerName: { settlements: [...], cities: [...], income: {...} } }
  players: {},

  // Track total resources received per player
  // { playerName: { lumber: 0, brick: 0, wool: 0, grain: 0, ore: 0 } }
  income: {},

  RESOURCE_ICONS: {
    lumber: "\u{1F332}",
    brick: "\u{1F9F1}",
    wool: "\u{1F411}",
    grain: "\u{1F33E}",
    ore: "\u{26F0}\uFE0F"
  },

  /**
   * Process a WebSocket message that might contain player/building data.
   */
  processMessage(message) {
    // Try to extract player placement events
    this._tryExtractPlacement(message);
    // Try to extract resource distribution events
    this._tryExtractDistribution(message);
  },

  _tryExtractPlacement(msg) {
    // Look for settlement/city build messages
    // Actual field names TBD from WS inspection
    const buildData = msg.payload || msg.data || msg;

    if (buildData.type === "build" || buildData.action === "build" ||
        buildData.type === "settlement" || buildData.type === "city") {
      const player = buildData.player || buildData.playerName || buildData.username;
      const type = buildData.buildingType || buildData.type || "settlement";
      const position = buildData.position || buildData.intersection || buildData.vertex;

      if (player && position !== undefined) {
        if (!this.players[player]) {
          this.players[player] = { settlements: [], cities: [] };
        }
        if (type === "city" || type === "City") {
          this.players[player].cities.push(position);
        } else {
          this.players[player].settlements.push(position);
        }
      }
    }
  },

  _tryExtractDistribution(msg) {
    // Look for resource distribution after dice rolls
    // Could be in game log parsing or WS messages
    const data = msg.payload || msg.data || msg;

    // Strategy: look for a distribution/resources object
    const dist = data.distribution || data.resources || data.gains;
    if (dist && typeof dist === "object") {
      Object.entries(dist).forEach(([player, resources]) => {
        if (!this.income[player]) {
          this.income[player] = { lumber: 0, brick: 0, wool: 0, grain: 0, ore: 0 };
        }
        if (typeof resources === "object") {
          Object.entries(resources).forEach(([res, count]) => {
            const normalized = this._normalizeResource(res);
            if (normalized && this.income[player].hasOwnProperty(normalized)) {
              this.income[player][normalized] += count;
            }
          });
        }
      });
      if (this.enabled) this._renderPanel();
    }
  },

  /**
   * Parse resource gains from game log text.
   * Called by content-script when game log entries mention resource gains.
   */
  addResourceFromLog(playerName, resource, count) {
    if (!this.income[playerName]) {
      this.income[playerName] = { lumber: 0, brick: 0, wool: 0, grain: 0, ore: 0 };
    }
    const normalized = this._normalizeResource(resource);
    if (normalized && this.income[playerName].hasOwnProperty(normalized)) {
      this.income[playerName][normalized] += count;
      if (this.enabled) this._renderPanel();
    }
  },

  _normalizeResource(raw) {
    if (!raw) return null;
    const lower = String(raw).toLowerCase();
    const map = {
      lumber: "lumber", wood: "lumber", forest: "lumber",
      brick: "brick", clay: "brick",
      wool: "wool", sheep: "wool",
      grain: "grain", wheat: "grain",
      ore: "ore", stone: "ore"
    };
    return map[lower] || null;
  },

  _renderPanel() {
    if (!this.panel) this._createPanel();
    if (!this.enabled) return;

    const body = this.panel.querySelector(".catansight-panel-body");
    const players = Object.entries(this.income);

    if (players.length === 0) {
      body.innerHTML = '<div class="catansight-no-data">No resource data yet</div>';
      return;
    }

    body.innerHTML = players.map(([player, resources]) => {
      const total = Object.values(resources).reduce((s, v) => s + v, 0);
      const resStr = Object.entries(resources)
        .filter(([, v]) => v > 0)
        .map(([res, count]) => `${this.RESOURCE_ICONS[res] || ""} ${count}`)
        .join("  ");

      return `
        <div class="catansight-player-row">
          <div class="catansight-player-name">${player} <span class="catansight-player-total">(${total})</span></div>
          <div class="catansight-player-resources">${resStr || "None yet"}</div>
        </div>
      `;
    }).join("");
  },

  _createPanel() {
    this.panel = document.createElement("div");
    this.panel.className = "catansight-side-panel catansight-resource-panel";
    this.panel.innerHTML = `
      <div class="catansight-panel-header" data-panel="resources">
        <span class="catansight-panel-title">Resource Income</span>
        <span class="catansight-panel-toggle">\u25BC</span>
        <span class="catansight-panel-close">\u00D7</span>
      </div>
      <div class="catansight-panel-body"></div>
    `;

    const header = this.panel.querySelector(".catansight-panel-header");
    const toggle = header.querySelector(".catansight-panel-toggle");
    const closeBtn = header.querySelector(".catansight-panel-close");

    toggle.addEventListener("click", (e) => {
      e.stopPropagation();
      this.collapsed = !this.collapsed;
      this.panel.classList.toggle("catansight-collapsed", this.collapsed);
      toggle.textContent = this.collapsed ? "\u25B6" : "\u25BC";
    });

    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.panel.style.display = "none";
    });

    CatanSight.PanelDragger.makeDraggable(this.panel, header);

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
    this.players = {};
    this.income = {};
  }
};
