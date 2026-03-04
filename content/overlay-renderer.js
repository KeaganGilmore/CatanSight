/**
 * CatanSight - Overlay Renderer
 * Renders pip count badges and tooltips over the colonist.io canvas.
 */

if (!window.CatanSight) window.CatanSight = {};

CatanSight.OverlayRenderer = {
  container: null,
  tooltipEl: null,
  calibrationPanel: null,
  badges: [],
  visible: true,
  enabled: true,
  resizeObserver: null,
  currentIntersections: null,
  opacity: 0.75,
  _cachedCanvas: null,

  // Calibration parameters
  offsetX: 0,
  offsetY: 0,
  boardFraction: 0.79,
  centerRatioX: 0.50,
  centerRatioY: 0.50,

  init() {
    this.container = document.createElement("div");
    this.container.id = "catansight-overlay";
    this.container.className = "catansight-overlay";
    document.body.appendChild(this.container);

    this.tooltipEl = document.createElement("div");
    this.tooltipEl.className = "catansight-tooltip";
    this.tooltipEl.style.display = "none";
    document.body.appendChild(this.tooltipEl);

    this._setupResizeObserver();
    this._loadCalibration();
  },

  render(enrichedIntersections) {
    if (!this.container) this.init();
    this.currentIntersections = enrichedIntersections;
    setTimeout(() => this._updateBadges(), 500);
  },

  _updateBadges() {
    this.clear();
    if (!this.enabled || !this.currentIntersections) return;

    const canvas = this._findCanvas();
    if (!canvas) {
      console.warn("[CatanSight] Canvas not found, retrying...");
      setTimeout(() => this._updateBadges(), 1000);
      return;
    }

    const rect = canvas.getBoundingClientRect();
    if (rect.width < 100 || rect.height < 100) {
      setTimeout(() => this._updateBadges(), 1000);
      return;
    }

    const transform = this._computeTransform(canvas);
    this.container.style.opacity = String(this.opacity);

    this.currentIntersections.forEach((inter) => {
      if (inter.pips === 0) return;

      const badge = document.createElement("div");
      badge.className = `catansight-pip-badge catansight-tier-${inter.tier}`;
      badge.textContent = inter.pips;

      const pos = transform(inter.x, inter.y);
      badge.style.left = `${pos.x}px`;
      badge.style.top = `${pos.y}px`;

      badge.addEventListener("mouseenter", (e) => this._showTooltip(e, inter));
      badge.addEventListener("mouseleave", () => this._hideTooltip());

      this.container.appendChild(badge);
      this.badges.push(badge);
    });
  },

  _findCanvas() {
    if (this._cachedCanvas && document.contains(this._cachedCanvas)) {
      return this._cachedCanvas;
    }

    const allCanvas = document.querySelectorAll("canvas");
    if (allCanvas.length === 0) return null;

    const gameCanvas = document.querySelector("#game-canvas");
    if (gameCanvas) {
      const c = gameCanvas.querySelector("canvas") ||
                (gameCanvas.tagName === "CANVAS" ? gameCanvas : null);
      if (c) {
        this._cachedCanvas = c;
        return c;
      }
    }

    const selectors = [
      ".game-canvas", "[class*='gameCanvas']", "[class*='game-board']",
      "[class*='GameCanvas']", "[class*='pixi']", "[class*='board']"
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) {
        const c = el.querySelector("canvas") || (el.tagName === "CANVAS" ? el : null);
        if (c) { this._cachedCanvas = c; return c; }
      }
    }

    const sorted = Array.from(allCanvas)
      .map(c => ({ el: c, area: c.getBoundingClientRect().width * c.getBoundingClientRect().height }))
      .filter(c => c.area > 10000)
      .sort((a, b) => b.area - a.area);

    if (sorted.length >= 2) { this._cachedCanvas = sorted[1].el; return sorted[1].el; }
    if (sorted.length >= 1) { this._cachedCanvas = sorted[0].el; return sorted[0].el; }
    return null;
  },

  _computeTransform(canvas) {
    const rect = canvas.getBoundingClientRect();

    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    this.currentIntersections.forEach(inter => {
      if (inter.x < minX) minX = inter.x;
      if (inter.x > maxX) maxX = inter.x;
      if (inter.y < minY) minY = inter.y;
      if (inter.y > maxY) maxY = inter.y;
    });

    const boardWidth = maxX - minX;
    const boardHeight = maxY - minY;
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    const usableWidth = rect.width * this.boardFraction;
    const usableHeight = rect.height * this.boardFraction;
    const scale = Math.min(usableWidth / boardWidth, usableHeight / boardHeight);

    const canvasCenterX = rect.left + rect.width * this.centerRatioX + this.offsetX;
    const canvasCenterY = rect.top + rect.height * this.centerRatioY + this.offsetY;

    return (nx, ny) => ({
      x: canvasCenterX + (nx - centerX) * scale,
      y: canvasCenterY + (ny - centerY) * scale
    });
  },

  // ── Calibration Panel ──────────────────────────────────

  toggleCalibration() {
    if (this.calibrationPanel) {
      this._closeCalibration();
    } else {
      this._openCalibration();
    }
  },

  _openCalibration() {
    if (this.calibrationPanel) return;

    const panel = document.createElement("div");
    panel.className = "catansight-calibration-panel";
    panel.innerHTML = `
      <div class="catansight-cal-header">
        <span>Overlay Calibration</span>
        <span class="catansight-cal-close">\u00D7</span>
      </div>
      <div class="catansight-cal-body">
        <label>
          <span class="catansight-cal-label">Scale <span class="catansight-cal-value" data-for="boardFraction">${this.boardFraction.toFixed(2)}</span></span>
          <input type="range" data-param="boardFraction" min="0.30" max="1.20" step="0.01" value="${this.boardFraction}">
        </label>
        <label>
          <span class="catansight-cal-label">Offset X <span class="catansight-cal-value" data-for="offsetX">${this.offsetX}</span>px</span>
          <input type="range" data-param="offsetX" min="-200" max="200" step="1" value="${this.offsetX}">
        </label>
        <label>
          <span class="catansight-cal-label">Offset Y <span class="catansight-cal-value" data-for="offsetY">${this.offsetY}</span>px</span>
          <input type="range" data-param="offsetY" min="-200" max="200" step="1" value="${this.offsetY}">
        </label>
        <label>
          <span class="catansight-cal-label">Center X <span class="catansight-cal-value" data-for="centerRatioX">${this.centerRatioX.toFixed(2)}</span></span>
          <input type="range" data-param="centerRatioX" min="0.30" max="0.70" step="0.01" value="${this.centerRatioX}">
        </label>
        <label>
          <span class="catansight-cal-label">Center Y <span class="catansight-cal-value" data-for="centerRatioY">${this.centerRatioY.toFixed(2)}</span></span>
          <input type="range" data-param="centerRatioY" min="0.30" max="0.70" step="0.01" value="${this.centerRatioY}">
        </label>
        <div class="catansight-cal-buttons">
          <button class="catansight-cal-btn catansight-cal-save">Save</button>
          <button class="catansight-cal-btn catansight-cal-reset">Reset</button>
        </div>
      </div>
    `;

    // Wire up sliders for live preview
    panel.querySelectorAll("input[type=range]").forEach(slider => {
      slider.addEventListener("input", () => {
        const param = slider.dataset.param;
        const val = parseFloat(slider.value);
        this[param] = val;

        // Update displayed value
        const display = panel.querySelector(`.catansight-cal-value[data-for="${param}"]`);
        if (display) {
          display.textContent = Number.isInteger(val) ? val : val.toFixed(2);
        }

        this._updateBadges();
      });
    });

    // Close button
    panel.querySelector(".catansight-cal-close").addEventListener("click", () => {
      this._closeCalibration();
    });

    // Save button
    panel.querySelector(".catansight-cal-save").addEventListener("click", () => {
      this._saveCalibration();
      this._closeCalibration();
      console.log("[CatanSight] Calibration saved:", {
        boardFraction: this.boardFraction,
        offsetX: this.offsetX, offsetY: this.offsetY,
        centerRatioX: this.centerRatioX, centerRatioY: this.centerRatioY
      });
    });

    // Reset button
    panel.querySelector(".catansight-cal-reset").addEventListener("click", () => {
      this.boardFraction = 0.79;
      this.offsetX = 0;
      this.offsetY = 0;
      this.centerRatioX = 0.50;
      this.centerRatioY = 0.50;
      // Update all sliders
      panel.querySelectorAll("input[type=range]").forEach(s => {
        s.value = this[s.dataset.param];
        const d = panel.querySelector(`.catansight-cal-value[data-for="${s.dataset.param}"]`);
        if (d) {
          const v = this[s.dataset.param];
          d.textContent = Number.isInteger(v) ? v : v.toFixed(2);
        }
      });
      this._updateBadges();
    });

    // Make panel draggable
    CatanSight.PanelDragger.makeDraggable(panel, panel.querySelector(".catansight-cal-header"));

    document.body.appendChild(panel);
    this.calibrationPanel = panel;
  },

  _closeCalibration() {
    if (this.calibrationPanel) {
      this.calibrationPanel.remove();
      this.calibrationPanel = null;
    }
  },

  _saveCalibration() {
    try {
      chrome.storage.local.set({
        catansightCalibration: {
          version: 3,
          offsetX: this.offsetX,
          offsetY: this.offsetY,
          boardFraction: this.boardFraction,
          centerRatioX: this.centerRatioX,
          centerRatioY: this.centerRatioY
        }
      });
    } catch (e) { /* ignore */ }
  },

  _loadCalibration() {
    try {
      chrome.storage.local.get("catansightCalibration", (result) => {
        if (result.catansightCalibration) {
          const cal = result.catansightCalibration;
          if (cal.version === 3) {
            this.offsetX = cal.offsetX || 0;
            this.offsetY = cal.offsetY || 0;
            if (cal.boardFraction) this.boardFraction = cal.boardFraction;
            if (cal.centerRatioX !== undefined) this.centerRatioX = cal.centerRatioX;
            if (cal.centerRatioY !== undefined) this.centerRatioY = cal.centerRatioY;
            console.log("[CatanSight] Loaded calibration:", cal);
          } else {
            chrome.storage.local.remove("catansightCalibration");
          }
        }
      });
    } catch (e) { /* ignore */ }
  },

  // ── Tooltip ────────────────────────────────────────────

  _showTooltip(event, inter) {
    const lines = [];
    lines.push(`<div class="catansight-tooltip-total">${inter.pips} pips (${inter.probability}%)</div>`);
    lines.push('<div class="catansight-tooltip-divider"></div>');
    inter.resources.forEach(r => {
      const resIcon = this._resourceEmoji(r.resource);
      lines.push(
        `<div class="catansight-tooltip-row">${resIcon} ${this._capitalize(r.resource)} ${r.number} <span class="catansight-tooltip-pips">(${r.pips} pips)</span></div>`
      );
    });

    this.tooltipEl.innerHTML = lines.join("");
    this.tooltipEl.style.display = "block";

    const badgeRect = event.target.getBoundingClientRect();
    this.tooltipEl.style.left = `${badgeRect.right + 8}px`;
    this.tooltipEl.style.top = `${badgeRect.top - 10}px`;

    requestAnimationFrame(() => {
      const ttRect = this.tooltipEl.getBoundingClientRect();
      if (ttRect.right > window.innerWidth - 10) {
        this.tooltipEl.style.left = `${badgeRect.left - ttRect.width - 8}px`;
      }
      if (ttRect.bottom > window.innerHeight - 10) {
        this.tooltipEl.style.top = `${window.innerHeight - ttRect.height - 10}px`;
      }
    });
  },

  _hideTooltip() {
    this.tooltipEl.style.display = "none";
  },

  _resourceEmoji(resource) {
    return { lumber: "\u{1F332}", grain: "\u{1F33E}", wool: "\u{1F411}", ore: "\u{26F0}\uFE0F", brick: "\u{1F9F1}" }[resource] || "";
  },

  _capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  },

  // ── Resize / Toggle / Lifecycle ────────────────────────

  _setupResizeObserver() {
    let debounceTimer = null;
    const handler = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        this._cachedCanvas = null;
        this._updateBadges();
      }, 200);
    };

    this.resizeObserver = new ResizeObserver(handler);
    window.addEventListener("resize", handler);

    const tryObserveCanvas = () => {
      const canvas = this._findCanvas();
      if (canvas) {
        this.resizeObserver.observe(canvas);
      } else {
        setTimeout(tryObserveCanvas, 2000);
      }
    };
    tryObserveCanvas();
  },

  toggle() {
    this.visible = !this.visible;
    if (this.container) {
      this.container.classList.toggle("catansight-hidden", !this.visible);
    }
  },

  setEnabled(enabled) {
    this.enabled = enabled;
    if (!enabled) {
      this.clear();
      if (this.container) this.container.classList.add("catansight-hidden");
    } else if (this.currentIntersections) {
      if (this.container) this.container.classList.remove("catansight-hidden");
      this._updateBadges();
    }
  },

  setOpacity(value) {
    this.opacity = value;
    if (this.container) this.container.style.opacity = value;
  },

  clear() {
    if (this.container) this.container.innerHTML = "";
    this.badges = [];
  },

  destroy() {
    this.clear();
    this._closeCalibration();
    if (this.container) this.container.remove();
    if (this.tooltipEl) this.tooltipEl.remove();
    if (this.resizeObserver) this.resizeObserver.disconnect();
    this.container = null;
    this.tooltipEl = null;
  }
};
