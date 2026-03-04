/**
 * CatanSight - WebSocket Interceptor (MAIN world)
 * Patches WebSocket.prototype to passively observe messages.
 * Dispatches string messages as-is and binary messages as base64.
 */
(function() {
  "use strict";

  function dispatchToExtension(data) {
    try {
      let payload, isBinary = false;

      if (typeof data === "string") {
        payload = data;
      } else if (data instanceof ArrayBuffer) {
        // Convert ArrayBuffer to base64 for safe transport via CustomEvent
        const bytes = new Uint8Array(data);
        let binary = "";
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        payload = btoa(binary);
        isBinary = true;
      } else {
        return;
      }

      document.dispatchEvent(new CustomEvent("catansight-ws-data", {
        detail: JSON.stringify({ payload, isBinary })
      }));
    } catch (e) {
      // Never break the game
    }
  }

  // Patch addEventListener on WebSocket prototype
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
