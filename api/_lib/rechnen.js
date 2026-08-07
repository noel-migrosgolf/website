/* =========================================================================
   Rechenlogik des Prozesschecks.

   Grundsatz: Das Modell liefert Urteile, dieser Code liefert Zahlen.
   Dadurch ergeben gleiche Eingaben immer dieselben Werte, und die Formel
   lässt sich im Gespräch verteidigen.

   Läuft bewusst serverseitig – die Gewichtungen stehen nicht im Browser.
   ========================================================================= */

export const LAEUFE_PRO_MONAT = {
  mehrmals_taeglich:     44,   // 2 je Arbeitstag, 22 Arbeitstage
  taeglich:              22,
  mehrmals_woechentlich: 12,
  woechentlich:          4.3,
  monatlich:             1,
  seltener:              0.5
};

export const MINUTEN_JE_LAUF = { "5": 5, "15": 15, "30": 30, "60": 60, "120": 120 };
// "2 Std. und mehr" wird bewusst mit 120 gerechnet, nicht höher.

const PERSONEN_ZAHL = { "1": 1, "2-5": 3, "6-20": 10, "20+": 25 };
// Nur für die Komplexität. NICHT als Multiplikator für den Aufwand:
// die Häufigkeit ist bereits die Gesamtzahl über alle Personen.

const FAKTOR = { voll: 1.0, teilweise: 0.5, nein: 0 };

const STUNDENSATZ_CHF = 80;

const UMSETZUNGSDAUER = {
  gering: "1 bis 2 Wochen",
  mittel: "2 bis 4 Wochen",
  hoch:   "4 bis 8 Wochen"
};

function klemme(wert, min, max) {
  return Math.min(max, Math.max(min, wert));
}

function runde(wert, stellen) {
  const f = Math.pow(10, stellen);
  return Math.round(wert * f) / f;
}

/**
 * Berechnet alle Zahlen des Ergebnisses aus den Wizard-Angaben und den
 * Urteilen des Modells.
 *
 * @param {object} eingabe   der Wizard-Zustand
 * @param {object} analyse   die bereinigte Modellantwort
 * @returns {object}         der Block "berechnung"
 */
