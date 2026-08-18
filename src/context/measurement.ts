import type { MeasurementStatement } from "./types.js";

export const loadedInterpretationTerms = Object.freeze([
  "rare", "very rare", "common", "bad", "good", "great deal", "bargain", "money pit", "safe", "unsafe", "guaranteed", "excellent investment",
] as const);

function containsLoadedTerm(value: string): string | undefined {
  const normalized = value.toLowerCase();
  return [...loadedInterpretationTerms].sort((a, b) => b.length - a.length).find((term) => new RegExp(`\\b${term.replace(/ /g, "\\s+")}\\b`, "i").test(normalized));
}

export function validateMeasurementStatement(statement: MeasurementStatement): readonly string[] {
  const errors: string[] = [];
  if (!statement.id.trim() || !statement.metricName.trim() || !statement.unit.trim()) errors.push("Measurement id, metricName, and unit are required.");
  if (statement.range && statement.range.minimum > statement.range.maximum) errors.push("Measurement range minimum cannot exceed maximum.");
  if (statement.confidence !== undefined && (statement.confidence < 0 || statement.confidence > 1)) errors.push("Measurement confidence must be between 0 and 1.");
  if (statement.interpretationStatus === "NONE" && statement.interpretation !== undefined) errors.push("Interpretation must be omitted when interpretationStatus is NONE.");
  if (statement.interpretationStatus !== "NONE" && !statement.interpretation?.trim()) errors.push("A non-NONE interpretation status requires interpretation text.");
  if (statement.interpretationStatus === "SYSTEM_DEFINED_WITH_RULE" && !statement.interpretationRuleId?.trim()) errors.push("A system-defined interpretation requires an explicit rule id.");
  const loaded = statement.interpretation ? containsLoadedTerm(statement.interpretation) : undefined;
  if (loaded && (!statement.interpretationDefinition?.trim() || !statement.uncertaintyStatement?.trim() || !statement.domain?.trim())) {
    errors.push(`Loaded term '${loaded}' requires a definition, uncertainty statement, and domain.`);
  }
  return errors;
}

export function createMeasurementStatement(input: MeasurementStatement): MeasurementStatement {
  const statement = structuredClone(input);
  const errors = validateMeasurementStatement(statement);
  if (errors.length) throw new TypeError(`Invalid measurement statement:\n${errors.join("\n")}`);
  return statement;
}

export function renderMeasurement(statementInput: MeasurementStatement): string {
  const statement = createMeasurementStatement(statementInput);
  const range = statement.range ? ` (range: ${statement.range.minimum}–${statement.range.maximum} ${statement.unit})` : "";
  const confidence = statement.confidence === undefined ? "" : `; confidence: ${(statement.confidence * 100).toFixed(1)}%`;
  const timestamp = statement.timestamp ? `; measured at: ${statement.timestamp}` : "";
  const interpretation = statement.interpretation ? `; defined interpretation: ${statement.interpretation}` : "";
  return `${statement.metricName}: ${String(statement.value)} ${statement.unit}${range}${confidence}${timestamp}${interpretation}`;
}
