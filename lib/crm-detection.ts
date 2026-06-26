// Infer the source CRM (Salesforce vs HubSpot) from a CSV's headers. This is a
// hint, never a gate: it powers a confirmable "Looks like Salesforce" chip and
// sensible defaults. The confirm step remains the source of truth.

export type Crm = "salesforce" | "hubspot";

export interface CrmGuess {
  crm: Crm | null;
  confidence: number; // 0..1
}

export const CRM_LABEL: Record<Crm, string> = {
  salesforce: "Salesforce",
  hubspot: "HubSpot",
};

const norm = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, "");

// Signature headers per CRM. Some (Close Date, Forecast Category) appear in both
// and are weak signals; the distinctive ones (Opportunity * vs Deal *, Record ID,
// Pipeline, Amount in company currency) do the real discriminating.
const SIGNATURES: Record<Crm, string[]> = {
  salesforce: [
    "Opportunity Name",
    "Opportunity Owner",
    "Opportunity ID",
    "Probability (%)",
    "Forecast Category",
    "Fiscal Period",
    "Account Name",
    "Lead Source",
    "Stage",
    "Created Date",
    "Close Date",
  ],
  hubspot: [
    "Deal Name",
    "Deal Stage",
    "Deal owner",
    "Deal probability",
    "Record ID",
    "Pipeline",
    "Amount in company currency",
    "Associated Company",
    "Deal Type",
    "Forecast category",
    "Create Date",
    "Close Date",
  ],
};

const NORM_SIGNATURES: Record<Crm, Set<string>> = {
  salesforce: new Set(SIGNATURES.salesforce.map(norm)),
  hubspot: new Set(SIGNATURES.hubspot.map(norm)),
};

export function inferCrm(headers: string[]): CrmGuess {
  const present = new Set(headers.map(norm));
  const score = (crm: Crm) => {
    let hits = 0;
    for (const s of NORM_SIGNATURES[crm]) if (present.has(s)) hits++;
    return hits;
  };

  const sf = score("salesforce");
  const hs = score("hubspot");
  const max = Math.max(sf, hs);
  if (max < 2) return { crm: null, confidence: 0 };

  const crm: Crm = sf >= hs ? "salesforce" : "hubspot";
  const margin = Math.abs(sf - hs);
  // More distinctive hits + a clear margin over the other CRM => more confident.
  const confidence = Math.min(1, max / 5) * (margin >= 2 ? 1 : 0.7);
  return { crm, confidence };
}