export function berechne(eingabe, analyse) {
  const k = analyse.kriterien;

  /* --- Aufwand heute ------------------------------------------------- */
  const laeufe = LAEUFE_PRO_MONAT[eingabe.haeufigkeit];
  const minuten = MINUTEN_JE_LAUF[eingabe.dauer];
  const angabenVollstaendig = typeof laeufe === "number" && typeof minuten === "number";

  const laeufeProMonat = angabenVollstaendig ? laeufe : 0;
  const minutenJeLauf = angabenVollstaendig ? minuten : 0;
  const minutenProMonat = laeufeProMonat * minutenJeLauf;
  const stundenProMonat = minutenProMonat / 60;
  const stundenProJahr = stundenProMonat * 12;

  /* --- Einsparung aus den Schritt-Bewertungen ------------------------ */
  let einsparanteil = 0;
  for (const schritt of analyse.ist_prozess) {
    const faktor = FAKTOR[schritt.automatisierbarkeit] ?? 0;
    einsparanteil += (schritt.dauer_anteil / 100) * faktor;
  }

  // Deckel: eine Restarbeit bleibt immer – Pflege, Ausnahmen, Kontrolle.
  einsparanteil = Math.min(einsparanteil, 0.85);

  // Dämpfung bei schlechter Integrierbarkeit: was sich nicht anbinden
  // lässt, spart auch nichts.
  if (k.integrierbarkeit < 40) einsparanteil *= 0.75;
  else if (k.integrierbarkeit < 60) einsparanteil *= 0.9;

  einsparanteil = klemme(einsparanteil, 0, 0.85);

  const einsparungStunden = stundenProMonat * einsparanteil;
  const einsparungVon = einsparungStunden * 0.8;
  const einsparungBis = einsparungStunden * 1.1;

  /* --- Volumen und Zeitaufwand als Kennzahlen ------------------------ */
  // Logarithmisch, damit "einmal im Monat" nicht auf 2 fällt und alles
  // darüber auf 100 springt. 44 Läufe im Monat sind der volle Ausschlag.
  const volumen = angabenVollstaendig
    ? klemme(100 * (Math.log10(1 + laeufeProMonat) / Math.log10(1 + 44)), 0, 100)
    : 40;

  // 40 Stunden im Monat gelten als voller Ausschlag.
  const zeitaufwand = angabenVollstaendig
    ? klemme(100 * (stundenProMonat / 40), 0, 100)
    : 40;

  /* --- Die drei Potenzial-Scores -------------------------------------
     Achtung, zwei bewusste Umkehrungen:
     - Digitalisierungs-Potenzial steigt, wenn der Digitalisierungsgrad
       sinkt. Wer schon alles digital hat, gewinnt hier nichts mehr.
     - KI-Potenzial steigt, wenn die Regelbasiertheit sinkt. Was sich
       sauber in Regeln fassen lässt, braucht keine KI, sondern eine Regel.
     ------------------------------------------------------------------- */
  const D =
      0.45 * (100 - k.digitalisierungsgrad)
    + 0.25 * zeitaufwand
    + 0.20 * k.fehleranfaelligkeit
    + 0.10 * volumen;

  const A =
      0.22 * k.wiederholbarkeit
    + 0.22 * k.regelbasiertheit
    + 0.18 * k.automatisierbarkeit
    + 0.14 * volumen
    + 0.12 * zeitaufwand
    + 0.12 * k.integrierbarkeit;

  const K =
      0.50 * k.ki_eignung
    + 0.20 * (100 - k.regelbasiertheit)
    + 0.15 * volumen
    + 0.15 * k.erwarteter_nutzen;

  const hoechster = Math.max(D, A, K);
  const mittel = (D + A + K) / 3;
  let gesamt = Math.round(0.6 * hoechster + 0.4 * mittel);

  // Plausibilitätsdeckel: Ohne nennenswertes Volumen ist ein glänzendes
  // Ergebnis unredlich. Der Nutzen liegt dann bei Qualität, nicht bei Zeit.
  const geringesVolumen = angabenVollstaendig && stundenProMonat < 1;
  const gedeckelt = geringesVolumen && gesamt > 60;
  if (gedeckelt) gesamt = 60;

  /* --- Komplexität ---------------------------------------------------- */
  const anzahlSysteme =
    (eingabe.systeme || []).length + (eingabe.systeme_frei || []).length;
  const personen = PERSONEN_ZAHL[eingabe.personen] || 1;
  const entscheidungen = analyse.ist_prozess
    .filter((s) => s.typ === "entscheidung").length;

  let punkte = anzahlSysteme;
  if (eingabe.vernetzung === "nein") punkte += 2;
  else if (eingabe.vernetzung === "teilweise") punkte += 1;
  if (k.integrierbarkeit < 50) punkte += 2;
  if (personen >= 10) punkte += 1;
  if (entscheidungen >= 2) punkte += 1;

  let komplexitaet;
  if (punkte <= 3) komplexitaet = "gering";
  else if (punkte <= 6) komplexitaet = "mittel";
  else komplexitaet = "hoch";

  // Ohne Systemangaben ist die Rechnung nicht aussagekräftig – dann gilt
  // die Einschätzung des Modells.
  if (anzahlSysteme === 0) {
    komplexitaet = analyse.komplexitaet || komplexitaet;
  }

  const minutenNachher = minutenJeLauf * (1 - einsparanteil);

  return {
    angaben_vollstaendig: angabenVollstaendig,
    laeufe_pro_monat: runde(laeufeProMonat, 1),
    minuten_je_lauf: minutenJeLauf,
    stunden_pro_monat: runde(stundenProMonat, 1),
    stunden_pro_jahr: runde(stundenProJahr, 0),
    einsparanteil: runde(einsparanteil, 2),
    einsparung_von_stunden: runde(einsparungVon, 1),
    einsparung_bis_stunden: runde(einsparungBis, 1),
    einsparung_von_chf: Math.round(einsparungVon * STUNDENSATZ_CHF),
    einsparung_bis_chf: Math.round(einsparungBis * STUNDENSATZ_CHF),
    stundensatz_chf: STUNDENSATZ_CHF,
    minuten_je_lauf_nachher: Math.round(minutenNachher),
    score_digitalisierung: Math.round(klemme(D, 0, 100)),
    score_automatisierung: Math.round(klemme(A, 0, 100)),
    score_ki: Math.round(klemme(K, 0, 100)),
    score_gesamt: Math.round(klemme(gesamt, 0, 100)),
    volumen: Math.round(volumen),
    zeitaufwand: Math.round(zeitaufwand),
    komplexitaet,
    umsetzungsdauer: UMSETZUNGSDAUER[komplexitaet] || analyse.umsetzungsdauer,
    // gedeckelt sagt, ob der Deckel tatsächlich gegriffen hat.
    // geringes_volumen steuert den Hinweis in der Oberfläche – der gehört
    // an die Situation, nicht an den Klemmvorgang: bei einem seltenen
    // Prozess fällt der Score oft schon von selbst unter den Deckel.
    gedeckelt,
    geringes_volumen: geringesVolumen
  };
}
