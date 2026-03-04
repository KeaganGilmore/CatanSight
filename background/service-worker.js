/**
 * CatanSight - Background Service Worker
 * Registers the MAIN world inject script and handles extension commands.
 */

const DEFAULT_SETTINGS = {
  pipOverlay: true,
  scarcityPanel: true,
  diceTracker: true,
  resourceTracker: true,
  portProximity: true,
  overlayOpacity: 0.9
};

// Register the MAIN world script for WebSocket interception
chrome.scripting.registerContentScripts([{
  id: "catansight-inject",
  matches: ["https://colonist.io/*"],
  js: ["content/inject.js"],
  runAt: "document_start",
  world: "MAIN"
}]).catch(err => {
  if (!err.message.includes("Duplicate")) {
    console.error("[CatanSight] Failed to register inject script:", err);
  }
});

// Initialize default settings on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get("settings", (result) => {
    if (!result.settings) {
      chrome.storage.local.set({ settings: DEFAULT_SETTINGS });
    }
  });
});

// Handle keyboard commands
chrome.commands.onCommand.addListener((command, tab) => {
  if (command === "toggle-pips" || command === "toggle-panel") {
    chrome.tabs.sendMessage(tab.id, { type: command });
  }
});

// Relay messages between popup and content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "settings-changed") {
    // Forward to all colonist.io tabs
    chrome.tabs.query({ url: "https://colonist.io/*" }, (tabs) => {
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, message).catch(() => {});
      });
    });
  }

  if (message.type === "get-settings") {
    chrome.storage.local.get("settings", (result) => {
      sendResponse(result.settings || DEFAULT_SETTINGS);
    });
    return true; // async response
  }
});
