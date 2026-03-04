/**
 * CatanSight - Pip Calculator
 * Computes pip totals for each intersection based on adjacent hex numbers.
 */

CatanSight.PipCalculator = {
  // Standard pip values: number of dots on dice faces that sum to each number
  PIP_VALUES: {
    2: 1, 3: 2, 4: 3, 5: 4, 6: 5,
    8: 5, 9: 4, 10: 3, 11: 2, 12: 1
  },

  /**
   * Calculate pip totals for all intersections.
   * @param {Array} boardHexes - parsed hex data [{resource, number, index}, ...]
   * @param {Array} intersections - from HexGeometry.buildIntersections()
   * @returns {Array} intersections enriched with pips, resources, tier
   */
  calculate(boardHexes, intersections) {
    return intersections.map(inter => {
      let totalPips = 0;
      const resources = [];

      inter.adjacentHexIndices.forEach(hexIdx => {
        if (hexIdx >= boardHexes.length) return;
        const hex = boardHexes[hexIdx];
        if (hex.resource === "desert") return;

        const pips = this.PIP_VALUES[hex.number] || 0;
        totalPips += pips;
        resources.push({
          resource: hex.resource,
          number: hex.number,
          pips: pips
        });
      });

      return {
        x: inter.x,
        y: inter.y,
        adjacentHexIndices: inter.adjacentHexIndices,
        pips: totalPips,
        resources: resources,
        probability: ((totalPips / 36) * 100).toFixed(1),
        tier: this._getTier(totalPips)
      };
    });
  },

  /**
   * Get color tier based on pip count.
   */
  _getTier(pips) {
    if (pips >= 10) return "excellent";
    if (pips >= 7) return "good";
    if (pips >= 4) return "average";
    if (pips > 0) return "poor";
    return "empty";
  }
};
