/**
 * CatanSight - Content Script (Orchestrator)
 * Coordinates all modules, manages feature toggles, handles WS message routing.
 */

(function() {
  "use strict";

  const DEFAULT_SETTINGS = {
    pipOverlay: true,
    scarcityPanel: true,
    diceTracker: true,
    resourceTracker: true,
    portProximity: true,
    overlayOpacity: 0.9
  };

  let settings = { ...DEFAULT_SETTINGS };
  let boardParsed = false;
  let intersections = null;
  let enrichedIntersections = null;

  // ── Settings Management ──────────────────────────────────

  function loadSettings() {
    chrome.storage.local.get("settings", (result) => {
      if (result.settings) {
        settings = { ...DEFAULT_SETTINGS, ...result.settings };
      }
      applySettings();
    });
  }

  function applySettings() {
    CatanSight.OverlayRenderer.setEnabled(settings.pipOverlay);
    CatanSight.OverlayRenderer.setOpacity(settings.overlayOpacity);
    CatanSight.ScarcityAnalyzer.setEnabled(settings.scarcityPanel);
    CatanSight.DiceTracker.setEnabled(settings.diceTracker);
    CatanSight.ResourceTracker.setEnabled(settings.resourceTracker);
  }

  // Listen for settings changes from popup/background
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "ping") {
      sendResponse({ status: "ok", boardParsed });
      return;
    }
    if (message.type === "settings-changed" && message.settings) {
      settings = { ...DEFAULT_SETTINGS, ...message.settings };
      applySettings();
    }
    if (message.type === "toggle-pips") {
      CatanSight.OverlayRenderer.toggle();
    }
    if (message.type === "toggle-panel") {
      // Toggle all side panels
      const panels = document.getElementById("catansight-panels");
      if (panels) {
        panels.classList.toggle("catansight-hidden");
      }
    }
  });

  // Also listen for storage changes directly
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.settings) {
      settings = { ...DEFAULT_SETTINGS, ...changes.settings.newValue };
      applySettings();
    }
  });

  // ── WebSocket Message Router ─────────────────────────────

  document.addEventListener("catansight-ws-data", (event) => {
    const { data } = event.detail;
    try {
      const message = typeof data === "string" ? JSON.parse(data) : data;
      routeMessage(message);
    } catch (e) {
      // Binary or non-JSON message — skip
    }
  });

  function routeMessage(message) {
    // Try to parse board state (only if not already parsed)
    if (!boardParsed) {
      const board = CatanSight.BoardParser.tryParse(message);
      if (board) {
        boardParsed = true;
        onBoardParsed(board);
      }
    }

    // Route to resource tracker
    if (settings.resourceTracker) {
      CatanSight.ResourceTracker.processMessage(message);
    }

    // Try to extract dice roll from WS
    tryExtractDiceRoll(message);
  }

  function tryExtractDiceRoll(msg) {
    const data = msg.payload || msg.data || msg;
    // Look for dice roll values in various message formats
    const roll = data.diceRoll || data.dice || data.roll ||
                 data.diceTotal || data.diceValue;
    if (typeof roll === "number" && roll >= 2 && roll <= 12) {
      CatanSight.DiceTracker.addRollFromWS(roll);
    }
    // Also check for two separate dice values
    const d1 = data.dice1 || data.die1;
    const d2 = data.dice2 || data.die2;
    if (typeof d1 === "number" && typeof d2 === "number") {
      CatanSight.DiceTracker.addRollFromWS(d1 + d2);
    }
  }

  // ── Board Initialization ─────────────────────────────────

  function onBoardParsed(board) {
    console.log("[CatanSight] Board state received:", board);

    // Build hex geometry
    intersections = CatanSight.HexGeometry.buildIntersections(1);

    // Calculate pip values
    enrichedIntersections = CatanSight.PipCalculator.calculate(
      board.hexes, intersections
    );

    // Render pip overlay
    if (settings.pipOverlay) {
      CatanSight.OverlayRenderer.render(enrichedIntersections);
    }

    // Render scarcity panel
    if (settings.scarcityPanel) {
      CatanSight.ScarcityAnalyzer.analyze(board.hexes);
    }

    // Show success notification
    showNotification("CatanSight active — board detected!");
  }

  // ── Notifications ────────────────────────────────────────

  function showNotification(text) {
    const el = document.createElement("div");
    el.className = "catansight-notification";
    el.textContent = text;
    document.body.appendChild(el);

    // Fade in
    requestAnimationFrame(() => el.classList.add("catansight-notification-visible"));

    // Remove after 3s
    setTimeout(() => {
      el.classList.remove("catansight-notification-visible");
      setTimeout(() => el.remove(), 300);
    }, 3000);
  }

  // ── Initialization ───────────────────────────────────────

  function init() {
    console.log("[CatanSight] Content script loaded");

    // Initialize overlay renderer
    CatanSight.OverlayRenderer.init();

    // Initialize dice tracker (DOM-based, works independently of WS)
    CatanSight.DiceTracker.init();

    // Load user settings
    loadSettings();

    // Show waiting notification
    showNotification("CatanSight loaded — waiting for game...");
  }

  // Start when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
