# Website

Statische Landingpage — Header (Logo, Menüs, Suche) und **ein** Hero-Bereich mit
Gitter-Hintergrund und Kreis-Ausschnitt an der Mausposition. Kein Build-Schritt,
keine Abhängigkeiten.

```
index.html
assets/css/styles.css
assets/js/app.js
assets/img/hero.svg         ← Platzhalter-Foto, ersetzen
assets/fonts/outfit-*.woff2 ← Outfit, lokal gehostet
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
python3 -m http.server 8000   # → http://localhost:8000
```

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
`opacity 0 → 1`, `translateY(20px) → 0`, **400 ms**,
`cubic-bezier(.33, 1, .68, 1)`, `animation-fill-mode: backwards`.

Jeder Block trägt die Klasse `fade-up` und einen Index, der den Versatz von
**50 ms** pro Stufe steuert:

```html
<h1  class="hero__title fade-up" style="--enter-index: 0">
<p   class="hero__lead  fade-up" style="--enter-index: 1">
<form class="signup     fade-up" style="--enter-index: 2">
<figure class="hero__media fade-up" style="--enter-index: 3">
```

Bei `prefers-reduced-motion: reduce` sind alle Blöcke sofort sichtbar.

## Anpassen

* **Marke** — `Aurora` und das Logo-SVG in `index.html` (`.brand`) austauschen,
  Markenfarbe über `--brand` in `styles.css`.
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

Das Anmeldeformular ist rein clientseitig: Es prüft die E-Mail-Adresse und zeigt
eine Bestätigung an, sendet aber nichts. Der Endpunkt gehört in
`initSignup()` in `assets/js/app.js`.
