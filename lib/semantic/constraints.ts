export type SemanticMediaType = "movie" | "tv";

export type SemanticConstraintSlug =
  | "non_tragic_ending"
  | "happy_ending"
  | "no_protagonist_death"
  | "protagonist_death"
  | "no_animal_death"
  | "animal_death"
  | "plot_twist";

export interface SemanticConstraintDefinition {
  slug: SemanticConstraintSlug;
  label: string;
  description: string;
  attribute: string;
  expectedValue: boolean;
  aliases: readonly string[];
}

/**
 * Story-level conditions that cannot be proven by TMDB Genre alone. The
 * public slug is deliberately separate from the stored fact: for example,
 * `non_tragic_ending` is satisfied by the reusable fact
 * `tragic_ending=false`.
 */
export const SEMANTIC_CONSTRAINTS: readonly SemanticConstraintDefinition[] = [
  {
    slug: "non_tragic_ending",
    label: "ตอนจบไม่เศร้า",
    description: "ตอนจบไม่เน้นโศกนาฏกรรม ความตาย หรือความสูญเสียที่แก้ไขไม่ได้",
    attribute: "tragic_ending",
    expectedValue: false,
    aliases: [
      "ตอนจบไม่เศร้า",
      "จบไม่เศร้า",
      "ไม่จบเศร้า",
      "ตอนจบดี",
      "จบดี",
      "not sad ending",
      "non tragic ending",
    ],
  },
  {
    slug: "happy_ending",
    label: "จบอย่างมีความสุข",
    description: "ตอนจบเป็นบวกและตัวละครหลักลงเอยอย่างมีความสุข",
    attribute: "happy_ending",
    expectedValue: true,
    aliases: ["จบแฮปปี้", "แฮปปี้เอนดิ้ง", "จบอย่างมีความสุข", "happy ending"],
  },
  {
    slug: "no_protagonist_death",
    label: "ตัวเอกไม่ตาย",
    description: "ตัวละครเอกไม่เสียชีวิตในเนื้อเรื่อง",
    attribute: "protagonist_death",
    expectedValue: false,
    aliases: [
      "ตัวเอกไม่ตาย",
      "พระเอกไม่ตาย",
      "นางเอกไม่ตาย",
      "main character does not die",
      "protagonist survives",
    ],
  },
  {
    slug: "protagonist_death",
    label: "ตัวเอกเสียชีวิต",
    description: "ตัวละครเอกเสียชีวิตในเนื้อเรื่อง",
    attribute: "protagonist_death",
    expectedValue: true,
    aliases: ["ตัวเอกตาย", "พระเอกตาย", "นางเอกตาย", "protagonist dies"],
  },
  {
    slug: "no_animal_death",
    label: "ไม่มีสัตว์ตาย",
    description: "ไม่มีสัตว์สำคัญเสียชีวิตในเนื้อเรื่อง",
    attribute: "animal_death",
    expectedValue: false,
    aliases: [
      "สัตว์ไม่ตาย",
      "หมาไม่ตาย",
      "แมวไม่ตาย",
      "ไม่มีสัตว์ตาย",
      "no animal death",
      "does the dog die no",
    ],
  },
  {
    slug: "animal_death",
    label: "มีสัตว์เสียชีวิต",
    description: "มีสัตว์สำคัญเสียชีวิตในเนื้อเรื่อง",
    attribute: "animal_death",
    expectedValue: true,
    aliases: ["สัตว์ตาย", "หมาตาย", "แมวตาย", "animal dies"],
  },
  {
    slug: "plot_twist",
    label: "มีจุดหักมุม",
    description: "เนื้อเรื่องมีจุดหักมุมสำคัญ",
    attribute: "plot_twist",
    expectedValue: true,
    aliases: ["หักมุม", "จุดหักมุม", "พล็อตหักมุม", "plot twist", "twist ending"],
  },
] as const;

