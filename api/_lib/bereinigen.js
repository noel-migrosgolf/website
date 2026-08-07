/* =========================================================================
   Nachbearbeitung der Modellantwort.

   Structured Outputs garantiert die Struktur, nicht den Inhalt. Hier wird
   erzwungen, was das Schema nicht ausdrücken kann: Längen, Mengen, die
   Summe der Zeitanteile, genau ein Auslöser und ein Ergebnis.
   ========================================================================= */

const EMOJI = /\p{Extended_Pictographic}|️|‍/gu;

const FLOSKELN = [
  "revolutionär", "revolutionäre", "revolutionären",
  "nahtlos", "nahtlose", "nahtlosen", "nahtloser",
  "game changer", "gamechanger",
  "state of the art",
  "bahnbrechend", "bahnbrechende", "bahnbrechenden",
  "einzigartig", "einzigartige", "einzigartigen"
];

/** Emojis entfernen, ß zu ss, Leerraum normalisieren. */
function text(wert) {
  if (typeof wert !== "string") return "";
  return wert
    .replace(EMOJI, "")
    .replace(/ß/g, "ss")
    .replace(/[ \t]+/g, " ")
    .trim();
}

/** Am Wortende kürzen, damit kein Wort zerschnitten wird. */
function kappe(wert, laenge) {
  const sauber = text(wert);
  if (sauber.length <= laenge) return sauber;
  const schnitt = sauber.slice(0, laenge - 1);
  const luecke = schnitt.lastIndexOf(" ");
  return (luecke > laenge * 0.6 ? schnitt.slice(0, luecke) : schnitt).trimEnd() + "…";
}

function ganzzahl(wert, min, max, ersatz) {
  const zahl = Math.round(Number(wert));
  if (!Number.isFinite(zahl)) return ersatz;
  return Math.min(max, Math.max(min, zahl));
}

/** Trifft eine Floskel zu, wird sie protokolliert, aber nicht verworfen. */
function pruefeFloskeln(objekt, protokoll) {
  const roh = JSON.stringify(objekt).toLowerCase();
  for (const wort of FLOSKELN) {
    if (roh.includes(wort)) protokoll.push(wort);
  }
}

/* ---------------------------------------------------------------------
   Analyse
   ------------------------------------------------------------------- */
