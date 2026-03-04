/**
 * CatanSight - Board Parser
 * Extracts board state from colonist.io WebSocket messages.
 *
 * Colonist.io message format (data.type === 4):
 *   data.payload.gameState.mapState.tileHexStates = {
 *     "0": { x: 0, y: -2, type: 2, diceNumber: 6 },
 *     "1": { x: -1, y: -1, type: 3, diceNumber: 2 },
 *     ...18 more
 *   }
 *
 * Resource type IDs: 0=desert, 1=lumber, 2=wool, 3=grain, 4=brick, 5=ore
 */

if (!window.CatanSight) window.CatanSight = {};

CatanSight.BoardParser = {
  RESOURCE_MAP: {
    0: "desert",
    1: "lumber",
    2: "brick",
    3: "wool",
    4: "grain",
    5: "ore"
  },

  boardState: null,
  ports: null,
  rawGameState: null,

  /**
   * Try to parse board state from a WebSocket message.
   * Returns { hexes, ports } or null.
   */
  tryParse(message) {
    if (!message || typeof message !== "object") return null;

    try {
      const payload = message.data?.payload;
      if (!payload || typeof payload !== "object") return null;

      // Find tileHexStates in the payload
      const tileStates = this._findTileHexStates(payload);
      if (!tileStates) return null;

      const hexes = this._parseTileStates(tileStates);
      if (!hexes || hexes.length < 19) return null;

      // Validate it looks like a real Catan board
      if (!this._validate(hexes)) return null;

      const ports = this._findPorts(payload);
      this.boardState = hexes;
      this.ports = ports;
      this.rawGameState = payload;

      console.log("[CatanSight] Board parsed:", hexes.length, "hexes", hexes);
      return { hexes, ports };
    } catch (e) {
      return null;
    }
  },

  /**
   * Find tileHexStates in the payload, searching known paths.
   */
  _findTileHexStates(payload) {
    // Primary path (confirmed from WS inspection)
    const direct = payload.gameState?.mapState?.tileHexStates;
    if (this._looksLikeTileStates(direct)) return direct;

    // Alternate paths
    const alt1 = payload.mapState?.tileHexStates;
    if (this._looksLikeTileStates(alt1)) return alt1;

    // Deep search fallback
    return this._deepFindTiles(payload, 4);
  },

  _looksLikeTileStates(obj) {
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) return false;
    const keys = Object.keys(obj);
    if (keys.length < 19) return false;
    const sample = obj[keys[0]];
    return sample && typeof sample === "object" && "x" in sample && "type" in sample;
  },

  /**
   * Recursively search for tileHexStates-like objects.
   */
  _deepFindTiles(obj, maxDepth) {
    if (maxDepth <= 0 || !obj || typeof obj !== "object") return null;
    if (Array.isArray(obj)) return null;

    if (this._looksLikeTileStates(obj)) return obj;

    for (const key of Object.keys(obj)) {
      const result = this._deepFindTiles(obj[key], maxDepth - 1);
      if (result) return result;
    }
    return null;
  },

  /**
   * Convert tileHexStates object to our standard hex array.
   */
  _parseTileStates(tileStates) {
    const hexes = [];
    const keys = Object.keys(tileStates).sort((a, b) => parseInt(a) - parseInt(b));

    for (const key of keys) {
      const tile = tileStates[key];
      if (!tile || typeof tile !== "object") continue;

      const resource = this.RESOURCE_MAP[tile.type];
      if (resource === undefined) continue;

      hexes.push({
        resource: resource,
        number: resource === "desert" ? 0 : (tile.diceNumber || 0),
        q: tile.x,
        r: tile.y,
        index: parseInt(key)
      });
    }

    return hexes;
  },

  /**
   * Validate that parsed hexes look like a real Catan board.
   */
  _validate(hexes) {
    if (hexes.length < 19) return false;

    const validResources = new Set(["lumber", "brick", "wool", "grain", "ore", "desert"]);
    if (!hexes.every(h => validResources.has(h.resource))) return false;

    // Must have at least 1 desert
    if (!hexes.some(h => h.resource === "desert")) return false;

    // Non-desert hexes must have valid dice numbers
    const nonDesert = hexes.filter(h => h.resource !== "desert");
    if (!nonDesert.every(h => h.number >= 2 && h.number <= 12)) return false;

    return true;
  },

  /**
   * Try to extract port/harbor data from the game state.
   */
  _findPorts(payload) {
    const harbors = payload.gameState?.mapState?.harbors ||
                    payload.gameState?.mapState?.harborStates ||
                    payload.gameState?.mapState?.ports;

    if (!harbors) return [];

    const values = Array.isArray(harbors) ? harbors : Object.values(harbors);
    return values.map(h => ({
      type: h.type ?? h.resource ?? "generic",
      position: h.position ?? h.edge ?? h.x ?? null
    })).filter(h => h.position !== null);
  }
};
