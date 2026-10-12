# unywebs.com — marketing site

Next.js 16 (App Router). Content lives in Supabase and is edited from the
Unywebs admin at admin.unywebs.com (`unywebs-admin/` in this repo).

## How content reaches the page

Pages are **statically rendered**, so crawlers and readers get finished
HTML rather than an empty shell that fills in later. That is the whole
reason the guides are not fetched in the browser — they are the pages
meant to earn search traffic.

Publishing does not wait for the hourly revalidation window. The admin
calls `POST /api/revalidate` on this site, which runs `revalidatePath()`
for the affected pages, so a change is live in roughly two seconds.

```
admin.unywebs.com  ──writes──>  Supabase  ──reads──>  this site
     │                                              ▲
     └──POST /api/revalidate (shared secret) ───────┘
```

## Content model

| Table            | Purpose                                                    |
|------------------|------------------------------------------------------------|
| `site_solutions` | Tools on `/solutions`. `sort_order` drives on-page order.   |
| `site_guides`    | Articles on `/guides`. Body is markdown, rendered server-side. |
| `site_redirects` | Old slug → current slug, written when a published slug is renamed. |

RLS gives the anon key **published rows only**. Drafts are unreachable
with it. Draft preview goes through `get_guide_preview(slug, token)`, a
security-definer function that returns a row only to a caller holding
that guide's `preview_token` — so this deployment never needs, and never
holds, a service-role key.

## Environment

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project (`uny-tools`). |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public by design; RLS constrains it. |
| `NEXT_PUBLIC_SITE_URL` | Canonical origin for `sitemap.xml` and `og:` tags. |
| `REVALIDATE_SECRET` | Must match the same variable in the admin app. |

Copy `.env.example` to `.env.local` for local work.

## Images

Two sources, both plain URLs, both work in markdown:

- **Committed files** under `public/media/` — referenced as `/media/name.jpg`.
  The seeded guides use these; see `MEDIA.md` for the filenames they expect.
- **Uploads from the admin** — pasted or dragged into the guide editor,
  stored in the `site-media` Supabase Storage bucket, inserted as a full URL.

New images should go through the admin. `public/media/` exists so the
original WordPress screenshots can be dropped in without re-uploading.

## Writing guides

Guides are markdown with a few extras (lib/guideMarkdown.ts), so a page
can be broken up for skimming without any HTML:

| Write this | Get this |
|---|---|
| `> [!TIP] Title` then `> text` | A coloured box with an icon. Kinds: TIP, INFO, NOTE, WARNING, SUCCESS. |
| `- :phone: **Calls.** Text` on every item | A grid of icon cards. Icon names are in lib/guideIcons.tsx. |
| `1. **Step.** Text` | Numbered step cards. |
| `![Alt](/media/x.webp "Caption")` on its own line | A full-width figure with a caption. |
| `[Start](https://... "button")` | A button (`"button-outline"` for a lighter one). |
| `![Watch](/media/guides/quo/video.mp4 "Caption")` | A video player (`.mp4`, `.webm` or `.mov`). |

A guide that links to `/solutions/<slug>` is shown on that tool's page
as its beginner guide. The admin editor has toolbar buttons for each of
these and a preview that uses the same rules (its copy of the two lib
files must be kept in step with this app's).

The tool guides' illustrations live in `public/media/guides/<tool>/`:
`hero.webp` (page and cards), `share.jpg` (link previews), `one.webp`
and `two.webp` (in the article), and `video.mp4` once a guide has an
explainer video (keep each under 25 MB, GitHub's browser upload limit).

## Local development

```bash
npm install
npm run dev     # http://localhost:3000
```

## Deployment

Vercel project `uny-unywebs-main-site`, root directory `unywebs-main-site`,
deployed from `main`. Pushing to `main` redeploys.

Live at unywebs.com (DNS at GoDaddy: `@` A record to Vercel, `www`
CNAME to Vercel and redirected to the bare domain).

## License

Content © Unywebs, LLC.
