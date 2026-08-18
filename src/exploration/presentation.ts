import type { ExplorationArc, RangeCardResult } from "./types.js";

export type RangeCardPresentationMode = "CONDENSED" | "BALANCED" | "AUDIT";
export interface CondensedRangeCardView { mode: "CONDENSED"; materialDisclosures: readonly { arcId: string; changes: readonly string[]; summary: string }[]; }
export interface BalancedRangeCardView { mode: "BALANCED"; mainArc: ExplorationArc; leftArc: ExplorationArc; rightArc: ExplorationArc; interlockingFactors: readonly ExplorationArc[]; relationships: RangeCardResult["rangeCard"]["relationships"]; }
export interface AuditRangeCardView { mode: "AUDIT"; result: RangeCardResult; }
export type RangeCardPresentation = CondensedRangeCardView | BalancedRangeCardView | AuditRangeCardView;

export function presentRangeCard(input: RangeCardResult, mode: RangeCardPresentationMode): RangeCardPresentation {
  const result = structuredClone(input);
  if (mode === "AUDIT") return { mode, result };
  const card = result.rangeCard;
  if (mode === "BALANCED") return { mode, mainArc: card.mainArc, leftArc: card.leftArc, rightArc: card.rightArc, interlockingFactors: card.interlockingArcs, relationships: card.relationships };
  const arcs = [card.leftArc, card.rightArc, ...card.interlockingArcs];
  return {
    mode,
    materialDisclosures: arcs.flatMap((arc) => arc.condensedDisclosure
      ? [{ arcId: arc.id, changes: [...arc.condensedDisclosure.changes], summary: arc.condensedDisclosure.summary }]
      : []),
  };
}
