# Unywebs — Static Site

A hand-built, static recreation of [unywebs.com](https://unywebs.com) — designed to deploy straight from a GitHub repo (GitHub Pages, Netlify, Vercel, or Cloudflare Pages).

## Structure

```
unywebs-site/
├── index.html                # Home
├── solutions.html            # Our Solutions
├── guides.html               # Guides & How-To's index
├── get-started.html          # Get Started
├── guides/
│   ├── app-needs-five-things.html
│   ├── registering-official-company-emails.html
│   └── wordpress-site-registration.html
├── css/
│   └── style.css
├── js/
│   └── main.js
└── media/                    # Drop your images here (see MEDIA.md)
```

## Deploying to GitHub Pages

1. Create a new GitHub repo (e.g. `unywebs-site`).
2. Push all files in this directory to the repo root.
3. In the repo → **Settings → Pages**, set:
   - **Source:** Deploy from a branch
   - **Branch:** `main` (or `master`), folder `/ (root)`
4. Save. Your site will be live at `https://<username>.github.io/<repo-name>/` within a minute.

### Using a custom domain (unywebs.com)

1. Create a file called `CNAME` at the repo root containing just: `unywebs.com`
2. In your DNS provider, point `unywebs.com` to GitHub Pages:
   - `A` record → `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
   - `CNAME` for `www` → `<username>.github.io`
3. In **Settings → Pages**, enable **Enforce HTTPS** once the cert issues.

## Uploading media

All images referenced in the HTML live in `/media/`. See `MEDIA.md` for the full list of expected filenames. As long as filenames match, images will show up automatically. Missing images degrade gracefully.

## External links preserved

All affiliate / partner links from the original site are preserved:

- GoDaddy / Unywebs WS reseller account
- OpenPhone (referral)
- Systeme.io (referral)
- ClickUp (referral)
- Zapier, Notion, ManyChat, Synthesia signup pages
- UnyBase via systeme.io
- Zoho Mail signup + ClickUp intake forms
- Facebook, Twitter, LinkedIn, Pinterest share links (on guide articles — optional)

## Local preview

```bash
# From this directory
python3 -m http.server 8080
# Then open http://localhost:8080
```

## License

Content © 2026 Unywebs, LLC.
