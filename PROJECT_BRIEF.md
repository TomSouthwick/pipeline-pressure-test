# Pipeline Pressure Test — Build Brief

> Drop this file at the root of the repo. Save it as `CLAUDE.md` (Claude Code reads it automatically every session), or keep this name and add a one-line `CLAUDE.md` that says "Read PROJECT_BRIEF.md before doing anything."
>
> First instruction to give Claude Code: *"Read PROJECT_BRIEF.md and propose a build plan in plan mode before writing any code."*

## 1. What this is

A free, single-page web tool. A GTM leader exports their open opportunities to CSV, drops the file in, and gets back a scored pipeline health diagnostic: a 0-100 score, category breakdowns, and the specific deals quietly killing their forecast.

**Purpose:** inbound and proof-of-shipping. It must feel effortless and be shareable. The headline score is the thing people screenshot, so it needs to be provocative but defensible.

## 2. Hard rules (do not violate)

- **Everything runs client-side.** CSV parsing and all diagnostic logic happen in the browser. No deal data is ever sent to a server or stored. This is the entire trust pitch and the reason a cold visitor will use it.
- **No signup, no login, no email gate to see results.** Results appear instantly and free.
- **No CRM OAuth, no database, no backend storage in v0.**
- Email capture and benchmarking are explicitly out of scope for v0 (see Non-goals).

## 3. Tech stack

- Next.js (App Router) on Vercel. Reason for Next over a plain Vite SPA: leaves room for one optional serverless route later (email send) without re-architecting. All v0 logic stays client-side regardless.
- Tailwind for styling, shadcn/ui for base components.
- Motion (`motion/react`, formerly Framer Motion) for UI animation.
- PapaParse for CSV parsing.
- PDF generation client-side (e.g. jsPDF or react-pdf). CSV export via a Blob download. No server needed for either.

## 4. UX flow (one screen, ruthless subtraction)

1. **Landing:** a single centred drop zone. No nav, no settings. Headline, one line of subcopy, the drop zone, and secondary **"Try Salesforce sample"** / **"Try HubSpot sample"** buttons. The sample-data path is mandatory: it is how curious visitors and mobile users experience the payoff, and it drives shares.
2. **Drop/select file** (drag-drop or click) → parse immediately → **column confirm** (uploads only).
3. **Sample buttons:** parse and auto-detect, then show a **mappings review** screen (not the upload confirm gate). Column mapping is visible upfront with a **Run now** banner; late stages and quota remain editable. One click to result when ready.
4. **Column confirm (uploads only):** show detected column mapping with high-confidence matches pre-filled. The user glances, fixes anything wrong, clicks **Run**. Do not auto-run silently for real uploads; a mis-mapped column produces a wrong diagnostic and destroys trust.
5. **Result reveal (the moment):** animated reveal of a big score counting up (0-100), four category cards with traffic-light status, the 3-5 worst deals named with reasons, a sortable/filterable **all-deals table**, and a collapsible **methodology** panel explaining how the score was computed. When too few columns are mapped, show an insufficient-data state instead of a misleading zero score.
6. **Outputs:** "Download annotated CSV" and "Download PDF report" buttons. Both generated entirely client-side. PDF includes methodology, checks ran/skipped, weighting method, and top at-risk deals.

Must work on mobile (the sample-data path especially). Page load under 2 seconds.

## 5. Column auto-detection (the dynamic mapping)

Two-layer detection, then a confirm step:

- **Layer 1 — synonym dictionary** keyed to real CRM export headers. Examples:
  - close date: `Close Date`, `CloseDate`, `Expected Close`, `Close`, `Est. Close Date`
  - amount: `Amount`, `Deal Value`, `ARR`, `Value`, `Opportunity Amount`, `Deal Amount`
  - stage: `Stage`, `Deal Stage`, `Opportunity Stage`, `Sales Stage`
  - owner: `Owner`, `Deal Owner`, `Opportunity Owner`, `Assigned To`
  - last activity: `Last Activity`, `Last Activity Date`, `Last Contacted`
  - created date: `Created Date`, `Create Date`, `Created`
  - next step: `Next Step`, `Next Steps`, `Next Activity`
  - deal name: `Deal Name`, `Opportunity Name`, `Name`
- **Layer 2 — content sniffer** as fallback: a column that parses mostly as dates is a date candidate; mostly currency/numeric → amount; low-cardinality strings → stage or owner.
- Score each guess for confidence. Pre-fill high-confidence matches as confirmed; surface low-confidence ones for the user to set.
- In the same confirm step, let the user flag which stage values count as **late/commit** (every CRM names stages differently). Provide sensible defaults for Salesforce/HubSpot stage names.
- **Graceful degradation:** skip any check whose required column is absent, and note in the report which checks ran and which were skipped.

## 6. Diagnostic ruleset (the actual IP)

