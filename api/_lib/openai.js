/* =========================================================================
   Aufruf der OpenAI-API mit Structured Outputs.

   Ohne SDK, nur mit fetch – das hält das Backend abhängigkeitsfrei.
   Primär wird die Responses-API angesprochen. Antwortet sie mit 400 auf
   einen unbekannten Parameter, wird einmal auf Chat Completions
   ausgewichen. Damit läuft der Code gegen jede gängige Fassung der
   Schnittstelle.

   Der API-Schlüssel wird ausschliesslich hier gelesen und verlässt den
   Server nie.
   ========================================================================= */

const BASIS_URL = () =>
  (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");

export const MODELL = () => process.env.OPENAI_MODEL || "gpt-5.6-terra";
export const MODELL_KLEIN = () =>
  process.env.OPENAI_MODEL_FAST || process.env.OPENAI_MODEL || "gpt-5.6-terra";

export function schluesselVorhanden() {
  return Boolean(process.env.OPENAI_API_KEY);
}

export class OpenAiFehler extends Error {
  constructor(nachricht, status, code) {
    super(nachricht);
    this.name = "OpenAiFehler";
    this.status = status;
    this.code = code;
  }
}

/** Holt den Text aus den verschiedenen möglichen Antwortformen. */
function extrahiereText(daten) {
  if (typeof daten.output_text === "string" && daten.output_text.trim()) {
    return daten.output_text;
  }

  // Responses-API: output[] mit reasoning- und message-Einträgen
  if (Array.isArray(daten.output)) {
    for (const eintrag of daten.output) {
      if (!Array.isArray(eintrag.content)) continue;
      for (const teil of eintrag.content) {
        if (typeof teil.text === "string" && teil.text.trim()) return teil.text;
      }
    }
  }

  // Chat Completions
  const inhalt = daten?.choices?.[0]?.message?.content;
  if (typeof inhalt === "string" && inhalt.trim()) return inhalt;

  return "";
}

async function sende(pfad, koerper, zeitlimit) {
  const antwort = await fetch(BASIS_URL() + pfad, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(koerper),
    signal: AbortSignal.timeout(zeitlimit)
  });

  const rohtext = await antwort.text();
  let daten;
  try {
    daten = JSON.parse(rohtext);
  } catch {
    // Kein JSON heisst fast immer: die Antwort kam nicht von OpenAI,
    // sondern von etwas dazwischen – Proxy, Firewall, Gateway. Der
    // Anfang des Textes ist dann die eigentliche Auskunft und gehört
    // ins Serverlog, sonst sucht man im Dunkeln.
    throw new OpenAiFehler(
      `HTTP ${antwort.status}, Antwort war kein JSON: ` +
      rohtext.slice(0, 200).replace(/\s+/g, " ").trim(),
      antwort.status,
      "kein_json"
    );
  }

  if (!antwort.ok) {
    const fehler = daten?.error || {};
    throw new OpenAiFehler(
      fehler.message || `HTTP ${antwort.status}`,
      antwort.status,
      fehler.code || fehler.type || "fehler"
    );
  }

  return daten;
}

/**
 * Ruft das Modell auf und gibt das geparste JSON zurück.
 *
 * @param {object}  o
 * @param {string}  o.modell
 * @param {string}  o.systemPrompt
 * @param {string}  o.nutzerBlock   ausschliesslich Kundeneingaben
 * @param {string}  o.schemaName
 * @param {object}  o.schema
 * @param {string}  o.aufwand       "minimal" | "low" | "medium"
 * @param {number}  o.maxTokens
 * @param {number}  o.zeitlimit     in Millisekunden
 */
export async function frageModell(o) {
  const {
    modell, systemPrompt, nutzerBlock, schemaName, schema,
    aufwand = "low", maxTokens = 4000, zeitlimit = 40000
  } = o;

  if (!schluesselVorhanden()) {
    throw new OpenAiFehler("OPENAI_API_KEY fehlt", 503, "nicht_konfiguriert");
  }

  const responsesKoerper = {
    model: modell,
    store: false,
    max_output_tokens: maxTokens,
    reasoning: { effort: aufwand },
    input: [
      { role: "system", content: systemPrompt },
      { role: "user", content: nutzerBlock }
    ],
    text: {
      format: { type: "json_schema", name: schemaName, strict: true, schema }
    }
  };

  let daten;
  try {
    daten = await sende("/responses", responsesKoerper, zeitlimit);
  } catch (fehler) {
    // Kennt die Schnittstelle einen Parameter nicht, einmal auf Chat
    // Completions ausweichen. Andere Fehler werden durchgereicht.
    const unbekannterParameter =
      fehler instanceof OpenAiFehler &&
      fehler.status === 400 &&
      /unknown|unsupported|not supported|invalid[_ ]parameter|reasoning|text\.format|max_output_tokens/i
        .test(fehler.message || "");

    if (!unbekannterParameter) throw fehler;

    daten = await sende("/chat/completions", {
      model: modell,
      max_completion_tokens: maxTokens,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: nutzerBlock }
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: schemaName, strict: true, schema }
      }
    }, zeitlimit);
  }

  if (daten.status === "incomplete") {
    throw new OpenAiFehler(
      "Antwort wurde abgeschnitten: " + (daten.incomplete_details?.reason || "unbekannt"),
      502, "unvollstaendig"
    );
  }

  const rohtext = extrahiereText(daten);
  if (!rohtext) {
    throw new OpenAiFehler("Antwort enthielt keinen Text", 502, "leer");
  }

  try {
    return JSON.parse(rohtext);
  } catch {
    // Sehr selten trotz Structured Outputs: eine Code-Umrandung drumherum.
    const treffer = rohtext.match(/\{[\s\S]*\}/);
    if (treffer) {
      try { return JSON.parse(treffer[0]); } catch { /* faellt unten durch */ }
    }
    throw new OpenAiFehler("Antwort war kein gültiges JSON", 502, "kein_json");
  }
}
