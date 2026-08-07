/* =========================================================================
   POST /api/verstehen

   Schneller Aufruf für Schritt 2: gliedert die Beschreibung in Auslöser,
   Schritte, Systeme und Ergebnis. Bewertet nichts.

   Scheitert dieser Endpunkt, merkt der Besucher nichts – das Frontend
   zeigt die Karte dann einfach nicht an.
   ========================================================================= */

import { frageModell, MODELL_KLEIN, schluesselVorhanden, OpenAiFehler } from "./_lib/openai.js";
import { SYSTEM_PROMPT_VERSTEHEN, baueVerstehenBlock } from "./_lib/prompt.js";
import { SCHEMA_VERSTEHEN } from "./_lib/schema.js";
import { bereinigeVerstehen } from "./_lib/bereinigen.js";
import { pruefe, ipVon } from "./_lib/ratelimit.js";
import { antworte, fehler, leseKoerper, begrenze, protokolliere } from "./_lib/http.js";

export default async function handler(req, res) {
  const start = Date.now();

  if (req.method !== "POST") return fehler(res, 405, "methode");

  if (!schluesselVorhanden()) {
    protokolliere("verstehen", start, 503, { grund: "kein_schluessel" });
    return fehler(res, 503, "nicht_konfiguriert");
  }

  let koerper;
  try {
    koerper = await leseKoerper(req, 16 * 1024);
  } catch {
    return fehler(res, 400, "koerper");
  }

  const beschreibung = begrenze(koerper.beschreibung, 4000).trim();
  if (beschreibung.length < 40) return fehler(res, 400, "zu_kurz");

  const grenze = Number(process.env.RATE_LIMIT_VERSTEHEN_PRO_STUNDE) || 40;
  const takt = pruefe(ipVon(req), "verstehen", grenze);
  if (!takt.erlaubt) {
    res.setHeader("Retry-After", String(takt.wartezeit));
    protokolliere("verstehen", start, 429, {});
    return fehler(res, 429, "zu_viele");
  }

  try {
    const roh = await frageModell({
      modell: MODELL_KLEIN(),
      systemPrompt: SYSTEM_PROMPT_VERSTEHEN,
      nutzerBlock: baueVerstehenBlock(beschreibung),
      schemaName: "ablauf_erkennung",
      schema: SCHEMA_VERSTEHEN,
      aufwand: "minimal",
      maxTokens: 1500,
      zeitlimit: 20000
    });

    protokolliere("verstehen", start, 200, { zeichen: beschreibung.length });
    return antworte(res, 200, bereinigeVerstehen(roh));
  } catch (f) {
    const status = f instanceof OpenAiFehler && f.status === 429 ? 429 : 502;
    protokolliere("verstehen", start, status, {
      modell: MODELL_KLEIN(),
      code: f.code || "unbekannt",
      grund: JSON.stringify(f.message || "")
    });
    return fehler(res, status, "analyse_fehlgeschlagen");
  }
}
