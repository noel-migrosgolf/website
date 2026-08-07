/* =========================================================================
   Lokaler Server: statische Dateien plus die drei API-Endpunkte.

   Ohne Abhängigkeiten. Nur für die Entwicklung und für einfaches Hosting
   auf einem eigenen Node-Server gedacht. Auf Vercel, Netlify und
   ähnlichen Plattformen werden die Dateien in api/ direkt als Funktionen
   erkannt; dort wird diese Datei nicht gebraucht.

       node server.js              → http://localhost:8000
       PORT=3000 node server.js

   Die Datei .env wird beim Start eingelesen, falls vorhanden.
   ========================================================================= */

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";

const WURZEL = process.cwd();
const PORT = Number(process.env.PORT) || 8000;

const TYPEN = {
  ".html": "text/html; charset=utf-8",
  ".css":  "text/css; charset=utf-8",
  ".js":   "text/javascript; charset=utf-8",
  ".svg":  "image/svg+xml",
  ".woff2": "font/woff2",
  ".png":  "image/png",
  ".jpg":  "image/jpeg",
  ".webp": "image/webp",
  ".json": "application/json; charset=utf-8",
  ".ico":  "image/x-icon"
};

/* --- .env einlesen, ohne Abhängigkeit ---------------------------------- */
async function ladeEnv() {
  try {
    const inhalt = await readFile(join(WURZEL, ".env"), "utf8");
    for (const zeile of inhalt.split("\n")) {
      const getrimmt = zeile.trim();
      if (!getrimmt || getrimmt.startsWith("#")) continue;
      const stelle = getrimmt.indexOf("=");
      if (stelle < 1) continue;
      const name = getrimmt.slice(0, stelle).trim();
      let wert = getrimmt.slice(stelle + 1).trim();
      if (/^".*"$/.test(wert) || /^'.*'$/.test(wert)) wert = wert.slice(1, -1);
      if (!(name in process.env)) process.env[name] = wert;
    }
    console.log(".env eingelesen");
  } catch {
    console.log("Keine .env gefunden – die KI-Endpunkte antworten mit 503.");
  }
}

/* --- API-Handler einmalig laden ---------------------------------------- */
const HANDLER = {};
async function ladeHandler() {
  for (const name of ["verstehen", "analyse", "lead", "status"]) {
    const modul = await import(`./api/${name}.js`);
    HANDLER[`/api/${name}`] = modul.default;
  }
}

/* --- statische Dateien -------------------------------------------------- */
async function liefereDatei(pfad, res) {
  // Pfad-Ausbruch verhindern
  const sicher = normalize(join(WURZEL, pfad));
  if (!sicher.startsWith(WURZEL + sep) && sicher !== WURZEL) {
    res.writeHead(403).end("Verboten");
    return;
  }

  let ziel = sicher;
  try {
    const info = await stat(ziel);
    if (info.isDirectory()) ziel = join(ziel, "index.html");
  } catch {
    // Ohne Endung eine .html-Datei versuchen: /prozesscheck → prozesscheck.html
    if (!extname(ziel)) {
      try {
        await stat(ziel + ".html");
        ziel += ".html";
      } catch {
        res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" })
           .end("<h1>404</h1><p>Seite nicht gefunden.</p>");
        return;
      }
    } else {
      res.writeHead(404).end("Nicht gefunden");
      return;
    }
  }

  try {
    const inhalt = await readFile(ziel);
    res.writeHead(200, {
      "Content-Type": TYPEN[extname(ziel)] || "application/octet-stream",
      "Cache-Control": "no-cache"
    }).end(inhalt);
  } catch {
    res.writeHead(404).end("Nicht gefunden");
  }
}

/* --- Server ------------------------------------------------------------- */
await ladeEnv();
await ladeHandler();

createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const handler = HANDLER[url.pathname.replace(/\/$/, "")];

  if (handler) {
    try {
      await handler(req, res);
    } catch (fehler) {
      console.error("Unbehandelter Fehler:", fehler);
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
      }
      res.end(JSON.stringify({ fehler: "serverfehler" }));
    }
    return;
  }

  await liefereDatei(decodeURIComponent(url.pathname), res);
}).listen(PORT, () => {
  console.log(`1Automationen läuft auf Port ${PORT}`);
  console.log(`Modell: ${process.env.OPENAI_MODEL || "gpt-5.6-terra"} · ` +
              `Endpunkt: ${process.env.OPENAI_BASE_URL || "https://api.openai.com/v1"} · ` +
              `Node ${process.version}`);
  if (!process.env.OPENAI_API_KEY) {
    console.log("Hinweis: OPENAI_API_KEY fehlt – der Wizard läuft, die Analyse zeigt den Rückfall.");
  } else {
    console.log(`OPENAI_API_KEY gesetzt (${process.env.OPENAI_API_KEY.length} Zeichen). ` +
                `Konfiguration prüfen: GET /api/status`);
  }
});
