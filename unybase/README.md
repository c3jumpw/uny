# unybase-marketing

Marketing site for UnyBase, served at **tryunybase.unywebs.com**.

Static HTML/CSS/JS — no build step, no dependencies. Every deploy is a
straight upload; every change is a single-file diff.

## Structure

```
index.html          Homepage: hero, problem, features, pricing
assets/logo.png     Brand mark (used in header and footer)
assets/favicon.png  Browser tab icon
assets/screens/     Dashboard screenshots for the tour (copied from the
                    app's guide: app/public/guide/dark/*.webp)
css/style.css       All styles (design tokens, layout, components)
js/config.js        Pricing + app URLs (single source of truth — edit here)
js/main.js          Pricing toggle, mobile nav, scroll-reveal
vercel.json         Static hosting config (clean URLs, asset caching)
```

## Editing content

- **Pricing or plan copy** → `js/config.js` (`window.UNYBASE_CONFIG.plans`)
- **App links** (login, signup) → `js/config.js` (`window.UNYBASE_CONFIG.appUrls`)
- **Copy in sections** (hero, features, pricing headings) → `index.html`
- **Visual design** → `css/style.css`
- **Dashboard tour** (`#tour`) → screenshots in `assets/screens/`. They come
  from the app's visual guide (`app/scripts/capture-guide.cjs` regenerates
  them). When refreshing, save with a new suffix (`-v2.webp`) and update
  `index.html` — `/assets/` is cached for a year. Hotspot positions are
  percentages of the image, set inline in `index.html`.

## How pricing flows into the app

The pricing "Choose Plan" buttons deep-link to the app's signup at
`https://unybase.unywebs.com/signup?plan=basic` (or `premium`), carrying
the chosen billing cycle as `&cycle=monthly|yearly`. Account creation,
checkout, and everything after happens on the app domain — this site is
marketing only.

## Local preview

Any static server works:

```bash
python3 -m http.server 8080
# open http://localhost:8080
```

## Deploy

Pushes to `main` deploy automatically via Vercel's GitHub integration.
No build command; Vercel serves the files as-is.
