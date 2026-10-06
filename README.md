# uny

Monorepo for Unywebs and its products. Unywebs is the parent company;
UnyBase is one of its products. All apps share one Supabase project.

| Folder | Deploys to | What it is |
|---|---|---|
| `unywebs-main-site/` | unywebs.com | Public Unywebs website (Next.js) |
| `unywebs-admin/` | admin.unywebs.com | Unywebs admin: edits the website's tools and guides |
| `app/` | unybase.unywebs.com | UnyBase customer app, with its own subscription admin at `/admin` |
| `unybase/` | tryunybase.unywebs.com | UnyBase product site |

Each folder is its own Vercel project, using that folder as its root
directory. A push to `main` deploys whichever projects changed.
