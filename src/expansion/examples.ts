import { stockRangeCardExample, vehicleRangeCardExample } from "../exploration/examples.js";
import { createExpansionPlan } from "./plan.js";
import { createStartingEvidenceField } from "./starting-field.js";
import type { EvidenceGap, ExpansionPlan, ExpansionProbe, StartingEvidenceField } from "./types.js";

export interface ExpansionExample { startingEvidence: StartingEvidenceField; gaps: readonly EvidenceGap[]; plan: ExpansionPlan; }

function probe(args: { id: string; question: string; purpose: ExpansionProbe["purpose"]; objective: string; evidenceIds: readonly string[]; gapIds: readonly string[]; arcIds?: readonly string[]; impact: string; value: number; scope: string }): ExpansionProbe {
  return { id: args.id, question: args.question, purpose: args.purpose, objectiveLink: args.objective, triggeredByEvidenceIds: args.evidenceIds, triggeredByUnknownIds: [], targetGapIds: args.gapIds, rangeCardArcIds: args.arcIds ?? [], expectedDecisionImpact: args.impact, expectedInformationValue: args.value, outcomeDimensions: ["PROBABILITY", "VALUE"], couldMateriallyChangeOutcome: true, searchScope: args.scope, status: "PROPOSED", resultEvidenceIds: [], notes: [] };
}

export function stockAppOutputExpansionExample(): ExpansionExample {
  const startingEvidence = createStartingEvidenceField({
    id: "stock-app-starting-field",
    decisionCaseId: "stock-decision",
    createdAt: "2026-08-13T00:00:00.000Z",
    items: [{ id: "momentum-20d", originType: "APP_OUTPUT", description: "20-day momentum +22%", sourceReference: "portfolio-app-screen", acquisitionTime: "2026-08-13T00:00:00.000Z", confidence: 0.9, provenance: "Value displayed by the user's stock application.", evidenceCharacter: "MEASURED", notes: ["App output is a starting measurement, not externally verified fundamentals."] }],
    notes: [],
  });
  const gaps: EvidenceGap[] = [
    { id: "post-move-valuation", missingInformation: "Post-move valuation has not been assessed.", whyItMatters: "Operational strength may already be reflected in current price.", affectedConclusionOrHypothesisIds: ["investment-thesis"], resolvingEvidence: "Current valuation multiples and comparable valuation evidence.", status: "MATERIAL", expectedInformationValue: 0.95, rangeCardArcIds: ["nominated-company"], notes: [] },
    { id: "move-explanation", missingInformation: "The event or flow explaining the 20-day move is unknown.", whyItMatters: "The explanation may distinguish durable repricing from transient momentum.", affectedConclusionOrHypothesisIds: ["investment-thesis"], resolvingEvidence: "Corporate-event chronology, volume, filings, and material announcements.", status: "MATERIAL", expectedInformationValue: 0.88, rangeCardArcIds: ["refinancing-milestone"], notes: [] },
    { id: "incentive-overlap", missingInformation: "Management incentive dates have not been compared with the decision timeframe.", whyItMatters: "Overlap may alter governance or timing risk but does not establish causation.", affectedConclusionOrHypothesisIds: ["investment-thesis"], resolvingEvidence: "Remuneration report, STI/LTI metrics, and vesting dates.", status: "NON_BLOCKING", expectedInformationValue: 0.62, rangeCardArcIds: ["management-incentives"], notes: [] },
  ];
  const probes = [
    probe({ id: "assess-valuation", question: "Has the +22% move already repriced the expected operational improvement?", purpose: "CHALLENGE", objective: "Risk-adjusted return at the current entry price", evidenceIds: ["momentum-20d"], gapIds: ["post-move-valuation"], impact: "Could weaken value even if the operating thesis remains intact.", value: 0.9, scope: "Current valuation and comparable securities." }),
    probe({ id: "explain-move", question: "What corporate event, filing, or trading-volume change explains the 20-day move?", purpose: "EXPLAIN", objective: "Durability and timing of the investment outcome", evidenceIds: ["momentum-20d"], gapIds: ["move-explanation"], arcIds: ["refinancing-milestone"], impact: "Could strengthen or weaken the probability assigned to durable repricing.", value: 0.84, scope: "Company filings, event chronology, and volume records." }),
    probe({ id: "check-incentives", question: "Do STI/LTI metrics or vesting dates overlap the current decision timeframe?", purpose: "CHECK_INCENTIVES", objective: "Governance risk within the holding period", evidenceIds: [], gapIds: ["incentive-overlap"], arcIds: ["management-incentives"], impact: "Could reveal a timing factor requiring further verification.", value: 0.6, scope: "Published remuneration disclosures." }),
    probe({ id: "social-sentiment", question: "What is the general social-media mood?", purpose: "OTHER", objective: "", evidenceIds: ["momentum-20d"], gapIds: [], impact: "No specified material decision effect.", value: 0.1, scope: "Unbounded social discussion." }),
  ];
  return { startingEvidence, gaps, plan: createExpansionPlan(probes, gaps, stockRangeCardExample(), { optionalDeferBelow: 0.2 }) };
}

