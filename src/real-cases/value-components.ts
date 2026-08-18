import type { RealCaseValidationResult, RealResolvedCase } from "./types.js";
import { validateRealResolvedCase } from "./validate.js";

export type ValueType = "FINANCIAL" | "UTILITY" | "RISK_REDUCTION" | "TRANSACTION" | "OPTIONALITY" | "OTHER";
export type MonetaryValueStatus = "KNOWN" | "ESTIMATED" | "UNKNOWN" | "NOT_APPLICABLE";

export interface ValueComponent {
  id: string;
  description: string;
  valueType: ValueType;
  stageIntroduced: string | "RESOLUTION";
  monetaryValue?: { amount: number; currency: string };
  monetaryValueStatus: MonetaryValueStatus;
  sourceId: string;
  provenance: string;
  notes?: string;
}

export type RealResolvedCaseWithValueComponents = RealResolvedCase & {
  valueComponents: readonly ValueComponent[];
};

type RecordValue = Record<string, unknown>;
const isRecord = (value: unknown): value is RecordValue => typeof value === "object" && value !== null && !Array.isArray(value);
const nonEmpty = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
const valueTypes = new Set<ValueType>(["FINANCIAL", "UTILITY", "RISK_REDUCTION", "TRANSACTION", "OPTIONALITY", "OTHER"]);
const moneyStatuses = new Set<MonetaryValueStatus>(["KNOWN", "ESTIMATED", "UNKNOWN", "NOT_APPLICABLE"]);

export function validateValueComponents(value: unknown): RealCaseValidationResult {
  const errors: string[] = [];
  if (!isRecord(value) || !Array.isArray(value.valueComponents)) return { valid: false, errors: ["valueComponents must be an array."] };
  const sources = new Set<string>();
  if (isRecord(value.caseSource) && nonEmpty(value.caseSource.sourceId)) sources.add(value.caseSource.sourceId);
  if (Array.isArray(value.verificationSources)) for (const source of value.verificationSources) if (isRecord(source) && nonEmpty(source.sourceId)) sources.add(source.sourceId);
  const stages = new Set(Array.isArray(value.chronologicalStages)
    ? value.chronologicalStages.flatMap((stage) => isRecord(stage) && nonEmpty(stage.stageId) ? [stage.stageId] : [])
    : []);
  const ids = new Set<string>();
  for (const [index, component] of value.valueComponents.entries()) {
    const path = `valueComponents[${index}]`;
    if (!isRecord(component)) { errors.push(`${path} must be an object.`); continue; }
    if (!nonEmpty(component.id)) errors.push(`${path}.id is required.`);
    else if (ids.has(component.id)) errors.push(`Duplicate value component ID: ${component.id}.`);
    else ids.add(component.id);
    if (!nonEmpty(component.description)) errors.push(`${path}.description is required.`);
    if (!valueTypes.has(component.valueType as ValueType)) errors.push(`${path}.valueType is invalid.`);
    if (component.stageIntroduced !== "RESOLUTION" && !stages.has(String(component.stageIntroduced))) errors.push(`${path}.stageIntroduced must reference a stage or RESOLUTION.`);
    if (!moneyStatuses.has(component.monetaryValueStatus as MonetaryValueStatus)) errors.push(`${path}.monetaryValueStatus is invalid.`);
    if (!nonEmpty(component.sourceId) || !sources.has(component.sourceId)) errors.push(`${path} references an unknown source.`);
    if (!nonEmpty(component.provenance)) errors.push(`${path}.provenance is required.`);
    if (component.monetaryValue !== undefined) {
      if (!isRecord(component.monetaryValue) || typeof component.monetaryValue.amount !== "number" || !Number.isFinite(component.monetaryValue.amount) || component.monetaryValue.amount < 0 || !nonEmpty(component.monetaryValue.currency)) errors.push(`${path}.monetaryValue is invalid.`);
      if (component.monetaryValueStatus !== "KNOWN" && component.monetaryValueStatus !== "ESTIMATED") errors.push(`${path}.monetaryValue requires KNOWN or ESTIMATED status.`);
    } else if (component.monetaryValueStatus === "KNOWN" || component.monetaryValueStatus === "ESTIMATED") errors.push(`${path} requires monetaryValue for KNOWN or ESTIMATED status.`);
  }
  return { valid: errors.length === 0, errors };
}

export function validateRealCaseWithValueComponents(value: unknown): RealCaseValidationResult {
  const base = validateRealResolvedCase(value);
  const components = validateValueComponents(value);
  return { valid: base.valid && components.valid, errors: [...base.errors, ...components.errors] };
}
