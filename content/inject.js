/**
 * CatanSight - WebSocket Interceptor (MAIN world)
 * Uses a non-invasive approach: patches WebSocket.prototype.send
 * and listens on individual instances without replacing the constructor.
 */
(function() {
  "use strict";

  function dispatchToExtension(data) {
    try {
      document.dispatchEvent(new CustomEvent("catansight-ws-data", {
        detail: { data: data, timestamp: Date.now() }
      }));
    } catch (e) {
      // Never break the game
    }
  }

  // Patch the native addEventListener on WebSocket prototype to intercept messages
  const origAddEventListener = WebSocket.prototype.addEventListener;
  WebSocket.prototype.addEventListener = function(type, listener, options) {
    if (type === "message") {
      const ws = this;
      const wrapped = function(event) {
        dispatchToExtension(event.data);
        return listener.call(ws, event);
      };
      return origAddEventListener.call(this, type, wrapped, options);
    }
    return origAddEventListener.call(this, type, listener, options);
  };

  // Patch onmessage property on the prototype
  const origOnMessageDesc = Object.getOwnPropertyDescriptor(WebSocket.prototype, "onmessage");
  if (origOnMessageDesc) {
    Object.defineProperty(WebSocket.prototype, "onmessage", {
      get: origOnMessageDesc.get,
      set: function(handler) {
        if (typeof handler === "function") {
          const ws = this;
          const wrapped = function(event) {
            dispatchToExtension(event.data);
            return handler.call(ws, event);
          };
          origOnMessageDesc.set.call(this, wrapped);
        } else {
          origOnMessageDesc.set.call(this, handler);
        }
      },
      configurable: true,
      enumerable: true
    });
  }

  console.log("[CatanSight] WebSocket interceptor active");
})();
