/* =========================================================================
   GET /api/status

   Minimale Betriebsauskunft für den öffentlichen Healthcheck. Interne
   Konfigurationsdetails, Modellnamen und Schlüsselmerkmale gehören nicht
   in einen anonym erreichbaren Endpunkt.

   Antwortet dieser Aufruf mit HTML statt JSON, läuft der Node-Dienst nicht
   und die Seite wird als reine Statik ausgeliefert – dann greifen auch die
   übrigen Endpunkte nicht.
   ========================================================================= */

import { antworte, fehler } from "./_lib/http.js";

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return fehler(res, 405, "methode");
  }

  return antworte(res, 200, {
    ok: true,
    dienst: "1automationen-prozesscheck"
  });
}
