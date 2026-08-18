import { createRangeCard } from "./range-card.js";
import type { ArcPosition, ArcType, ExplorationArc, ExplorationPurpose, RangeCard, RangeCardResult } from "./types.js";

function arc(args: {
  id: string;
  position: ArcPosition;
  type: ArcType;
  purpose: ExplorationPurpose;
  origin: ExplorationArc["origin"];
  title: string;
  description: string;
  objectiveLink: string;
  assumption: string;
  evidenceNeeded: readonly string[];
  impact: string;
  dimensions: ExplorationArc["outcomeChangingFactor"]["dimensions"];
  condensed?: ExplorationArc["condensedDisclosure"];
}): ExplorationArc {
  return {
    id: args.id,
    arcPosition: args.position,
    arcType: args.type,
    purpose: args.purpose,
    origin: args.origin,
    title: args.title,
    description: args.description,
    objectiveLink: args.objectiveLink,
    affectedObjectiveParts: [args.objectiveLink],
    challengedAssumption: args.assumption,
    relevantConstraints: ["Evidence must be obtained before treating this direction as fact."],
    evidenceNeeded: args.evidenceNeeded,
    potentialDecisionImpact: { direction: "MIXED", description: args.impact },
    outcomeChangingFactor: { couldMateriallyChangeOutcome: true, dimensions: args.dimensions, rationale: args.impact },
    sourceReferences: [],
    evidenceReferences: [],
    status: "PROPOSED",
    notes: ["Exploration direction only; no factual claim is made."],
    ...(args.condensed ? { condensedDisclosure: args.condensed } : {}),
  };
}

export function vehicleRangeCardExample(): RangeCardResult {
  const card: RangeCard = {
    id: "vehicle-range-card",
    originalQuestion: "Should I buy the nominated used vehicle?",
    desiredResult: "Obtain reliable transport at good total value without taking avoidable mechanical risk.",
    mainArc: arc({ id: "nominated-car", position: "MAIN_ARC", type: "STATED_PATH", purpose: "STATED_PATH", origin: "USER_SUPPLIED", title: "Evaluate the nominated vehicle", description: "Assess the nominated used car on its stated price, condition, records, and suitability.", objectiveLink: "Reliable transport and total ownership value", assumption: "The nominated vehicle is the appropriate path to evaluate first.", evidenceNeeded: ["Inspection", "title check", "service records"], impact: "Verification may strengthen or weaken the nominated purchase path.", dimensions: ["PROBABILITY", "VALUE", "CONDITIONS"] }),
    leftArc: arc({ id: "model-failure-risk", position: "LEFT_ARC", type: "RISK_FACTOR", purpose: "HIDDEN_FACTOR_EXPLORATION", origin: "SYSTEM_PROPOSED", title: "Model-specific failure exposure", description: "Known transmission, timing-system, or model-year failure patterns may materially affect deal economics; this does not assert that this vehicle has a fault.", objectiveLink: "Reliability and total ownership value", assumption: "Visible condition and asking price capture the material ownership risks.", evidenceNeeded: ["Model-year reliability records", "specialist inspection", "maintenance history"], impact: "Supported failure exposure could weaken value, add a purchase condition, or improve negotiation leverage.", dimensions: ["VALUE", "CONDITIONS", "PROBABILITY"], condensed: { changes: ["MAIN_RISK", "CONDITION"], summary: "Verify model-specific mechanical exposure before commitment." } }),
    rightArc: arc({ id: "adjacent-vehicle-path", position: "RIGHT_ARC", type: "ALTERNATIVE_PATH", purpose: "ALTERNATIVE_PATH_EXPLORATION", origin: "SYSTEM_PROPOSED", title: "Comparable lower-liability vehicle", description: "A nearby model or example may satisfy the same transport objective with different maintenance and resale economics.", objectiveLink: "Reliable transport and total ownership value", assumption: "The nominated car dominates nearby options after whole-of-ownership costs.", evidenceNeeded: ["Comparable listings", "maintenance schedules", "resale and liquidity evidence"], impact: "A comparable may redirect the decision if it offers materially better total value or availability.", dimensions: ["VALUE", "AVAILABILITY", "TIMING"] }),
    interlockingArcs: [arc({ id: "maintenance-resale-interlock", position: "INTERLOCKING_ARC", type: "CONSTRAINT_FACTOR", purpose: "HIDDEN_FACTOR_EXPLORATION", origin: "SYSTEM_PROPOSED", title: "Maintenance and resale interlock", description: "Upcoming maintenance may affect both the nominated car's economics and its comparison with adjacent vehicles.", objectiveLink: "Whole-of-ownership cost and exit flexibility", assumption: "Purchase price can be considered separately from maintenance timing and resale.", evidenceNeeded: ["Scheduled maintenance liabilities", "resale comparables"], impact: "The same records may change relative value across both purchase pathways.", dimensions: ["VALUE", "TIMING"] })],
    relationships: [{ id: "vehicle-shared-economics", relationshipType: "SHARES_EVIDENCE", arcIds: ["nominated-car", "model-failure-risk", "adjacent-vehicle-path", "maintenance-resale-interlock"], rationale: "Maintenance and resale evidence affects the economics of every vehicle pathway.", evidenceReferences: [] }],
    hunches: [],
    notes: ["No mechanical problem is assumed without evidence."],
  };
  return createRangeCard(card);
}

