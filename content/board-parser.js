/**
 * CatanSight - Board Parser
 * Extracts board state (hex types, numbers, ports) from WebSocket messages.
 * Uses a strategy pattern to handle different message formats.
 */

CatanSight.BoardParser = {
  // Resource type mapping — colonist.io uses numeric IDs
  // These will be refined after inspecting actual WebSocket traffic
  RESOURCE_NAMES: {
    0: "lumber",
    1: "brick",
    2: "wool",
    3: "grain",
    4: "ore",
    5: "desert",
    // Alternative mappings to try
    lumber: "lumber", wood: "lumber", forest: "lumber",
    brick: "brick", clay: "brick", hills: "brick",
    wool: "wool", sheep: "wool", pasture: "wool",
    grain: "grain", wheat: "grain", fields: "grain",
    ore: "ore", mountains: "ore", mountain: "ore",
    desert: "desert", none: "desert"
  },

  boardState: null,
  ports: null,

  /**
   * Attempt to parse board state from a WebSocket message.
   * Returns { hexes, ports } or null if not a board message.
   */
  tryParse(message) {
    if (!message || typeof message !== "object") return null;

    const strategies = [
      this._parseFromGameState,
      this._parseFromBoardData,
      this._parseFromDeepSearch
    ];

    for (const strategy of strategies) {
      try {
        const result = strategy.call(this, message);
        if (result && this._validate(result)) {
          this.boardState = result.hexes;
          this.ports = result.ports || [];
          console.log("[CatanSight] Board parsed successfully:", result);
          return result;
        }
      } catch (e) {
        continue;
      }
    }
    return null;
  },

  /**
   * Strategy 1: Look for a top-level hexes/tiles array.
   */
  _parseFromGameState(msg) {
    // Try common field names for the board data
    const candidates = [
      msg.hexes, msg.tiles, msg.board?.hexes, msg.board?.tiles,
      msg.payload?.hexes, msg.payload?.tiles, msg.payload?.board?.hexes,
      msg.gameState?.hexes, msg.gameState?.board?.hexes,
      msg.data?.hexes, msg.data?.tiles, msg.data?.board?.hexes
    ];

    for (const hexArray of candidates) {
      if (!Array.isArray(hexArray)) continue;
      if (hexArray.length < 19) continue;

      const hexes = this._normalizeHexArray(hexArray);
      if (hexes) {
        const ports = this._extractPorts(msg);
        return { hexes, ports };
      }
    }
    return null;
  },

  /**
   * Strategy 2: Look for board object with nested structure.
   */
  _parseFromBoardData(msg) {
    // Some formats have the board as a flat object with numbered keys
    if (msg.type === "board" || msg.type === "gameSetup" || msg.type === "game_started") {
      const data = msg.payload || msg.data || msg;
      const hexArray = data.hexes || data.tiles || data.board;
      if (Array.isArray(hexArray)) {
        const hexes = this._normalizeHexArray(hexArray);
        if (hexes) {
          const ports = this._extractPorts(data);
          return { hexes, ports };
        }
      }
    }
    return null;
  },

  /**
   * Strategy 3: Deep search for any array of ~19 objects that look like hexes.
   */
  _parseFromDeepSearch(msg) {
    const found = this._findHexArray(msg, 3);
    if (found) {
      const hexes = this._normalizeHexArray(found);
      if (hexes) return { hexes, ports: [] };
    }
    return null;
  },

  /**
   * Recursively search for an array of 19+ objects with resource/number-like fields.
   */
  _findHexArray(obj, maxDepth) {
    if (maxDepth <= 0 || !obj || typeof obj !== "object") return null;

    if (Array.isArray(obj) && obj.length >= 19 && obj.length <= 37) {
      // Check if items look like hex objects
      const sample = obj[0];
      if (sample && typeof sample === "object") {
        const keys = Object.keys(sample);
        const hasResourceLike = keys.some(k =>
          /resource|type|terrain|land|hex/i.test(k)
        );
        const hasNumberLike = keys.some(k =>
          /number|value|token|chit|dice/i.test(k)
        );
        if (hasResourceLike || hasNumberLike) return obj;
      }
    }

    for (const key of Object.keys(obj)) {
      const result = this._findHexArray(obj[key], maxDepth - 1);
      if (result) return result;
    }
    return null;
  },

  /**
   * Normalize a raw hex array into our standard format.
   * Returns array of { resource, number, index } or null if invalid.
   */
  _normalizeHexArray(rawArray) {
    const hexes = [];
    for (let i = 0; i < rawArray.length; i++) {
      const raw = rawArray[i];
      if (!raw || typeof raw !== "object") return null;

      // Try to extract resource type
      const resourceRaw = raw.resource ?? raw.type ?? raw.terrain ?? raw.landType ?? raw.hexType;
      const resource = this._normalizeResource(resourceRaw);
      if (!resource) return null;

      // Try to extract number token
      let number = raw.number ?? raw.value ?? raw.token ?? raw.chit ?? raw.diceValue ?? 0;
      if (resource === "desert") number = 0;

      hexes.push({ resource, number: parseInt(number, 10) || 0, index: i });
    }
    return hexes;
  },

  /**
   * Normalize a resource identifier to our standard name.
   */
  _normalizeResource(raw) {
    if (raw === null || raw === undefined) return null;
    const key = typeof raw === "number" ? raw : String(raw).toLowerCase();
    return this.RESOURCE_NAMES[key] || null;
  },

  /**
   * Try to extract port data from the message.
   */
  _extractPorts(data) {
    const portArray = data.ports || data.harbors || data.harbour ||
                      data.board?.ports || data.payload?.ports;
    if (!Array.isArray(portArray)) return [];

    return portArray.map(p => ({
      type: p.type ?? p.resource ?? "generic",
      // Port position data — format TBD from WS inspection
      position: p.position ?? p.edge ?? p.location ?? null
    })).filter(p => p.position !== null);
  },

  /**
   * Validate that parsed board state looks like a real Catan board.
   */
  _validate(boardData) {
    const hexes = boardData.hexes;
    if (!Array.isArray(hexes) || hexes.length < 19) return false;

    // Check for valid resources
    const validResources = new Set(["lumber", "brick", "wool", "grain", "ore", "desert"]);
    if (!hexes.every(h => validResources.has(h.resource))) return false;

    // Must have at least 1 desert
    const desertCount = hexes.filter(h => h.resource === "desert").length;
    if (desertCount < 1) return false;

    // Non-desert hexes must have valid numbers (2-12, not 7)
    const nonDesert = hexes.filter(h => h.resource !== "desert");
    if (!nonDesert.every(h => h.number >= 2 && h.number <= 12 && h.number !== 7)) return false;

    return true;
  }
};
