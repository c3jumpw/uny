# unywebs.com — marketing site

Next.js 16 (App Router). Content lives in Supabase and is edited from the
admin at `/admin/solutions` and `/admin/guides` in the `app/` project.

## How content reaches the page

Pages are **statically rendered**, so crawlers and readers get finished
HTML rather than an empty shell that fills in later. That is the whole
reason the guides are not fetched in the browser — they are the pages
meant to earn search traffic.

Publishing does not wait for the hourly revalidation window. The admin
calls `POST /api/revalidate` on this site, which runs `revalidatePath()`
for the affected pages, so a change is live in roughly two seconds.

```
admin (app/)  ──PATCH──>  Supabase  ──reads──>  this site
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

## Local development

```bash
npm install
npm run dev     # http://localhost:3000
```

## Deployment

Vercel project `uny-unywebs-main-site`, root directory `unywebs-main-site`,
deployed from `main`. Pushing to `main` redeploys.

### Attaching unywebs.com

1. Vercel → project → Settings → Domains → add `unywebs.com`.
2. Point DNS at the records Vercel shows.
3. Update `MARKETING_SITE_URL` on the **`unybase-app-v2`** project to
   `https://unywebs.com`, so the admin's "View live" links and its
   revalidation calls target the real domain.

`NEXT_PUBLIC_SITE_URL` is already set to `https://unywebs.com`.

## License

Content © Unywebs, LLC.
