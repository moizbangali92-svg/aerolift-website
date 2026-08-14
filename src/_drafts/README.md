# Drafts — not built, not published

`scripts/build.mjs` skips any directory under `src/` whose name starts with an
underscore. Nothing in here reaches `dist/`, so nothing here can be deployed by
accident. That is deliberate, not a limitation.

These pages are blocked on facts that only Aerolift can supply. Every one of
them would be actively harmful to publish in its current state:

| Draft | Blocked on | Why publishing early hurts |
|---|---|---|
| `products/hoists/_model-template.html` | Manufacturer datasheet per MT model | Every spec would be invented. A wrong capacity on a lifting product is a safety claim, not a typo. |
| `lifting-equipment/_emirate-template.html` | Per-emirate facts (see `CONTENT-BRIEF.md`) | Five near-duplicate pages with a swapped place name is the textbook doorway-page pattern; it drags down site-wide quality signals under the helpful-content system. |
| `insights/_article-template.html` | Regulatory sources per claim | These are crane *safety* and *compliance* pages. An unverified inspection interval or authority name is the worst possible thing to get wrong here. |

## To publish one

1. Fill every `<!-- SLOT: … -->` marker with real, sourced content.
2. Delete the slot comments.
3. Move the file to its real path under `src/` (e.g.
   `src/lifting-equipment/dubai/index.html`).
4. Add the URL to `sitemap.xml` — the build fails if you forget, which is the
   point of the sitemap guard.
5. Link it from somewhere real. An orphan page is a page nobody finds.

## What NOT to do

Do not publish with the slots filled by plausible-sounding text. The whole
reason these are parked rather than written is that the facts are not knowable
from the existing site, and every one of them is the kind a customer could act
on and be harmed by.
