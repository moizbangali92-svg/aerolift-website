# Deploying aerolift-cranes.com

The site is fully static. `dist/` is the only artifact — no server, no database,
no build step at request time.

## Build settings

| Setting | Value |
|---|---|
| Install command | `npm ci` |
| Build command | `npm run build` |
| Publish directory | `dist` |
| Node version | pinned to 22 by `.nvmrc` |

`dist/` is gitignored on purpose, so the host must run the build. `npm run build`
wipes and regenerates `dist/` every time — it is never incrementally patched.

The image pipeline (`npm run images`, which needs `sharp`) is **not** part of the
build. Optimised images are committed under `src/assets/img/`, so a deploy never
has to compile sharp.

## Files the host reads

Both are copied to the publish root by `scripts/build.mjs`:

- **`_headers`** — security headers, CSP, and cache policy. Read by Netlify and
  Cloudflare Pages. Ignored by Vercel (see below).
- **`_redirects`** — apex → www. Netlify applies it directly; Cloudflare Pages
  only matches on path, so the apex redirect has to be a Redirect Rule there.

`dist/404.html` is picked up automatically by all three hosts for unmatched paths.

## Per-host notes

**Netlify** — everything above works as-is. Set `www.aerolift-cranes.com` as the
primary domain; Netlify then handles the apex redirect itself and `_redirects`
is belt-and-braces.

**Cloudflare Pages** — this is where the site is hosted, and where the domain's
nameservers already point. `_headers` works. Add **both** `aerolift-cranes.com`
and `www.aerolift-cranes.com` as custom domains, then send the apex to www with
a Redirect Rule — `_redirects` cannot match on hostname, so the file's apex
rules are inert here.

Repointing the site touches only the apex `A` record and the `www` `CNAME`.
The `MX`, SPF/`TXT` and verification records are independent: mail is on
Microsoft 365 and is not affected by any website change.

**Vercel** — reads neither file. Add a `vercel.json` with the equivalent
`headers` and `redirects` blocks, or set the redirect in Project → Domains.

## DNS

Every `<link rel="canonical">` and `og:url` on the site declares the **www**
host. Keep it that way:

- `www.aerolift-cranes.com` → CNAME to the host
- `aerolift-cranes.com` → 301 to `https://www.aerolift-cranes.com/`

Serving the same pages on both hosts without a redirect splits the SEO signal.

## Before the first public deploy

1. **The quote form is not connected.** `src/partials/quote-form.html` posts to
   `https://formspree.io/f/xkgqvbwz`, which currently returns
   `404 Form not found`. Submissions fail and the visitor sees the error message
   with the phone number. Fix the endpoint before announcing the site, or every
   web enquiry is lost.
2. **Favicon** is a placeholder mark, not the client's.
3. **`og:image`** is a photo crop; a 1200×630 export with the logo lock-up would
   present better when the site is shared.
4. **`#clients` (home) and `#team` (about)** ship with `hidden` on them. Remove
   the class only once real logos, a signed-off testimonial, and real team
   photos exist — see the "no invented proof" rule in `README.md`.

## After deploying

- [ ] `https://www.aerolift-cranes.com/` loads over HTTPS
- [ ] `http://aerolift-cranes.com/` 301s to the www HTTPS URL
- [ ] A nonsense path (e.g. `/nope/`) returns the branded 404 with a **404**
      status, not 200
- [ ] `/robots.txt` and `/sitemap.xml` resolve
- [ ] The catalogue downloads: `/assets/aerolift-catalogue-2026.pdf`
- [ ] Submit the sitemap in Google Search Console
- [ ] Check the browser console on the home page is clean (the CSP in `_headers`
      is strict; anything added later that loads a third-party script or font
      will be blocked until the policy is widened)
