/**
 * CatanSight - Dice Roll Tracker
 * Monitors the game log for dice rolls and displays a histogram.
 */

CatanSight.DiceTracker = {
  rolls: [],
  histogram: {},
  panel: null,
  observer: null,
  lastProcessedIndex: 0,
  enabled: true,
  collapsed: false,

  // Expected probability for each roll (out of 36)
  EXPECTED: {
    2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6,
    8: 5, 9: 4, 10: 3, 11: 2, 12: 1
  },

  init() {
    for (let i = 2; i <= 12; i++) this.histogram[i] = 0;
    this._waitForGameLog();
  },

  _waitForGameLog() {
    const check = () => {
      const el = document.getElementById("game-log-text");
      if (el) {
        this._processExisting(el);
        this.observer = new MutationObserver(() => this._processNew(el));
        this.observer.observe(el, { childList: true, subtree: true });
      } else {
        setTimeout(check, 1000);
      }
    };
    check();
  },

  _processExisting(logEl) {
    this._processNew(logEl);
  },

  _processNew(logEl) {
    const messages = logEl.children;
    for (let i = this.lastProcessedIndex; i < messages.length; i++) {
      this._parseRoll(messages[i]);
    }
    this.lastProcessedIndex = messages.length;
    if (this.enabled) this._renderPanel();
  },

  _parseRoll(messageEl) {
    // Strategy 1: Look for dice images with alt="dice_N"
    const diceImgs = messageEl.querySelectorAll('img[alt^="dice_"]');
    if (diceImgs.length >= 2) {
      let total = 0;
      diceImgs.forEach(img => {
        const val = parseInt(img.alt.replace("dice_", ""), 10);
        if (!isNaN(val)) total += val;
      });
      if (total >= 2 && total <= 12) {
        this.rolls.push(total);
        this.histogram[total]++;
        return;
      }
    }

    // Strategy 2: Look for "rolled" text with a number
    const text = messageEl.textContent || "";
    const match = text.match(/rolled?\s+(?:a\s+)?(\d{1,2})/i);
    if (match) {
      const roll = parseInt(match[1], 10);
      if (roll >= 2 && roll <= 12) {
        this.rolls.push(roll);
        this.histogram[roll]++;
        return;
      }
    }

    // Strategy 3: Look for two separate dice value images
    const allImgs = messageEl.querySelectorAll("img");
    const diceValues = [];
    allImgs.forEach(img => {
      const src = img.src || "";
      const alt = img.alt || "";
      // Try extracting dice value from src or alt
      const srcMatch = src.match(/dice[_-]?(\d)/i) || alt.match(/^(\d)$/);
      if (srcMatch) diceValues.push(parseInt(srcMatch[1], 10));
    });
    if (diceValues.length === 2) {
      const total = diceValues[0] + diceValues[1];
      if (total >= 2 && total <= 12) {
        this.rolls.push(total);
        this.histogram[total]++;
      }
    }
  },

  /**
   * Also accept dice rolls from WebSocket messages.
   */
  addRollFromWS(rollValue) {
    if (rollValue >= 2 && rollValue <= 12) {
      this.rolls.push(rollValue);
      this.histogram[rollValue]++;
      if (this.enabled) this._renderPanel();
    }
  },

  _renderPanel() {
    if (!this.panel) this._createPanel();
    if (!this.enabled) return;

    const totalRolls = this.rolls.length;
    const maxCount = Math.max(...Object.values(this.histogram), 1);

    const body = this.panel.querySelector(".catansight-panel-body");
    let rows = `<div class="catansight-dice-total">Total rolls: ${totalRolls}</div>`;

    for (let n = 2; n <= 12; n++) {
      const count = this.histogram[n];
      const expected = totalRolls > 0 ? (this.EXPECTED[n] / 36) * totalRolls : 0;
      const pct = (count / Math.max(maxCount, 1)) * 100;
      const expectedPct = (expected / Math.max(maxCount, 1)) * 100;

      // Hot/cold classification
      let tempClass = "";
      if (totalRolls >= 10) {
        const ratio = expected > 0 ? count / expected : 0;
        if (ratio > 1.5) tempClass = "catansight-hot";
        else if (ratio < 0.5) tempClass = "catansight-cold";
      }

      rows += `
        <div class="catansight-dice-row ${tempClass}">
          <span class="catansight-dice-num">${n}</span>
          <div class="catansight-dice-bar-track">
            <div class="catansight-dice-expected" style="width:${expectedPct}%"></div>
            <div class="catansight-dice-actual" style="width:${pct}%"></div>
          </div>
          <span class="catansight-dice-count">${count}</span>
        </div>
      `;
    }

    body.innerHTML = rows;
  },

  _createPanel() {
    this.panel = document.createElement("div");
    this.panel.className = "catansight-side-panel catansight-dice-panel";
    this.panel.innerHTML = `
      <div class="catansight-panel-header" data-panel="dice">
        <span class="catansight-panel-title">Dice Tracker</span>
        <span class="catansight-panel-toggle">\u25BC</span>
      </div>
      <div class="catansight-panel-body"></div>
    `;

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
    if (this.observer) this.observer.disconnect();
    if (this.panel) this.panel.remove();
    this.observer = null;
    this.panel = null;
    this.rolls = [];
    for (let i = 2; i <= 12; i++) this.histogram[i] = 0;
    this.lastProcessedIndex = 0;
  }
};
