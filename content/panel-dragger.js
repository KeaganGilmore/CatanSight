/**
 * CatanSight - Panel Dragger
 * Makes side panels draggable by their header and freely positionable.
 */

if (!window.CatanSight) window.CatanSight = {};

CatanSight.PanelDragger = {
  /**
   * Make a panel draggable by its header.
   * When dragged, the panel pops out of its container and becomes position:fixed.
   */
  makeDraggable(panel, header) {
    let isDragging = false;
    let startX, startY, startLeft, startTop;

    header.addEventListener("mousedown", (e) => {
      // Don't drag if clicking toggle or close button
      if (e.target.closest(".catansight-panel-toggle") ||
          e.target.closest(".catansight-panel-close")) {
        return;
      }

      isDragging = true;
      panel.classList.add("catansight-dragging");

      // If panel is still in the container (not yet free), pop it out
      if (!panel.classList.contains("catansight-free")) {
        const rect = panel.getBoundingClientRect();
        panel.classList.add("catansight-free");
        panel.style.left = rect.left + "px";
        panel.style.top = rect.top + "px";
        // Move to body so it's freely positioned
        document.body.appendChild(panel);
      }

      startX = e.clientX;
      startY = e.clientY;
      startLeft = parseInt(panel.style.left, 10) || 0;
      startTop = parseInt(panel.style.top, 10) || 0;

      e.preventDefault();
    });

    document.addEventListener("mousemove", (e) => {
      if (!isDragging) return;

      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      panel.style.left = (startLeft + dx) + "px";
      panel.style.top = (startTop + dy) + "px";
    });

    document.addEventListener("mouseup", () => {
      if (!isDragging) return;
      isDragging = false;
      panel.classList.remove("catansight-dragging");
    });
  }
};
