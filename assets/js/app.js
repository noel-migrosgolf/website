/* =========================================================================
   1Automationen – Interaktion
   1) Hero: Gitter-Hintergrund mit Kreis-Ausschnitt an der Mausposition
   2) Mobile-Navigation, Einblenden beim Scrollen, Sticky-Header
   ========================================================================= */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var finePointer  = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  /* =======================================================================
     1) Kreis-Ausschnitt folgt der Maus
     --------------------------------------------------------------------
     Das Gitter liegt in ::before, darüber deckt ::after alles mit der
     Hintergrundfarbe zu – bis auf einen Kreis an --graph-grid-x/y.
     Die Position wird hier weich nachgezogen (Lerp), damit der Kreis dem
     Cursor mit leichter Verzögerung folgt.
     ===================================================================== */
  (function initGridReveal() {
    var hero = document.querySelector("[data-grid-hero]");
    var grid = hero && hero.querySelector("[data-grid]");
    if (!hero || !grid) return;

    var current = null;      // aktuell gezeichnete Position
    var target  = null;      // Zielposition (Cursor)
    var frame   = 0;

    function apply(x, y) {
      grid.style.setProperty("--graph-grid-x", x.toFixed(1) + "px");
      grid.style.setProperty("--graph-grid-y", y.toFixed(1) + "px");
    }

    function tick() {
      frame = 0;
      if (!current || !target) return;

      var dx = target.x - current.x;
      var dy = target.y - current.y;

      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
        current = { x: target.x, y: target.y };
        apply(current.x, current.y);
        return;
      }

      current = { x: current.x + dx * 0.18, y: current.y + dy * 0.18 };
      apply(current.x, current.y);
      frame = requestAnimationFrame(tick);
    }

    function moveTo(x, y) {
      target = { x: x, y: y };
      if (!current || reduceMotion) {
        current = { x: x, y: y };
        apply(x, y);
        return;
      }
      if (!frame) frame = requestAnimationFrame(tick);
    }

    function onPointerMove(event) {
      var rect = hero.getBoundingClientRect();
      // Nur zeichnen, solange der Hero überhaupt im Blickfeld ist.
      if (rect.bottom < -200 || rect.top > window.innerHeight + 200) return;
      moveTo(event.clientX - rect.left, event.clientY - rect.top);
    }

    if (finePointer) {
      window.addEventListener("pointermove", onPointerMove, { passive: true });
    } else {
      // Touch: Kreis auf Tippen setzen, sonst mittig lassen.
      hero.addEventListener("pointerdown", onPointerMove, { passive: true });
    }
  })();

  /* =======================================================================
     2) Mobile-Navigation, Einblenden beim Scrollen, Sticky-Header
     ===================================================================== */
  (function initMobileNav() {
    var burger = document.querySelector("[data-burger]");
    var nav    = document.querySelector("[data-mobile-nav]");
    if (!burger || !nav) return;

    burger.addEventListener("click", function () {
      var open = burger.getAttribute("aria-expanded") === "true";
      burger.setAttribute("aria-expanded", String(!open));
      nav.hidden = open;
    });
  })();

  (function initStickyHeader() {
    var header = document.querySelector("[data-header]");
    if (!header) return;

    var ticking = false;
    function update() {
      ticking = false;
      header.classList.toggle("is-stuck", window.scrollY > 4);
    }
    window.addEventListener("scroll", function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    }, { passive: true });
    update();
  })();
})();