Four categories, each scored out of 25, rolling into a 0-100 health score (higher = healthier). Also compute a per-deal risk score to surface the worst 3-5 deals by name.

> **Tunable:** the thresholds and weights below are a sensible v1 to make the build executable. They are the part to refine with sales judgement. Keep them in a single `scoring-config.ts` so they are easy to change.

**Hygiene (0-25)** — per-deal flags, share of clean deals drives the score:
- missing or zero amount
- missing close date
- close date in the past but deal still open (overdue)
- missing owner
- missing next step (only if column present)

**Momentum (0-25):**
- no activity in 14 / 30 / 60 days (tiered penalty, worse the longer)
- stuck: days in current stage beyond benchmark (default >30 days early stage, >21 days late stage)
- zombie: created >90 days ago but still in an early stage

**Concentration & risk (0-25):**
- close-date bunching: share of pipeline value closing in the final 7 days of the quarter (flag if >40%). This is the single sharpest "oh no" signal.
- deal concentration: top 3 deals as a share of total open value (flag if >50%)
- **late-stage + stale combo** (highest individual weight): deals in a late/commit stage with no activity in 30+ days

**Coverage & realism (0-25)** — only if the user types in a quota:
- coverage ratio = total open pipeline / quota (flag if <3x)
- weighted pipeline = sum(amount × stage probability) vs quota (flag if weighted < 1.0x). The line that makes a sales leader sit up: "your weighted pipeline covers 0.7x of your number."
- default stage→probability map in config, tunable, matched to the confirmed stage names.

**Bonus checks if columns exist** (treat as additive, not core): stage regression and close-date pushes (need history a single export usually lacks).

**Worst deals:** rank by per-deal risk score (sum of that deal's weighted flags). Show name, amount, stage, and a plain-English reason ("late-stage commit, no activity in 47 days").

## 7. Outputs

- **Annotated CSV:** original rows plus added columns — overall flag(s), per-deal risk score, and reason text. Generated client-side, downloaded as a Blob.
- **PDF report:** one page — the score, the four category breakdowns, and the named worst deals. Shareable artefact. Client-side.

## 8. Design direction

- **Light mode**, credible and restrained — clean “instrument” UI (audience is technical: think Tines/Semgrep buyers). The tool must not look like a toy or it undermines the pipeline judgement it is selling.
- No decorative grid background; generous whitespace on a neutral surface.
- Geist Sans for body, Geist Mono for numerals and data readouts.
- Persistent sticky wordmark header (“Pipeline Pressure Test”) on every screen — click returns to landing. No nav links or settings.
- Motion: tight and quick. Score count-up with a pop on land, staggered reveal of category cards and worst-deals list. Respect `prefers-reduced-motion`.
- Single clear action per screen. Whitespace as a tool, not decoration.

## 9. Build order

1. ~~Scaffold: Next + Tailwind on Vercel. One page, drop zone, sample-data buttons, realistic sample CSVs committed to the repo.~~ **Done**
2. ~~Parser + auto-detect + confirm step (PapaParse + synonym dictionary + content sniffer + late-stage flagging).~~ **Done**
3. ~~Diagnostic engine in `scoring-engine.ts` with all config in `scoring-config.ts`. Unit-test the engine against sample CSVs.~~ **Done**
4. ~~Result reveal + visual polish (Motion, score dial).~~ **Done**
5. ~~Outputs: annotated CSV + PDF, both client-side.~~ **Done** (PDF extended to two pages with methodology)
6. ~~Deal table + in-app methodology panel.~~ **Done (v0)**
7. (Out of scope for v0, note for later) optional email delivery via a single Resend serverless route; aggregate-only, opt-in benchmarking.

**Explicitly deferred:** stuck-in-stage check (needs stage history), shadcn/ui migration, dark mode, benchmarking, email capture, auth.

## 10. Non-goals (v0)

- No auth, no accounts.
- No backend storage of any deal data.
- No CRM integration / OAuth.
- No mandatory email field. (When email is added later, it is optional and only requested at the point of value, e.g. "email me the report", never as a gate.)
- No benchmarking yet (it requires a backend; build it later as aggregate-scores-only with explicit opt-in, never raw rows).

## 11. Acceptance criteria

- Loads in under 2 seconds; works on mobile.
- Sample-data buttons land on a mappings review screen with **Run now** — one click to result when mapping looks good (confirm step skipped for uploads only).
- A real Salesforce or HubSpot CSV export auto-maps correctly with at most one or two manual fixes in the confirm step.
- No network request ever carries deal-row data (verify in DevTools Network tab).
- Score, category breakdowns, named worst deals, full deal table, and methodology all render with reasons.
- Annotated CSV and PDF both download and open correctly.
- Mis-mapping is impossible to do silently for real uploads: the confirm step always precedes a result. Sample data uses a lighter mappings review instead of the upload confirm gate.
