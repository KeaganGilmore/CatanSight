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
      const panels = document.getElementById("catansight-panels");
      if (panels) {
        panels.classList.toggle("catansight-hidden");
      }
    }
    if (message.type === "toggle-calibration") {
      CatanSight.OverlayRenderer.toggleCalibration();
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

  let wsMessageCount = 0;
  document.addEventListener("catansight-ws-data", (event) => {
    wsMessageCount++;

    try {
      const envelope = JSON.parse(event.detail);
      let message;

      if (envelope.isBinary) {
        // Decode base64 back to ArrayBuffer, then decode MessagePack
        const binary = atob(envelope.payload);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        message = CatanSight.MsgPack.decode(bytes.buffer);
      } else {
        message = JSON.parse(envelope.payload);
      }

      // Debug: log first 30 messages with stringified payload
      if (wsMessageCount <= 30) {
        try {
          const t = message?.data?.type;
          const p = message?.data?.payload;
          const s = JSON.stringify(p);
          console.log(`[CatanSight WS #${wsMessageCount}] type=${t} len=${s?.length}`, s?.substring(0, 800));
        } catch(ex) {
          console.log(`[CatanSight WS #${wsMessageCount}]`, message);
        }
      }

      routeMessage(message);
    } catch (e) {
      // Decode error — skip
      if (wsMessageCount <= 30) {
        console.warn(`[CatanSight WS #${wsMessageCount}] decode error:`, e.message);
      }
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

  let lastDice1 = null, lastDice2 = null;
  let diceReady = false; // tracks when diceThrown goes false→true

  function tryExtractDiceRoll(msg) {
    const payload = msg.data?.payload;
    if (!payload || typeof payload !== "object") return;

    // Search for dice values at multiple levels, including diff (type=91 updates)
    const candidates = [
      payload.diff?.diceState,           // type=91 incremental updates
      payload.gameState?.diceState,       // type=4 full game state
      payload.diceState,
      payload.diff,
      payload
    ];

    for (const obj of candidates) {
      if (!obj || typeof obj !== "object") continue;

      // Check if diceThrown changed to false (reset) — prepare for next roll
      if (obj.diceThrown === false) {
        diceReady = true;
        return;
      }

      const d1 = obj.dice1;
      const d2 = obj.dice2;
      if (typeof d1 === "number" && typeof d2 === "number" &&
          d1 >= 1 && d1 <= 6 && d2 >= 1 && d2 <= 6) {
        // Record if dice values changed OR if we saw a diceThrown:false reset
        if (d1 !== lastDice1 || d2 !== lastDice2 || diceReady) {
          lastDice1 = d1;
          lastDice2 = d2;
          diceReady = false;
          // Only record if diceThrown is true (or not specified)
          const thrown = obj.diceThrown ?? true;
          if (thrown !== false) {
            console.log("[CatanSight] Dice roll:", d1, "+", d2, "=", d1 + d2);
            CatanSight.DiceTracker.addRollFromWS(d1 + d2);
          }
        }
        return;
      }
    }
  }

  // ── Board Initialization ─────────────────────────────────

  function onBoardParsed(board) {
    console.log("[CatanSight] Board state received:", board);

    // Build hex geometry from actual game tile positions
    intersections = CatanSight.HexGeometry.buildIntersectionsFromHexes(board.hexes, 1);
    console.log("[CatanSight] Computed", intersections.length, "intersections");

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
