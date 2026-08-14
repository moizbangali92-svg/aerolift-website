# Content brief — facts required before these pages can publish

Everything here is blocked on information only Aerolift has. Nothing on this
list can be researched from the open web with enough confidence to publish,
because a wrong answer on any of it is one a customer could act on.

Templates live in `src/_drafts/` and are excluded from the build, so none of
this can ship by accident. See `src/_drafts/README.md` for how to publish one.

---

## 1. MT-series hoist models — BLOCKED ON DATASHEETS

**Routes:** `/products/hoists/mt305/`, `mt308/`, `mt312/`, `mt316/`, `mt525/`

The current hoists page lists five **configurations** with capacities, and
separately lists five **model numbers**. It does not connect them. So the very
first fact each page needs — what an MT305 actually *is* — is unknown.

Per model, from the manufacturer datasheet:

| Field | Why it's needed |
|---|---|
| Which configuration this model is | foot-mounted / monorail low-headroom / monorail normal-headroom / double-rail trolley / true vertical lift |
| Rated capacity | The site says the range is 1–50 t; which part is this model? |
| Headroom class | Decides whether it fits an existing bay |
| Reeving | Only the 1.5 t true-vertical-lift unit is documented (4/2) |
| Lifting speeds, main and creep | |
| FEM duty classification | The single most load-bearing spec for a buyer |
| Motor ratings | |
| Hook path / lifting height | |
| Dimensions and dead weight | Decides whether the runway can carry it |

**Also needed:** one sentence per model on *which job it does that its
neighbour does not*. If that can't be answered for all five, these should stay
one page — five pages that differ only by a number rank worse than one good one.

---

## 2. Emirate landing pages — BLOCKED ON LOCAL FACTS

**Routes:** `/lifting-equipment/dubai/`, `sharjah/`, `abu-dhabi/`, `ajman/`,
`ras-al-khaimah/`

**These fail if they are one template with the place name swapped.** That is the
doorway-page pattern; it costs site-wide quality signals rather than simply not
ranking. Each page must contain something true of that emirate and false of the
other four.

Per emirate:

1. **Industrial zones actually served** — Al Quoz, JAFZA, DIP, Mussafah,
   Hamriyah, SAIF Zone, etc. Only ones genuinely covered. Do not pad with every
   zone in the emirate.
2. **Realistic call-out response time to that emirate.** This is a commitment
   customers will hold you to at 3 a.m. It must come from whoever dispatches
   the team. If no number can be committed to, that section gets deleted rather
   than softened into something meaningless.
3. **Installed base or reference sites that can be named** — with written
   permission from the client named. If none, the section is omitted; it is not
   replaced with "leading manufacturers in the region".
4. **The local authority and inspection context** for that emirate — see §3,
   same sourcing rule.

Publishing three good emirate pages beats five thin ones. Start with the
emirates where the answers are real.

---

## 3. Aftermarket insights cluster — BLOCKED ON REGULATORY SOURCES

**Routes:** `/insights/crane-load-testing-uae/`,
`third-party-crane-inspection-uae/`, `overhead-crane-inspection-checklist/`,
`fem-duty-classification-explained/`, `what-an-amc-should-cover/`,
`crane-spare-parts-lead-times-uae/`

This is the highest-value content on the list — load testing and third-party
certification are regulatory obligations in the UAE, so the demand is recurring
and the intent is non-discretionary. It is also the easiest to get badly wrong.

**Two of the six can be written now.** `fem-duty-classification-explained` and
`what-an-amc-should-cover` are explainer content your own engineers can write
and verify with no external authority. The AMC terms are already established and
on the site (12-month term, quarterly inspections, parts charged separately).
**Start there** — the cluster gets a foundation while the regulatory sourcing
happens.

**The other four need, per claim:**

- **which authority governs** crane load testing and third-party certification,
  per emirate — Dubai Municipality, ADCD/Abu Dhabi, MOHRE or another
- **at what interval**, and what the interval applies to (capacity? duty class?
  crane type?)
- **the standard reference** with its number — BS EN, FEM, or the applicable
  LOLER-equivalent
- **whether it differs by emirate.** It very likely does. Do not let one
  emirate's rule be published as "the UAE".

Every such statement carries its source in the visible text, so a reader
checking a compliance obligation can see where it came from.

> Aerolift's engineers know this material. It must not be assembled from the
> open web — a plausible-looking inspection interval on a crane safety page is
> the single most harmful thing this site could publish.

---

## 4. Not blocked on facts — outstanding from earlier phases

| Item | Status |
|---|---|
| **Quote form endpoint** | `formspree.io/f/xkgqvbwz` returns 404. Every web enquiry is currently lost. |
| **SPF records** | Broken three ways, and the surviving record hard-fails your own mail. Full diagnosis and the exact replacement record are in `DEPLOY.md`. DKIM and DMARC are absent too. |
| **Catalogue PDF** | Still prints the old phone number `+971 52 865 1180`. Needs reissuing. |
| **Full street address** | Blocks completing `LocalBusiness` schema, a map embed, and the Google Business Profile. |
| **Client logos + signed-off testimonial** | Blocks restoring `src/partials/clients-trust-band.html`. |
| **Team photos, names, roles** | Blocks restoring `src/partials/team-band.html`. |
| **Google Business Profile** | Likely the single biggest lever on inbound enquiries, and entirely outside this repo. |
| **Old number purge** | `+971 55 782 0054` is likely still live across UAE directories. Inconsistent NAP suppresses local pack eligibility. |
