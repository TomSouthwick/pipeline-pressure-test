# Pipeline Pressure Test

A free, single-page web tool. Drop in a CSV export of your open opportunities and
get back a scored pipeline health diagnostic: a 0–100 score, four category
breakdowns, and the specific deals quietly killing your forecast.

**Everything runs client-side.** CSV parsing and all diagnostic logic happen in
your browser. No deal data is ever sent to a server or stored.

## Run it

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build
npm test         # engine unit tests (Vitest)
```

**Live:** [pipeline-pressure-test.vercel.app](https://pipeline-pressure-test.vercel.app) · [GitHub](https://github.com/TomSouthwick/pipeline-pressure-test)

## How it works

```
app/page.tsx            State machine: idle → confirm → result
components/             DropZone, ColumnConfirm, ResultReveal, DealTable,
                        MethodologyPanel, score dial, category cards
lib/
  scoring-config.ts     ALL tunable IP — thresholds, weights, synonyms,
                        stage→probability map, default late/commit stages
  scoring-engine.ts     Pure, deterministic runDiagnostic(rows, mapping, opts)
  column-detection.ts   Synonym dictionary + content sniffer + confidence
  parse.ts              Tolerant date/currency/quota parsing
  csv.ts                PapaParse + annotated-CSV Blob export
  pdf.ts                Client-side PDF report (jsPDF, two pages)
public/
  sample-pipeline.csv           Salesforce-style demo data
  sample-pipeline-hubspot.csv   HubSpot-style demo data
```

### The flow

1. **Drop a CSV** (or try the Salesforce or HubSpot sample).
2. **Confirm columns** — auto-detection pre-fills high-confidence matches; you
   fix anything wrong, flag which stages are late/commit, and optionally enter a
   quota. Sample data shows a prominent **Run now** banner when mapping looks
   good; real uploads use the standard confirm step at the bottom.
3. **Run** → animated reveal of the score, category cards, worst deals, full
   deal table, and methodology panel.
4. **Download** an annotated CSV or a PDF report — both generated in the browser.

### Scoring

Four categories, each out of 25, rolling into a 0–100 health score (higher =
healthier). All thresholds and weights live in
[`lib/scoring-config.ts`](lib/scoring-config.ts) so they can be refined with
sales judgement without touching engine or UI code.

- **Hygiene** — missing/zero amount, missing/overdue close date, missing owner,
  missing next step.
- **Momentum** — activity recency (14/30/60-day tiers), zombie deals (90+ days
  old and still early-stage). *(Stuck-in-stage needs stage history a single
  export rarely has, so it's skipped and noted.)*
- **Concentration & risk** — quarter-end close-date bunching, top-3 deal
  concentration, and the sharpest signal: late-stage deals gone quiet (30+ days).
- **Coverage & realism** *(only with a quota)* — coverage ratio and weighted
  pipeline vs. quota. When a CRM probability column is present, weighting uses
  those values per deal; otherwise stage-based estimates apply.

Any check whose required column is absent is skipped and recorded in the report.

## Privacy

This tool is designed so **no deal-row data ever leaves your browser**.

### Network audit checklist

Use DevTools → **Network** while running a full diagnostic:

1. Upload a real CSV (or use sample data) and click **Run**.
2. Confirm there are **no POST/PUT/PATCH** requests carrying row payloads.
3. The only fetches should be static assets: JS bundles, fonts, CSS, and (for
   sample mode) `GET /sample-pipeline.csv` or `GET /sample-pipeline-hubspot.csv`
   from this same origin.
4. PDF and annotated CSV downloads are **Blob URLs** — they do not upload data.

If you see any request sending CSV content to a third party, please file an issue.

## Supported exports

Synthetic fixtures in `public/` cover Salesforce and HubSpot header patterns.
Vitest asserts auto-mapping and CRM inference for both.

For real exports (run locally — **never commit customer data**):

| CRM | Expected headers | Notes |
|-----|------------------|-------|
| Salesforce | `Opportunity Name`, `Amount`, `Stage`, `Probability (%)`, `Forecast Category` | Auto-maps at high confidence |
| HubSpot | `Deal Name`, `Deal Stage`, `Deal probability`, `Forecast category` | Auto-maps at high confidence |

If your export uses uncommon column names, map them manually in the confirm step.
Report synonym gaps via issue — patches go in `lib/scoring-config.ts`.

## Manual QA script

1. **Sample fast path:** Try Salesforce sample → **Run now** → result → Back →
   change one mapping → Run → score changes.
2. **Late stages:** Deselect all late/commit stages → warning visible → run →
   skipped check appears in methodology.
3. **Bad file:** Upload a `.xlsx` or `.txt` → friendly error on the landing screen.
4. **Privacy:** DevTools Network tab during a run — no row payloads (see above).
5. **Mobile:** iPhone-width sample path, drop zone tap, confirm scroll, result
   reveal, PDF/CSV download.

## Non-goals (v0)

No auth, no backend storage, no CRM OAuth, no email gate. The App Router leaves
room for one optional serverless route later (email delivery), but nothing in v0
sends deal data anywhere.
