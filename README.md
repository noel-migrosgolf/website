# 1Automationen – Website

Statische Landingpage — Header (Logo, Menüs, Suche) und **ein** Hero-Bereich mit
Gitter-Hintergrund und Kreis-Ausschnitt an der Mausposition, dazu der
**KI-Prozesscheck** unter `/prozesscheck.html`. Das Frontend hat weiterhin
keinen Build-Schritt und keine Abhängigkeiten; das Backend besteht aus drei
Node-Funktionen ohne Fremdpakete.

> **Logo:** `assets/img/logo.svg` und `assets/img/favicon.svg` sind nach Vorlage
> nachgezeichnet, nicht die Originaldateien. Sobald das Original vorliegt,
> beide Dateien und das eingebettete SVG in `index.html` (`.brand__mark`)
> ersetzen.

```
index.html
prozesscheck.html              ← KI-Prozesscheck
assets/css/styles.css
assets/css/prozesscheck.css
assets/js/app.js
assets/js/prozesscheck.js
assets/img/hero.svg            ← Platzhalter-Foto, ersetzen
assets/fonts/outfit-*.woff2    ← Outfit, lokal gehostet
api/verstehen.js               ← Ablauf-Erkennung (Schritt 2)
api/analyse.js                 ← Prozessanalyse (Schritt 5)
api/lead.js                    ← Kontaktformular
api/_lib/                      ← Prompts, Schema, Rechnen, Bereinigen
server.js                      ← lokaler Server, nur für Entwicklung
docs/prompt-ki-prozesscheck.md ← vollständige Spezifikation
```

## Schrift

**Outfit** (variabel, 100–900), lokal unter `assets/fonts/` statt über das
Google-CDN — dadurch keine Verbindung zu Google beim Seitenaufruf und ein
Request weniger. Zwei Dateien, aufgeteilt nach `unicode-range`:

| Datei | Zeichensatz | Grösse |
| --- | --- | --- |
| `outfit-latin.woff2` | Latin (Standard) | 32 KB |
| `outfit-latin-ext.woff2` | Latin Extended | 15 KB |

Die Latin-Datei wird im `<head>` per `rel="preload"` vorgeladen, damit die
Überschrift ohne Nachladeeffekt erscheint.

## Lokal ansehen

```bash
node server.js                # → http://localhost:8000
```

`server.js` liefert die statischen Dateien **und** die drei API-Endpunkte und
liest beim Start eine vorhandene `.env` ein. Für die reine Landingpage genügt
weiterhin `python3 -m http.server 8000`; der Prozesscheck läuft dann bis zum
Kontaktformular und zeigt bei der Analyse den Rückfall.

## KI-Prozesscheck

Ein Wizard in fünf Schritten: Ziel, Prozessbeschreibung, beteiligte Systeme,
Aufwand, Analyse. Am Ende sieht der Besucher seinen Ist-Ablauf, den möglichen
Soll-Ablauf und die Kennzahlen — **vor** jeder Kontaktangabe. Erst darunter
steht das Formular.

Die vollständige Spezifikation samt Bewertungsankern, Schema und Copy steht in
[`docs/prompt-ki-prozesscheck.md`](docs/prompt-ki-prozesscheck.md).

### Umgebungsvariablen

`.env.example` nach `.env` kopieren und ausfüllen. `.env` steht in
`.gitignore` — **der Schlüssel gehört nie ins Repository und nie ins
Frontend.** Auf gehosteten Plattformen die Werte in den Projekteinstellungen
setzen, nicht als Datei ausliefern.

| Variable | Bedeutung |
| --- | --- |
| `OPENAI_API_KEY` | Pflicht. Fehlt er, antworten die KI-Endpunkte mit 503 und der Wizard zeigt den Rückfall. |
| `OPENAI_MODEL` | Modell für die Analyse in Schritt 5 |
| `OPENAI_MODEL_FAST` | Modell für die Ablauf-Erkennung in Schritt 2 |
| `OPENAI_BASE_URL` | Für europäische Datenhaltung auf `https://eu.api.openai.com/v1` setzen |
| `LEAD_EMPFAENGER` | Empfängeradresse der Anfragen |
| `RESEND_API_KEY` | Optional. Ohne Schlüssel landen Anfragen nur in `data/leads.jsonl`. |
| `RATE_LIMIT_*` | Aufrufe je IP und Stunde |

