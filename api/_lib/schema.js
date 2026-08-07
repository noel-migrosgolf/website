/* =========================================================================
   JSON-Schemas für die Structured Outputs der OpenAI-Aufrufe.

   Im strict-Modus gilt: jedes Objekt braucht additionalProperties: false,
   jedes Feld muss in required stehen. Optionale Felder werden als
   Typvereinigung mit null ausgedrückt. Mengenangaben wie minItems sind
   dort nicht zulässig – sie stehen deshalb im description-Text und werden
   zusätzlich in bereinigen.js geprüft und notfalls gekürzt.
   ========================================================================= */

export const SCHEMA_ANALYSE = {
  type: "object",
  additionalProperties: false,
  required: [
    "titel", "einordnung", "kriterien", "ist_prozess", "soll_prozess",
    "empfehlung", "vorgehen", "quick_win", "voraussetzungen",
    "annahmen", "komplexitaet", "umsetzungsdauer"
  ],
  properties: {
    titel: {
      type: "string",
      description: "Der Prozess in maximal 60 Zeichen, aus Kundensicht, ohne Anführungszeichen. Beispiel: Angebot nach E-Mail-Anfrage erstellen"
    },

    einordnung: {
      type: "object",
      additionalProperties: false,
      required: [
        "hebel", "begruendung_digitalisierung",
        "begruendung_automatisierung", "begruendung_ki"
      ],
      properties: {
        hebel: {
          type: "string",
          enum: [
            "digitalisierung", "automatisierung", "ki",
            "digitalisierung_und_automatisierung", "automatisierung_und_ki"
          ],
          description: "Der fachlich führende Hebel."
        },
        begruendung_digitalisierung: {
          type: "string",
          description: "Ein Satz, maximal 140 Zeichen, warum dieser Score so ausfällt."
        },
        begruendung_automatisierung: {
          type: "string",
          description: "Ein Satz, maximal 140 Zeichen."
        },
        begruendung_ki: {
          type: "string",
          description: "Ein Satz, maximal 140 Zeichen."
        }
      }
    },

    kriterien: {
      type: "object",
      additionalProperties: false,
      description: "Je 0 bis 100 nach den Ankern im System-Prompt. Volumen und Zeitaufwand werden hier NICHT bewertet, die rechnet der Server aus den Angaben.",
      required: [
        "wiederholbarkeit", "regelbasiertheit", "digitalisierungsgrad",
        "fehleranfaelligkeit", "integrierbarkeit", "ki_eignung",
        "automatisierbarkeit", "erwarteter_nutzen"
      ],
      properties: {
        wiederholbarkeit:     { type: "integer", description: "0 bis 100." },
        regelbasiertheit:     { type: "integer", description: "0 bis 100." },
        digitalisierungsgrad: { type: "integer", description: "0 bis 100. Hoch bedeutet: läuft heute bereits digital." },
        fehleranfaelligkeit:  { type: "integer", description: "0 bis 100. Hoch bedeutet: fehleranfällig." },
        integrierbarkeit:     { type: "integer", description: "0 bis 100." },
        ki_eignung:           { type: "integer", description: "0 bis 100." },
        automatisierbarkeit:  { type: "integer", description: "0 bis 100." },
        erwarteter_nutzen:    { type: "integer", description: "0 bis 100." }
      }
    },

    ist_prozess: {
      type: "array",
      description: "Der heutige Ablauf, maximal 12 Schritte, in Reihenfolge. Verdichte längere Abläufe, statt sie abzuschneiden.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "label", "typ", "system", "dauer_anteil", "automatisierbarkeit"],
        properties: {
          id: { type: "string", description: "i1, i2, i3 und so weiter." },
          label: { type: "string", description: "Maximal 55 Zeichen, Verbform aus Kundensicht: Daten in die Tabelle übertragen" },
          typ: {
            type: "string",
            enum: ["ausloeser", "manuell", "system", "entscheidung", "ergebnis"]
          },
          system: {
            type: ["string", "null"],
            description: "Anzeigename des beteiligten Programms, sonst null."
          },
          dauer_anteil: {
            type: "integer",
            description: "Anteil dieses Schritts an der Gesamtdauer eines Durchlaufs in Prozent. Die Anteile aller Schritte ergeben zusammen 100. Auslöser und Ergebnis bekommen 0."
          },
          automatisierbarkeit: {
            type: "string",
            enum: ["voll", "teilweise", "nein"],
            description: "voll = der Schritt entfällt vollständig. teilweise = bleibt, wird aber deutlich kürzer. nein = bleibt unverändert menschliche Arbeit."
          }
        }
      }
    },

    soll_prozess: {
      type: "array",
      description: "Der mögliche Ablauf nach der Umsetzung, maximal 12 Schritte.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "label", "typ", "system", "ersetzt_ist_schritte", "hinweis"],
        properties: {
          id: { type: "string", description: "s1, s2, s3 und so weiter." },
          label: { type: "string", description: "Maximal 55 Zeichen." },
          typ: {
            type: "string",
            enum: ["ausloeser", "automatisch", "ki", "manuell", "entscheidung", "ergebnis"]
          },
          system: { type: ["string", "null"] },
          ersetzt_ist_schritte: {
            type: "array",
            description: "IDs der Ist-Schritte, die dieser Schritt ablöst. Leer, wenn er neu hinzukommt.",
            items: { type: "string" }
          },
          hinweis: {
            type: ["string", "null"],
            description: "Maximal 90 Zeichen, nur wenn er echten Mehrwert bringt. Etwa: Freigabe bleibt bei dir."
          }
        }
      }
    },

    empfehlung: {
      type: "object",
      additionalProperties: false,
      required: ["titel", "text"],
      properties: {
        titel: { type: "string", description: "Maximal 55 Zeichen, etwa: Automatisierung mit KI-Unterstützung" },
        text: { type: "string", description: "Zwei bis drei Sätze, maximal 380 Zeichen. Konkret, ohne Werbesprache, in der Du-Form." }
      }
    },

    vorgehen: {
      type: "array",
      description: "Drei bis fünf Umsetzungsschritte in sinnvoller Reihenfolge.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["titel", "text"],
        properties: {
          titel: { type: "string", description: "Maximal 45 Zeichen." },
          text: { type: "string", description: "Ein bis zwei Sätze, maximal 200 Zeichen." }
        }
      }
    },

    quick_win: {
      type: "string",
      description: "Der schnellste sinnvolle erste Schritt, ein Absatz, maximal 300 Zeichen. Er muss ohne grosses Projekt umsetzbar sein."
    },

    voraussetzungen: {
      type: "array",
      description: "Zwei bis vier ehrliche Voraussetzungen oder Risiken, konkret auf diesen Prozess bezogen. Keine Allgemeinplätze.",
      items: { type: "string", description: "Maximal 160 Zeichen." }
    },

    annahmen: {
      type: "array",
      description: "Was du annehmen musstest, weil die Beschreibung es nicht hergab. Leer, wenn nichts fehlte. Maximal vier Einträge.",
      items: { type: "string", description: "Maximal 160 Zeichen." }
    },

    komplexitaet: {
      type: "string",
      enum: ["gering", "mittel", "hoch"],
      description: "Aufwand der Umsetzung, nicht des heutigen Prozesses."
    },

    umsetzungsdauer: {
      type: "string",
      description: "Grobe Bandbreite als Text, etwa: 2 bis 4 Wochen. Immer eine Spanne, nie ein exakter Wert."
    }
  }
};

