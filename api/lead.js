/* =========================================================================
   POST /api/lead

   Nimmt die Kontaktdaten samt vollständigem Ergebnis entgegen. Honigtopf
   und Zeitschwelle fangen Bots ab – beide antworten mit 200 und verwerfen
   still, damit ein Bot nicht lernt, was ihn verraten hat.
   ========================================================================= */

import { speichereLead } from "./_lib/lead-ziel.js";
import { pruefe, ipVon } from "./_lib/ratelimit.js";
import { antworte, fehler, leseKoerper, begrenze, protokolliere } from "./_lib/http.js";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default async function handler(req, res) {
  const start = Date.now();

  if (req.method !== "POST") return fehler(res, 405, "methode");

  let koerper;
  try {
    koerper = await leseKoerper(req, 256 * 1024);
  } catch {
    return fehler(res, 400, "koerper");
  }

  // Honigtopf: von Menschen nie ausgefüllt, weil unsichtbar.
  if (begrenze(koerper.website, 200).trim()) {
    protokolliere("lead", start, 200, { verworfen: "honigtopf" });
    return antworte(res, 200, { ok: true });
  }

  // Zeitschwelle: unter drei Sekunden hat niemand ein Ergebnis gelesen.
  const verweildauer = Number(koerper.verweildauer_ms);
  if (Number.isFinite(verweildauer) && verweildauer < 3000) {
    protokolliere("lead", start, 200, { verworfen: "zu_schnell" });
    return antworte(res, 200, { ok: true });
  }

  const kontakt = {
    name: begrenze(koerper.name, 200).trim(),
    firma: begrenze(koerper.firma, 200).trim(),
    email: begrenze(koerper.email, 200).trim(),
    telefon: begrenze(koerper.telefon, 200).trim(),
    nachricht: begrenze(koerper.nachricht, 2000).trim()
  };

  if (!kontakt.name) return fehler(res, 400, "name_fehlt");
  if (!EMAIL.test(kontakt.email)) return fehler(res, 400, "email_ungueltig");
  if (koerper.einverstanden !== true) return fehler(res, 400, "einverstaendnis_fehlt");

  const grenze = Number(process.env.RATE_LIMIT_LEAD_PRO_STUNDE) || 5;
  const takt = pruefe(ipVon(req), "lead", grenze);
  if (!takt.erlaubt) {
    res.setHeader("Retry-After", String(takt.wartezeit));
    protokolliere("lead", start, 429, {});
    return fehler(res, 429, "zu_viele");
  }

  const daten = {
    zeitpunkt: new Date().toISOString(),
    kontakt,
    eingabe: koerper.eingabe || null,
    ergebnis: koerper.ergebnis || null,
    referrer: begrenze(koerper.referrer, 300),
    ip: ipVon(req)
  };

  const ziel = await speichereLead(daten);

  if (!ziel.datei && !ziel.mail) {
    protokolliere("lead", start, 502, {});
    return fehler(res, 502, "speichern_fehlgeschlagen");
  }

  protokolliere("lead", start, 200, { datei: ziel.datei, mail: ziel.mail });
  return antworte(res, 200, { ok: true });
}
