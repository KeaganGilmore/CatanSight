/**
 * CatanSight - Hex Geometry Engine
 * Computes all 54 intersections on a standard Catan board using axial coordinates.
 */

const CatanSight = window.CatanSight || {};
window.CatanSight = CatanSight;

CatanSight.HexGeometry = {
  // Standard 3-4-5-4-3 Catan board in axial coordinates (q, r)
  BOARD_HEXES: [
    // Row 0 (3 hexes)
    { q: 0, r: -2 }, { q: 1, r: -2 }, { q: 2, r: -2 },
    // Row 1 (4 hexes)
    { q: -1, r: -1 }, { q: 0, r: -1 }, { q: 1, r: -1 }, { q: 2, r: -1 },
    // Row 2 (5 hexes)
    { q: -2, r: 0 }, { q: -1, r: 0 }, { q: 0, r: 0 }, { q: 1, r: 0 }, { q: 2, r: 0 },
    // Row 3 (4 hexes)
    { q: -2, r: 1 }, { q: -1, r: 1 }, { q: 0, r: 1 }, { q: 1, r: 1 },
    // Row 4 (3 hexes)
    { q: -2, r: 2 }, { q: -1, r: 2 }, { q: 0, r: 2 }
  ],

  /**
   * Convert axial (q, r) to pixel (x, y) for flat-top hexes.
   * Size = distance from center to vertex.
   */
  axialToPixel(q, r, size) {
    const s = size || 1;
    const x = s * (3 / 2 * q);
    const y = s * (Math.sqrt(3) / 2 * q + Math.sqrt(3) * r);
    return { x, y };
  },

  /**
   * Get 6 vertex pixel positions for a hex at (q, r).
   * Flat-top orientation: vertex 0 is at 0 degrees (right).
   */
  hexVertices(q, r, size) {
    const s = size || 1;
    const center = this.axialToPixel(q, r, s);
    const vertices = [];
    for (let i = 0; i < 6; i++) {
      const angleDeg = 60 * i;
      const angleRad = (Math.PI / 180) * angleDeg;
      vertices.push({
        x: center.x + s * Math.cos(angleRad),
        y: center.y + s * Math.sin(angleRad)
      });
    }
    return vertices;
  },

  /**
   * Build all unique intersections by deduplicating shared vertices.
   * Returns array of { x, y, adjacentHexIndices: number[] }
   */
  buildIntersections(size) {
    const s = size || 1;
    const EPSILON = s * 0.01;
    const intersections = [];

    this.BOARD_HEXES.forEach((hex, hexIdx) => {
      const verts = this.hexVertices(hex.q, hex.r, s);
      verts.forEach(v => {
        const existing = intersections.find(
          iv => Math.abs(iv.x - v.x) < EPSILON && Math.abs(iv.y - v.y) < EPSILON
        );
        if (existing) {
          if (!existing.adjacentHexIndices.includes(hexIdx)) {
            existing.adjacentHexIndices.push(hexIdx);
          }
        } else {
          intersections.push({
            x: v.x,
            y: v.y,
            adjacentHexIndices: [hexIdx]
          });
        }
      });
    });

    return intersections;
  },

  /**
   * Get the center pixel position for each hex.
   */
  getHexCenters(size) {
    const s = size || 1;
    return this.BOARD_HEXES.map(hex => this.axialToPixel(hex.q, hex.r, s));
  }
};
