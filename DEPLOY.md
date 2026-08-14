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

**`_headers`** is copied to the publish root by `scripts/build.mjs` and carries
the security headers, CSP and cache policy. It applies to static asset
responses, which here is all of them — there is no Worker script.

**There is deliberately no `_redirects` file.** The apex → www redirect is a
dashboard Redirect Rule, because Cloudflare matches `_redirects` on path only
and cannot express a hostname rule.

If one is ever added, it must be Cloudflare-valid: this file is **validated
server-side at deploy time and a bad line fails the whole deploy**, not just
that rule. Two Netlify idioms are rejected outright:

- `301!` — the `!` force suffix parses as status `0`
- `https://example.com/*` as a source — only relative paths are accepted

`wrangler deploy --dry-run` does **not** catch either; the check happens in the
API call, so the first sign is a failed build.

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

## Email is not part of this — but it is broken

The `MX`, SPF/`TXT` and verification records are independent of the website, and
no website change can affect them. Recording the diagnosis here because it is
the same DNS zone and the same dashboard.

Mail runs on **Microsoft 365** (`aeroliftcranes-com02b.mail.protection.outlook.com`).

### What is published today

```
v=spf1 include:dc-8e814c8572._spfm.aerolift-cranes.com ~all
v=spf1 include:secureserver.net -all
```

Three separate faults, in increasing order of severity:

1. **Two SPF records.** RFC 7208 §4.5 requires receivers to treat that as a
   permerror. A domain may publish exactly one.
2. **The first record's include does not resolve.** `dc-8e814c8572._spfm…`
   returns NXDOMAIN — it is GoDaddy's SPF-merge helper and it is gone. A
   dangling include is a permerror on its own.
3. **Neither record authorises the mail platform.** `secureserver.net` expands
   to GoDaddy's servers. The mail comes from Microsoft 365. So deleting the
   broken record and keeping the "valid" one would leave `-all` hard-failing
   Aerolift's own mail — worse than the current state, not better.

There is also **no DMARC record** and **no DKIM** on the standard M365 selectors
(`selector1`/`selector2._domainkey`). SPF and DKIM are both absent as passing
signals, which explains spam placement better than the SPF fault alone.

### The replacement

Delete **both** TXT records above and publish exactly one:

```
v=spf1 include:spf.protection.outlook.com ~all
```

`spf.protection.outlook.com` resolves to Microsoft's ip4/ip6 ranges with no
nested includes — one DNS lookup, against a limit of ten.

**`~all` (softfail), not `-all`, to begin with.** SPF has been failing for long
enough that a forgotten legitimate sender is likely; softfail marks those rather
than rejecting them. Tighten to `-all` once a couple of weeks of DMARC reports
show nothing unexpected sending.

Add `include:secureserver.net` **only** if something genuinely still sends from
GoDaddy infrastructure. It costs two more lookups and authorises a large shared
range, so it should not be kept out of caution.

### Then, in order

1. **DKIM** — enable it for the domain in the Microsoft 365 admin centre and
   publish the two `selector1`/`selector2` CNAMEs it gives you. This is the
   bigger deliverability lever of the two.
2. **DMARC** — start at `v=DMARC1; p=none; rua=mailto:…` to collect reports
   without affecting delivery. Only move to `p=quarantine` or `p=reject` once
   the reports are clean. Publishing an enforcing policy while SPF and DKIM are
   in this state would actively bounce real mail.

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
