/* =========================================================================
   Einfache Ratenbegrenzung je IP im Arbeitsspeicher.

   Hinweis für den Betrieb: Auf serverlosem Hosting teilen sich die
   Instanzen den Speicher nicht. Die Begrenzung wirkt dort je Instanz und
   ist damit nur ein grober Schutz. Für harte Grenzen einen gemeinsamen
   Zähldienst (Redis, Upstash, Vercel KV) einsetzen – dafür genügt es,
   pruefe() auszutauschen.
   ========================================================================= */

const speicher = new Map();
const STUNDE = 60 * 60 * 1000;

/** Räumt regelmässig abgelaufene Einträge auf, damit die Map nicht wächst. */
function aufraeumen(jetzt) {
  for (const [schluessel, zeiten] of speicher) {
    const frisch = zeiten.filter((t) => jetzt - t < STUNDE);
    if (frisch.length) speicher.set(schluessel, frisch);
    else speicher.delete(schluessel);
  }
}

let letzteReinigung = 0;

/**
 * @param {string} kennung  IP oder anderer Schlüssel
 * @param {string} bereich  Name des Endpunkts
 * @param {number} grenze   erlaubte Aufrufe je Stunde
 * @returns {{erlaubt: boolean, wartezeit: number}}  Wartezeit in Sekunden
 */
export function pruefe(kennung, bereich, grenze) {
  const jetzt = Date.now();

  if (jetzt - letzteReinigung > 5 * 60 * 1000) {
    aufraeumen(jetzt);
    letzteReinigung = jetzt;
  }

  const schluessel = `${bereich}:${kennung}`;
  const zeiten = (speicher.get(schluessel) || []).filter((t) => jetzt - t < STUNDE);

  if (zeiten.length >= grenze) {
    const wartezeit = Math.ceil((STUNDE - (jetzt - zeiten[0])) / 1000);
    speicher.set(schluessel, zeiten);
    return { erlaubt: false, wartezeit };
  }

  zeiten.push(jetzt);
  speicher.set(schluessel, zeiten);
  return { erlaubt: true, wartezeit: 0 };
}

/** Liest die IP aus den üblichen Proxy-Kopfzeilen. */
export function ipVon(req) {
  // Proxy-Kopfzeilen nur auf dem dafür konfigurierten Hosting vertrauen.
  // Der letzte Eintrag ist der Client vor dem direkt vertrauten Proxy und
  // verhindert, dass ein vorgeschobener erster Wert das Limit umgeht.
  if (process.env.TRUST_PROXY === "1") {
    const weiter = req.headers["x-forwarded-for"];
    const teile = Array.isArray(weiter)
      ? weiter.flatMap((wert) => String(wert).split(","))
      : String(weiter || "").split(",");
    const kandidat = teile.map((wert) => wert.trim()).filter(Boolean).at(-1);
    if (kandidat) return kandidat.slice(0, 80);
    if (req.headers["x-real-ip"]) return String(req.headers["x-real-ip"]).slice(0, 80);
  }
  return String(req.socket?.remoteAddress || "unbekannt").slice(0, 80);
}
