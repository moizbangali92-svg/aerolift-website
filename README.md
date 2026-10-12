# Aerolift L.L.C. — aerolift-cranes.com

Static site. HTML5 + Tailwind CSS v4 (CLI build, purged) + ~8KB gzipped of
vanilla JS. No framework, no CDN scripts, no third-party requests at runtime.

## Commands

```bash
npm install
npm run dev      # copy assets + Tailwind --watch
npm run build    # copy assets + Tailwind --minify  -> dist/
npm run serve    # static server for dist/ on :4321
npm test         # worker/quote.js — validation, payload, failure handling
```

`npm run serve` is the static site only; it does not run the Worker, so
`POST /api/quote` 404s there and the form falls back to mailto:. Use
`npx wrangler dev` to exercise the quote endpoint.

`dist/` is the deploy artifact. It is gitignored — build it in CI.

## Structure

```
src/index.html          -> dist/index.html
src/404.html            -> dist/404.html        (served for any unmatched path)
src/<slug>/index.html   -> dist/<slug>/index.html
src/partials/*.html     -> spliced in by `<!-- @include name -->`
src/_drafts/            -> never emitted (leading underscore excludes it)
src/css/input.css       -> dist/css/style.css   (design tokens live in @theme)
src/js/main.js          -> dist/js/main.js      (deferred)
src/assets/             -> dist/assets/         (minus _source/ originals)
robots.txt, sitemap.xml   -> dist/
favicon.ico, favicon-192.png, apple-touch-icon.png -> dist/
_headers, _redirects    -> dist/                (Cloudflare deploy config)
node_modules/@fontsource/* -> dist/fonts/       (self-hosted woff2, 5 weights)
worker/index.js         -> not built; deployed by wrangler alongside dist/
```

Pages today: `/`, `/about/`, `/services/` (+4 service pages), `/products/`
(+5 product pages), `/gallery/`, `/insights/` (+2 articles), `/contact/`.

There is no `tailwind.config.js`. Tailwind v4 takes its configuration from the
`@theme` block at the top of `src/css/input.css` — colours, type scale, radii,
shadows and easing are all defined there as CSS custom properties, and the
utilities (`bg-primary`, `text-steel-strong`, `rounded-lg`, …) are generated
from them. Change a token in one place and it propagates.

## Adding a page

URL structure is planned as: `/`, `/about/`, `/services/`,
`/services/annual-maintenance-contract/`, `/products/eot-cranes/`,
`/products/gantry-cranes/`, `/products/jib-cranes/`, `/products/hoists/`,
`/products/spare-parts/`, `/contact/`.

1. Add `src/<slug>/index.html` — the build discovers page directories
   recursively, so no script change is needed.
2. Add a `<url>` entry to `sitemap.xml`.
3. Reuse the icon sprite, header, footer and section patterns from `index.html`.

Deployment is documented separately in [DEPLOY.md](DEPLOY.md).

## Conventions worth keeping

- **Icons** come from one inline `<symbol>` sprite at the top of `<body>`.
  Use `<svg class="icon icon-md"><use href="#i-name"/></svg>`. Stroke width is
  set in CSS per size so weight stays optically even. Never inline a one-off path.
- **Colour**: `--color-steel` (#6B7280) is for placeholder and border use only —
  it is 4.46:1 on `--color-surface` and fails AA for body text. Use
  `--color-steel-strong` (#4B5563) for any secondary text.
- **Motion**: every animation is opacity/transform only and is disabled under
  `prefers-reduced-motion: reduce`. The marching header stripe is the only
  continuously animating element on the page — keep it that way.
- **Scroll reveal** uses IntersectionObserver *and* a position sweep on scroll.
  Both are needed: IO misses elements carried past the viewport between frames
  (fast scroll, anchor jump), and those would stay invisible permanently.
- **The quote form posts to our own Worker**, not a form service —
  `worker/quote.js`, sending through MailChannels. The visitor's address goes
  in `Reply-To` and never in `From`: `From` has to stay on a domain the DKIM
  and Domain Lockdown records authorise. The message is `text/plain` only, so
  nothing typed into the form is ever parsed as markup. Setup and the DNS
  prerequisites are in [DEPLOY.md](DEPLOY.md).
- **No invented proof.** Client logos, testimonials, counts, certifications and
  ratings must be real. The `#clients` section ships with `hidden` on it until
  real assets exist.