export function vehicleListingExpansionExample(): ExpansionExample {
  const startingEvidence = createStartingEvidenceField({
    id: "vehicle-listing-starting-field",
    decisionCaseId: "vehicle-decision",
    createdAt: "2026-08-13T00:00:00.000Z",
    items: [{ id: "listing-drives-perfectly", originType: "LISTING", description: "Seller states: drives perfectly", sourceReference: "vehicle-listing", acquisitionTime: "2026-08-13T00:00:00.000Z", provenance: "Seller-authored listing text.", evidenceCharacter: "CLAIMED", notes: ["The claim has not been independently verified."] }],
    notes: [],
  });
  const gaps: EvidenceGap[] = [
    { id: "transmission-variant", missingInformation: "Exact transmission variant is unknown.", whyItMatters: "Failure exposure and repair cost may differ materially by transmission.", affectedConclusionOrHypothesisIds: ["nominated-car"], resolvingEvidence: "VIN/build data and transmission identifier.", status: "BLOCKING", expectedInformationValue: 0.98, rangeCardArcIds: ["model-failure-risk"], notes: [] },
    { id: "maintenance-history", missingInformation: "Relevant maintenance history has not been verified.", whyItMatters: "Service history may strengthen or weaken model-specific failure exposure.", affectedConclusionOrHypothesisIds: ["nominated-car"], resolvingEvidence: "Dated invoices and service records.", status: "MATERIAL", expectedInformationValue: 0.9, rangeCardArcIds: ["maintenance-resale-interlock"], notes: [] },
    { id: "comparable-path", missingInformation: "Nearby vehicle alternatives have not been compared.", whyItMatters: "Another vehicle may satisfy the transport objective with lower liabilities.", affectedConclusionOrHypothesisIds: ["nominated-car"], resolvingEvidence: "Comparable listings, inspections, and ownership-cost records.", status: "NON_BLOCKING", expectedInformationValue: 0.65, rangeCardArcIds: ["adjacent-vehicle-path"], notes: [] },
  ];
  const probes = [
    probe({ id: "identify-transmission", question: "What exact transmission is fitted?", purpose: "RESOLVE_UNKNOWN", objective: "Mechanical reliability and repair exposure", evidenceIds: ["listing-drives-perfectly"], gapIds: ["transmission-variant"], arcIds: ["model-failure-risk"], impact: "Could materially change risk, value, and purchase conditions.", value: 0.98, scope: "VIN/build records and physical identifiers." }),
    probe({ id: "verify-maintenance", question: "Do dated records show the maintenance relevant to this drivetrain?", purpose: "VERIFY", objective: "Mechanical reliability and ownership cost", evidenceIds: ["listing-drives-perfectly"], gapIds: ["maintenance-history"], arcIds: ["maintenance-resale-interlock"], impact: "Could strengthen or weaken the seller claim without converting repetition into fact.", value: 0.88, scope: "Invoices and service records." }),
    probe({ id: "compare-vehicles", question: "Does an adjacent vehicle offer materially lower total liability?", purpose: "COMPARE_ALTERNATIVE", objective: "Reliable transport at good total value", evidenceIds: [], gapIds: ["comparable-path"], arcIds: ["adjacent-vehicle-path"], impact: "Could redirect the decision to another path.", value: 0.64, scope: "Nearby comparable vehicles." }),
  ];
  return { startingEvidence, gaps, plan: createExpansionPlan(probes, gaps, vehicleRangeCardExample()) };
}
