# Deploying aerolift-cranes.com

The site is fully static. `dist/` is the only artifact — no server, no database,
no build step at request time.

## Where it is hosted

A **Cloudflare Worker with static assets** (`aerolift-website`), built from the
`main` branch of `moizbangali92-svg/aerolift-website` by Workers Builds. The
domain's nameservers were already on Cloudflare, so DNS and hosting live in one
dashboard.

There is no Worker script — `wrangler.jsonc` declares assets only, so every
response is served straight from `dist/`.

## Build settings

| Setting | Value |
|---|---|
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` |
| Assets directory | `dist` (set in `wrangler.jsonc`, not the dashboard) |
| Node version | pinned to 22 by `.nvmrc` |

`dist/` is gitignored on purpose, so the host must run the build. `npm run build`
wipes and regenerates `dist/` every time — it is never incrementally patched.

**The `name` in `wrangler.jsonc` must match the Worker in the dashboard.** If it
drifts, `wrangler deploy` creates a second Worker and the custom domain stays
pointed at the old one — a silent failure, not an error.

The image pipeline (`npm run images`, which needs `sharp`) is **not** part of the
build. Optimised images are committed under `src/assets/img/`, so a deploy never
has to compile sharp.

## Files the host reads

Both are copied to the publish root by `scripts/build.mjs`, and Workers static
assets honours both:

- **`_headers`** — security headers, CSP, and cache policy. Applies to static
  asset responses, which here is all of them (there is no Worker script).
- **`_redirects`** — apex → www. Path-matching only, so on Cloudflare these
  host-qualified rules are inert; the apex redirect is a dashboard Redirect Rule
  instead. The file is kept because it is what Netlify would need if the site
  ever moves.

Unmatched paths serve `dist/404.html` with a real 404 status, via
`not_found_handling: "404-page"` in `wrangler.jsonc`. The default (`"none"`)
would return a bare Cloudflare error page.

## Domain

Both `aerolift-cranes.com` and `www.aerolift-cranes.com` are attached to the
Worker; a Redirect Rule sends the apex to www, which is what every canonical tag
on the site declares.

Repointing the site touched only the apex `A` record and the `www` `CNAME` (both
previously Wix). SSL/TLS mode must stay on **Full (strict)** — on Flexible, a
proxied record plus the site's HTTPS redirect produces an infinite loop.

## If the site ever moves off Cloudflare

**Netlify** — works as-is: `_headers` and `_redirects` are both native, and the
apex rules in `_redirects` start applying. Set www as the primary domain.

**Vercel** — reads neither file. Port them to `vercel.json` as `headers` and
`redirects` blocks.

## Email is not part of this

The `MX`, SPF/`TXT` and verification records are independent of the website.
Mail runs on Microsoft 365 (`aeroliftcranes-com02b.mail.protection.outlook.com`)
and no website change can affect it — but note the domain currently publishes
**two** SPF records, which is a permanent error under RFC 7208, and one of them
includes a hostname that no longer resolves. That needs fixing on its own.

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
