# Unywebs Admin (admin.unywebs.com)

The parent company's console. It edits the public website at unywebs.com
and links out to each product's own admin.

```
unywebs.com              public website        (unywebs-main-site/)
admin.unywebs.com        Unywebs admin         (this app)
  /website/solutions       tools on the site
  /website/guides          articles on the site
unybase.unywebs.com      UnyBase app + its subscription admin   (app/)
tryunybase.unywebs.com   UnyBase product site                   (unybase/)
```

## Access

Sign in with the same email and password as your UnyBase account. Entry is
decided by the database: an account needs a `super_admin` or
`technical_admin` row in `public.user_roles`, checked by
`public.is_site_admin()`.

## No service-role key

Every read and write runs as the signed-in admin. Row level security on
`site_solutions`, `site_guides`, `site_redirects` and the `site-media`
storage bucket allows writes only when `is_site_admin()` is true. A bug in
a route here cannot touch any table the person couldn't already reach.

## Publishing

Saves call the website's `/api/revalidate`, so changes are live in about
two seconds. That needs `MARKETING_SITE_URL` and `REVALIDATE_SECRET`
(see `.env.example`).

## Change log

Edits are recorded in `public.site_content_events`, created by
`supabase/migrations/20261005_site_content_events.sql`. Until that
migration is applied, edits still work and the overview shows that the
log is off.
