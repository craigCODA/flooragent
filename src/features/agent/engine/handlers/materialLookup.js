import { extractFreeTextQuery, scoreTextMatch } from "../queryText";

export function handleMaterialLookup(ctx) {
  const { entities, binState, rawInput } = ctx;

  if (!binState || Object.keys(binState).length === 0) {
    return { type: "error", text: "No SAP data loaded. Load an export first." };
  }

  let query = entities.materials[0] || "";
  if (!query) {
    const match = rawInput.match(/\d{5,18}/);
    if (match) query = match[0];
  }
  if (!query) {
    query = extractFreeTextQuery(rawInput);
  }
  if (!query) {
    return { type: "info", text: "Which material? Try **\"Where is material 12345?\"** or describe it in plain language." };
  }

  const results = [];
  for (const [binId, entry] of Object.entries(binState)) {
    for (const [matId, qty] of Object.entries(entry.byMaterialQty || {})) {
      if (matId === query || matId.startsWith(query)) {
        results.push({
          Bin: binId,
          Material: matId,
          Description: (entry.descByMaterial?.[matId] || "").slice(0, 30),
          PAL: qty,
        });
      }
    }
  }

  if (results.length === 0) {
    const q = query.toLowerCase();
    for (const [binId, entry] of Object.entries(binState)) {
      for (const [matId] of Object.entries(entry.byMaterialQty || {})) {
        const desc = entry.descByMaterial?.[matId] || "";
        const score = scoreTextMatch(q, `${matId} ${desc}`);
        if (score > 0) {
          results.push({
            Bin: binId,
            Material: matId,
            Description: desc.slice(0, 30),
            PAL: entry.byMaterialQty[matId],
            _score: score,
          });
        }
      }
    }
  }

  if (results.length === 0) {
    return { type: "info", text: `Material **${query}** not found in any bin.` };
  }

  results.sort((a, b) => (b._score || 0) - (a._score || 0) || b.PAL - a.PAL);
  const totalQty = results.reduce((s, r) => s + r.PAL, 0);
  const display = results.slice(0, 15).map(({ _score, ...row }) => row);

  return {
    type: "table",
    text: `Material **${query}** found in **${results.length}** bin${results.length !== 1 ? "s" : ""} (${totalQty} PAL total)${results.length > 15 ? " — showing top 15" : ""}`,
    table: { headers: ["Bin", "Material", "Description", "PAL"], rows: display },
  };
}
