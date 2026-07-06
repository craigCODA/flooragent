import { analyzeMaterialScatter, DRIVE_AISLES } from "../../../../domain/proximity";
import { resolveMaterial } from "./materialResolver";

export function handleScatterAnalysis(ctx) {
  const { entities, binState, rawInput } = ctx;

  if (!binState || Object.keys(binState).length === 0) {
    return { type: "error", text: "No SAP data loaded. Load an export first." };
  }

  const resolved = resolveMaterial(entities, rawInput, binState);
  if (!resolved.id && resolved.ambiguous) {
    const list = resolved.ambiguous.map((m) => `**${m.materialId}** — ${m.desc}`);
    return {
      type: "list",
      text: "Multiple materials match. Which one did you mean?",
      items: list,
    };
  }
  if (!resolved.id) {
    return { type: "info", text: "Which material? Try **\"How scattered is 12345?\"** or use a description like **\"scatter analysis for blue caps\"**." };
  }
  const materialId = resolved.id;

  const scatter = analyzeMaterialScatter(materialId, binState);

  if (scatter.binCount === 0) {
    return { type: "info", text: `Material **${materialId}** not found in any bin.` };
  }

  const aisleCount = Object.keys(scatter.byAisle).length;
  const rows = [];

  for (const [aisleStr, data] of Object.entries(scatter.byAisle)) {
    const aisle = DRIVE_AISLES[aisleStr];
    const aisleLabel = aisle ? `${aisle.left}/${aisle.right}` : aisleStr;
    rows.push({
      Aisle: `${aisleStr} (${aisleLabel})`,
      Bins: data.binCount,
      PAL: Number(data.pal.toFixed(1)),
      "Bin List": data.bins.map((b) => b.binId).join(", "),
    });
  }

  rows.sort((a, b) => b.PAL - a.PAL);

  const desc = scatter.materialDesc ? ` — ${scatter.materialDesc}` : "";
  const scatterLevel =
    aisleCount === 1 ? "concentrated (1 aisle)" :
    aisleCount === 2 ? "moderately spread (2 aisles)" :
    `scattered across ${aisleCount} aisles`;

  const recText = scatter.recommendation
    ? `\n${scatter.recommendation.reason}.`
    : "";

  return {
    type: "table",
    highlight: "Scatter Analysis",
    text: `Material **${materialId}**${desc}\n**${scatter.totalPAL.toFixed(1)}** PAL in **${scatter.binCount}** bins — ${scatterLevel}.${recText}`,
    table: {
      headers: ["Aisle", "Bins", "PAL", "Bin List"],
      rows,
    },
  };
}
