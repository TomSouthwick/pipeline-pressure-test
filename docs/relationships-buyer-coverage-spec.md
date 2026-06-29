# Spec: Relationships / Buyer-Coverage module

**Status:** Proposed (not started)
**Owner:** TBD
**Last updated:** 2026-06-29

---

## 1. Problem

The engine today scores deal *hygiene, momentum, and concentration* — all properties of
the **deal record**. It says nothing about **who you're selling to**. A deal can be
spotless on every mapped field and still be single-threaded to one junior contact, which
is one of the most common reasons "Commit" deals slip late.

This module adds a fourth scored lens — **Relationships / buyer coverage** — that answers:
*are we engaged with enough people, senior enough to actually sign?*

## 2. The data constraint (read this first)

A standard opportunity/deal export **does not contain contacts.** In both CRMs contacts
are a separate object:

- **Salesforce:** contacts attach to opps via *Opportunity Contact Roles*. To get them in a
  CSV the user must build the report on the **"Opportunities with Contact Roles"** report
  type. That yields a `Role` field (Decision Maker / Economic Buyer / Influencer / …); the
  **title** comes from the Contact record and must be added as a column.
- **HubSpot:** Deals and Contacts are separate objects. The user must customize a deal view
  to include associated-contact properties (incl. *Job Title*), or build a cross-object
  report (Professional tier).

### Design rule: detect-and-light-up, never block or nag

The target persona is a rep casually trying the tool with whatever they exported. The
majority will drop a single-object deal report with **no contacts**. Therefore:

- If contact + title columns are **present** → activate the Relationships category.
- If **absent** → the category stays dark and **nothing else changes**. No prompt that
  forces a re-export, no empty error state. At most, a single dismissible hint on the
  results page (see §6).

This mirrors the existing graceful-degradation pattern (e.g. Coverage requires a quota;
without it the category shows "Enter a quota to score coverage" and the rest of the app is
unaffected).

## 3. New canonical fields (opt-in)

Add to `CanonicalField` in [lib/types.ts](../lib/types.ts):

| Field | CRM source examples | Notes |
|-------|--------------------|-------|
| `contactName` | Contact: Full Name, Contact Name | Optional, for display |
| `contactTitle` | Contact: Title, Job Title | **Required** to activate the module |
| `contactRole` | Role (SF Opportunity Contact Role) | Optional; high-value when present |

Because a CSV row is one (opportunity × contact) pair in these report types, **multiple
rows can share one Opportunity ID**. The engine must group contact rows back to their deal.
This is a new ingestion shape — see §5, risk 1.

Synonyms go in `SYNONYMS` ([lib/scoring-config.ts](../lib/scoring-config.ts)); detection
reuses the existing two-layer approach in [lib/column-detection.ts](../lib/column-detection.ts).

## 4. Derived signals

### 4a. Title → seniority tier

A pure function `seniorityTier(title: string): Tier` using ordered keyword regex
(first match wins, highest tier first):

| Tier | Match (case-insensitive) |
|------|--------------------------|
| `c-level` | `chief`, `\bc[a-z]o\b` (CEO/CIO/CTO/…), `president`, `founder`, `owner`, `partner` |
| `vp` | `\bvp\b`, `vice president`, `svp`, `evp` |
| `director` | `director`, `head of` |
| `manager` | `manager`, `lead` |
| `ic` | `senior`, `analyst`, `associate`, `coordinator`, `specialist`, `engineer`, (fallback) |

Edge cases to handle: empty/blank title → `unknown` (not `ic`); "Senior Director" must match
`director` before `senior` (order the regex accordingly); non-English titles → `unknown`.

### 4b. Per-deal aggregates

For each deal, from its grouped contacts:
- `maxTier` — highest seniority reached
- `contactCount` — distinct contacts
- `hasEconomicBuyer` — any `contactRole` in {Decision Maker, Economic Buyer} (SF only)

## 5. New flags + scoring

Add a `relationships` category to `FLAGS_BY_CATEGORY` ([lib/deal-filters.ts](../lib/deal-filters.ts))
and the flags to the scoring config. Suggested weights mirror existing flag magnitudes
(tune in `scoring-config`, not engine code):

| Flag code | Condition | Suggested weight | Rationale |
|-----------|-----------|------------------|-----------|
| `single_threaded` | `contactCount === 1` | medium | One champion = one point of failure |
| `junior_only` | `maxTier` ≤ `manager` | high | No budget authority engaged |
| `no_economic_buyer` | `contactRole` present in data, none is DM/EB | medium | MEDDIC red flag (SF-only; skip if role unmapped) |
| `seniority_mismatch` | top-quartile `amount` **and** `junior_only` | high | Big bet, no exec air cover |

Category contributes 25 pts to the headline like the others. When the module is inactive,
it behaves like Coverage-without-a-quota: excluded from the headline (not scored as 0).

## 6. UI surfacing

- **Category card:** new "Relationships" card alongside Hygiene/Momentum/Concentration
  ([components/category-card.tsx](../components/category-card.tsx), wired in
  [components/result-reveal.tsx](../components/result-reveal.tsx)).
- **Deal explorer:** add `relationships` to `CATEGORY_TABS`
  ([components/deal-explorer.tsx](../components/deal-explorer.tsx)); reuse the same
  `DealRow` table. `primaryReasonForCategory` already handles per-category reasons.
- **DealCard:** a "Buyer coverage" section listing contacts with tier + role
  ([components/deal-card.tsx](../components/deal-card.tsx)).
- **Inactive hint (only when contacts absent):** a single dismissible line on the results
  page — *"Selling to the right people? Export with contact roles to unlock buyer-coverage
  analysis →"* with a short how-to. Do **not** show this as an error or block results.

## 7. Risks / open questions

1. **Row-grouping ingestion** is the biggest lift. The current pipeline assumes one row =
   one deal. Contact-role reports break that. Decide: detect duplicate deal-id rows and
   group, vs. require a deal-id column to be mapped. Needs design before coding.
2. **Title parsing is fuzzy.** Keyword regex will misfire on creative titles ("Growth
   Ninja", "Chief Happiness Officer"). Acceptable for v1 as a directional signal; surface
   the parsed tier in the DealCard so it's auditable, never hidden.
3. **`no_economic_buyer` is SF-only** (role field). Gate it on `contactRole` being mapped,
   or it will false-positive on every HubSpot export.
4. **Privacy:** contact names/titles are more sensitive than deal metadata. Parsing stays
   100% client-side like the rest of the app — reaffirm in copy. Do not aggregate or
   transmit contact data.

## 8. PR breakdown

Ship behind the detect-and-light-up rule so each PR is safe to merge independently.

1. **PR 1 — Ingestion: group contact rows to deals.** Detect duplicate deal-id rows;
   attach a `contacts[]` array to each deal. No scoring/UI yet. Tests for grouping +
   single-object (no-op) case.
2. **PR 2 — `seniorityTier()` + per-deal aggregates.** Pure functions + unit tests
   (edge cases from §4a). No UI.
3. **PR 3 — Relationships flags + category scoring.** Wire into `FLAGS_BY_CATEGORY`,
   scoring-config weights, engine aggregation. Tests. Category excluded from headline when
   inactive.
4. **PR 4 — UI: category card + explorer tab + DealCard buyer-coverage section.**
5. **PR 5 — Inactive hint + how-to** on results page; copy review.

Estimated: PRs 1–3 are the substance; 4–5 are mechanical given existing components.
