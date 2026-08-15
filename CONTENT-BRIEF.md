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

## 2. Emirate landing pages — CANCELLED

Not being built. UAE keyword data shows roughly 20 searches a month for
geo-modified crane terms, which does not justify five pages that would each need
genuinely distinct local facts to avoid being doorway pages.

The template that existed for them has been deleted. If this is ever revived,
the requirements are in the git history of this file.

---

## 3. Aftermarket insights cluster — BLOCKED ON REGULATORY SOURCES

Two of the six are **published**: `/insights/fem-duty-classification-explained/`
and `/insights/what-an-amc-should-cover/`. Neither depends on an external
authority.

Two more have **scaffolding built** and are blocked on the questions below:
`src/_drafts/insights/crane-load-testing-uae/` and
`.../third-party-crane-inspection-uae/`. The remaining two
(`overhead-crane-inspection-checklist`, `crane-spare-parts-lead-times-uae`) are
not started.

> These two pages state legal obligations, published by the company the reader
> would pay to satisfy them. A wrong interval or a wrong authority can cause a
> real operator to skip a real test. **Answers must come from Aerolift's
> engineers.** Do not source them from competitor sites or general web search —
> the point is not to find *an* answer, it is to publish one Aerolift will stand
> behind. Where an answer is "it depends", that is a publishable answer; where it
> is "I think so", it is not.

### 3a. Questions for the engineers — crane load testing

1. **Which authority requires load testing of overhead cranes, and does it
   differ by emirate?** Name each one that applies to customers Aerolift serves.
   1a. Do free zones (JAFZA, DIP, Hamriyah, SAIF, KIZAD) fall under their own
       authority rather than the municipality? Which ones differ?
   1b. Is there a federal requirement (MOHRE or other) that applies regardless
       of emirate?
2. **How often must a load test be carried out?** State the interval.
   2a. What is the interval keyed to — crane capacity, duty class, crane type,
       age, or industry?
   2b. What events reset or trigger it outside the normal cycle — installation,
       relocation, major repair, change of ownership?
3. **What does the test physically involve?**
   3a. What proof load is applied, as a percentage of SWL, and does that figure
       differ between a commissioning test and a periodic one?
4. **What does the customer receive afterwards?**
   4a. How long is the certificate valid, and does validity differ from the test
       interval?
   4b. Who accepts it — the municipality, the insurer, the customer's own
       auditor, all three?
5. **Who is legally permitted to carry out the test?**
   5a. What competency or accreditation must the tester hold, and who issues it?
6. **What are the consequences of not testing?** Only answer if it can be stated
   factually — enforcement action, insurance invalidation, liability. If this
   cannot be sourced precisely, the section will be cut rather than softened.

### 3b. Questions for the engineers — third-party inspection

7. **What does "third party" mean in this context?**
   7a. **The crux:** may the company that installed or currently maintains a
       crane also perform its statutory inspection? This defines both the
       reader's obligation and what Aerolift is permitted to do for an existing
       AMC customer.
8. **Who must be accredited, and by whom?**
   8a. Is accreditation recognised across all emirates, or must it be held per
       emirate or per free zone?
9. **How does a statutory third-party inspection differ from a scheduled
   maintenance inspection?** Customers routinely assume a quarterly AMC visit
   satisfies the statutory requirement. Does it? If not, saying so plainly is
   the most valuable sentence on the page.
10. **What must the inspection report contain?**
    10a. How long must it be retained, and who has to produce it on demand?
11. **How often is third-party inspection required, and is it the same event as
    the load test** or a separate one?
12. **Given the answer to 7a — what can Aerolift do for a customer whose crane
    it already maintains, and what must be referred elsewhere?** If there are
    cranes Aerolift cannot independently inspect, the page will say so.

### 3c. Standing rules for both pages

- Every claim carries its source **in the visible text**, not a code comment. A
  reader checking a compliance obligation needs to see where it came from.
- Never publish one emirate's rule as "the UAE".
- Where the honest answer is that it varies, publish the variation rather than
  the simplification.

## 4. Not blocked on facts — outstanding from earlier phases

| Item | Status |
|---|---|
| **Quote form endpoint** | No backend by decision. The dead Formspree id is removed; the form now opens a pre-filled email in the visitor's own mail client. Enquiries are no longer lost, but anyone without a configured mail client cannot submit. A working Formspree id restores a real backend in two minutes — see `src/partials/quote-form.html`. |
| **SPF records** | Broken three ways, and the surviving record hard-fails your own mail. Full diagnosis and the exact replacement record are in `DEPLOY.md`. DKIM and DMARC are absent too. |
| **Catalogue PDF** | Still prints the old phone number `+971 52 865 1180`. Needs reissuing. |
| **Full street address** | Blocks completing `LocalBusiness` schema, a map embed, and the Google Business Profile. |
| **Client logos + signed-off testimonial** | Blocks restoring `src/partials/clients-trust-band.html`. |
| **Team photos, names, roles** | Blocks restoring `src/partials/team-band.html`. |
| **Google Business Profile** | Likely the single biggest lever on inbound enquiries, and entirely outside this repo. |
| **Old number purge** | `+971 55 782 0054` is likely still live across UAE directories. Inconsistent NAP suppresses local pack eligibility. |
