/* =========================================================================
   POST /api/analyse

   Der grosse Aufruf für Schritt 5. Das Modell liefert Urteile, rechnen.js
   liefert die Zahlen. Scheitert das Schema, wird einmal mit höherem
   Denkaufwand wiederholt.
   ========================================================================= */

import { frageModell, MODELL, schluesselVorhanden, OpenAiFehler } from "./_lib/openai.js";
import { SYSTEM_PROMPT_ANALYSE, baueNutzerblock } from "./_lib/prompt.js";
import { SCHEMA_ANALYSE } from "./_lib/schema.js";
import { bereinigeAnalyse } from "./_lib/bereinigen.js";
import { berechne } from "./_lib/rechnen.js";
import { pruefe, ipVon } from "./_lib/ratelimit.js";
import {
  antworte, fehler, leseKoerper, begrenze, begrenzeListe, protokolliere
} from "./_lib/http.js";

const HAEUFIGKEITEN = [
  "mehrmals_taeglich", "taeglich", "mehrmals_woechentlich",
  "woechentlich", "monatlich", "seltener"
];
const DAUERN = ["5", "15", "30", "60", "120"];
const PERSONEN = ["1", "2-5", "6-20", "20+"];
const VERNETZUNGEN = ["nein", "teilweise", "ja", "unbekannt"];

/** Nimmt nur bekannte Felder an und begrenzt jede Länge serverseitig. */
function saeubereEingabe(koerper) {
  return {
    ziele: begrenzeListe(koerper.ziele, 7, 20),
    beschreibung: begrenze(koerper.beschreibung, 4000).trim(),
    schritte_bestaetigt: (Array.isArray(koerper.schritte_bestaetigt) ? koerper.schritte_bestaetigt : [])
      .slice(0, 12)
      .map((s) => ({
        text: begrenze(s?.text, 200).trim(),
        system: s?.system ? begrenze(s.system, 40).trim() : null
      }))
      .filter((s) => s.text),
    rueckfragen: (Array.isArray(koerper.rueckfragen) ? koerper.rueckfragen : [])
      .slice(0, 3)
      .map((r) => ({
        frage: begrenze(r?.frage, 120).trim(),
        antwort: begrenze(r?.antwort, 300).trim()
      }))
      .filter((r) => r.frage && r.antwort),
    systeme: begrenzeListe(koerper.systeme, 30, 40),
    systeme_frei: begrenzeListe(koerper.systeme_frei, 8, 40),
    vernetzung: VERNETZUNGEN.includes(koerper.vernetzung) ? koerper.vernetzung : null,
    haeufigkeit: HAEUFIGKEITEN.includes(koerper.haeufigkeit) ? koerper.haeufigkeit : null,
    dauer: DAUERN.includes(String(koerper.dauer)) ? String(koerper.dauer) : null,
    personen: PERSONEN.includes(koerper.personen) ? koerper.personen : null
  };
}

export default async function handler(req, res) {
  const start = Date.now();

  if (req.method !== "POST") return fehler(res, 405, "methode");

  if (!schluesselVorhanden()) {
    protokolliere("analyse", start, 503, { grund: "kein_schluessel" });
    return fehler(res, 503, "nicht_konfiguriert");
  }

  let koerper;
  try {
    koerper = await leseKoerper(req, 64 * 1024);
  } catch {
    return fehler(res, 400, "koerper");
  }

  const eingabe = saeubereEingabe(koerper);
  if (eingabe.beschreibung.length < 40) return fehler(res, 400, "zu_kurz");

  const grenze = Number(process.env.RATE_LIMIT_ANALYSE_PRO_STUNDE) || 6;
  const takt = pruefe(ipVon(req), "analyse", grenze);
  if (!takt.erlaubt) {
    res.setHeader("Retry-After", String(takt.wartezeit));
    protokolliere("analyse", start, 429, {});
    return fehler(res, 429, "zu_viele");
  }

  const nutzerBlock = baueNutzerblock(eingabe);

  async function versuch(aufwand) {
    const roh = await frageModell({
      modell: MODELL(),
      systemPrompt: SYSTEM_PROMPT_ANALYSE,
      nutzerBlock,
      schemaName: "prozesscheck",
      schema: SCHEMA_ANALYSE,
      aufwand,
      maxTokens: 4000,
      zeitlimit: 40000
    });
    return bereinigeAnalyse(roh);
  }

  // Ein zweiter Versuch hilft nur, wenn die Antwort unbrauchbar war.
  // Bei einem abgelehnten Aufruf – falsches Modell, ungültiger Schlüssel,
  // fehlende Berechtigung – kostet die Wiederholung nur Zeit und Geld.
  function lohntWiederholung(f) {
    if (!(f instanceof OpenAiFehler)) return false;
    return ["kein_json", "leer", "unvollstaendig"].includes(f.code) || f.status >= 500;
  }

  function melde(f, status) {
    // Die Meldung von OpenAI gehört ins Serverlog, nicht zum Besucher.
    // Sie enthält den eigentlichen Grund, etwa einen unbekannten Modellnamen.
    protokolliere("analyse", start, status, {
      modell: MODELL(),
      code: f.code || "unbekannt",
      grund: JSON.stringify(f.message || "")
    });
  }

  let analyse;
  try {
    analyse = await versuch("low");
  } catch (f) {
    if (f instanceof OpenAiFehler && f.status === 429) {
      res.setHeader("Retry-After", "60");
      melde(f, 429);
      return fehler(res, 429, "zu_viele");
    }

    if (!lohntWiederholung(f)) {
      melde(f, 502);
      return fehler(res, 502, "analyse_fehlgeschlagen");
    }

    try {
      analyse = await versuch("medium");
    } catch (f2) {
      melde(f2, 502);
      return fehler(res, 502, "analyse_fehlgeschlagen");
    }
  }

  const floskeln = analyse._floskeln || [];
  delete analyse._floskeln;

  analyse.berechnung = berechne(eingabe, analyse);

  protokolliere("analyse", start, 200, {
    zeichen: eingabe.beschreibung.length,
    schritte: analyse.ist_prozess.length,
    gesamt: analyse.berechnung.score_gesamt,
    floskeln: floskeln.length
  });

  return antworte(res, 200, analyse);
}