export function stockRangeCardExample(): RangeCardResult {
  const card: RangeCard = {
    id: "stock-range-card",
    originalQuestion: "Should I invest in the nominated company?",
    desiredResult: "Achieve attractive risk-adjusted returns within the intended holding period.",
    mainArc: arc({ id: "nominated-company", position: "MAIN_ARC", type: "STATED_PATH", purpose: "STATED_PATH", origin: "USER_SUPPLIED", title: "Evaluate the nominated company", description: "Assess the company's economics, valuation, risks, and fit with the desired holding period.", objectiveLink: "Risk-adjusted return", assumption: "The nominated security is the relevant investment path.", evidenceNeeded: ["Financial statements", "valuation evidence", "risk disclosures"], impact: "Evidence may support, weaken, or condition the investment case.", dimensions: ["PROBABILITY", "VALUE", "TIMING"] }),
    leftArc: arc({ id: "management-incentives", position: "LEFT_ARC", type: "INCENTIVE_FACTOR", purpose: "HIDDEN_FACTOR_EXPLORATION", origin: "SYSTEM_PROPOSED", title: "Management incentive timing", description: "Compensation metrics, vesting periods, and review timing may influence behavior; they do not establish future performance.", objectiveLink: "Probability and timing of investment outcomes", assumption: "Reported strategy is independent of management incentive timing.", evidenceNeeded: ["Compensation disclosures", "vesting calendar", "bonus metrics"], impact: "Evidence may change governance risk or the timing assigned to milestones.", dimensions: ["PROBABILITY", "TIMING"] }),
    rightArc: arc({ id: "diversified-path", position: "RIGHT_ARC", type: "ALTERNATIVE_PATH", purpose: "ALTERNATIVE_PATH_EXPLORATION", origin: "SYSTEM_PROPOSED", title: "Diversified exposure to the same thesis", description: "A diversified fund or adjacent company may express the same investment thesis with different concentration and execution risk.", objectiveLink: "Risk-adjusted return from the underlying thesis", assumption: "Single-company exposure is the best route to the desired return.", evidenceNeeded: ["Alternative exposure costs", "holdings", "factor and concentration comparison"], impact: "An alternative vehicle may offer a better route if it preserves upside while reducing company-specific risk.", dimensions: ["VALUE", "PROBABILITY", "AVAILABILITY"] }),
    interlockingArcs: [arc({ id: "refinancing-milestone", position: "INTERLOCKING_ARC", type: "TIMING_FACTOR", purpose: "HIDDEN_FACTOR_EXPLORATION", origin: "SYSTEM_PROPOSED", title: "Refinancing and milestone timing", description: "Debt refinancing, contract renewals, regulatory deadlines, or product milestones may interact with incentives and valuation.", objectiveLink: "Return probability and holding-period timing", assumption: "Financing and milestone calendars do not materially constrain the thesis.", evidenceNeeded: ["Debt maturity schedule", "contract calendar", "regulatory and product milestones"], impact: "Timing evidence may amplify risk or open a more favorable entry pathway.", dimensions: ["TIMING", "PROBABILITY", "VALUE"] })],
    relationships: [{ id: "incentive-timing-interlock", relationshipType: "AMPLIFIES_RISK", arcIds: ["management-incentives", "refinancing-milestone", "nominated-company"], rationale: "Incentive dates and corporate deadlines may interact, but causation requires evidence.", evidenceReferences: [] }],
    hunches: [],
    notes: ["No incentive is assumed to cause future performance."],
  };
  return createRangeCard(card);
}
