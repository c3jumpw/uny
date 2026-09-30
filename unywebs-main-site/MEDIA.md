# Media

The WordPress media library was exported into `public/media/` and is
served at `/media/<filename>`. Files kept their original WordPress
names, and the content in Supabase points at those names — so nothing
needs renaming.

## How images get referenced now

Image paths live in the database, not in the code:

- `site_guides.body_markdown` — inline images, as `![alt](/media/name.jpg)`
- `site_guides.hero_image_url` — the banner at the top of an article
- `site_guides.og_image_url` — social share image (falls back to the hero)
- `site_solutions.logo_url` — optional logo on a tool card

To change one, edit it in the admin rather than here. Adding a **new**
image should go through the guide editor (paste, drag, or Insert image),
which uploads to the `site-media` Supabase Storage bucket and writes a
full URL. `public/media/` exists so the original WordPress screenshots
didn't have to be re-uploaded one at a time.

## Files currently referenced

Verified present and serving:

| File | Used by |
|------|---------|
| `site-logo.png` | Header and favicon, every page |
| `official-email.jpg` | Hero — "app needs five things" and "official company emails" |
| `web-registering.jpg` | Hero — "WordPress site registration" |
| `3ddfccc5-665a-4c31-af54-2b78bd7d21d1.jpg` | Email guide — "let our team handle it" |
| `sign-up.jpg`, `diy.png` | Email guide — DIY intro |
| `add-domain-name.png` | Email guide — step 2 |
| `select-the-txt-method.jpg`, `mx.jpg` | Email guide — TXT verification |
| `select-cname-record.jpg`, `cname.jpg` | Email guide — CNAME verification |
| `add-users.jpg`, `add-user-details.jpg` | Email guide — step 4 |
| `dns-values.jpg`, `mx-record-values.jpg` | Email guide — MX records |
| `spf-record-value.jpg`, `dkim-record-value.jpg` | Email guide — SPF / DKIM |
| `hosting-diagram.jpg`, `register-hosting.jpg` | WordPress guide — intro |
| `image.png` … `image-5.png` | WordPress guide — steps 1 through 5 |

## Not carried over

Two assets came from the old WordPress **theme**, not the media library,
so they weren't in the export:

- `bebusiness7-home-pic1.svg` — home page hero illustration
- `bebusiness7-about-pic2.webp` — home page "about" image

Neither is missing on the live site: the home page draws its own inline
SVG artwork instead. To use real images there, add them to
`public/media/` and swap the `<HeroArt />` / `<AboutArt />` components in
`src/app/page.tsx` for `<img>` tags.

## About the unused files

The export included every size WordPress generates per upload
(`-150x150`, `-768x768`, `-scaled`, and so on) — 559 files, about 28MB,
of which 25 are actually referenced.

This is harmless: Vercel serves `public/` as static files, so the unused
ones cost nothing at request time. They do make the folder hard to read
and the repo larger than it needs to be. Pruning to just the referenced
files would take it from ~28MB to ~5MB, but it is worth keeping the full
set if you might reference other images from future guides.
