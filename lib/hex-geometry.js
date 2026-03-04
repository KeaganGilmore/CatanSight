/**
 * CatanSight - Hex Geometry Engine
 * Computes all intersections on a Catan board using axial coordinates.
 * Uses POINTY-TOP hex orientation (standard Catan board layout).
 */

if (!window.CatanSight) window.CatanSight = {};

CatanSight.HexGeometry = {
  /**
   * Convert axial (q, r) to pixel (x, y) for pointy-top hexes.
   * Size = distance from center to vertex.
   */
  axialToPixel(q, r, size) {
    const s = size || 1;
    const x = s * (Math.sqrt(3) * q + Math.sqrt(3) / 2 * r);
    const y = s * (3 / 2 * r);
    return { x, y };
  },

  /**
   * Get 6 vertex pixel positions for a hex at (q, r).
   * Pointy-top orientation: vertex 0 is at 30 degrees (top-right).
   */
  hexVertices(q, r, size) {
    const s = size || 1;
    const center = this.axialToPixel(q, r, s);
    const vertices = [];
    for (let i = 0; i < 6; i++) {
      const angleDeg = 30 + 60 * i;
      const angleRad = (Math.PI / 180) * angleDeg;
      vertices.push({
        x: center.x + s * Math.cos(angleRad),
        y: center.y + s * Math.sin(angleRad)
      });
    }
    return vertices;
  },

  /**
   * Build all unique intersections from game hex data.
   * @param {Array} hexes - parsed hex array with { q, r, resource, number, index }
   * @param {number} size - hex size for pixel computation
   * @returns {Array} intersections with { x, y, adjacentHexIndices }
   */
  buildIntersectionsFromHexes(hexes, size) {
    const s = size || 1;
    const EPSILON = s * 0.01;
    const intersections = [];

    hexes.forEach((hex, idx) => {
      const verts = this.hexVertices(hex.q, hex.r, s);
      verts.forEach(v => {
        const existing = intersections.find(
          iv => Math.abs(iv.x - v.x) < EPSILON && Math.abs(iv.y - v.y) < EPSILON
        );
        if (existing) {
          if (!existing.adjacentHexIndices.includes(idx)) {
            existing.adjacentHexIndices.push(idx);
          }
        } else {
          intersections.push({
            x: v.x,
            y: v.y,
            adjacentHexIndices: [idx]
          });
        }
      });
    });

    return intersections;
  }
};
