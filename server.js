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
import { createReadStream } from "node:fs";
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
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".mp4":  "video/mp4",
  ".webm": "video/webm",
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

/* --- statische Dateien --------------------------------------------------
   Streamt statt einzulesen, beantwortet Range-Anfragen und schickt
   Validatoren mit. Alle drei Punkte zahlen auf das Hero-Video ein: ohne
   Range kann der Browser nicht spulen, ohne ETag lädt er die Datei bei
   jedem Seitenaufruf komplett neu.
   ------------------------------------------------------------------------ */
async function liefereDatei(pfad, req, res) {
  // Pfad-Ausbruch verhindern
  const sicher = normalize(join(WURZEL, pfad));
  if (!sicher.startsWith(WURZEL + sep) && sicher !== WURZEL) {
    res.writeHead(403).end("Verboten");
    return;
  }

  let ziel = sicher;
  let info;
  try {
    info = await stat(ziel);
    if (info.isDirectory()) {
      ziel = join(ziel, "index.html");
      info = await stat(ziel);
    }
  } catch {
    // Ohne Endung eine .html-Datei versuchen: /prozesscheck → prozesscheck.html
    if (!extname(ziel)) {
      try {
        ziel += ".html";
        info = await stat(ziel);
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

  const typ = TYPEN[extname(ziel)] || "application/octet-stream";
  const etag = `"${info.size.toString(16)}-${info.mtimeMs.toString(16)}"`;
  const istSeite = typ.startsWith("text/html");

  const kopf = {
    "Content-Type": typ,
    "ETag": etag,
    "Last-Modified": info.mtime.toUTCString(),
    "Accept-Ranges": "bytes",
    // Seiten immer prüfen, Anhänge eine Stunde behalten. Ohne Hash im
    // Dateinamen wäre alles darüber riskant.
    "Cache-Control": istSeite ? "no-cache" : "public, max-age=3600"
  };

  // Unverändert? Dann spart der Browser sich den Inhalt.
  if (req.headers["if-none-match"] === etag) {
    res.writeHead(304, kopf).end();
    return;
  }

  // Teilbereich angefordert (Video spulen, Wiedergabe auf iOS)
  const bereich = req.headers.range;
  if (bereich) {
    const treffer = /^bytes=(\d*)-(\d*)$/.exec(bereich.trim());
    if (treffer) {
      let von = treffer[1] === "" ? null : Number(treffer[1]);
      let bis = treffer[2] === "" ? null : Number(treffer[2]);

      if (von === null && bis !== null) {           // bytes=-500 → letzte 500
        von = Math.max(0, info.size - bis);
        bis = info.size - 1;
      } else {
        if (von === null) von = 0;
        if (bis === null || bis >= info.size) bis = info.size - 1;
      }

      if (von > bis || von >= info.size) {
        res.writeHead(416, { "Content-Range": `bytes */${info.size}` }).end();
        return;
      }

      res.writeHead(206, {
        ...kopf,
        "Content-Range": `bytes ${von}-${bis}/${info.size}`,
        "Content-Length": bis - von + 1
      });
      if (req.method === "HEAD") { res.end(); return; }
      createReadStream(ziel, { start: von, end: bis }).pipe(res);
      return;
    }
  }

  res.writeHead(200, { ...kopf, "Content-Length": info.size });
  if (req.method === "HEAD") { res.end(); return; }
  createReadStream(ziel).pipe(res);
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

  await liefereDatei(decodeURIComponent(url.pathname), req, res);
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
