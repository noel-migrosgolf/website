/* =========================================================================
   Ablage der Anfragen aus dem Prozesscheck.

   Bewusst hinter einer einzigen Funktion gekapselt, damit das Ziel später
   austauschbar bleibt: heute E-Mail plus Datei, morgen CRM oder Datenbank.
   ========================================================================= */

import { appendFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

const ABLAGE = "data/leads.jsonl";

/**
 * Nimmt eine Anfrage entgegen. Wirft nie – ein fehlgeschlagener Versand
 * darf den Besucher nicht treffen, solange die Datei geschrieben wurde.
 *
 * @returns {{datei: boolean, mail: boolean}}
 */
export async function speichereLead(daten) {
  const ergebnis = { datei: false, mail: false };

  try {
    await mkdir(dirname(ABLAGE), { recursive: true });
    await appendFile(ABLAGE, JSON.stringify(daten) + "\n", "utf8");
    ergebnis.datei = true;
  } catch (fehler) {
    console.error("Lead konnte nicht abgelegt werden:", fehler.message);
  }

  try {
    ergebnis.mail = await sendeMail(daten);
  } catch (fehler) {
    console.error("Lead-Mail konnte nicht versendet werden:", fehler.message);
  }

  return ergebnis;
}

async function sendeMail(daten) {
  const schluessel = process.env.RESEND_API_KEY;
  const empfaenger = process.env.LEAD_EMPFAENGER;
  if (!schluessel || !empfaenger) return false;

  const antwort = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${schluessel}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: process.env.RESEND_ABSENDER || "Prozesscheck <onboarding@resend.dev>",
      to: [empfaenger],
      reply_to: daten.kontakt.email,
      subject: `Prozesscheck: ${daten.ergebnis?.titel || "Neue Anfrage"} – ${daten.kontakt.name}`,
      html: baueMail(daten)
    }),
    signal: AbortSignal.timeout(10000)
  });

  return antwort.ok;
}

function esc(wert) {
  return String(wert ?? "").replace(/[&<>"']/g, (z) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[z]
  ));
}

function liste(eintraege, abbilden) {
  if (!eintraege || !eintraege.length) return "<p>–</p>";
  return "<ul>" + eintraege.map((e) => `<li>${abbilden(e)}</li>`).join("") + "</ul>";
}

function baueMail(daten) {
  const k = daten.kontakt || {};
  const e = daten.ergebnis || {};
  const b = e.berechnung || {};
  const a = daten.eingabe || {};

  return `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5;color:#101214">
  <h2 style="margin:0 0 4px">${esc(e.titel || "Prozesscheck")}</h2>
  <p style="margin:0 0 20px;color:#626F86">
    Gesamtpotenzial ${esc(b.score_gesamt)} von 100 &middot;
    Digitalisierung ${esc(b.score_digitalisierung)} &middot;
    Automatisierung ${esc(b.score_automatisierung)} &middot;
    KI ${esc(b.score_ki)}
  </p>

  <h3>Kontakt</h3>
  <p style="margin:0 0 16px">
    ${esc(k.name)}${k.firma ? ", " + esc(k.firma) : ""}<br>
    <a href="mailto:${esc(k.email)}">${esc(k.email)}</a>
    ${k.telefon ? "<br>" + esc(k.telefon) : ""}
  </p>
  ${k.nachricht ? `<p style="margin:0 0 16px"><em>${esc(k.nachricht)}</em></p>` : ""}

  <h3>Zahlen</h3>
  <ul>
    <li>Aufwand heute: ${esc(b.stunden_pro_monat)} Std./Monat (${esc(b.stunden_pro_jahr)} Std./Jahr)</li>
    <li>Einsparpotenzial: ${esc(b.einsparung_von_stunden)}–${esc(b.einsparung_bis_stunden)} Std./Monat</li>
    <li>Komplexität: ${esc(b.komplexitaet)} (${esc(b.umsetzungsdauer)})</li>
    <li>Häufigkeit: ${esc(a.haeufigkeit)} &middot; Dauer: ${esc(a.dauer)} Min. &middot; Personen: ${esc(a.personen)}</li>
    <li>Systeme: ${esc([].concat(a.systeme || [], a.systeme_frei || []).join(", ") || "–")}</li>
  </ul>

  <h3>Empfehlung</h3>
  <p><strong>${esc(e.empfehlung?.titel)}</strong><br>${esc(e.empfehlung?.text)}</p>

  <h3>Prozess heute</h3>
  ${liste(e.ist_prozess, (s) => `${esc(s.label)}${s.system ? ` <em>(${esc(s.system)})</em>` : ""} – ${esc(s.automatisierbarkeit)}`)}

  <h3>Möglicher Ablauf</h3>
  ${liste(e.soll_prozess, (s) => `${esc(s.label)} <em>(${esc(s.typ)})</em>`)}

  <h3>Vorgehen</h3>
  ${liste(e.vorgehen, (v) => `<strong>${esc(v.titel)}</strong> – ${esc(v.text)}`)}

  <h3>Voraussetzungen</h3>
  ${liste(e.voraussetzungen, esc)}

  <h3>Annahmen der KI</h3>
  ${liste(e.annahmen, esc)}

  <h3>Beschreibung im Wortlaut</h3>
  <p style="white-space:pre-wrap;background:#F7F8F9;padding:12px;border-radius:8px">${esc(a.beschreibung)}</p>

  <p style="color:#8590A2;font-size:13px">
    Eingegangen ${esc(daten.zeitpunkt)} &middot; Quelle ${esc(daten.referrer || "direkt")}
  </p>
</div>`;
}
