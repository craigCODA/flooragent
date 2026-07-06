import { parseBin } from "../../../../domain/bin";
import { effectiveCapacity } from "../../../../domain/capacity";

export function handleRowInfo(ctx) {
  const { entities, binState, capOverrides, emptyBinsFromExport } = ctx;

  const targetRow = entities.rows[0] || (entities.bins[0] ? parseBin(entities.bins[0]).rowKey : null);
  if (!targetRow) {
    return { type: "info", text: "Which row? Try **\"Show me row F stats\"**" };
  }

  if (!binState || Object.keys(binState).length === 0) {
    return { type: "error", text: "No SAP data loaded. Load an export first." };
  }

  const allBinIds = new Set([
    ...Object.keys(binState),
    ...Array.from(emptyBinsFromExport || []),
  ]);

  let totalCap = 0, totalUsed = 0, binCount = 0, emptyCount = 0;
  const materialSet = new Set();
  const binDetails = [];

  for (const id of allBinIds) {
    const { rowKey } = parseBin(id);
    if (rowKey !== targetRow) continue;
    binCount++;
    const cap = effectiveCapacity(id, binState, capOverrides || {});
    const entry = binState[id];
    const used = entry?.totalQty || 0;
    totalCap += cap;
    totalUsed += used;
    if (used === 0) emptyCount++;
    if (entry?.materials) {
      for (const m of entry.materials) materialSet.add(m);
    }
    binDetails.push({ bin: id, used, cap, free: Math.max(0, cap - used) });
  }

  if (binCount === 0) {
    return { type: "info", text: `No bins found in row **${targetRow}**.` };
  }

  const totalFree = Math.max(0, totalCap - totalUsed);
  const pctUsed = totalCap > 0 ? Math.round((totalUsed / totalCap) * 100) : 0;

  binDetails.sort((a, b) => b.used - a.used);
  const topBins = binDetails.slice(0, 5).map((b) => ({
    Bin: b.bin,
    Used: `${b.used} PAL`,
    Free: `${b.free} PAL`,
    Cap: b.cap,
  }));

  return {
    type: "table",
    text: `**Row ${targetRow}** — ${binCount} bins, ${emptyCount} empty | ${totalUsed} / ${totalCap} PAL (${pctUsed}% used) | ${materialSet.size} unique materials`,
    table: { headers: ["Bin", "Used", "Free", "Cap"], rows: topBins },
  };
}
