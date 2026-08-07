/* =========================================================================
   GET /api/status

   Betriebsauskunft für die Fehlersuche nach einem Deployment. Beantwortet
   genau eine Frage: Läuft der Node-Dienst, und wie ist er konfiguriert?

   Gibt bewusst NUR Fakten aus, die kein Geheimnis sind: ob ein Schlüssel
   gesetzt ist (als true/false, nie der Wert), welches Modell konfiguriert
   ist und gegen welchen Endpunkt gerufen wird.

   Antwortet dieser Aufruf mit HTML statt JSON, läuft der Node-Dienst nicht
   und die Seite wird als reine Statik ausgeliefert – dann greifen auch die
   übrigen Endpunkte nicht.
   ========================================================================= */

import { MODELL, MODELL_KLEIN, schluesselVorhanden } from "./_lib/openai.js";
import { antworte, fehler } from "./_lib/http.js";

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return fehler(res, 405, "methode");
  }

  const schluessel = process.env.OPENAI_API_KEY || "";

  return antworte(res, 200, {
    ok: true,
    dienst: "1automationen-prozesscheck",
    schluessel_gesetzt: schluesselVorhanden(),
    // Nur Länge und Präfix – daraus lässt sich ein abgeschnittener oder
    // mit Leerzeichen eingefügter Schlüssel erkennen, ohne ihn zu zeigen.
    schluessel_laenge: schluessel.length,
    schluessel_praefix: schluessel ? schluessel.slice(0, 7) : null,
    schluessel_sauber: schluessel === schluessel.trim(),
    modell: MODELL(),
    modell_schnell: MODELL_KLEIN(),
    basis_url: (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1"),
    lead_empfaenger_gesetzt: Boolean(process.env.LEAD_EMPFAENGER),
    mailversand_gesetzt: Boolean(process.env.RESEND_API_KEY),
    node: process.version
  });
}
