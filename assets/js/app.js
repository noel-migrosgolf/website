/* =========================================================================
   1Automationen – Interaktion
   1) Hero: Gitter-Hintergrund mit Kreis-Ausschnitt an der Mausposition
   2) Header: Dropdown-Menüs
   3) Header: Suchfunktion
   4) Mobile-Navigation, Signup, Einblenden beim Scrollen, Sticky-Header
   5) Hero: scrollgesteuerte Bildsequenz auf dem Canvas
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

  /* Wird von initSearch belegt; initMenus schließt darüber die Suche. */
  var closeSearch = function () {};

  /* =======================================================================
     2) Dropdown-Menüs
     ===================================================================== */
  (function initMenus() {
    var triggers = Array.prototype.slice.call(document.querySelectorAll("[data-menu-trigger]"));
    if (!triggers.length) return;

    var openTimer  = 0;
    var closeTimer = 0;

    function panelOf(trigger) {
      return document.getElementById(trigger.getAttribute("aria-controls"));
    }

    function closeAll(except) {
      triggers.forEach(function (trigger) {
        if (trigger === except) return;
        var panel = panelOf(trigger);
        if (!panel || panel.hidden) return;
        panel.hidden = true;
        trigger.setAttribute("aria-expanded", "false");
      });
    }

    function open(trigger) {
      var panel = panelOf(trigger);
      if (!panel) return;
      closeAll(trigger);
      closeSearch();
      panel.hidden = false;
      trigger.setAttribute("aria-expanded", "true");
    }

    function close(trigger) {
      var panel = panelOf(trigger);
      if (!panel) return;
      panel.hidden = true;
      trigger.setAttribute("aria-expanded", "false");
    }

    triggers.forEach(function (trigger) {
      var item  = trigger.closest(".nav__item");
      var panel = panelOf(trigger);

      trigger.addEventListener("click", function () {
        if (trigger.getAttribute("aria-expanded") === "true") close(trigger);
        else open(trigger);
      });

      trigger.addEventListener("keydown", function (event) {
        if (event.key !== "ArrowDown" || !panel) return;
        event.preventDefault();
        open(trigger);
        var first = panel.querySelector("a");
        if (first) first.focus();
      });

      if (!finePointer || !item || !panel) return;

      [item, panel].forEach(function (zone) {
        zone.addEventListener("pointerenter", function () {
          clearTimeout(closeTimer);
          openTimer = setTimeout(function () { open(trigger); }, 90);
        });
        zone.addEventListener("pointerleave", function () {
          clearTimeout(openTimer);
          closeTimer = setTimeout(function () { close(trigger); }, 180);
        });
      });
    });

    document.addEventListener("keydown", function (event) {
      if (event.key !== "Escape") return;
      triggers.forEach(function (trigger) {
        if (trigger.getAttribute("aria-expanded") !== "true") return;
        close(trigger);
        trigger.focus();
      });
    });

    document.addEventListener("click", function (event) {
      if (event.target.closest("[data-menu], [data-menu-trigger]")) return;
      closeAll(null);
    });

    window.__closeAllMenus = function () { closeAll(null); };
  })();

  /* =======================================================================
     3) Suchfunktion
     ===================================================================== */
  (function initSearch() {
    var toggle  = document.querySelector("[data-search-toggle]");
    var panel   = document.querySelector("[data-search-panel]");
    var form    = document.querySelector("[data-search-form]");
    var input   = document.querySelector("[data-search-input]");
    var status  = document.querySelector("[data-search-status]");
    var results = document.querySelector("[data-search-results]");
    if (!toggle || !panel || !input || !results || !status) return;

    /* Durchsuchbarer Index – hier später echte Seiten eintragen. */
    var INDEX = [
      { title: "Prozesscheck",         category: "Produkt",    desc: "In zwei Minuten sehen, was sich in deinem Ablauf automatisieren lässt.", href: "/prozesscheck.html" },
      { title: "Alle Features",        category: "Funktionen", desc: "Der komplette Überblick über die Plattform.", href: "#" },
      { title: "Seiten und Dokumente", category: "Funktionen", desc: "Schreiben, strukturieren und gemeinsam teilen.", href: "#" },
      { title: "Whiteboards",          category: "Funktionen", desc: "Vom ersten Einfall zum fertigen Plan.", href: "#" },
      { title: "KI-Assistent",         category: "Funktionen", desc: "Inhalte zusammenfassen und Entwürfe erstellen.", href: "#" },
      { title: "Suche",                category: "Funktionen", desc: "Antworten statt endloser Trefferlisten.", href: "#" },
      { title: "Automatisierung",      category: "Funktionen", desc: "Wiederkehrende Aufgaben abgeben.", href: "#" },
      { title: "Guides",               category: "Ressourcen", desc: "Schritt für Schritt in die Plattform starten.", href: "#" },
      { title: "Blog",                 category: "Ressourcen", desc: "Neuigkeiten aus dem Produkt.", href: "#" },
      { title: "Community",            category: "Ressourcen", desc: "Fragen stellen, Antworten finden.", href: "#" },
      { title: "Support",              category: "Ressourcen", desc: "Direkte Hilfe vom Team.", href: "#" },
      { title: "Design",               category: "Vorlagen",   desc: "Vorlagen für Design-Teams.", href: "#" },
      { title: "Finanzen und Operations", category: "Vorlagen", desc: "Budgets, Reportings und Prozesse.", href: "#" },
      { title: "Human Resources",      category: "Vorlagen",   desc: "Onboarding, Feedback und Policies.", href: "#" },
      { title: "Marketing und Vertrieb", category: "Vorlagen", desc: "Kampagnen, Briefings und Pipelines.", href: "#" },
      { title: "Produktmanagement",    category: "Vorlagen",   desc: "PRDs, Roadmaps und Discovery.", href: "#" },
      { title: "Projektmanagement",    category: "Vorlagen",   desc: "Pläne, Status und Retrospektiven.", href: "#" },
      { title: "Software und IT",      category: "Vorlagen",   desc: "Runbooks, Incidents und Architektur.", href: "#" },
      { title: "Enterprise",           category: "Produkt",    desc: "Sicherheit, Governance und Skalierung.", href: "#" },
      { title: "Preise",               category: "Produkt",    desc: "Pläne und Konditionen im Vergleich.", href: "#" }
    ];

    var activeIndex = -1;
    var matches = [];

    function normalize(value) {
      return value
        .toLowerCase()
        .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss");
    }

    function escapeHtml(value) {
      return value.replace(/[&<>"']/g, function (char) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
      });
    }

    function highlight(text, query) {
      var position = normalize(text).indexOf(normalize(query));
      if (position < 0) return escapeHtml(text);
      return escapeHtml(text.slice(0, position)) +
             "<mark>" + escapeHtml(text.slice(position, position + query.length)) + "</mark>" +
             escapeHtml(text.slice(position + query.length));
    }

    function search(query) {
      var needle = normalize(query.trim());
      if (!needle) return [];
      return INDEX
        .map(function (item) {
          var title = normalize(item.title);
          var score = 0;
          if (title.indexOf(needle) === 0) score = 3;
          else if (title.indexOf(needle) > -1) score = 2;
          else if (normalize(item.category + " " + item.desc).indexOf(needle) > -1) score = 1;
          return { item: item, score: score };
        })
        .filter(function (entry) { return entry.score > 0; })
        .sort(function (a, b) { return b.score - a.score; })
        .map(function (entry) { return entry.item; })
        .slice(0, 8);
    }

    function setActive(next) {
      var options = results.querySelectorAll("li");
      if (!options.length) return;
      if (next < 0) next = options.length - 1;
      if (next >= options.length) next = 0;
      activeIndex = next;
      Array.prototype.forEach.call(options, function (option, index) {
        option.classList.toggle("is-active", index === activeIndex);
        option.setAttribute("aria-selected", String(index === activeIndex));
      });
      options[activeIndex].scrollIntoView({ block: "nearest" });
    }

    function render(query) {
      matches = search(query);
      activeIndex = -1;

      if (!query.trim()) {
        results.innerHTML = "";
        status.textContent = "";
        input.setAttribute("aria-expanded", "false");
        return;
      }

      results.innerHTML = matches.map(function (item) {
        return '<li role="option" aria-selected="false"><a href="' + item.href + '">' +
                 '<span class="search-results__title">' + highlight(item.title, query.trim()) + "</span>" +
                 '<span class="search-results__meta">' +
                   '<span class="search-results__cat">' + escapeHtml(item.category) + "</span>" +
                   escapeHtml(item.desc) +
                 "</span>" +
               "</a></li>";
      }).join("");

      status.textContent = 'Für den Suchbegriff „' + query.trim() + '" ' +
        (matches.length === 1 ? "wird 1 Ergebnis" : "werden " + matches.length + " Ergebnisse") +
        " angezeigt";
      input.setAttribute("aria-expanded", matches.length ? "true" : "false");
    }

    function openSearch() {
      if (window.__closeAllMenus) window.__closeAllMenus();
      panel.hidden = false;
      toggle.setAttribute("aria-expanded", "true");
      input.focus();
    }

    closeSearch = function (returnFocus) {
      if (panel.hidden) return;
      panel.hidden = true;
      toggle.setAttribute("aria-expanded", "false");
      if (returnFocus) toggle.focus();
    };

    toggle.addEventListener("click", function () {
      if (panel.hidden) openSearch();
      else closeSearch(true);
    });

    var closeButton = document.querySelector("[data-search-close]");
    if (closeButton) closeButton.addEventListener("click", function () { closeSearch(true); });

    input.addEventListener("input", function () { render(input.value); });

    input.addEventListener("keydown", function (event) {
      if (event.key === "ArrowDown") { event.preventDefault(); setActive(activeIndex + 1); }
      else if (event.key === "ArrowUp") { event.preventDefault(); setActive(activeIndex - 1); }
      else if (event.key === "Enter" && activeIndex > -1) {
        event.preventDefault();
        var link = results.querySelectorAll("li")[activeIndex].querySelector("a");
        if (link) link.click();
        closeSearch(false);
      }
    });

    if (form) form.addEventListener("submit", function (event) {
      event.preventDefault();
      var first = results.querySelector("li a");
      if (first) { first.click(); closeSearch(false); }
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") closeSearch(true);
      // Tastenkürzel "/" öffnet die Suche
      var focusedTag = (document.activeElement && document.activeElement.tagName) || "";
      if (event.key === "/" && !/^(INPUT|TEXTAREA|SELECT)$/.test(focusedTag)) {
        event.preventDefault();
        openSearch();
      }
    });

    document.addEventListener("click", function (event) {
      if (event.target.closest("[data-search-panel], [data-search-toggle]")) return;
      closeSearch(false);
    });
  })();

  /* =======================================================================
     4) Mobile-Navigation, Signup, Einblenden beim Scrollen, Sticky-Header
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

  (function initSignup() {
    var form = document.querySelector("[data-signup]");
    if (!form) return;

    var input   = form.querySelector("input[type=email]");
    var message = form.querySelector("[data-signup-message]");

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var value = input.value.trim();
      var valid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);

      message.classList.toggle("is-error", !valid);
      message.classList.toggle("is-success", valid);
      input.setAttribute("aria-invalid", String(!valid));

      if (!valid) {
        message.textContent = "Bitte gib eine gültige E-Mail-Adresse ein.";
        input.focus();
        return;
      }

      // Kein Backend angebunden – hier später den echten Endpunkt aufrufen.
      message.textContent = "Danke! Wir haben " + value + " notiert.";
      form.reset();
    });
  })();

  /* Inhalte unterhalb des Hero blenden sich beim Heranscrollen ein.
     Die Klasse js-reveal schaltet die CSS-Startwerte frei – ohne
     JavaScript bleibt alles unverändert sichtbar. */
  (function initReveal() {
    var items = Array.prototype.slice.call(document.querySelectorAll(".reveal"));
    if (!items.length) return;

    if (!("IntersectionObserver" in window)) {
      items.forEach(function (item) { item.classList.add("is-visible"); });
      return;
    }

    document.documentElement.classList.add("js-reveal");

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    }, { rootMargin: "0px 0px -12% 0px", threshold: 0.1 });

    items.forEach(function (item) { observer.observe(item); });
  })();

  /* =======================================================================
     5) Bildsequenz im Hero
     --------------------------------------------------------------------
     Der Scrollfortschritt steuert unmittelbar, welcher Frame auf dem
     Canvas liegt – nichts läuft von allein ab. Sobald die Bühne den
     oberen Fensterrand erreicht, wird sie angeheftet; erst mit dem
     letzten Frame gibt sie den Weg zum nächsten Abschnitt frei. Rückwärts
     gilt dasselbe, bis der erste Frame wieder erreicht ist.

     Ohne JavaScript, ohne GSAP oder bei reduzierter Bewegung bleibt das
     Standbild aus dem HTML stehen; dieser Block steigt dann still aus.
     ===================================================================== */
  (function initHeroSequence() {
    var wrapper = document.querySelector("[data-sequence]");
    var stage   = wrapper && wrapper.querySelector("[data-sequence-stage]");
    var canvas  = wrapper && wrapper.querySelector("[data-sequence-canvas]");
    if (!wrapper || !stage || !canvas) return;
    if (reduceMotion) return;
    if (!window.gsap || !window.ScrollTrigger) return;

    /* --- Einstellungen ------------------------------------------------- */
    var SEQUENZ = {
      pfad:     "assets/frames/hero-",   // ergibt assets/frames/hero-0001.jpg
      endung:   ".jpg",
      stellen:  4,
      anzahl:   233,
      /* Scrollstrecke der Sequenz als Vielfaches der Fensterhöhe.
         Höher = ruhigeres Durchblättern, aber längerer Weg bis zum
         nächsten Abschnitt. */
      strecke:  3.5,
      /* Nachlauf des Scrubbings in Sekunden; 0 klebt hart am Scrollrad. */
      scrub:    0.4,
      /* Wie viele Frames gleichzeitig geladen werden. */
      parallel: 8,
      /* Grundton der Frames, siehe .hero__canvas im Stylesheet. */
      grund:    "#E7EDED"
    };

    var ctx     = canvas.getContext("2d", { alpha: false });
    var bilder  = new Array(SEQUENZ.anzahl);
    var bereit  = new Array(SEQUENZ.anzahl);
    var gemalt  = -1;   // aktuell gezeichneter Frame
    var ziel    = 0;    // vom Scrollen gewünschter Frame
    var frame   = 0;    // laufende requestAnimationFrame-Anforderung

    function quelle(index) {
      var nummer = String(index + 1);
      while (nummer.length < SEQUENZ.stellen) nummer = "0" + nummer;
      return SEQUENZ.pfad + nummer + SEQUENZ.endung;
    }

    /* --- Canvas an Anzeigegrösse und Pixeldichte anpassen --------------- */
    function masseSetzen() {
      var rechteck = canvas.getBoundingClientRect();
      if (!rechteck.width || !rechteck.height) return false;

      var dichte = Math.min(window.devicePixelRatio || 1, 2);
      var breite = Math.round(rechteck.width * dichte);
      var hoehe  = Math.round(rechteck.height * dichte);
      if (breite === canvas.width && hoehe === canvas.height) return false;

      // Das Setzen der Masse leert den Canvas – der Aufrufer zeichnet neu.
      canvas.width  = breite;
      canvas.height = hoehe;
      return true;
    }

    /* --- Nächstes vorhandenes Bild zum gewünschten Frame ---------------- */
    function naechstesBereit(index) {
      var i;
      for (i = index; i >= 0; i--) if (bereit[i]) return i;
      for (i = index + 1; i < SEQUENZ.anzahl; i++) if (bereit[i]) return i;
      return -1;
    }

    function male(erzwingen) {
      var index = naechstesBereit(ziel);
      if (index < 0) return;
      if (index === gemalt && !erzwingen) return;   // nichts zu tun
      gemalt = index;

      var bild = bilder[index];
      var cb = canvas.width, ch = canvas.height;

      ctx.fillStyle = SEQUENZ.grund;
      ctx.fillRect(0, 0, cb, ch);

      /* Deckend einpassen: das Bild füllt die Fläche und behält sein
         Seitenverhältnis. Da Canvas und Frames beide 16:9 sind, geht
         dabei nichts verloren; bei abweichenden Massen wird mittig
         beschnitten statt verzerrt. */
      var skala = Math.max(cb / bild.naturalWidth, ch / bild.naturalHeight);
      var zb = bild.naturalWidth * skala;
      var zh = bild.naturalHeight * skala;
      ctx.drawImage(bild, (cb - zb) / 2, (ch - zh) / 2, zb, zh);
    }

    /* Mehrere Anforderungen pro Bildschirmaktualisierung fallen zu einem
       Zeichenvorgang zusammen. Ein zwischenzeitlich gesetztes "erzwingen"
       darf dabei nicht verloren gehen. */
    var erzwungen = false;
    function plane(erzwingen) {
      if (erzwingen) erzwungen = true;
      if (frame) return;
      frame = requestAnimationFrame(function () {
        frame = 0;
        var jetzt = erzwungen;
        erzwungen = false;
        male(jetzt);
      });
    }

    /* --- Laden ---------------------------------------------------------- */
    function lade(index, danach) {
      if (bilder[index]) { if (danach) danach(); return; }

      var bild = new Image();
      bild.decoding = "async";
      bild.onload = function () {
        bereit[index] = true;
        if (index <= ziel || gemalt < 0) plane(false);
        if (danach) danach();
      };
      bild.onerror = function () { if (danach) danach(); };
      bild.src = quelle(index);
      bilder[index] = bild;
    }

    /* Der Reihe nach mit begrenzt vielen parallelen Anforderungen, damit
       der erste Frame früh steht und die Verbindung nicht verstopft. */
    function vorladen() {
      var naechster = 0;
      function arbeiter() {
        if (naechster >= SEQUENZ.anzahl) return;
        lade(naechster++, arbeiter);
      }
      for (var i = 0; i < SEQUENZ.parallel; i++) arbeiter();
    }

    /* --- Scrollsteuerung ------------------------------------------------ */
    function starte() {
      wrapper.classList.add("is-aktiv");   // Canvas sichtbar, Bühne fensterhoch
      masseSetzen();
      male(true);

      window.ScrollTrigger.create({
        trigger: stage,
        start: "top top",
        end: function () {
          return "+=" + Math.round(window.innerHeight * SEQUENZ.strecke);
        },
        pin: stage,
        pinSpacing: true,
        anticipatePin: 1,          // kein Ruck beim Anheften
        scrub: SEQUENZ.scrub,
        invalidateOnRefresh: true, // Strecke nach Grössenänderung neu messen
        onUpdate: function (self) {
          var neu = Math.round(self.progress * (SEQUENZ.anzahl - 1));
          if (neu === ziel) return;
          ziel = neu;
          plane(false);
        }
      });

      /* Nach jedem Neuvermessen kann sich die Canvasgrösse geändert
         haben – dann ist die Zeichenfläche leer und muss neu gefüllt
         werden. */
      window.ScrollTrigger.addEventListener("refresh", function () {
        if (masseSetzen()) male(true);
      });

      window.addEventListener("resize", function () {
        if (masseSetzen()) male(true);
      }, { passive: true });

      /* Beim Aufruf blendet sich die Bühne ein und ist dabei noch
         verschoben. Würde ScrollTrigger in diesem Moment messen, begänne
         der Pin um ein paar Pixel versetzt und der Einstieg ruckelte.
         Deshalb nach dem Einblenden – und nach dem vollständigen Laden,
         falls Schriften die Höhe darüber noch verändern – neu vermessen. */
      if (wrapper.getAnimations) {
        Promise.all(wrapper.getAnimations().map(function (a) { return a.finished; }))
          .then(function () { window.ScrollTrigger.refresh(); })
          .catch(function () {});
      }
      window.addEventListener("load", function () { window.ScrollTrigger.refresh(); });
    }

    /* Erst wenn der erste Frame steht, wird umgeschaltet und die
       Scrollstrecke aufgespannt – so entsteht kein Layoutsprung. */
    lade(0, function () {
      if (!bereit[0]) return;   // Frame fehlt: Standbild bleibt stehen
      starte();
      vorladen();
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
