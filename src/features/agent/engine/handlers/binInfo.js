import { parseBin } from "../../../../domain/bin";
import { SIDE_BINS, baseCapacity, effectiveCapacity } from "../../../../domain/capacity";

export function handleBinInfo(ctx) {
  const { entities, binState, capOverrides } = ctx;
  const binId = entities.bins[0];
  if (!binId) {
    return { type: "info", text: "Which bin? Try something like **\"What's in D15?\"**" };
  }

  const { rowKey } = parseBin(binId);
  const isSide = SIDE_BINS.has(binId);
  const baseCap = baseCapacity(binId, binState || {});
  const effCap = effectiveCapacity(binId, binState || {}, capOverrides || {});
  const entry = binState?.[binId];

  if (!entry || entry.totalQty === 0) {
    return {
      type: "info",
      text: `**${binId}** is empty.`,
      highlight: binId,
      items: [
        `Row **${rowKey}**${isSide ? " (side bin)" : ""}`,
        `Base capacity: **${baseCap}** PAL`,
        effCap !== baseCap ? `Effective capacity: **${effCap}** PAL (override)` : null,
      ].filter(Boolean),
    };
  }

  const materials = Object.entries(entry.byMaterialQty || {});
  const used = entry.totalQty;
  const free = Math.max(0, effCap - used);

  const rows = materials.map(([matId, qty]) => ({
    Material: matId,
    Description: (entry.descByMaterial?.[matId] || "").slice(0, 30),
    PAL: qty,
  }));

  return {
    type: "table",
    text: `**${binId}** — Row ${rowKey}${isSide ? " (side bin)" : ""} | ${used} PAL used, ${free} PAL free (cap ${effCap})`,
    highlight: binId,
    table: { headers: ["Material", "Description", "PAL"], rows },
  };
}
