# Website

Statische Landingpage — Header (Logo, Menüs, Suche) und **ein** Hero-Bereich mit
Gitter-Hintergrund und Kreis-Ausschnitt an der Mausposition. Kein Build-Schritt,
keine Abhängigkeiten.

```
index.html
assets/css/styles.css
assets/js/app.js
assets/img/hero.svg     ← Platzhalter-Foto, ersetzen
```

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

## Anpassen

* **Marke** — `Aurora` und das Logo-SVG in `index.html` (`.brand`) austauschen,
  Markenfarbe über `--brand` in `styles.css`.
* **Foto** — `assets/img/hero.svg` durch ein eigenes Bild ersetzen und `src`,
  `width`, `height` im `<figure class="hero__media">` anpassen.
* **Menüs** — die `<li class="nav__item">`-Blöcke in `index.html`.
* **Suche** — das `INDEX`-Array in `assets/js/app.js`; Tastenkürzel `/`,
  Navigation mit ↑/↓, `Enter` öffnet, `Esc` schließt.

## Noch offen

Das Anmeldeformular ist rein clientseitig: Es prüft die E-Mail-Adresse und zeigt
eine Bestätigung an, sendet aber nichts. Der Endpunkt gehört in
`initSignup()` in `assets/js/app.js`.
