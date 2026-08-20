/* =========================================================================
   Kleine Helfer für die drei Endpunkte: Kopfzeilen, Körper lesen,
   Antworten schreiben, Protokoll ohne personenbezogene Daten.
   ========================================================================= */

export function setzeKopfzeilen(res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), geolocation=(), payment=(), usb=()");
  res.setHeader("Cache-Control", "no-store");
}

/** Verwirft browserseitige POST-Aufrufe von fremden Websites. */
export function istGleicherUrsprung(req) {
  const fetchSite = String(req.headers["sec-fetch-site"] || "").toLowerCase();
  if (fetchSite && !["same-origin", "same-site", "none"].includes(fetchSite)) return false;

  const ursprung = req.headers.origin;
  if (!ursprung) return true; // Server-zu-Server und ältere Clients

  const konfiguriert = String(process.env.PUBLIC_ORIGIN || "").replace(/\/$/, "");
  if (konfiguriert) return ursprung === konfiguriert;

  const host = req.headers["x-forwarded-host"] || req.headers.host;
  if (!host) return false;
  const protokoll = req.headers["x-forwarded-proto"] || (req.socket?.encrypted ? "https" : "http");
  return ursprung === `${protokoll}://${host}`;
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