### Deployment auf Render

Der Dienst muss ein **Web Service** sein, keine Static Site. Eine Static Site
liefert nur die Dateien aus — dann läuft `server.js` nie, alle `/api/`-Aufrufe
fehlen, und die Umgebungsvariable spielt keine Rolle, weil es keinen Prozess
gibt, der sie lesen könnte.

| Feld | Wert |
| --- | --- |
| Language / Runtime | Node |
| Build Command | `npm install` |
| Start Command | `node server.js` |
| Health Check Path | `/api/status` |
| Environment Variables | mindestens `OPENAI_API_KEY`, dazu `LEAD_EMPFAENGER` |

Das Projekt hat keine Abhängigkeiten. `npm install` installiert also nichts,
läuft aber sauber durch und erfüllt Renders Pflichtfeld für den Build.

Den Port setzt Render selbst über `PORT`; `server.js` liest ihn aus. Nach dem
Hinzufügen einer Umgebungsvariablen ist ein neues Deployment nötig — die Werte
werden nur beim Start gelesen.

Alternativ liegt die Konfiguration als Blueprint in
[`render.yaml`](render.yaml): in Render unter **New → Blueprint** das
Repository wählen. Die Geheimnisse stehen dort mit `sync: false`, Render fragt
sie beim Anlegen ab und speichert sie verschlüsselt — im Repository landen sie
nie.

> **Free-Plan:** Der Dienst wird nach Leerlauf angehalten, der erste Aufruf
> danach dauert einige Sekunden. Ausserdem ist das Dateisystem nicht dauerhaft
> — ohne `RESEND_API_KEY` gehen die Anfragen aus `data/leads.jsonl` beim
> nächsten Deployment verloren. Für den produktiven Betrieb den Mailversand
> einrichten.

### Fehlersuche nach dem Deployment

Zeigt der Wizard „Die Analyse ist nicht durchgelaufen", ist als Erstes zu
klären, ob der Node-Dienst überhaupt läuft:

```bash
curl -s https://DEINE-DOMAIN/api/status
```

| Antwort | Bedeutung | Lösung |
| --- | --- | --- |
| JSON mit `"ok": true` | Der Dienst läuft. Weiter mit der Logzeile unten. | – |
| HTML oder 404 | Die Seite wird als reine Statik ausgeliefert, es läuft kein Node. | Als **Web Service** deployen, nicht als Static Site. Start-Befehl `node server.js`, kein Build-Schritt nötig. |
| `"schluessel_gesetzt": false` | Die Umgebungsvariable kommt nicht an. | Namen prüfen (`OPENAI_API_KEY`), danach neu deployen — Variablen werden erst beim Start gelesen. |

`/api/status` gibt den Schlüssel nie aus, nur Länge und Präfix. Daran erkennt
man einen abgeschnittenen oder mit Leerzeichen eingefügten Wert:
`schluessel_praefix` sollte `sk-proj` oder `sk-` sein, `schluessel_sauber`
muss `true` sein.

Läuft der Dienst und ist der Schlüssel gesetzt, steht der Grund in der
Logzeile des fehlgeschlagenen Aufrufs:

```
[2026-08-07T13:30:54.081Z] analyse status=502 dauer=57ms
  modell=gpt-5.6-terra code=model_not_found grund="The model … does not exist"
```

| `code` | Bedeutung |
| --- | --- |
| `model_not_found`, `invalid_request_error` | Die Modellbezeichnung stimmt nicht. `OPENAI_MODEL` korrigieren. |
| `invalid_api_key` | Schlüssel falsch oder widerrufen. |
| `insufficient_quota` | Kein Guthaben im OpenAI-Projekt. |
| `unvollstaendig` | Antwort abgeschnitten, `max_output_tokens` in `api/analyse.js` erhöhen. |
| `kein_json` | Die Antwort kam nicht von OpenAI, sondern von einem Proxy oder Gateway. Der Anfang der Antwort steht in `grund`. |