export const SCHEMA_VERSTEHEN = {
  type: "object",
  additionalProperties: false,
  required: [
    "titel", "ausloeser", "schritte", "ergebnis", "systeme",
    "haeufigkeit_erkannt", "dauer_erkannt", "rueckfragen"
  ],
  properties: {
    titel: { type: ["string", "null"], description: "Maximal 60 Zeichen." },
    ausloeser: { type: ["string", "null"], description: "Was den Ablauf startet, maximal 60 Zeichen." },
    schritte: {
      type: "array",
      description: "Maximal 10 Schritte in Reihenfolge, aus dem Text abgeleitet. Erfinde nichts dazu.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["text", "system"],
        properties: {
          text: { type: "string", description: "Maximal 55 Zeichen." },
          system: { type: ["string", "null"] }
        }
      }
    },
    ergebnis: { type: ["string", "null"], description: "Maximal 60 Zeichen." },
    systeme: {
      type: "array",
      description: "Kleingeschriebene Kennungen der erkannten Programme, etwa outlook, excel, pdf.",
      items: { type: "string" }
    },
    haeufigkeit_erkannt: {
      type: ["string", "null"],
      enum: [
        "mehrmals_taeglich", "taeglich", "mehrmals_woechentlich",
        "woechentlich", "monatlich", "seltener", null
      ],
      description: "Nur setzen, wenn im Text ausdrücklich genannt."
    },
    dauer_erkannt: {
      type: ["string", "null"],
      enum: ["5", "15", "30", "60", "120", null],
      description: "Minuten je Durchlauf, nur wenn im Text genannt."
    },
    rueckfragen: {
      type: "array",
      description: "Maximal drei kurze Rückfragen, nur zu fehlendem Auslöser, fehlendem Ergebnis, unklarem Entscheidungspunkt oder unbekanntem Zielsystem. Leer, wenn nichts Wesentliches fehlt.",
      items: { type: "string", description: "Eine Frage, maximal 90 Zeichen, in der Du-Form." }
    }
  }
};
