import { extractFreeTextQuery, scoreTextMatch } from "../queryText";

/**
 * Resolve a material ID from entities, raw input, and bin state.
 * Tries: exact entity match → numeric regex → description fuzzy match.
 *
 * Returns: { id: string } on unique match,
 *          { id: "", ambiguous: [...] } when multiple close candidates exist,
 *          { id: "" } when nothing matched.
 */
export function resolveMaterial(entities, rawInput, binState) {
  // 1. Extracted entity (numeric material ID already parsed)
  if (entities.materials.length > 0) {
    return { id: entities.materials[0] };
  }

  // 2. Numeric regex fallback
  const numMatch = rawInput.match(/\d{5,18}/);
  if (numMatch) {
    return { id: numMatch[0] };
  }

  // 3. Free-text query against material IDs and descriptions
  const query = extractFreeTextQuery(rawInput);
  if (!query) return { id: "" };

  const scored = new Map(); // matId → { score, desc }

  for (const [, entry] of Object.entries(binState)) {
    for (const matId of Object.keys(entry.byMaterialQty || {})) {
      if ((entry.byMaterialQty[matId] || 0) <= 0) continue;
      if (scored.has(matId)) continue;
      const desc = entry.descByMaterial?.[matId] || "";
      const candidate = `${matId} ${desc}`;
      const score = scoreTextMatch(query, candidate);
      if (score >= 8) {
        scored.set(matId, { score, desc });
      }
    }
  }

  if (scored.size === 0) return { id: "" };

  // Sort by score descending
  const sorted = Array.from(scored.entries())
    .sort((a, b) => b[1].score - a[1].score);

  const best = sorted[0];

  // If the top match is clearly ahead (>= 20 points gap or only one match), return it
  if (sorted.length === 1 || best[1].score - sorted[1][1].score >= 20) {
    return { id: best[0] };
  }

  // Multiple close matches — return disambiguation list (top 5)
  const ambiguous = sorted.slice(0, 5).map(([matId, { desc }]) => ({
    materialId: matId,
    desc: desc.slice(0, 40),
  }));

  return { id: "", ambiguous };
}