Ein zweiter Versuch wird nur bei unbrauchbaren Antworten unternommen. Ein
abgelehnter Aufruf — falsches Modell, ungültiger Schlüssel — wird nicht
wiederholt, das kostete nur Zeit und Geld.

### Wie die Zahlen entstehen

Das Modell liefert **Urteile**, der Code liefert **Zahlen**. Diese Trennung
steht in `api/_lib/rechnen.js` und ist der Grund, warum gleiche Eingaben immer
dasselbe Ergebnis geben.

Das Modell bewertet acht Kriterien von 0 bis 100 und markiert jeden Ist-Schritt
mit `voll`, `teilweise` oder `nein`. Daraus berechnet der Server:

* **Aufwand** = Läufe pro Monat × Minuten je Lauf. Die Personenzahl ist
  **kein** Multiplikator — die Häufigkeit ist bereits die Gesamtzahl über alle
  Personen. Ohne diese Trennung entstehen absurde Einsparversprechen.
* **Einsparung** = Summe der Zeitanteile der automatisierbaren Schritte,
  gedeckelt bei 85 % und gedämpft, wenn sich die Systeme schlecht anbinden
  lassen. Ausgabe immer als Bandbreite.
* **Digitalisierungs-Potenzial** steigt, wenn der Digitalisierungsgrad
  **sinkt** — wer schon digital arbeitet, gewinnt hier nichts mehr.
* **KI-Potenzial** steigt, wenn die Regelbasiertheit **sinkt** — was sich in
  Regeln fassen lässt, braucht eine Regel, keine KI.
* Unter einer Stunde im Monat wird der Gesamtwert bei 60 gedeckelt und der
  Hinweis eingeblendet, dass der Nutzen bei Qualität liegt, nicht bei Zeit.

Der Stundensatz für die Frankenrechnung steht an zwei Stellen und muss
zusammen geändert werden: `STUNDENSATZ_CHF` in `api/_lib/rechnen.js` und in
`assets/js/prozesscheck.js`.

### Piktogramme

Keine Icon-Bibliothek. Die Piktogramme stehen als `<g>`-Sprite am Anfang von
`prozesscheck.html` und werden über `<use href="#pi-…">` eingebunden. Regeln:
`viewBox 0 0 24 24`, `fill: none`, `stroke: currentColor`, `stroke-width: 1.6`,
runde Enden. Die Werte setzt `svg use` in `prozesscheck.css` — sie kaskadieren
in den referenzierten Inhalt. **Emojis kommen nirgends vor**, auch nicht in
den Antworten der KI: `api/_lib/bereinigen.js` entfernt sie vorsorglich.

### Was noch offen ist

* Die Modellbezeichnung in `.env.example` stammt aus der Konzeptphase und ist
  bewusst als Umgebungsvariable gehalten. **Vor dem Livegang gegen die
  aktuelle OpenAI-Dokumentation prüfen.**
* Impressum, Datenschutzerklärung und Kontaktseite sind in
  `prozesscheck.html` als Anker verlinkt, aber noch nicht geschrieben. Die
  Einverständnisformulierung gehört juristisch geprüft.
* Die Ratenbegrenzung liegt im Arbeitsspeicher und wirkt auf serverlosem
  Hosting je Instanz. Für harte Grenzen `pruefe()` in
  `api/_lib/ratelimit.js` gegen einen gemeinsamen Zähldienst tauschen.
* Die Kopfzeile ist in `index.html` und `prozesscheck.html` dupliziert —
  ohne Build-Schritt gibt es keine Vorlagen. Beide Blöcke sind markiert.

## Der Hintergrund-Effekt

Zwei Ebenen auf `.hero__grid` (`assets/css/styles.css`):