const DEFINITION_BY_SLUG = new Map(
  SEMANTIC_CONSTRAINTS.map((definition) => [definition.slug, definition]),
);

export interface SemanticCandidateInput {
  id: number;
  mediaType: SemanticMediaType;
  title: string;
  originalTitle: string;
  overview: string;
  releaseYear: string;
}

export interface SemanticAnalysisFact {
  attribute: string;
  value: boolean | null;
  confidence: number;
  source: string;
}

export interface SemanticCandidateAnalysis {
  id: number;
  facts: SemanticAnalysisFact[];
}

export type SemanticMatchDecision = "match" | "reject" | "unknown";

export function evaluateSemanticAttribute(
  attribute: string,
  facts: readonly SemanticAnalysisFact[],
  expectedValue = true,
  minimumConfidence = 0.55,
): SemanticMatchDecision {
  const fact = facts
    .filter(
      (candidate) =>
        candidate.attribute === attribute &&
        candidate.value !== null &&
        candidate.confidence >= minimumConfidence,
    )
    .sort((a, b) => b.confidence - a.confidence)[0];

  if (!fact || typeof fact.value !== "boolean") return "unknown";
  return fact.value === expectedValue ? "match" : "reject";
}

export function normalizeSemanticConstraints(raw: unknown): SemanticConstraintSlug[] {
  const values = Array.isArray(raw) ? raw : [raw];
  const normalized: SemanticConstraintSlug[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    const parts = typeof value === "string" ? value.split(",") : [];
    for (const part of parts) {
      const slug = part.trim() as SemanticConstraintSlug;
      if (!DEFINITION_BY_SLUG.has(slug) || seen.has(slug)) continue;
      seen.add(slug);
      normalized.push(slug);
    }
  }
  return normalized;
}

export function getSemanticConstraintDefinition(
  slug: SemanticConstraintSlug,
): SemanticConstraintDefinition {
  return DEFINITION_BY_SLUG.get(slug)!;
}

export function getSemanticConstraintTaxonomy() {
  return SEMANTIC_CONSTRAINTS.map(({ slug, label, description, aliases }) => ({
    slug,
    label,
    description,
    aliases,
  }));
}

export function getRequestedSemanticAttributes(
  constraints: readonly SemanticConstraintSlug[],
): string[] {
  return [
    ...new Set(
      constraints.map((constraint) => getSemanticConstraintDefinition(constraint).attribute),
    ),
  ];
}

/** Namespaces movie and TV IDs without requiring a database schema change. */
export function getSemanticStorageAttribute(
  mediaType: SemanticMediaType,
  attribute: string,
  candidate?: Pick<SemanticCandidateInput, "originalTitle" | "releaseYear">,
): string {
  if (!candidate) return `${mediaType}:${attribute}`;

  // Facts are also tied to a stable title/year fingerprint. This prevents
  // untrusted client input from poisoning the shared cache for a TMDB ID by
  // submitting a different title under that ID.
  const identity = `${candidate.originalTitle.normalize("NFKC").trim().toLowerCase()}|${candidate.releaseYear}`;
  let hash = 2_166_136_261;
  for (let index = 0; index < identity.length; index += 1) {
    hash ^= identity.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return `${mediaType}:${attribute}:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function evaluateSemanticConstraints(
  constraints: readonly SemanticConstraintSlug[],
  facts: readonly SemanticAnalysisFact[],
  minimumConfidence = 0.55,
): SemanticMatchDecision {
  let hasUnknown = false;

  for (const constraint of constraints) {
    const definition = getSemanticConstraintDefinition(constraint);
    const decision = evaluateSemanticAttribute(
      definition.attribute,
      facts,
      definition.expectedValue,
      minimumConfidence,
    );
    if (decision === "unknown") {
      hasUnknown = true;
      continue;
    }
    if (decision === "reject") return "reject";
  }

  return hasUnknown ? "unknown" : "match";
}
