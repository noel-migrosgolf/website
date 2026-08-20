/* =========================================================================
   1Automationen – KI-Prozesscheck

   1) Zustand, Persistenz, Wiederaufnahme
   2) Schrittwechsel, Prüfung, Verlauf, Fokus
   3) Schritt 1: Ziele
   4) Schritt 2: Beschreibung, Qualitätsanzeiger, Diktieren
   5) Schritt 2: KI-Erkennung des Ablaufs
   6) Schritt 3: Systeme
   7) Schritt 4: Aufwand
   8) Schritt 5: Analyse und Ergebnis
   9) Kontaktformular

   Kein Framework, keine Abhängigkeit. Aufbau wie assets/js/app.js:
   eine äussere IIFE, darin je Aufgabe eine benannte Funktion, die früh
   zurückkehrt, wenn ihre Elemente fehlen.
   ========================================================================= */
(function () {
  "use strict";

  var wizard = document.querySelector("[data-wizard]");
  if (!wizard) return;

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ENTSCHEIDUNG: Stundensatz für die Frankenrechnung. Der Server rechnet
     mit demselben Wert (api/_lib/rechnen.js) – beide zusammen ändern. */
  var STUNDENSATZ_CHF = 80;

  var SPEICHER = "1a-prozesscheck";
  var LETZTER_SCHRITT = 5;

  var nf0 = new Intl.NumberFormat("de-CH", { maximumFractionDigits: 0 });
  var nf1 = new Intl.NumberFormat("de-CH", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

  /* =======================================================================
     Kleine Helfer
     ===================================================================== */
  function el(auswahl, wurzel) { return (wurzel || document).querySelector(auswahl); }
  function els(auswahl, wurzel) {
    return Array.prototype.slice.call((wurzel || document).querySelectorAll(auswahl));
  }

  function erzeuge(tag, klasse, text) {
    var knoten = document.createElement(tag);
    if (klasse) knoten.className = klasse;
    if (text != null) knoten.textContent = text;
    return knoten;
  }

  /* Piktogramm als SVG mit <use>. Nie über innerHTML mit fremden Daten. */
  function piktogramm(name, groesse) {
    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", groesse || 20);
    svg.setAttribute("height", groesse || 20);
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    var use = document.createElementNS("http://www.w3.org/2000/svg", "use");
    use.setAttribute("href", "#" + name);
    svg.appendChild(use);
    return svg;
  }

  function stundenText(wert) {
    if (!isFinite(wert)) return "0";
    return wert >= 10 ? nf0.format(Math.round(wert)) : nf1.format(Math.round(wert * 10) / 10);
  }

  function fokussiere(knoten) {
    if (!knoten) return;
    knoten.focus({ preventScroll: true });
  }

  /* =======================================================================
     Stammdaten

     Stehen bewusst vor allen Abschnitten: der Qualitätsanzeiger in
     Schritt 2 greift auf SYSTEM_LISTE zu, und var-Deklarationen weiter
     unten wären zu diesem Zeitpunkt noch undefined.
     ===================================================================== */
  var SYSTEM_GRUPPEN = [
    { titel: "Microsoft", eintraege: [
      { id: "outlook", name: "Outlook", ikone: "pi-mail" },
      { id: "excel", name: "Excel", ikone: "pi-document" },
      { id: "word", name: "Word", ikone: "pi-document" },
      { id: "teams", name: "Teams", ikone: "pi-system" },
      { id: "sharepoint", name: "SharePoint", ikone: "pi-system" },
      { id: "onedrive", name: "OneDrive", ikone: "pi-system" },
      { id: "power-automate", name: "Power Automate", ikone: "pi-repeat" },
      { id: "power-apps", name: "Power Apps", ikone: "pi-system" },
      { id: "dynamics", name: "Dynamics", ikone: "pi-system" }
    ] },
    { titel: "Google", eintraege: [
      { id: "gmail", name: "Gmail", ikone: "pi-mail" },
      { id: "google-sheets", name: "Google Sheets", ikone: "pi-document" },
      { id: "google-docs", name: "Google Docs", ikone: "pi-document" },
      { id: "google-drive", name: "Google Drive", ikone: "pi-system" },
      { id: "kalender", name: "Kalender", ikone: "pi-clock" }
    ] },
    { titel: "Kommunikation", eintraege: [
      { id: "slack", name: "Slack", ikone: "pi-system" },
      { id: "whatsapp", name: "WhatsApp Business", ikone: "pi-mail" },
      { id: "telefon", name: "Telefon", ikone: "pi-system" },
      { id: "videocall", name: "Videocall", ikone: "pi-system" }
    ] },
    { titel: "Geschäft", eintraege: [
      { id: "crm", name: "CRM", ikone: "pi-system" },
      { id: "erp", name: "ERP", ikone: "pi-system" },
      { id: "buchhaltung", name: "Buchhaltung", ikone: "pi-system" },
      { id: "lohn", name: "Lohnsystem", ikone: "pi-system" },
      { id: "zeiterfassung", name: "Zeiterfassung", ikone: "pi-clock" },
      { id: "warenwirtschaft", name: "Warenwirtschaft", ikone: "pi-system" },
      { id: "kasse", name: "Kassensystem", ikone: "pi-system" },
      { id: "branchenloesung", name: "Branchenlösung", ikone: "pi-system" }
    ] },
    { titel: "Dateien", eintraege: [
      { id: "pdf", name: "PDF", ikone: "pi-document" },
      { id: "scan", name: "Scan", ikone: "pi-document" },
      { id: "papier", name: "Papier", ikone: "pi-document" },
      { id: "formular", name: "Formular", ikone: "pi-document" },
      { id: "datenbank", name: "Datenbank", ikone: "pi-system" }
    ] },
    { titel: "Web", eintraege: [
      { id: "website", name: "Website", ikone: "pi-system" },
      { id: "webshop", name: "Webshop", ikone: "pi-system" },
      { id: "onlineformular", name: "Onlineformular", ikone: "pi-document" },
      { id: "api", name: "Schnittstelle (API)", ikone: "pi-link" },
      { id: "unbekannt", name: "Weiss ich nicht", ikone: "pi-help" }
    ] }
  ];

  // Flache Liste für den Qualitätsanzeiger in Schritt 2.
  var SYSTEM_LISTE = SYSTEM_GRUPPEN.reduce(function (alle, gruppe) {
    return alle.concat(gruppe.eintraege.map(function (e) {
      return { id: e.id, suche: e.name.toLowerCase() };
    }));
  }, []);

  // Was die KI erkennt, auf die Chips abbilden.
  var SYNONYME = {
    "e-mail": "outlook", "email": "outlook", "mail": "outlook", "posteingang": "outlook",
    "tabelle": "excel", "excel-tabelle": "excel", "spreadsheet": "google-sheets",
    "sheets": "google-sheets", "docs": "google-docs", "drive": "google-drive",
    "sap": "erp", "abacus": "erp", "bexio": "buchhaltung", "banana": "buchhaltung",
    "salesforce": "crm", "hubspot": "crm", "pipedrive": "crm",
    "microsoft-365": "outlook", "office": "word", "office-365": "outlook",
    "kalender-outlook": "kalender", "telefonat": "telefon", "anruf": "telefon",
    "ausdruck": "papier", "unterschrift": "papier", "ordner": "papier",
    "dokument": "pdf", "rechnung": "pdf", "webformular": "onlineformular",
    "schnittstelle": "api", "rest": "api"
  };

  var bekannteIds = SYSTEM_LISTE.map(function (s) { return s.id; });

  /* =======================================================================
     1) Zustand
     ===================================================================== */
  var zustand = {
    schritt: 1,
    ziele: [],
    beschreibung: "",
    verstanden: null,
    schritteBestaetigt: false,
    schritteListe: [],
    rueckfragen: [],
    systeme: [],
    systemeFrei: [],
    vernetzung: null,
    haeufigkeit: null,
    dauer: null,
    personen: null,
    ergebnis: null,
    gesendet: false
  };

  function speichern() {
    try {
      sessionStorage.setItem(SPEICHER, JSON.stringify(zustand));
    } catch (fehler) { /* Speicher gesperrt – dann eben ohne Persistenz */ }
  }

  function laden() {
    try {
      var roh = sessionStorage.getItem(SPEICHER);
      return roh ? JSON.parse(roh) : null;
    } catch (fehler) { return null; }
  }

  function leeren() {
    try { sessionStorage.removeItem(SPEICHER); } catch (fehler) { /* egal */ }
  }

  /* =======================================================================
     2) Schrittwechsel
     ===================================================================== */
  var abschnitte = els("[data-step]", wizard);
  var navLeiste = el("[data-nav]", wizard);
  var knopfZurueck = el("[data-zurueck]", wizard);
  var knopfWeiter = el("[data-weiter]", wizard);
  var weiterText = el("[data-weiter-text]", wizard);
  var weiterIcon = el("[data-weiter-icon]", wizard);
  var karte = el(".pc-card");
  var erstesZeigen = true;

  function abschnittVon(nummer) {
    return abschnitte.filter(function (a) { return Number(a.dataset.step) === nummer; })[0];
  }

  function zeigeFehler(nummer, nachricht) {
    var abschnitt = abschnittVon(nummer);
    var feld = abschnitt && el(".wz-step__error", abschnitt);
    if (!feld) return;
    if (!nachricht) { feld.hidden = true; feld.textContent = ""; return; }
    feld.textContent = "";
    feld.appendChild(piktogramm("pi-warning", 16));
    feld.appendChild(document.createTextNode(nachricht));
    feld.hidden = false;
  }

  function pruefe(nummer) {
    zeigeFehler(nummer, "");

    if (nummer === 1 && !zustand.ziele.length) {
      zeigeFehler(1, "Bitte wähle mindestens einen Punkt aus.");
      return false;
    }
    if (nummer === 2 && zustand.beschreibung.trim().length < 40) {
      zeigeFehler(2, "Bitte beschreibe deinen Ablauf in ein, zwei Sätzen — sonst kann die Analyse nichts erkennen.");
      var feld = el("[data-beschreibung]");
      if (feld) { feld.setAttribute("aria-invalid", "true"); feld.focus(); }
      return false;
    }
    if (nummer === 2) {
      var kiHinweis = el('input[name="ki-hinweis"]', wizard);
      var kiFehler = el("#wz-ki-hinweis-fehler", wizard);
      if (!kiHinweis || !kiHinweis.checked) {
        if (kiFehler) {
          kiFehler.textContent = "Bitte bestätige den Datenschutzhinweis, bevor die KI-Analyse startet.";
          kiFehler.hidden = false;
        }
        if (kiHinweis) kiHinweis.focus();
        return false;
      }
      if (kiFehler) { kiFehler.textContent = ""; kiFehler.hidden = true; }
    }
    return true;
  }

  function zeigeSchritt(nummer, mitVerlauf) {
    zustand.schritt = nummer;

    abschnitte.forEach(function (abschnitt) {
      abschnitt.hidden = Number(abschnitt.dataset.step) !== nummer;
    });

    knopfZurueck.hidden = nummer === 1 || nummer === LETZTER_SCHRITT;
    navLeiste.hidden = nummer === LETZTER_SCHRITT;

    if (nummer === 4) {
      weiterText.textContent = "Analyse starten";
      weiterIcon.firstChild.setAttribute("href", "#pi-spark");
    } else {
      weiterText.textContent = "Weiter";
      weiterIcon.firstChild.setAttribute("href", "#pi-arrow-right");
    }

    if (karte) karte.classList.toggle("is-breit", nummer === LETZTER_SCHRITT);

    speichern();

    // Beim ersten Aufbau weder Fokus setzen noch scrollen: der Besucher
    // soll oben bei der Überschrift beginnen, und ein Fokussprung beim
    // Laden ist irritierend.
    if (erstesZeigen) { erstesZeigen = false; return; }

    var abschnitt = abschnittVon(nummer);
    var titel = abschnitt && el(".wz-step__title", abschnitt);
    fokussiere(titel);

    var oben = karte.getBoundingClientRect().top + window.scrollY - 88;
    window.scrollTo({ top: Math.max(0, oben), behavior: reduceMotion ? "auto" : "smooth" });

    if (mitVerlauf !== false) {
      history.pushState({ schritt: nummer }, "", "#schritt-" + nummer);
    }
  }

  function weiter() {
    if (!pruefe(zustand.schritt)) return;

    if (zustand.schritt === 4) {
      zeigeSchritt(5);
      starteAnalyse();
      return;
    }
    if (zustand.schritt < LETZTER_SCHRITT) zeigeSchritt(zustand.schritt + 1);
  }

  knopfWeiter.addEventListener("click", weiter);
  knopfZurueck.addEventListener("click", function () {
    if (zustand.schritt > 1) zeigeSchritt(zustand.schritt - 1);
  });

  window.addEventListener("popstate", function (ereignis) {
    var nummer = (ereignis.state && ereignis.state.schritt) || 1;
    if (nummer !== zustand.schritt) zeigeSchritt(nummer, false);
  });

  // Enter in einzeiligen Feldern führt weiter, im Textfeld nicht.
  wizard.addEventListener("keydown", function (ereignis) {
    if (ereignis.key !== "Enter") return;
    var ziel = ereignis.target;
    if (ziel.tagName === "TEXTAREA" || ziel.tagName === "BUTTON") return;
    if (ziel.closest("[data-lead]")) return;
    if (ziel.matches("[data-system-frei]")) return;   // hat einen eigenen Knopf
    ereignis.preventDefault();
    if (zustand.schritt < LETZTER_SCHRITT) weiter();
  });

  wizard.addEventListener("submit", function (e) { e.preventDefault(); });

  /* =======================================================================
     3) Schritt 1: Ziele
     ===================================================================== */
  (function initZiele() {
    var kaestchen = els('input[name="ziel"]', wizard);
    if (!kaestchen.length) return;

    kaestchen.forEach(function (feld) {
      feld.addEventListener("change", function () {
        // "Ich weiss noch nicht genau" schliesst die übrigen aus.
        if (feld.value === "unklar" && feld.checked) {
          kaestchen.forEach(function (a) { if (a !== feld) a.checked = false; });
        } else if (feld.checked) {
          var unklar = kaestchen.filter(function (a) { return a.value === "unklar"; })[0];
          if (unklar) unklar.checked = false;
        }

        zustand.ziele = kaestchen.filter(function (a) { return a.checked; })
                                 .map(function (a) { return a.value; });
        if (zustand.ziele.length) zeigeFehler(1, "");
        speichern();
      });
    });
  })();

  /* =======================================================================
     4) Schritt 2: Beschreibung
     ===================================================================== */
  var feldBeschreibung = el("[data-beschreibung]");
  var feldKiHinweis = el('input[name="ki-hinweis"]', wizard);

  var BEISPIEL = "Eine Kundenanfrage kommt per E-Mail bei mir an. Ich lese sie durch " +
    "und prüfe, ob alle Angaben vollständig sind. Danach übertrage ich Name, Adresse " +
    "und die gewünschten Positionen von Hand in meine Excel-Tabelle. Aus der Tabelle " +
    "erstelle ich ein Angebot in Word, speichere es als PDF und schicke es dem Kunden " +
    "per E-Mail zurück. Zum Schluss trage ich in einer zweiten Liste ein, dass das " +
    "Angebot verschickt wurde, damit ich nach einer Woche nachfassen kann.";

  (function initBeschreibung() {
    if (!feldBeschreibung) return;

    var anzeige = el("[data-qualitaet]");
    var anzeigeText = anzeige && el(".wz-quality__text", anzeige);
    var zaehler = el("[data-counter]");
    var knopfBeispiel = el("[data-beispiel]");

    var SCHRITTWOERTER = /\b(dann|danach|anschliessend|anschließend|zuerst|zum schluss|sobald|jeweils|danach|weiter|erst|später)\b/gi;

    function schrittZahl(text) {
      var saetze = text.split(/[.!?\n]+/).filter(function (s) { return s.trim().length > 8; }).length;
      var woerter = (text.match(SCHRITTWOERTER) || []).length;
      return saetze + woerter;
    }

    function systemZahl(text) {
      var klein = text.toLowerCase();
      return SYSTEM_LISTE.filter(function (s) {
        return klein.indexOf(s.suche) > -1;
      }).length;
    }

    function bewerte() {
      var text = feldBeschreibung.value;
      var laenge = text.trim().length;
      var schritte = schrittZahl(text);
      var systeme = systemZahl(text);

      var stufe = 1;
      var satz = "Noch etwas knapp. Was löst den Ablauf aus, und was steht am Ende?";

      if (laenge >= 260 && schritte >= 4 && systeme >= 1) {
        stufe = 3;
        satz = "Sehr gut. Das reicht für eine belastbare Analyse.";
      } else if (laenge >= 120 && schritte >= 3) {
        stufe = 2;
        satz = "Gut. Nenne noch die beteiligten Programme, wenn du magst.";
      }

      if (anzeige) anzeige.dataset.stufe = String(stufe);
      if (anzeigeText) anzeigeText.textContent = satz;

      if (zaehler) {
        zaehler.hidden = text.length < 3000;
        zaehler.textContent = text.length + " / 4000";
      }
    }

    feldBeschreibung.addEventListener("input", function () {
      zustand.beschreibung = feldBeschreibung.value;
      feldBeschreibung.removeAttribute("aria-invalid");
      if (zustand.beschreibung.trim().length >= 40) zeigeFehler(2, "");
      bewerte();
      speichern();
      planeErkennung();
    });

    feldBeschreibung.addEventListener("blur", function () { erkenneJetzt(false); });

    if (knopfBeispiel) knopfBeispiel.addEventListener("click", function () {
      if (feldBeschreibung.value.trim() && !confirm("Der vorhandene Text wird ersetzt. Fortfahren?")) return;
      feldBeschreibung.value = BEISPIEL;
      feldBeschreibung.dispatchEvent(new Event("input", { bubbles: true }));
      feldBeschreibung.focus();
      erkenneJetzt(false);
    });

    bewerte();
  })();

  /* --- Diktieren: nur wenn der Browser es kann ------------------------- */
  (function initDiktieren() {
    var Erkennung = window.SpeechRecognition || window.webkitSpeechRecognition;
    var knopf = el("[data-diktieren]");
    if (!Erkennung || !knopf || !feldBeschreibung) return;

    var beschriftung = el("[data-diktieren-text]", knopf);
    var erkennung = null;
    var laeuft = false;
    var stand = "";

    knopf.hidden = false;

    function beende() {
      laeuft = false;
      knopf.classList.remove("is-aktiv");
      if (beschriftung) beschriftung.textContent = "Diktieren";
    }

    knopf.addEventListener("click", function () {
      if (laeuft) { if (erkennung) erkennung.stop(); return; }

      erkennung = new Erkennung();
      erkennung.lang = "de-CH";
      erkennung.continuous = true;
      erkennung.interimResults = true;

      stand = feldBeschreibung.value ? feldBeschreibung.value.replace(/\s+$/, "") + " " : "";

      erkennung.onresult = function (ereignis) {
        var endgueltig = "";
        var vorlaeufig = "";
        for (var i = ereignis.resultIndex; i < ereignis.results.length; i++) {
          var teil = ereignis.results[i][0].transcript;
          if (ereignis.results[i].isFinal) endgueltig += teil;
          else vorlaeufig += teil;
        }
        if (endgueltig) stand += endgueltig;
        feldBeschreibung.value = stand + vorlaeufig;
        zustand.beschreibung = feldBeschreibung.value;
      };

      erkennung.onerror = function (ereignis) {
        beende();
        // Verweigertes Mikrofon: den Knopf ganz ausblenden statt zu meckern.
        if (ereignis.error === "not-allowed" || ereignis.error === "service-not-allowed") {
          knopf.hidden = true;
        }
      };

      erkennung.onend = function () {
        beende();
        feldBeschreibung.dispatchEvent(new Event("input", { bubbles: true }));
        erkenneJetzt(false);
      };

      try {
        erkennung.start();
        laeuft = true;
        knopf.classList.add("is-aktiv");
        if (beschriftung) beschriftung.textContent = "Aufnahme beenden";
      } catch (fehler) {
        beende();
      }
    });
  })();

  /* =======================================================================
     5) KI-Erkennung des Ablaufs
     ===================================================================== */
  var kastenVerstanden = el("[data-understood]");
  var spinnerVerstanden = el("[data-understood-spinner]");
  var listeSchritte = el("[data-steps]");
  var zeileAusloeser = el("[data-verstanden-ausloeser-zeile]");
  var textAusloeser = el("[data-verstanden-ausloeser]");
  var zeileErgebnis = el("[data-verstanden-ergebnis-zeile]");
  var textErgebnis = el("[data-verstanden-ergebnis]");
  var kastenFragen = el("[data-questions]");
  var listeFragen = el("[data-questions-list]");

  var erkennungTimer = 0;
  var erkennungLetzterText = "";
  var erkennungLetzterAufruf = 0;
  var erkennungAbbruch = null;
  var erkennungCache = new Map();
  var erkennungLaeuft = false;

  function planeErkennung() {
    clearTimeout(erkennungTimer);
    if (!feldKiHinweis || !feldKiHinweis.checked) return;
    if (feldBeschreibung.value.trim().length < 140) return;
    erkennungTimer = setTimeout(function () { erkenneJetzt(false); }, 1200);
  }

  function erkenneJetzt(blockierend) {
    if (!feldBeschreibung) return Promise.resolve();
    if (!feldKiHinweis || !feldKiHinweis.checked) return Promise.resolve();

    var text = feldBeschreibung.value.trim();
    if (text.length < 60) return Promise.resolve();

    // Nicht bei jeder Kleinigkeit erneut fragen.
    var unterschied = Math.abs(text.length - erkennungLetzterText.length);
    if (text === erkennungLetzterText) return Promise.resolve();
    if (!blockierend && erkennungLetzterText && unterschied < 25) return Promise.resolve();

    if (erkennungCache.has(text)) {
      uebernehmeErkennung(erkennungCache.get(text));
      erkennungLetzterText = text;
      return Promise.resolve();
    }

    var jetzt = Date.now();
    if (!blockierend && jetzt - erkennungLetzterAufruf < 4000) return Promise.resolve();
    erkennungLetzterAufruf = jetzt;
    erkennungLetzterText = text;

    if (erkennungAbbruch) erkennungAbbruch.abort();
    erkennungAbbruch = new AbortController();

    erkennungLaeuft = true;
    if (kastenVerstanden && !kastenVerstanden.hidden && spinnerVerstanden) {
      spinnerVerstanden.hidden = false;
    }

    return fetch("/api/verstehen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ beschreibung: text, ziele: zustand.ziele }),
      signal: erkennungAbbruch.signal
    })
      .then(function (antwort) {
        if (!antwort.ok) throw new Error("nicht ok");
        return antwort.json();
      })
      .then(function (daten) {
        erkennungCache.set(text, daten);
        uebernehmeErkennung(daten);
      })
      .catch(function () {
        // Still ignorieren: Der Besucher füllt dann von Hand aus und merkt
        // von der Störung nichts.
      })
      .finally(function () {
        erkennungLaeuft = false;
        if (spinnerVerstanden) spinnerVerstanden.hidden = true;
      });
  }

  if (feldKiHinweis) {
    feldKiHinweis.addEventListener("change", function () {
      var fehler = el("#wz-ki-hinweis-fehler");
      if (fehler) {
        fehler.textContent = feldKiHinweis.checked ? "" :
          "Bitte bestätige den Datenschutzhinweis, bevor die KI-Analyse startet.";
        fehler.hidden = feldKiHinweis.checked;
      }
      if (feldKiHinweis.checked) planeErkennung();
    });
  }

  function uebernehmeErkennung(daten) {
    if (!daten) return;
    zustand.verstanden = daten;

    if (!zustand.schritteBestaetigt) {
      zustand.schritteListe = (daten.schritte || []).map(function (s) {
        return { text: s.text, system: s.system || "" };
      });
    }

    // Rückfragen: bereits gegebene Antworten bleiben erhalten.
    var alt = {};
    zustand.rueckfragen.forEach(function (r) { alt[r.frage] = r.antwort; });
    zustand.rueckfragen = (daten.rueckfragen || []).map(function (frage) {
      return { frage: frage, antwort: alt[frage] || "" };
    });

    zeichneVerstanden();
    uebernehmeVorbelegungen(daten);
    speichern();
  }

  function zeichneVerstanden() {
    if (!kastenVerstanden) return;

    var hatInhalt = zustand.schritteListe.length ||
      (zustand.verstanden && (zustand.verstanden.ausloeser || zustand.verstanden.ergebnis));
    if (!hatInhalt) { kastenVerstanden.hidden = true; return; }

    kastenVerstanden.hidden = false;

    var v = zustand.verstanden || {};
    if (zeileAusloeser) {
      zeileAusloeser.hidden = !v.ausloeser;
      if (v.ausloeser && textAusloeser) textAusloeser.textContent = v.ausloeser;
    }
    if (zeileErgebnis) {
      zeileErgebnis.hidden = !v.ergebnis;
      if (v.ergebnis && textErgebnis) textErgebnis.textContent = v.ergebnis;
    }

    zeichneSchritte();
    zeichneFragen();
  }

  function zeichneSchritte() {
    if (!listeSchritte) return;
    listeSchritte.textContent = "";

    var teil = document.createDocumentFragment();

    zustand.schritteListe.forEach(function (schritt, index) {
      var zeile = erzeuge("li", "wz-steps__item");

      zeile.appendChild(erzeuge("span", "wz-steps__num", String(index + 1)));

      var text = erzeuge("input", "wz-steps__text");
      text.type = "text";
      text.value = schritt.text;
      text.maxLength = 200;
      text.setAttribute("aria-label", "Schritt " + (index + 1));
      text.addEventListener("input", function () {
        zustand.schritteListe[index].text = text.value;
        zustand.schritteBestaetigt = true;
        speichern();
      });
      zeile.appendChild(text);

      var system = erzeuge("input", "wz-steps__sys");
      system.type = "text";
      system.value = schritt.system || "";
      system.maxLength = 40;
      system.placeholder = "Programm";
      system.setAttribute("aria-label", "Programm für Schritt " + (index + 1));
      system.addEventListener("input", function () {
        zustand.schritteListe[index].system = system.value;
        zustand.schritteBestaetigt = true;
        speichern();
      });
      zeile.appendChild(system);

      var aktionen = erzeuge("div", "wz-steps__actions");

      aktionen.appendChild(schrittKnopf("pi-arrow-up", "nach oben", index === 0, function () {
        tausche(index, index - 1);
      }));
      aktionen.appendChild(schrittKnopf("pi-arrow-down", "nach unten",
        index === zustand.schritteListe.length - 1, function () {
          tausche(index, index + 1);
        }));
      aktionen.appendChild(schrittKnopf("pi-minus", "entfernen", false, function () {
        zustand.schritteListe.splice(index, 1);
        zustand.schritteBestaetigt = true;
        zeichneSchritte();
        speichern();
      }));

      zeile.appendChild(aktionen);
      teil.appendChild(zeile);
    });

    listeSchritte.appendChild(teil);
  }

  function schrittKnopf(ikone, beschreibung, gesperrt, handlung) {
    var knopf = erzeuge("button", "wz-steps__btn");
    knopf.type = "button";
    knopf.disabled = gesperrt;
    knopf.title = "Schritt " + beschreibung;
    knopf.appendChild(piktogramm(ikone, 15));
    knopf.appendChild(erzeuge("span", "visually-hidden", "Schritt " + beschreibung));
    knopf.addEventListener("click", handlung);
    return knopf;
  }

  function tausche(a, b) {
    var liste = zustand.schritteListe;
    if (b < 0 || b >= liste.length) return;
    var merk = liste[a];
    liste[a] = liste[b];
    liste[b] = merk;
    zustand.schritteBestaetigt = true;
    zeichneSchritte();
    speichern();

    // Fokus auf den bewegten Schritt zurücklegen.
    var zeilen = els(".wz-steps__item", listeSchritte);
    if (zeilen[b]) fokussiere(el(".wz-steps__text", zeilen[b]));
  }

  (function initSchrittHinzufuegen() {
    var knopf = el("[data-step-add]");
    if (!knopf) return;
    knopf.addEventListener("click", function () {
      zustand.schritteListe.push({ text: "", system: "" });
      zustand.schritteBestaetigt = true;
      zeichneSchritte();
      speichern();
      var zeilen = els(".wz-steps__item", listeSchritte);
      fokussiere(el(".wz-steps__text", zeilen[zeilen.length - 1]));
    });
  })();

  function zeichneFragen() {
    if (!kastenFragen || !listeFragen) return;

    if (!zustand.rueckfragen.length) { kastenFragen.hidden = true; return; }
    kastenFragen.hidden = false;
    listeFragen.textContent = "";

    zustand.rueckfragen.forEach(function (eintrag, index) {
      var block = erzeuge("div", "wz-question");
      var kennung = "wz-frage-" + index;

      var beschriftung = erzeuge("label", "wz-question__label", eintrag.frage);
      beschriftung.setAttribute("for", kennung);
      block.appendChild(beschriftung);

      var feld = erzeuge("input", "wz-input");
      feld.type = "text";
      feld.id = kennung;
      feld.maxLength = 300;
      feld.value = eintrag.antwort;
      feld.placeholder = "Antwort in einem Satz";
      feld.addEventListener("input", function () {
        zustand.rueckfragen[index].antwort = feld.value;
        speichern();
      });
      block.appendChild(feld);

      listeFragen.appendChild(block);
    });
  }

  /* =======================================================================
     6) Schritt 3: Systeme
     ===================================================================== */

  (function initSysteme() {
    var behaelter = el("[data-systeme]");
    if (!behaelter) return;

    SYSTEM_GRUPPEN.forEach(function (gruppe) {
      var block = erzeuge("div", "wz-gruppe");
      block.appendChild(erzeuge("p", "wz-gruppe__label", gruppe.titel));

      var feldsatz = erzeuge("fieldset", "wz-chips");
      var legende = erzeuge("legend", "visually-hidden", gruppe.titel);
      feldsatz.appendChild(legende);

      gruppe.eintraege.forEach(function (eintrag) {
        var beschriftung = erzeuge("label", "wz-chip");

        var feld = erzeuge("input");
        feld.type = "checkbox";
        feld.name = "system";
        feld.value = eintrag.id;
        feld.addEventListener("change", function () {
          if (feld.checked) {
            if (zustand.systeme.indexOf(eintrag.id) < 0) zustand.systeme.push(eintrag.id);
          } else {
            zustand.systeme = zustand.systeme.filter(function (s) { return s !== eintrag.id; });
            beschriftung.classList.remove("is-erkannt");
            var marke = el(".wz-chip__erkannt", beschriftung);
            if (marke) marke.remove();
          }
          speichern();
        });

        var huelle = erzeuge("span");
        var ikone = piktogramm(eintrag.ikone, 16);
        ikone.classList.add("wz-chip__icon");
        huelle.appendChild(ikone);
        huelle.appendChild(erzeuge("span", null, eintrag.name));

        beschriftung.appendChild(feld);
        beschriftung.appendChild(huelle);
        feldsatz.appendChild(beschriftung);
      });

      block.appendChild(feldsatz);
      behaelter.appendChild(block);
    });

    els('input[name="vernetzung"]', wizard).forEach(function (feld) {
      feld.addEventListener("change", function () {
        zustand.vernetzung = feld.value;
        speichern();
      });
    });
  })();

  function markiereErkannt(id) {
    var feld = el('input[name="system"][value="' + CSS.escape(id) + '"]', wizard);
    if (!feld || feld.checked) return;

    feld.checked = true;
    if (zustand.systeme.indexOf(id) < 0) zustand.systeme.push(id);

    var beschriftung = feld.closest(".wz-chip");
    if (!beschriftung || el(".wz-chip__erkannt", beschriftung)) return;

    var marke = piktogramm("pi-spark", 13);
    marke.classList.add("wz-chip__erkannt");
    beschriftung.classList.add("is-erkannt");
    beschriftung.title = "Aus deiner Beschreibung erkannt";
    el("span", beschriftung).appendChild(marke);
  }

  function uebernehmeVorbelegungen(daten) {
    (daten.systeme || []).forEach(function (roh) {
      var id = SYNONYME[roh] || roh;
      if (bekannteIds.indexOf(id) > -1) {
        markiereErkannt(id);
      } else if (roh && zustand.systemeFrei.indexOf(roh) < 0 && zustand.systemeFrei.length < 8) {
        zustand.systemeFrei.push(roh);
      }
    });
    zeichneFreieSysteme();

    // Häufigkeit und Dauer nur vorbelegen, solange der Besucher nichts wählte.
    if (daten.haeufigkeit_erkannt && !zustand.haeufigkeit) {
      var h = el('input[name="haeufigkeit"][value="' + daten.haeufigkeit_erkannt + '"]', wizard);
      if (h) { h.checked = true; zustand.haeufigkeit = daten.haeufigkeit_erkannt; markiereVorbelegt(h); }
    }
    if (daten.dauer_erkannt && !zustand.dauer) {
      var d = el('input[name="dauer"][value="' + daten.dauer_erkannt + '"]', wizard);
      if (d) { d.checked = true; zustand.dauer = daten.dauer_erkannt; markiereVorbelegt(d); }
    }
    zeichneVorschau();
  }

  function markiereVorbelegt(feld) {
    var satz = feld.closest("fieldset");
    if (!satz || el(".wz-sub__vorbelegt", satz)) return;
    var hinweis = erzeuge("p", "wz-sub__hint wz-sub__vorbelegt",
      "Aus deiner Beschreibung — bitte prüfen.");
    satz.appendChild(hinweis);
  }

  function zeichneFreieSysteme() {
    var liste = el("[data-systeme-frei]");
    if (!liste) return;
    liste.textContent = "";

    zustand.systemeFrei.forEach(function (name, index) {
      var eintrag = erzeuge("li");
      eintrag.appendChild(document.createTextNode(name));

      var knopf = erzeuge("button");
      knopf.type = "button";
      knopf.appendChild(piktogramm("pi-close", 13));
      knopf.appendChild(erzeuge("span", "visually-hidden", name + " entfernen"));
      knopf.addEventListener("click", function () {
        zustand.systemeFrei.splice(index, 1);
        zeichneFreieSysteme();
        speichern();
      });

      eintrag.appendChild(knopf);
      liste.appendChild(eintrag);
    });
  }

  (function initFreieSysteme() {
    var feld = el("[data-system-frei]");
    var knopf = el("[data-system-add]");
    if (!feld || !knopf) return;

    function hinzufuegen() {
      var name = feld.value.trim();
      if (!name) return;
      if (zustand.systemeFrei.length >= 8) {
        zeigeFehler(3, "Mehr als acht eigene Einträge brauchen wir nicht — den Rest klären wir im Gespräch.");
        return;
      }
      if (zustand.systemeFrei.indexOf(name) < 0) zustand.systemeFrei.push(name);
      feld.value = "";
      zeichneFreieSysteme();
      speichern();
      feld.focus();
    }

    knopf.addEventListener("click", hinzufuegen);
    feld.addEventListener("keydown", function (ereignis) {
      if (ereignis.key === "Enter") { ereignis.preventDefault(); hinzufuegen(); }
    });
  })();

  /* =======================================================================
     7) Schritt 4: Aufwand
     ===================================================================== */
  var LAEUFE_PRO_MONAT = {
    mehrmals_taeglich: 44, taeglich: 22, mehrmals_woechentlich: 12,
    woechentlich: 4.3, monatlich: 1, seltener: 0.5
  };
  var MINUTEN_JE_LAUF = { "5": 5, "15": 15, "30": 30, "60": 60, "120": 120 };

  function zeichneVorschau() {
    var kasten = el("[data-vorschau]");
    var text = el("[data-vorschau-text]");
    if (!kasten || !text) return;

    var laeufe = LAEUFE_PRO_MONAT[zustand.haeufigkeit];
    var minuten = MINUTEN_JE_LAUF[zustand.dauer];
    if (!laeufe || !minuten) { kasten.hidden = true; return; }

    var proMonat = laeufe * minuten / 60;

    text.textContent = "";
    text.appendChild(document.createTextNode("Das sind rund "));
    text.appendChild(erzeuge("strong", null, stundenText(proMonat) + " Stunden pro Monat"));
    text.appendChild(document.createTextNode(
      ". Etwa " + stundenText(proMonat * 12) + " Stunden im Jahr."
    ));
    kasten.hidden = false;
  }

  (function initAufwand() {
    ["haeufigkeit", "dauer", "personen"].forEach(function (name) {
      els('input[name="' + name + '"]', wizard).forEach(function (feld) {
        feld.addEventListener("change", function () {
          zustand[name] = feld.value;
          // Eine eigene Wahl hebt den Vorbelegungshinweis auf.
          var satz = feld.closest("fieldset");
          var hinweis = satz && el(".wz-sub__vorbelegt", satz);
          if (hinweis) hinweis.remove();
          zeichneVorschau();
          speichern();
        });
      });
    });
  })();

  /* =======================================================================
     8) Schritt 5: Analyse und Ergebnis
     ===================================================================== */
  var kastenLaden = el("[data-laden]");
  var textLaden = el("[data-laden-status]");
  var hinweisLang = el("[data-laden-lang]");
  var kastenAnalyseFehler = el("[data-analyse-fehler]");
  var textAnalyseFehler = el("[data-analyse-fehler-text]");
  var kastenErgebnis = el("[data-ergebnis]");
  var kastenLead = el("[data-lead]");
  var kastenDanke = el("[data-danke]");

  var LADETEXTE = [
    "Deine Beschreibung wird gelesen …",
    "Schritte und Systeme werden eingeordnet …",
    "Automatisierbarkeit wird bewertet …",
    "Potenzial wird berechnet …",
    "Ergebnis wird zusammengestellt …"
  ];

  var ladeTimer = 0, langTimer = 0, analyseLaeuft = false, ergebnisZeitpunkt = 0;

  function starteLadeanzeige() {
    var index = 0;
    if (textLaden) textLaden.textContent = LADETEXTE[0];

    ladeTimer = setInterval(function () {
      index += 1;
      if (index >= LADETEXTE.length) { clearInterval(ladeTimer); return; }
      if (textLaden) textLaden.textContent = LADETEXTE[index];
    }, 2200);

    langTimer = setTimeout(function () {
      if (hinweisLang) hinweisLang.hidden = false;
    }, 25000);
  }

  function stoppeLadeanzeige() {
    clearInterval(ladeTimer);
    clearTimeout(langTimer);
    if (hinweisLang) hinweisLang.hidden = true;
  }

  function starteAnalyse() {
    if (analyseLaeuft) return;

    // Ein bereits vorhandenes Ergebnis nicht erneut berechnen.
    if (zustand.ergebnis) { zeigeErgebnis(zustand.ergebnis); return; }

    analyseLaeuft = true;
    kastenLaden.hidden = false;
    kastenAnalyseFehler.hidden = true;
    kastenErgebnis.hidden = true;
    kastenLead.hidden = true;
    starteLadeanzeige();

    var anfrage = {
      ziele: zustand.ziele,
      beschreibung: zustand.beschreibung,
      schritte_bestaetigt: zustand.schritteBestaetigt
        ? zustand.schritteListe.filter(function (s) { return s.text.trim(); })
        : [],
      rueckfragen: zustand.rueckfragen.filter(function (r) { return r.antwort.trim(); }),
      systeme: zustand.systeme,
      systeme_frei: zustand.systemeFrei,
      vernetzung: zustand.vernetzung,
      haeufigkeit: zustand.haeufigkeit,
      dauer: zustand.dauer,
      personen: zustand.personen
    };

    fetch("/api/analyse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(anfrage),
      signal: AbortSignal.timeout(45000)
    })
      .then(function (antwort) {
        return antwort.text().then(function (roh) {
          var daten = null;
          try {
            daten = JSON.parse(roh);
          } catch (f) {
            // Keine JSON-Antwort: dann läuft der Node-Dienst nicht und die
            // Seite wird als reine Statik ausgeliefert. Für den Besucher
            // sieht das aus wie ein Ausfall, für den Betreiber ist es ein
            // Deployment-Fehler – deshalb der Hinweis in der Konsole.
            console.error(
              "/api/analyse hat kein JSON geliefert (HTTP " + antwort.status + "). " +
              "Läuft der Node-Dienst? Prüfen mit: GET /api/status"
            );
            throw { status: antwort.status, kein_json: true };
          }
          return { status: antwort.status, daten: daten };
        });
      })
      .then(function (ergebnis) {
        if (ergebnis.status !== 200) throw ergebnis;
        zustand.ergebnis = ergebnis.daten;
        speichern();
        zeigeErgebnis(ergebnis.daten);
      })
      .catch(function (fehler) {
        var status = fehler && fehler.status;
        var text;
        if (status === 429) {
          text = "Gerade sind viele Checks unterwegs. Versuch es in einer Minute nochmal.";
        } else if (status === 503 || (fehler && fehler.kein_json)) {
          text = "Die Analyse ist im Moment nicht verfügbar. Schick uns deine Angaben " +
                 "direkt — wir schauen sie uns von Hand an.";
        } else {
          text = "Die Analyse ist nicht durchgelaufen.";
        }
        zeigeAnalyseFehler(text, status === 503 || Boolean(fehler && fehler.kein_json));
      })
      .finally(function () {
        analyseLaeuft = false;
        stoppeLadeanzeige();
        kastenLaden.hidden = true;
      });
  }

  function zeigeAnalyseFehler(text, nurManuell) {
    if (textAnalyseFehler) textAnalyseFehler.textContent = text;
    kastenAnalyseFehler.hidden = false;
    var wiederholen = el("[data-analyse-retry]");
    if (wiederholen) wiederholen.hidden = Boolean(nurManuell);
  }

  (function initAnalyseFehler() {
    var wiederholen = el("[data-analyse-retry]");
    var manuell = el("[data-analyse-manuell]");

    if (wiederholen) wiederholen.addEventListener("click", function () {
      kastenAnalyseFehler.hidden = true;
      zustand.ergebnis = null;
      starteAnalyse();
    });

    if (manuell) manuell.addEventListener("click", function () {
      kastenAnalyseFehler.hidden = true;
      kastenLead.hidden = false;
      ergebnisZeitpunkt = Date.now();
      var titel = el(".wz-lead__title", kastenLead);
      if (titel) titel.textContent = "Schick uns deine Angaben";
      fokussiere(el("#lead-name"));
    });
  })();

  /* --- Ergebnis zeichnen --------------------------------------------- */
  var TYP_IKONE = {
    ausloeser: "pi-trigger", manuell: "pi-hand", system: "pi-system",
    entscheidung: "pi-branch", ergebnis: "pi-output",
    automatisch: "pi-check", ki: "pi-spark"
  };
  var TYP_TEXT = {
    ausloeser: "Auslöser", manuell: "manuell", system: "System",
    entscheidung: "Entscheidung", ergebnis: "Ergebnis",
    automatisch: "automatisch", ki: "KI"
  };
  var KOMPLEXITAET_TEXT = { gering: "Gering", mittel: "Mittel", hoch: "Hoch" };

  function block(titel, inhalt, klasse) {
    var kasten = erzeuge("section", "wz-block" + (klasse ? " " + klasse : ""));
    if (titel) {
      var ueberschrift = erzeuge("h3", "wz-block__title", titel);
      kasten.appendChild(ueberschrift);
    }
    kasten.appendChild(inhalt);
    return kasten;
  }

  function zeigeErgebnis(daten) {
    if (!kastenErgebnis) return;
    var b = daten.berechnung || {};

    kastenErgebnis.textContent = "";
    var teil = document.createDocumentFragment();

    /* --- Kopf mit Gesamtscore ---------------------------------------- */
    var kopf = erzeuge("div", "wz-score");
    kopf.appendChild(erzeuge("h3", "wz-score__titel", daten.titel));
    kopf.appendChild(erzeuge("p", "wz-score__label", "Automatisierungspotenzial"));

    var zeile = erzeuge("div", "wz-score__zeile");
    var bar = erzeuge("div", "wz-score__bar");
    var fill = erzeuge("span", "wz-score__fill");
    bar.appendChild(fill);
    zeile.appendChild(bar);

    var zahl = erzeuge("p", "wz-score__zahl");
    zahl.setAttribute("aria-label", b.score_gesamt + " von 100");
    var zahlWert = erzeuge("span", null, "0");
    zahl.appendChild(zahlWert);
    zahl.appendChild(erzeuge("small", null, " / 100"));
    zeile.appendChild(zahl);
    kopf.appendChild(zeile);

    if (b.geringes_volumen) {
      kopf.appendChild(erzeuge("p", "wz-score__satz",
        "Bei diesem Volumen lohnt sich eine Umsetzung vor allem wegen Verlässlichkeit " +
        "und Qualität — weniger wegen der eingesparten Zeit."));
    }
    teil.appendChild(block(null, kopf));

    /* --- Empfehlung ---------------------------------------------------- */
    var empfehlung = erzeuge("div", "wz-empfehlung");
    var eIkone = piktogramm("pi-spark", 22);
    eIkone.classList.add("wz-empfehlung__icon");
    empfehlung.appendChild(eIkone);
    var eText = erzeuge("div");
    eText.appendChild(erzeuge("p", "wz-empfehlung__titel", daten.empfehlung.titel));
    eText.appendChild(erzeuge("p", "wz-empfehlung__text", daten.empfehlung.text));
    empfehlung.appendChild(eText);
    teil.appendChild(block("Empfehlung", empfehlung));

    /* --- Kennzahlen ---------------------------------------------------- */
    var kpis = erzeuge("div", "wz-kpis");

    kpis.appendChild(kpi(
      "Aufwand heute",
      b.angaben_vollstaendig ? stundenText(b.stunden_pro_monat) + " Std./Monat" : "keine Angabe",
      b.angaben_vollstaendig ? stundenText(b.stunden_pro_jahr) + " Std./Jahr" : null
    ));

    kpis.appendChild(kpi(
      "Einsparpotenzial",
      b.angaben_vollstaendig
        ? stundenText(b.einsparung_von_stunden) + "–" + stundenText(b.einsparung_bis_stunden) + " Std./Monat"
        : "keine Angabe",
      b.angaben_vollstaendig
        ? "rund CHF " + nf0.format(b.einsparung_von_chf) + "–" + nf0.format(b.einsparung_bis_chf) + " pro Monat"
        : null,
      b.angaben_vollstaendig ? "Annahme: CHF " + STUNDENSATZ_CHF + " pro Stunde" : null
    ));

    kpis.appendChild(kpi(
      "Komplexität",
      KOMPLEXITAET_TEXT[b.komplexitaet] || "Mittel",
      "Umsetzung " + (b.umsetzungsdauer || "2 bis 4 Wochen")
    ));

    teil.appendChild(block(null, kpis));

    /* --- Prozessdarstellung -------------------------------------------- */
    teil.appendChild(block("Dein Prozess", prozessBild(daten)));

    /* --- Zeitleiste ----------------------------------------------------- */
    if (b.angaben_vollstaendig && b.minuten_je_lauf) {
      teil.appendChild(block("Je Durchlauf", zeitLeiste(b)));
    }

    /* --- Teil-Scores ---------------------------------------------------- */
    var hebel = erzeuge("div", "wz-hebel");
    hebel.appendChild(hebelZeile("Digitalisierung", b.score_digitalisierung,
      daten.einordnung.begruendung_digitalisierung, ""));
    hebel.appendChild(hebelZeile("Automatisierung", b.score_automatisierung,
      daten.einordnung.begruendung_automatisierung, ""));
    hebel.appendChild(hebelZeile("KI-Potenzial", b.score_ki,
      daten.einordnung.begruendung_ki, "wz-hebel__zeile--ki"));
    teil.appendChild(block("Wo der Hebel liegt", hebel));

    /* --- Vorgehen -------------------------------------------------------- */
    if (daten.vorgehen && daten.vorgehen.length) {
      var vorgehen = erzeuge("ol", "wz-vorgehen");
      daten.vorgehen.forEach(function (schritt) {
        var eintrag = erzeuge("li");
        var inhalt = erzeuge("div");
        inhalt.appendChild(erzeuge("span", "wz-vorgehen__titel", schritt.titel));
        inhalt.appendChild(erzeuge("span", "wz-vorgehen__text", schritt.text));
        eintrag.appendChild(inhalt);
        vorgehen.appendChild(eintrag);
      });
      teil.appendChild(block("So gehen wir vor", vorgehen));
    }

    /* --- Quick Win -------------------------------------------------------- */
    if (daten.quick_win) {
      var quick = erzeuge("div", "wz-quick");
      var qTitel = erzeuge("p", "wz-quick__titel");
      qTitel.appendChild(piktogramm("pi-check", 18));
      qTitel.appendChild(document.createTextNode("Der schnellste Gewinn"));
      quick.appendChild(qTitel);
      quick.appendChild(erzeuge("p", "wz-quick__text", daten.quick_win));
      teil.appendChild(block(null, quick));
    }

    /* --- Voraussetzungen und Annahmen ------------------------------------ */
    var hatVoraussetzungen = daten.voraussetzungen && daten.voraussetzungen.length;
    var hatAnnahmen = daten.annahmen && daten.annahmen.length;

    if (hatVoraussetzungen || hatAnnahmen) {
      var hinweise = erzeuge("div", "wz-hinweise");
      if (hatVoraussetzungen) {
        hinweise.appendChild(hinweisKasten(
          "Was wir noch klären müssen", "pi-warning",
          daten.voraussetzungen, "wz-hinweis--risiko"
        ));
      }
      if (hatAnnahmen) {
        hinweise.appendChild(hinweisKasten(
          "Annahmen der Analyse", "pi-info",
          daten.annahmen, "wz-hinweis--annahme"
        ));
      }
      teil.appendChild(block(null, hinweise));
    }

    /* --- Transparenz zur automatisierten Auswertung ---------------------- */
    var aiHinweis = erzeuge("div", "wz-ai-disclaimer");
    aiHinweis.appendChild(piktogramm("pi-info", 18));
    var aiText = erzeuge("p");
    aiText.appendChild(document.createTextNode(
      "Diese Auswertung wurde automatisiert mit KI erstellt. Angaben zu Potenzial, " +
      "Aufwand und Umsetzbarkeit sind unverbindliche Schätzungen und können " +
      "unvollständig oder fehlerhaft sein. "
    ));
    var aiLink = erzeuge("a", null, "Mehr zum Prozesscheck und Datenschutz");
    aiLink.href = "/datenschutz.html#prozesscheck";
    aiText.appendChild(aiLink);
    aiHinweis.appendChild(aiText);
    teil.appendChild(aiHinweis);

    /* --- Nebenaktionen ----------------------------------------------------- */
    var neben = erzeuge("div", "wz-neben");

    var drucken = erzeuge("button", "wz-helper");
    drucken.type = "button";
    drucken.appendChild(piktogramm("pi-print", 16));
    drucken.appendChild(document.createTextNode("Ergebnis drucken"));
    drucken.addEventListener("click", function () { window.print(); });
    neben.appendChild(drucken);

    var aendern = erzeuge("button", "wz-helper");
    aendern.type = "button";
    aendern.appendChild(piktogramm("pi-edit", 16));
    aendern.appendChild(document.createTextNode("Angaben ändern"));
    aendern.addEventListener("click", function () { zeigeSchritt(1); });
    neben.appendChild(aendern);

    teil.appendChild(neben);

    kastenErgebnis.appendChild(teil);
    kastenErgebnis.hidden = false;
    kastenLead.hidden = false;
    ergebnisZeitpunkt = Date.now();

    // Balken und Zahl animieren, sobald das Ergebnis im Baum hängt.
    requestAnimationFrame(function () {
      fill.style.width = b.score_gesamt + "%";
      els(".wz-hebel__fill", kastenErgebnis).forEach(function (balken) {
        balken.style.width = balken.dataset.wert + "%";
      });
      els(".wz-zeit__fill", kastenErgebnis).forEach(function (balken) {
        balken.style.width = balken.dataset.wert + "%";
      });
      zaehleHoch(zahlWert, b.score_gesamt);
    });
  }

  function kpi(beschriftung, wert, zusatz, annahme) {
    var kasten = erzeuge("div", "wz-kpi");
    kasten.appendChild(erzeuge("p", "wz-kpi__label", beschriftung));
    kasten.appendChild(erzeuge("p", "wz-kpi__wert", wert));
    if (zusatz) kasten.appendChild(erzeuge("p", "wz-kpi__zusatz", zusatz));
    if (annahme) kasten.appendChild(erzeuge("p", "wz-kpi__annahme", annahme));
    return kasten;
  }

  function hebelZeile(name, wert, satz, klasse) {
    var zeile = erzeuge("div", "wz-hebel__zeile" + (klasse ? " " + klasse : ""));

    var kopf = erzeuge("div", "wz-hebel__kopf");
    kopf.appendChild(erzeuge("span", "wz-hebel__name", name));

    var bar = erzeuge("span", "wz-hebel__bar");
    var fill = erzeuge("span", "wz-hebel__fill");
    fill.dataset.wert = String(wert);
    bar.appendChild(fill);
    kopf.appendChild(bar);

    kopf.appendChild(erzeuge("span", "wz-hebel__wert", String(wert)));
    zeile.appendChild(kopf);

    if (satz) zeile.appendChild(erzeuge("p", "wz-hebel__satz", satz));
    return zeile;
  }

  function hinweisKasten(titel, ikone, eintraege, klasse) {
    var kasten = erzeuge("div", "wz-hinweis " + klasse);
    var ueberschrift = erzeuge("p", "wz-hinweis__titel");
    ueberschrift.appendChild(piktogramm(ikone, 17));
    ueberschrift.appendChild(document.createTextNode(titel));
    kasten.appendChild(ueberschrift);

    var liste = erzeuge("ul", "wz-hinweis__liste");
    eintraege.forEach(function (eintrag) {
      liste.appendChild(erzeuge("li", null, eintrag));
    });
    kasten.appendChild(liste);
    return kasten;
  }

  function prozessBild(daten) {
    var flow = erzeuge("div", "wz-flow");

    // Welche Ist-Schritte werden von einem Soll-Schritt abgelöst?
    var ersetzt = new Set();
    daten.soll_prozess.forEach(function (schritt) {
      (schritt.ersetzt_ist_schritte || []).forEach(function (id) { ersetzt.add(id); });
    });

    /* --- Spalte Heute -------------------------------------------------- */
    var heute = erzeuge("div", "wz-flow__spalte");
    heute.appendChild(erzeuge("p", "wz-flow__kopf", "Heute"));

    var listeHeute = erzeuge("ol", "wz-flow__list");
    var nummer = 0;

    daten.ist_prozess.forEach(function (schritt, index) {
      var istRand = schritt.typ === "ausloeser" || schritt.typ === "ergebnis";
      if (!istRand) nummer += 1;

      // Wenn das Modell gar keine Zuordnung geliefert hat, entscheidet
      // allein die Automatisierbarkeit.
      var zugeordnet = ersetzt.size === 0 || ersetzt.has(schritt.id);
      var entfaellt = !istRand && schritt.automatisierbarkeit === "voll" && zugeordnet;
      var kuerzer = !istRand && schritt.automatisierbarkeit === "teilweise";

      var klassen = ["wz-node", "wz-node--" + schritt.typ];
      if (entfaellt) klassen.push("wz-node--entfaellt");

      listeHeute.appendChild(knoten({
        klassen: klassen,
        index: istRand ? null : nummer,
        typ: schritt.typ,
        label: schritt.label,
        system: schritt.system,
        tag: entfaellt ? "entfällt" : (kuerzer ? "wird kürzer" : null),
        reihe: index
      }));
    });

    heute.appendChild(listeHeute);
    flow.appendChild(heute);

    /* --- Spalte Möglich ------------------------------------------------- */
    var moeglich = erzeuge("div", "wz-flow__spalte wz-flow__spalte--soll");
    moeglich.appendChild(erzeuge("p", "wz-flow__kopf", "Möglich"));

    var listeSoll = erzeuge("ol", "wz-flow__list");
    var nummerSoll = 0;

    daten.soll_prozess.forEach(function (schritt, index) {
      var istRand = schritt.typ === "ausloeser" || schritt.typ === "ergebnis";
      if (!istRand) nummerSoll += 1;

      listeSoll.appendChild(knoten({
        klassen: ["wz-node", "wz-node--" + schritt.typ],
        index: istRand ? null : nummerSoll,
        typ: schritt.typ,
        label: schritt.label,
        system: schritt.system,
        tag: schritt.hinweis || null,
        reihe: index
      }));
    });

    moeglich.appendChild(listeSoll);
    flow.appendChild(moeglich);

    return flow;
  }

  function knoten(o) {
    var eintrag = erzeuge("li", o.klassen.join(" "));
    eintrag.style.setProperty("--enter-index", String(Math.min(o.reihe, 12)));

    if (o.index != null) {
      eintrag.appendChild(erzeuge("span", "wz-node__index", String(o.index)));
    } else {
      eintrag.appendChild(erzeuge("span", "wz-node__index", ""));
    }

    var ikone = piktogramm(TYP_IKONE[o.typ] || "pi-system", 18);
    ikone.classList.add("wz-node__icon");
    eintrag.appendChild(ikone);

    eintrag.appendChild(erzeuge("span", "wz-node__label", o.label));

    var meta = erzeuge("span", "wz-node__meta");
    if (o.system) meta.appendChild(erzeuge("span", "wz-node__system", o.system));
    meta.appendChild(erzeuge("span", "wz-node__typ", TYP_TEXT[o.typ] || ""));

    // Das Etikett läuft in derselben Zeile mit, damit es auf schmalen
    // Schirmen umbricht statt die Angaben zu überdecken.
    if (o.tag) meta.appendChild(erzeuge("span", "wz-node__tag", o.tag));

    eintrag.appendChild(meta);
    return eintrag;
  }

  function zeitLeiste(b) {
    var kasten = erzeuge("div", "wz-zeit");
    var maximum = Math.max(b.minuten_je_lauf, 1);

    kasten.appendChild(zeitZeile("Heute", b.minuten_je_lauf, maximum, "heute"));
    kasten.appendChild(zeitZeile("Möglich", b.minuten_je_lauf_nachher, maximum, "soll"));
    return kasten;
  }

  function zeitZeile(beschriftung, minuten, maximum, art) {
    var zeile = erzeuge("div", "wz-zeit__zeile");
    zeile.appendChild(erzeuge("span", "wz-zeit__label", beschriftung));

    var bar = erzeuge("span", "wz-zeit__bar");
    var fill = erzeuge("span", "wz-zeit__fill wz-zeit__fill--" + art);
    fill.dataset.wert = String(Math.round(minuten / maximum * 100));
    bar.appendChild(fill);
    zeile.appendChild(bar);

    zeile.appendChild(erzeuge("span", "wz-zeit__wert", nf0.format(minuten) + " Min."));
    return zeile;
  }

  function zaehleHoch(knoten, ziel) {
    if (reduceMotion) { knoten.textContent = String(ziel); return; }

    var start = performance.now();
    var dauer = 900;

    function schritt(jetzt) {
      var anteil = Math.min(1, (jetzt - start) / dauer);
      var geglaettet = 1 - Math.pow(1 - anteil, 3);
      knoten.textContent = String(Math.round(ziel * geglaettet));
      if (anteil < 1) requestAnimationFrame(schritt);
    }
    requestAnimationFrame(schritt);
  }

  /* =======================================================================
     9) Kontaktformular
     ===================================================================== */
  (function initLead() {
    var knopf = el("[data-lead-submit]");
    if (!knopf || !kastenLead) return;

    var meldung = el("[data-lead-message]");
    var feldName = el("#lead-name");
    var feldEmail = el("#lead-email");
    var feldConsent = el('input[name="einverstanden"]', kastenLead);
    var laeuft = false;

    var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

    function fehlerAn(feld, kennung, text) {
      var anzeige = el("#" + kennung);
      if (anzeige) { anzeige.textContent = text || ""; anzeige.hidden = !text; }
      if (feld) {
        if (text) feld.setAttribute("aria-invalid", "true");
        else feld.removeAttribute("aria-invalid");
      }
      return !text;
    }

    function pruefeName() {
      return fehlerAn(feldName, "lead-name-fehler",
        feldName.value.trim() ? "" : "Bitte trag deinen Namen ein.");
    }
    function pruefeEmail() {
      var wert = feldEmail.value.trim();
      if (!wert) return fehlerAn(feldEmail, "lead-email-fehler", "Bitte trag deine E-Mail-Adresse ein.");
      if (!EMAIL.test(wert)) return fehlerAn(feldEmail, "lead-email-fehler", "Diese Adresse sieht nicht gültig aus.");
      return fehlerAn(feldEmail, "lead-email-fehler", "");
    }
    function pruefeConsent() {
      return fehlerAn(null, "lead-consent-fehler",
        feldConsent.checked ? "" : "Ohne dein Einverständnis dürfen wir die Angaben nicht verarbeiten.");
    }

    // Prüfung beim Verlassen des Feldes, nicht bei jedem Tastendruck.
    feldName.addEventListener("blur", pruefeName);
    feldEmail.addEventListener("blur", pruefeEmail);
    feldConsent.addEventListener("change", pruefeConsent);

    knopf.addEventListener("click", function () {
      if (laeuft) return;

      var okName = pruefeName();
      var okEmail = pruefeEmail();
      var okConsent = pruefeConsent();

      if (!okName || !okEmail || !okConsent) {
        var erstes = !okName ? feldName : (!okEmail ? feldEmail : feldConsent);
        erstes.focus();
        return;
      }

      laeuft = true;
      knopf.disabled = true;
      var beschriftungAlt = knopf.textContent;
      knopf.textContent = "Wird gesendet …";
      if (meldung) { meldung.textContent = ""; meldung.classList.remove("is-error"); }

      fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: feldName.value.trim(),
          firma: el("#lead-firma").value.trim(),
          email: feldEmail.value.trim(),
          telefon: el("#lead-telefon").value.trim(),
          nachricht: el("#lead-nachricht").value.trim(),
          website: el("#lead-website").value,
          einverstanden: true,
          verweildauer_ms: ergebnisZeitpunkt ? Date.now() - ergebnisZeitpunkt : 99999,
          eingabe: {
            ziele: zustand.ziele,
            beschreibung: zustand.beschreibung,
            schritte: zustand.schritteListe,
            rueckfragen: zustand.rueckfragen,
            systeme: zustand.systeme,
            systeme_frei: zustand.systemeFrei,
            vernetzung: zustand.vernetzung,
            haeufigkeit: zustand.haeufigkeit,
            dauer: zustand.dauer,
            personen: zustand.personen
          },
          ergebnis: zustand.ergebnis
        })
      })
        .then(function (antwort) {
          if (!antwort.ok) throw new Error("nicht ok");
          zeigeDanke(feldName.value.trim());
        })
        .catch(function () {
          if (!meldung) return;
          meldung.textContent = "";
          meldung.classList.add("is-error");
          meldung.appendChild(document.createTextNode("Das hat gerade nicht geklappt. Schreib uns direkt an "));
          var link = erzeuge("a", null, "kontakt@1automationen.ch");
          link.href = "mailto:kontakt@1automationen.ch";
          meldung.appendChild(link);
          meldung.appendChild(document.createTextNode(", wir melden uns."));
        })
        .finally(function () {
          laeuft = false;
          knopf.disabled = false;
          knopf.textContent = beschriftungAlt;
        });
    });

    function zeigeDanke(name) {
      var vorname = name.split(" ")[0];
      var titel = el("[data-danke-title]");
      if (titel) titel.textContent = "Danke, " + vorname + ".";

      kastenLead.hidden = true;
      kastenDanke.hidden = false;
      zustand.gesendet = true;
      leeren();
      fokussiere(titel);
    }
  })();

  (function initDankeAktionen() {
    var drucken = el("[data-drucken]");
    var neustart = el("[data-neustart]");
    if (drucken) drucken.addEventListener("click", function () { window.print(); });
    if (neustart) neustart.addEventListener("click", function () {
      leeren();
      window.location.href = window.location.pathname;
    });
  })();

  /* =======================================================================
     Wiederherstellen und Start
     ===================================================================== */
  function stelleWiederHer(gesichert) {
    Object.keys(zustand).forEach(function (schluessel) {
      if (gesichert[schluessel] !== undefined) zustand[schluessel] = gesichert[schluessel];
    });

    els('input[name="ziel"]', wizard).forEach(function (feld) {
      feld.checked = zustand.ziele.indexOf(feld.value) > -1;
    });

    if (feldBeschreibung) {
      feldBeschreibung.value = zustand.beschreibung;
      feldBeschreibung.dispatchEvent(new Event("input", { bubbles: true }));
    }

    zustand.systeme.forEach(function (id) {
      var feld = el('input[name="system"][value="' + CSS.escape(id) + '"]', wizard);
      if (feld) feld.checked = true;
    });
    zeichneFreieSysteme();

    [["vernetzung", zustand.vernetzung], ["haeufigkeit", zustand.haeufigkeit],
     ["dauer", zustand.dauer], ["personen", zustand.personen]].forEach(function (paar) {
      if (!paar[1]) return;
      var feld = el('input[name="' + paar[0] + '"][value="' + paar[1] + '"]', wizard);
      if (feld) feld.checked = true;
    });

    zeichneVorschau();
    zeichneVerstanden();

    // Ein bereits berechnetes Ergebnis nicht neu anfordern.
    if (zustand.ergebnis && zustand.schritt === 5) {
      zeigeSchritt(5, false);
      zeigeErgebnis(zustand.ergebnis);
    } else {
      zeigeSchritt(Math.min(zustand.schritt, 4), false);
    }
  }

  (function start() {
    var gesichert = laden();
    var kasten = el("[data-resume]");

    // Erkennung neu anstossen, sobald der Text lang genug ist.
    erkennungLetzterText = "";

    if (gesichert && gesichert.schritt > 1 && !gesichert.gesendet && kasten) {
      kasten.hidden = false;

      el("[data-resume-yes]", kasten).addEventListener("click", function () {
        kasten.hidden = true;
        stelleWiederHer(gesichert);
      });

      el("[data-resume-no]", kasten).addEventListener("click", function () {
        kasten.hidden = true;
        leeren();
        zeigeSchritt(1, false);
        fokussiere(el(".wz-step__title", abschnittVon(1)));
      });

      zeigeSchritt(1, false);
      return;
    }

    if (gesichert && gesichert.gesendet) leeren();
    zeigeSchritt(1, false);
    history.replaceState({ schritt: 1 }, "", window.location.pathname);
  })();
})();
