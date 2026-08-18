import type { DecisionCase } from "../domain.js";
import { buildAuditData, presentDecision } from "../presentation/present.js";
import type { AuditData, PresentationContext, PresentationPreference, PresentationResult } from "../presentation/types.js";
import {
  PRESENTATION_SCHEMA_VERSION,
  type AuditContract,
  type BalancedContract,
  type CondensedContract,
  type ContractExpansion,
  type JsonObject,
  type JsonValue,
  type PresentationContract,
} from "./types.js";

function toJsonValue(value: unknown, path = "$", omitUndefined = false): JsonValue | undefined {
  if (value === undefined) {
    if (omitUndefined) return undefined;
    throw new TypeError(`${path} contains undefined.`);
  }
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError(`${path} contains a non-finite number.`);
    return value;
  }
  if (typeof value === "function" || typeof value === "symbol" || typeof value === "bigint") {
    throw new TypeError(`${path} is not JSON-safe.`);
  }
  if (Array.isArray(value)) {
    return value.map((item, index) => toJsonValue(item, `${path}[${index}]`) as JsonValue);
  }
  if (typeof value === "object") {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) throw new TypeError(`${path} contains a class or special object.`);
    const output: JsonObject = {};
    for (const [key, item] of Object.entries(value)) {
      const converted = toJsonValue(item, `${path}.${key}`, true);
      if (converted !== undefined) output[key] = converted;
    }
    return output;
  }
  throw new TypeError(`${path} is not JSON-safe.`);
}

function jsonObject(value: unknown): JsonObject {
  const converted = toJsonValue(value);
  if (!converted || Array.isArray(converted) || typeof converted !== "object") throw new TypeError("Expected a JSON object.");
  return converted;
}

function expansions(result: PresentationResult): ContractExpansion[] {
  return result.expandableSections.filter((section) => section.available).map((section) => ({
    id: section.id,
    label: section.label,
    targetMode: section.opensMode,
  }));
}

function condensedContract(result: PresentationResult): CondensedContract {
  if (result.view.mode !== "CONDENSED") throw new TypeError("Expected a CONDENSED presentation result.");
  return {
    schemaVersion: PRESENTATION_SCHEMA_VERSION,
    mode: "CONDENSED",
    conclusion: { ...result.view.conclusion },
    confidence: result.view.confidence,
    mainReason: result.view.mainReason,
    mainRiskOrUncertainty: result.view.mainRiskOrUncertainty,
    nextActionOrTrigger: result.view.nextActionOrTrigger,
    availableExpansions: expansions(result),
  };
}

function balancedContract(result: PresentationResult, audit: AuditData): BalancedContract {
  if (result.view.mode !== "BALANCED") throw new TypeError("Expected a BALANCED presentation result.");
  const evidenceById = new Map(audit.evidence.map((evidence) => [evidence.id, evidence]));
  return {
    schemaVersion: PRESENTATION_SCHEMA_VERSION,
    mode: "BALANCED",
    conclusion: { ...result.view.conclusion },
    confidence: result.view.confidence,
    strongestEvidenceDrivers: result.view.strongestEvidenceAndDrivers.map((driver) => {
      const evidence = evidenceById.get(driver.id);
      return {
        id: driver.id,
        statement: driver.statement,
        sourceId: evidence?.sourceId ?? "",
        provenance: evidence?.provenance ?? "",
      };
    }),
    highValueUnknowns: result.view.highValueUnknowns.map((unknown) => ({
      id: unknown.id,
      question: unknown.question,
      status: unknown.status,
      informationValueScore: unknown.informationValueScore,
    })),
    hypotheses: result.view.competingHypotheses.map((hypothesis) => ({ ...hypothesis })),
    contradictions: audit.contradictions.map((evidence) => ({
      evidenceId: evidence.id,
      statement: evidence.statement,
      sourceId: evidence.sourceId,
    })),
    reassessment: {
      majorUncertainty: result.view.majorUncertainty,
      nextActionOrTrigger: result.view.nextActionOrTrigger,
      triggers: [...audit.conclusion.reassessmentTriggers],
    },
    availableExpansions: expansions(result),
  };
}

function auditContract(result: PresentationResult): AuditContract {
  if (result.view.mode !== "AUDIT") throw new TypeError("Expected an AUDIT presentation result.");
  const { mode: _mode, ...audit } = result.view;
  return {
    schemaVersion: PRESENTATION_SCHEMA_VERSION,
    mode: "AUDIT",
    availableExpansions: expansions(result),
    ...jsonObject(audit),
  } as AuditContract;
}

export function serializePresentationResult(result: PresentationResult, auditData?: AuditData): PresentationContract {
  const contract = result.view.mode === "CONDENSED"
    ? condensedContract(result)
    : result.view.mode === "BALANCED"
      ? balancedContract(result, auditData ?? (() => { throw new TypeError("BALANCED serialization requires audit data for traceability."); })())
      : auditContract(result);
  return jsonObject(contract) as PresentationContract;
}

export function serializeDecisionPresentation(
  decisionCase: DecisionCase,
  preference: PresentationPreference,
  context: PresentationContext = {},
): PresentationContract {
  const result = presentDecision(decisionCase, preference, context);
  const audit = result.view.mode === "BALANCED" ? buildAuditData(decisionCase, context) : undefined;
  return serializePresentationResult(result, audit);
}