export function bereinigeAnalyse(roh) {
  const floskeln = [];
  pruefeFloskeln(roh, floskeln);

  /* --- Ist-Prozess ---------------------------------------------------- */
  let ist = (Array.isArray(roh.ist_prozess) ? roh.ist_prozess : [])
    .map((s, i) => ({
      id: text(s.id) || `i${i + 1}`,
      label: kappe(s.label, 55) || "Schritt",
      typ: ["ausloeser", "manuell", "system", "entscheidung", "ergebnis"].includes(s.typ)
        ? s.typ : "manuell",
      system: s.system ? kappe(s.system, 30) : null,
      dauer_anteil: ganzzahl(s.dauer_anteil, 0, 100, 0),
      automatisierbarkeit: ["voll", "teilweise", "nein"].includes(s.automatisierbarkeit)
        ? s.automatisierbarkeit : "nein"
    }))
    .slice(0, 12);

  if (!ist.length) {
    ist = [{
      id: "i1", label: "Ablauf von Hand", typ: "manuell",
      system: null, dauer_anteil: 100, automatisierbarkeit: "teilweise"
    }];
  }

  // Genau ein Auslöser am Anfang. Überzählige werden zu manuellen Schritten.
  const mitte = ist.filter((s) => s.typ !== "ausloeser" && s.typ !== "ergebnis");
  const ausloeser = ist.find((s) => s.typ === "ausloeser") || {
    id: "i0", label: "Der Prozess startet", typ: "ausloeser",
    system: null, dauer_anteil: 0, automatisierbarkeit: "nein"
  };
  const ergebnis = ist.find((s) => s.typ === "ergebnis") || {
    id: "i99", label: "Ergebnis liegt vor", typ: "ergebnis",
    system: null, dauer_anteil: 0, automatisierbarkeit: "nein"
  };
  ausloeser.typ = "ausloeser";
  ausloeser.dauer_anteil = 0;
  ergebnis.typ = "ergebnis";
  ergebnis.dauer_anteil = 0;

  ist = [ausloeser, ...mitte, ergebnis];

  // Zeitanteile auf exakt 100 normalisieren – Modelle treffen das selten.
  const summe = mitte.reduce((s, k) => s + k.dauer_anteil, 0);
  if (mitte.length) {
    if (summe <= 0) {
      const gleich = Math.floor(100 / mitte.length);
      mitte.forEach((s) => { s.dauer_anteil = gleich; });
      mitte[mitte.length - 1].dauer_anteil = 100 - gleich * (mitte.length - 1);
    } else if (summe !== 100) {
      let verteilt = 0;
      mitte.forEach((s, i) => {
        if (i === mitte.length - 1) s.dauer_anteil = 100 - verteilt;
        else {
          s.dauer_anteil = Math.round((s.dauer_anteil / summe) * 100);
          verteilt += s.dauer_anteil;
        }
      });
    }
  }

  const istIds = new Set(ist.map((s) => s.id));

  /* --- Soll-Prozess --------------------------------------------------- */
  let soll = (Array.isArray(roh.soll_prozess) ? roh.soll_prozess : [])
    .map((s, i) => ({
      id: text(s.id) || `s${i + 1}`,
      label: kappe(s.label, 55) || "Schritt",
      typ: ["ausloeser", "automatisch", "ki", "manuell", "entscheidung", "ergebnis"].includes(s.typ)
        ? s.typ : "automatisch",
      system: s.system ? kappe(s.system, 30) : null,
      ersetzt_ist_schritte: (Array.isArray(s.ersetzt_ist_schritte) ? s.ersetzt_ist_schritte : [])
        .map(text).filter((id) => istIds.has(id)),
      hinweis: s.hinweis ? kappe(s.hinweis, 90) : null
    }))
    .slice(0, 12);

  if (!soll.length) {
    soll = [{
      id: "s1", label: "Ablauf automatisiert", typ: "automatisch",
      system: null, ersetzt_ist_schritte: [], hinweis: null
    }];
  }

  if (soll[0].typ !== "ausloeser") {
    soll.unshift({
      id: "s0", label: ausloeser.label, typ: "ausloeser",
      system: ausloeser.system, ersetzt_ist_schritte: [], hinweis: null
    });
  }
  if (soll[soll.length - 1].typ !== "ergebnis") {
    soll.push({
      id: "s99", label: ergebnis.label, typ: "ergebnis",
      system: null, ersetzt_ist_schritte: [], hinweis: null
    });
  }

  /* --- Kriterien ------------------------------------------------------ */
  const rk = roh.kriterien || {};
  const kriterien = {
    wiederholbarkeit:     ganzzahl(rk.wiederholbarkeit, 0, 100, 50),
    regelbasiertheit:     ganzzahl(rk.regelbasiertheit, 0, 100, 50),
    digitalisierungsgrad: ganzzahl(rk.digitalisierungsgrad, 0, 100, 50),
    fehleranfaelligkeit:  ganzzahl(rk.fehleranfaelligkeit, 0, 100, 50),
    integrierbarkeit:     ganzzahl(rk.integrierbarkeit, 0, 100, 50),
    ki_eignung:           ganzzahl(rk.ki_eignung, 0, 100, 40),
    automatisierbarkeit:  ganzzahl(rk.automatisierbarkeit, 0, 100, 50),
    erwarteter_nutzen:    ganzzahl(rk.erwarteter_nutzen, 0, 100, 50)
  };

  /* --- Texte ---------------------------------------------------------- */
  const re = roh.einordnung || {};
  const rp = roh.empfehlung || {};

  return {
    _floskeln: floskeln,
    titel: kappe(roh.titel, 60) || "Dein Prozess",
    einordnung: {
      hebel: [
        "digitalisierung", "automatisierung", "ki",
        "digitalisierung_und_automatisierung", "automatisierung_und_ki"
      ].includes(re.hebel) ? re.hebel : "automatisierung",
      begruendung_digitalisierung: kappe(re.begruendung_digitalisierung, 140),
      begruendung_automatisierung: kappe(re.begruendung_automatisierung, 140),
      begruendung_ki: kappe(re.begruendung_ki, 140)
    },
    kriterien,
    ist_prozess: ist,
    soll_prozess: soll,
    empfehlung: {
      titel: kappe(rp.titel, 55) || "Empfehlung",
      text: kappe(rp.text, 380)
    },
    vorgehen: (Array.isArray(roh.vorgehen) ? roh.vorgehen : [])
      .slice(0, 5)
      .map((v) => ({ titel: kappe(v.titel, 45), text: kappe(v.text, 200) }))
      .filter((v) => v.titel),
    quick_win: kappe(roh.quick_win, 300),
    voraussetzungen: (Array.isArray(roh.voraussetzungen) ? roh.voraussetzungen : [])
      .slice(0, 4).map((v) => kappe(v, 160)).filter(Boolean),
    annahmen: (Array.isArray(roh.annahmen) ? roh.annahmen : [])
      .slice(0, 4).map((v) => kappe(v, 160)).filter(Boolean),
    komplexitaet: ["gering", "mittel", "hoch"].includes(roh.komplexitaet)
      ? roh.komplexitaet : "mittel",
    umsetzungsdauer: kappe(roh.umsetzungsdauer, 40) || "2 bis 4 Wochen"
  };
}

/* ---------------------------------------------------------------------
   Ablauf-Erkennung
   ------------------------------------------------------------------- */
export function bereinigeVerstehen(roh) {
  const haeufigkeiten = [
    "mehrmals_taeglich", "taeglich", "mehrmals_woechentlich",
    "woechentlich", "monatlich", "seltener"
  ];

  return {
    titel: roh.titel ? kappe(roh.titel, 60) : null,
    ausloeser: roh.ausloeser ? kappe(roh.ausloeser, 60) : null,
    schritte: (Array.isArray(roh.schritte) ? roh.schritte : [])
      .slice(0, 10)
      .map((s) => ({
        text: kappe(s.text, 55),
        system: s.system ? kappe(s.system, 30) : null
      }))
      .filter((s) => s.text),
    ergebnis: roh.ergebnis ? kappe(roh.ergebnis, 60) : null,
    systeme: (Array.isArray(roh.systeme) ? roh.systeme : [])
      .slice(0, 20)
      .map((s) => text(s).toLowerCase())
      .filter(Boolean),
    haeufigkeit_erkannt: haeufigkeiten.includes(roh.haeufigkeit_erkannt)
      ? roh.haeufigkeit_erkannt : null,
    dauer_erkannt: ["5", "15", "30", "60", "120"].includes(roh.dauer_erkannt)
      ? roh.dauer_erkannt : null,
    rueckfragen: (Array.isArray(roh.rueckfragen) ? roh.rueckfragen : [])
      .slice(0, 3).map((f) => kappe(f, 90)).filter(Boolean)
  };
}
