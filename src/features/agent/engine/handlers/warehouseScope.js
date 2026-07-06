import { getWarehouse } from "../../../../domain/bin";

export function handleWarehouseScope(ctx) {
  const { entities, binState, emptyBinsFromExport } = ctx;

  const targetWH = entities.warehouse || ctx.warehouse || "WH1";

  if (!binState || Object.keys(binState).length === 0) {
    return {
      type: "list",
      text: `Warehouse scope rules for **${targetWH}**:`,
      items: [
        "**WH1**: bins A-J (excluding any with 'R')",
        "**WH2**: bins containing 'R' + bins starting with '2A'",
        "**WH3**: bins starting with '3'",
        "**ALL**: everything",
        "",
        "Load a SAP export to see bin counts and details.",
      ],
    };
  }

  const allBinIds = new Set([
    ...Object.keys(binState),
    ...Array.from(emptyBinsFromExport || []),
  ]);

  let count = 0;
  let usedPAL = 0;
  let emptyCount = 0;
  const rowCounts = {};

  for (const id of allBinIds) {
    if (getWarehouse(id) !== targetWH && targetWH !== "ALL") continue;
    count++;
    const used = binState[id]?.totalQty || 0;
    usedPAL += used;
    if (used === 0) emptyCount++;
    const row = id.startsWith("HH") ? "HH" : id.startsWith("II") ? "II" : id[0];
    rowCounts[row] = (rowCounts[row] || 0) + 1;
  }

  if (count === 0) {
    return { type: "info", text: `No bins found for **${targetWH}** in the loaded data.` };
  }

  const rowSummary = Object.entries(rowCounts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([row, cnt]) => `Row ${row}: ${cnt}`);

  return {
    type: "list",
    text: `**${targetWH}** — ${count} bins (${emptyCount} empty, ${usedPAL} PAL total):`,
    items: rowSummary,
  };
}
