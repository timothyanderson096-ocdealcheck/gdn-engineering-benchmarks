import type { StartingEvidenceField, StartingEvidenceItem } from "./types.js";

function validateItem(item: StartingEvidenceItem): void {
  if (!item.id.trim() || !item.description.trim() || !item.sourceReference.trim() || !item.provenance.trim()) throw new TypeError("Starting evidence requires id, description, source reference, and provenance.");
  if (item.confidence !== undefined && (item.confidence < 0 || item.confidence > 1)) throw new TypeError("Starting-evidence confidence must be between 0 and 1.");
  if (item.originType === "APP_OUTPUT" && item.evidenceCharacter === "EXTERNALLY_VERIFIED") throw new TypeError("APP_OUTPUT is not externally verified merely because an app displayed it.");
  if (item.originType === "LISTING" && item.evidenceCharacter === "EXTERNALLY_VERIFIED") throw new TypeError("A listing claim is not externally verified merely because it was published.");
}

export function createStartingEvidenceField(input: StartingEvidenceField): StartingEvidenceField {
  const field = structuredClone(input);
  field.items.forEach(validateItem);
  if (new Set(field.items.map((item) => item.id)).size !== field.items.length) throw new TypeError("Starting-evidence ids must be unique.");
  return field;
}
