import { parseBin } from "../../../../domain/bin";
import { SIDE_BINS, effectiveCapacity } from "../../../../domain/capacity";

export function handleCapacityQuery(ctx) {
  const { entities, binState, capOverrides, emptyBinsFromExport } = ctx;

  if (entities.bins.length > 0) {
    const binId = entities.bins[0];
    const effCap = effectiveCapacity(binId, binState || {}, capOverrides || {});
    const used = binState?.[binId]?.totalQty || 0;
    const free = Math.max(0, effCap - used);
    return {
      type: "text",
      text: `**${binId}**: ${free} PAL free out of ${effCap} total capacity (${used} PAL used)`,
      highlight: binId,
    };
  }

  const targetRow = entities.rows[0];
  if (!targetRow) {
    return { type: "info", text: "Which row or bin? Try **\"How much space in row D?\"**" };
  }

  if (!binState || Object.keys(binState).length === 0) {
    return { type: "error", text: "No SAP data loaded. Load an export first." };
  }

  const allBinIds = new Set([
    ...Object.keys(binState),
    ...Array.from(emptyBinsFromExport || []),
  ]);

  let totalCap = 0;
  let totalUsed = 0;
  let binCount = 0;
  let sideBinCount = 0;

  for (const id of allBinIds) {
    const { rowKey } = parseBin(id);
    if (rowKey !== targetRow) continue;
    binCount++;
    if (SIDE_BINS.has(id)) sideBinCount++;
    const cap = effectiveCapacity(id, binState, capOverrides || {});
    const used = binState[id]?.totalQty || 0;
    totalCap += cap;
    totalUsed += used;
  }

  if (binCount === 0) {
    return { type: "info", text: `No bins found in row **${targetRow}** in the current data.` };
  }

  const totalFree = Math.max(0, totalCap - totalUsed);
  const pctUsed = totalCap > 0 ? Math.round((totalUsed / totalCap) * 100) : 0;

  return {
    type: "list",
    text: `**Row ${targetRow}** capacity summary:`,
    items: [
      `**${binCount}** bins (${sideBinCount} side bins)`,
      `Total capacity: **${totalCap}** PAL`,
      `Used: **${totalUsed}** PAL (${pctUsed}%)`,
      `Free: **${totalFree}** PAL`,
    ],
  };
}
