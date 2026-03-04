/**
 * CatanSight - Overlay Renderer
 * Renders pip count badges and tooltips over the colonist.io canvas.
 */

CatanSight.OverlayRenderer = {
  container: null,
  tooltipEl: null,
  badges: [],
  visible: true,
  enabled: true,
  resizeObserver: null,
  currentIntersections: null,
  opacity: 0.9,

  init() {
    // Create overlay container
    this.container = document.createElement("div");
    this.container.id = "catansight-overlay";
    this.container.className = "catansight-overlay";
    document.body.appendChild(this.container);

    // Create tooltip element
    this.tooltipEl = document.createElement("div");
    this.tooltipEl.className = "catansight-tooltip";
    this.tooltipEl.style.display = "none";
    document.body.appendChild(this.tooltipEl);

    // Listen for resize
    this._setupResizeObserver();
  },

  /**
   * Render pip badges at all intersections.
   */
  render(enrichedIntersections) {
    if (!this.container) this.init();
    this.currentIntersections = enrichedIntersections;
    this._updateBadges();
  },

  _updateBadges() {
    this.clear();
    if (!this.enabled || !this.currentIntersections) return;

    const canvas = this._findCanvas();
    if (!canvas) {
      console.warn("[CatanSight] Canvas not found, retrying in 1s...");
      setTimeout(() => this._updateBadges(), 1000);
      return;
    }

    const transform = this._computeTransform(canvas);
    this.container.style.opacity = this.opacity;

    this.currentIntersections.forEach((inter, idx) => {
      if (inter.pips === 0) return; // Skip empty intersections

      const badge = document.createElement("div");
      badge.className = `catansight-pip-badge catansight-tier-${inter.tier}`;
      badge.textContent = inter.pips;
      badge.dataset.index = idx;

      const pos = transform(inter.x, inter.y);
      badge.style.left = `${pos.x}px`;
      badge.style.top = `${pos.y}px`;

      // Hover tooltip
      badge.addEventListener("mouseenter", (e) => this._showTooltip(e, inter));
      badge.addEventListener("mouseleave", () => this._hideTooltip());

      this.container.appendChild(badge);
      this.badges.push(badge);
    });
  },

  /**
   * Find the game canvas element.
   */
  _findCanvas() {
    // colonist.io renders with PIXI.js — try several selectors
    return document.querySelector("#game-canvas canvas") ||
           document.querySelector(".game-canvas canvas") ||
           document.querySelector("canvas[data-engine]") ||
           document.querySelector("canvas");
  },

  /**
   * Compute the transform function from normalized hex coords to screen pixels.
   */
  _computeTransform(canvas) {
    const rect = canvas.getBoundingClientRect();

    // The hex geometry spans approximately:
    // X: from -3 to +3 (in hex size units) => total ~6 units
    // Y: from -3.46 to +3.46 => total ~6.93 units
    // We use the actual computed bounds from the intersections for accuracy
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

    // Scale to fit canvas with padding
    const padding = 0.15; // 15% padding on each side
    const usableWidth = rect.width * (1 - 2 * padding);
    const usableHeight = rect.height * (1 - 2 * padding);
    const scale = Math.min(usableWidth / boardWidth, usableHeight / boardHeight);

    const offsetX = rect.left + rect.width / 2;
    const offsetY = rect.top + rect.height / 2;

    return (nx, ny) => ({
      x: offsetX + (nx - centerX) * scale,
      y: offsetY + (ny - centerY) * scale
    });
  },

  /**
   * Show tooltip with pip breakdown.
   */
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

    // Position tooltip near the badge
    const badgeRect = event.target.getBoundingClientRect();
    this.tooltipEl.style.left = `${badgeRect.right + 8}px`;
    this.tooltipEl.style.top = `${badgeRect.top - 10}px`;

    // Keep tooltip in viewport
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
    const map = {
      lumber: "\u{1F332}", grain: "\u{1F33E}", wool: "\u{1F411}",
      ore: "\u{26F0}\uFE0F", brick: "\u{1F9F1}"
    };
    return map[resource] || "";
  },

  _capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  },

  /**
   * Setup resize observer to reposition badges when canvas resizes.
   */
  _setupResizeObserver() {
    let debounceTimer = null;
    this.resizeObserver = new ResizeObserver(() => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => this._updateBadges(), 150);
    });

    // Observe document body for layout changes; will observe canvas once found
    const tryObserveCanvas = () => {
      const canvas = this._findCanvas();
      if (canvas) {
        this.resizeObserver.observe(canvas);
      } else {
        setTimeout(tryObserveCanvas, 2000);
      }
    };
    tryObserveCanvas();

    // Also handle window resize
    window.addEventListener("resize", () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => this._updateBadges(), 150);
    });
  },

  /**
   * Toggle overlay visibility.
   */
  toggle() {
    this.visible = !this.visible;
    if (this.container) {
      this.container.classList.toggle("catansight-hidden", !this.visible);
    }
  },

  /**
   * Enable/disable the overlay module.
   */
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

  /**
   * Update global opacity.
   */
  setOpacity(value) {
    this.opacity = value;
    if (this.container) {
      this.container.style.opacity = value;
    }
  },

  /**
   * Remove all badges from the DOM.
   */
  clear() {
    if (this.container) this.container.innerHTML = "";
    this.badges = [];
  },

  destroy() {
    this.clear();
    if (this.container) this.container.remove();
    if (this.tooltipEl) this.tooltipEl.remove();
    if (this.resizeObserver) this.resizeObserver.disconnect();
    this.container = null;
    this.tooltipEl = null;
  }
};
