/* =========================================================================
   Kleine Helfer für die drei Endpunkte: Kopfzeilen, Körper lesen,
   Antworten schreiben, Protokoll ohne personenbezogene Daten.
   ========================================================================= */

export function setzeKopfzeilen(res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", "no-store");
}

export function antworte(res, status, daten) {
  setzeKopfzeilen(res);
  res.statusCode = status;
  res.end(JSON.stringify(daten));
}

export function fehler(res, status, code, nachricht) {
  antworte(res, status, { fehler: code, nachricht: nachricht || null });
}

/** Liest den JSON-Körper. Grenze verhindert, dass eine Anfrage den Speicher füllt. */
export async function leseKoerper(req, maxBytes = 64 * 1024) {
  if (req.body && typeof req.body === "object") return req.body;   // Vercel & Co.

  const teile = [];
  let laenge = 0;

  for await (const stueck of req) {
    laenge += stueck.length;
    if (laenge > maxBytes) throw new Error("Anfrage zu gross");
    teile.push(stueck);
  }

  if (!teile.length) return {};
  return JSON.parse(Buffer.concat(teile).toString("utf8"));
}

/** Schneidet Text auf eine Höchstlänge, ohne die Anfrage abzulehnen. */
export function begrenze(wert, laenge) {
  if (typeof wert !== "string") return "";
  return wert.slice(0, laenge);
}

export function begrenzeListe(wert, anzahl, laenge) {
  if (!Array.isArray(wert)) return [];
  return wert.slice(0, anzahl).map((e) => begrenze(String(e), laenge)).filter(Boolean);
}

/**
 * Protokoll ohne Inhalte: nur Zeitstempel, Endpunkt, Dauer, Status und
 * Eingabelänge. Beschreibungen und Kontaktdaten landen nie im Log.
 */
export function protokolliere(endpunkt, start, status, zusatz) {
  const dauer = Date.now() - start;
  const felder = Object.entries(zusatz || {})
    .map(([k, v]) => `${k}=${v}`)
    .join(" ");
  console.log(
    `[${new Date().toISOString()}] ${endpunkt} status=${status} dauer=${dauer}ms ${felder}`.trim()
  );
}
