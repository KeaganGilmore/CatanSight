/**
 * CatanSight - Popup Script
 * Manages feature toggles and settings persistence.
 */

const FEATURE_KEYS = [
  "pipOverlay",
  "scarcityPanel",
  "diceTracker",
  "resourceTracker",
  "portProximity"
];

const DEFAULT_SETTINGS = {
  pipOverlay: true,
  scarcityPanel: true,
  diceTracker: true,
  resourceTracker: true,
  portProximity: true,
  overlayOpacity: 0.9
};

let currentSettings = { ...DEFAULT_SETTINGS };

// ── Initialize ─────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {
  loadSettings();
  setupToggleListeners();
  setupOpacitySlider();
  setupQuickButtons();
  setupCalibrateButton();
  checkStatus();
});

// ── Settings ───────────────────────────────────────────────

function loadSettings() {
  chrome.storage.local.get("settings", (result) => {
    currentSettings = { ...DEFAULT_SETTINGS, ...(result.settings || {}) };
    updateUI();
  });
}

function saveSettings() {
  chrome.storage.local.set({ settings: currentSettings }, () => {
    // Notify content scripts
    chrome.runtime.sendMessage({
      type: "settings-changed",
      settings: currentSettings
    });
  });
}

function updateUI() {
  FEATURE_KEYS.forEach(key => {
    const toggle = document.getElementById(`toggle-${key}`);
    if (toggle) toggle.checked = currentSettings[key];
  });

  const slider = document.getElementById("opacity-slider");
  const valueEl = document.getElementById("opacity-value");
  if (slider) {
    slider.value = Math.round(currentSettings.overlayOpacity * 100);
    valueEl.textContent = `${slider.value}%`;
  }
}

// ── Toggle Listeners ───────────────────────────────────────

function setupToggleListeners() {
  FEATURE_KEYS.forEach(key => {
    const toggle = document.getElementById(`toggle-${key}`);
    if (toggle) {
      toggle.addEventListener("change", () => {
        currentSettings[key] = toggle.checked;
        saveSettings();
      });
    }
  });
}

// ── Opacity Slider ─────────────────────────────────────────

function setupOpacitySlider() {
  const slider = document.getElementById("opacity-slider");
  const valueEl = document.getElementById("opacity-value");

  if (slider) {
    slider.addEventListener("input", () => {
      valueEl.textContent = `${slider.value}%`;
      currentSettings.overlayOpacity = parseInt(slider.value, 10) / 100;
      saveSettings();
    });
  }
}

// ── Quick Buttons ──────────────────────────────────────────

function setupQuickButtons() {
  document.getElementById("btn-all-on").addEventListener("click", () => {
    FEATURE_KEYS.forEach(key => { currentSettings[key] = true; });
    updateUI();
    saveSettings();
  });

  document.getElementById("btn-all-off").addEventListener("click", () => {
    FEATURE_KEYS.forEach(key => { currentSettings[key] = false; });
    updateUI();
    saveSettings();
  });
}

// ── Calibrate Button ──────────────────────────────────────

function setupCalibrateButton() {
  document.getElementById("btn-calibrate").addEventListener("click", () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { type: "toggle-calibration" });
        window.close();
      }
    });
  });
}

// ── Status Check ───────────────────────────────────────────

function checkStatus() {
  const dot = document.querySelector(".status-dot");
  const text = document.querySelector(".status-text");

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (!tab) {
      setStatus(dot, text, "inactive", "No active tab");
      return;
    }

    const url = tab.url || "";
    if (!url.includes("colonist.io")) {
      setStatus(dot, text, "inactive", "Not on colonist.io");
      return;
    }

    // Try to ping the content script
    chrome.tabs.sendMessage(tab.id, { type: "ping" }, (response) => {
      if (chrome.runtime.lastError) {
        setStatus(dot, text, "waiting", "Waiting for page load...");
      } else {
        setStatus(dot, text, "active", "Active on colonist.io");
      }
    });
  });
}

function setStatus(dot, text, state, message) {
  dot.className = `status-dot ${state}`;
  text.textContent = message;
}
