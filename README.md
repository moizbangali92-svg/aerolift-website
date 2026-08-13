# Aerolift L.L.C. — aerolift-cranes.com

Static site. HTML5 + Tailwind CSS v4 (CLI build, purged) + ~3.5KB of vanilla JS.
No framework, no CDN scripts, no third-party requests at runtime.

## Commands

```bash
npm install
npm run dev      # copy assets + Tailwind --watch
npm run build    # copy assets + Tailwind --minify  -> dist/
npm run serve    # static server for dist/ on :4321
```

`dist/` is the deploy artifact. It is gitignored — build it in CI.

## Structure

```
src/index.html          -> dist/index.html
src/css/input.css       -> dist/css/style.css   (design tokens live in @theme)
src/js/main.js          -> dist/js/main.js      (deferred)
src/assets/img/         -> dist/assets/img/
robots.txt, sitemap.xml, favicon.svg -> dist/
node_modules/@fontsource/* -> dist/fonts/       (self-hosted woff2, 5 weights)
```

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
- **No invented proof.** Client logos, testimonials, counts, certifications and
  ratings must be real. The `#clients` section ships with `hidden` on it until
  real assets exist.