| Ebene | Aufgabe |
| --- | --- |
| `::before` | zeichnet das Gitter: zwei `linear-gradient`-Layer, `background-size: 40px 2px, 2px 40px` |
| `::after` | legt `--hero-bg` über alles — bis auf einen `radial-gradient`-Kreis an `--graph-grid-x` / `--graph-grid-y` |

`assets/js/app.js` schreibt die Mausposition in die beiden Custom Properties und
zieht sie per `requestAnimationFrame` weich nach, damit der Kreis dem Cursor mit
leichter Verzögerung folgt.

Stellschrauben in `:root`:

| Variable | Bedeutung |
| --- | --- |
| `--grid-line` | Farbe der Gitterlinien |
| `--grid-cell` | Abstand der Linien (Standard `40px`) |
| `--grid-weight` | Linienstärke (Standard `2px`) |
| `--reveal-inner` | Radius des voll sichtbaren Kerns |
| `--reveal-outer` | Radius, ab dem das Gitter wieder verdeckt ist |
| `--hero-bg` | Hintergrundfarbe, die den Kreis begrenzt |

Ohne Maus (Touch) erscheint der Kreis beim Tippen; bei
`prefers-reduced-motion: reduce` folgt er ohne Nachziehen.

Die Gitterfläche deckt den kompletten Hero ab und endet exakt an der Unterkante
des Bildes: `.hero` hat unten kein Padding, `.hero__media` keinen unteren
Aussenabstand. Der Kreis funktioniert damit bis zum letzten Pixel — sichtbar
wird er überall dort, wo das Bild ihn nicht verdeckt, also links und rechts
neben dem Bild und oberhalb davon.

## Einblenden beim Seitenaufruf

Die Hero-Blöcke fahren beim Laden von unten ein — übernommen aus der Vorlage:
`opacity 0 → 1`, `translateY(44px) → 0`, **750 ms**,
`cubic-bezier(.33, 1, .68, 1)`, `animation-fill-mode: backwards` — kräftiger als im Vorbild (dort 20 px / 400 ms), damit die Bewegung klar zu sehen ist.

Jeder Block trägt die Klasse `fade-up` und einen Index, der den Versatz von
**90 ms** pro Stufe steuert (`--enter-stagger`):

```html
<h1  class="hero__title fade-up" style="--enter-index: 0">
<p   class="hero__lead  fade-up" style="--enter-index: 1">
<form class="signup     fade-up" style="--enter-index: 2">
<figure class="hero__media fade-up" style="--enter-index: 3">
```

Bei `prefers-reduced-motion: reduce` sind alle Blöcke sofort sichtbar.

## Anpassen

* **Marke** — Schriftzug und Logo stehen in `index.html` unter `.brand`. Das
  „1A" ist als `<span class="brand__accent">` abgesetzt und wird über
  `--logo-blue` eingefärbt, der Rest über `--logo-navy`. Unter 520 px Breite
  steht die Bildmarke allein, damit die Kopfzeile nicht überläuft.
* **Schrift** — `--font` in `:root`; für eine andere Schrift die `@font-face`-
  Blöcke am Anfang von `styles.css` ersetzen und den `preload` im `<head>`
  mitziehen.
* **Bild** — `assets/img/hero.svg` durch ein eigenes ersetzen und `src`, `width`,
  `height` im `<figure class="hero__media">` anpassen. Das Bild sitzt mittig
  unter dem Text, maximal 1120 px breit; ein Querformat um 16:9 passt am besten.
* **Menüs** — die `<li class="nav__item">`-Blöcke in `index.html`.
* **Suche** — das `INDEX`-Array in `assets/js/app.js`; Tastenkürzel `/`,
  Navigation mit ↑/↓, `Enter` öffnet, `Esc` schließt.

## Noch offen

Das Anmeldeformular im Hero ist weiterhin rein clientseitig: Es prüft die
E-Mail-Adresse und zeigt eine Bestätigung an, sendet aber nichts. Der Endpunkt
gehört in `initSignup()` in `assets/js/app.js`. Der Prozesscheck ist davon
unabhängig und hat mit `/api/lead` ein eigenes, angebundenes Formular.
