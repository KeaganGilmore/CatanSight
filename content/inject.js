/**
 * CatanSight - WebSocket Interceptor (MAIN world)
 * Monkey-patches WebSocket to capture colonist.io game messages.
 * This runs in the page context, NOT the extension isolated world.
 */
(function() {
  "use strict";

  const OriginalWebSocket = window.WebSocket;

  function dispatchToExtension(data, url) {
    try {
      document.dispatchEvent(new CustomEvent("catansight-ws-data", {
        detail: { data: data, url: url, timestamp: Date.now() }
      }));
    } catch (e) {
      // Never break the game
    }
  }

  window.WebSocket = function(...args) {
    const ws = new OriginalWebSocket(...args);
    const wsUrl = args[0] || "";

    // Intercept messages via addEventListener
    const origAddEventListener = ws.addEventListener.bind(ws);
    ws.addEventListener = function(type, listener, options) {
      if (type === "message") {
        const wrapped = function(event) {
          dispatchToExtension(event.data, wsUrl);
          return listener.call(ws, event);
        };
        return origAddEventListener(type, wrapped, options);
      }
      return origAddEventListener(type, listener, options);
    };

    // Intercept messages via onmessage property
    let _onmessage = null;
    Object.defineProperty(ws, "onmessage", {
      get: () => _onmessage,
      set: (handler) => {
        _onmessage = function(event) {
          dispatchToExtension(event.data, wsUrl);
          return handler.call(ws, event);
        };
      }
    });

    return ws;
  };

  // Preserve WebSocket statics and prototype
  window.WebSocket.prototype = OriginalWebSocket.prototype;
  window.WebSocket.CONNECTING = OriginalWebSocket.CONNECTING;
  window.WebSocket.OPEN = OriginalWebSocket.OPEN;
  window.WebSocket.CLOSING = OriginalWebSocket.CLOSING;
  window.WebSocket.CLOSED = OriginalWebSocket.CLOSED;

  console.log("[CatanSight] WebSocket interceptor active");
})();
