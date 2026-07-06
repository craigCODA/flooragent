import { parseBin } from "../../../../domain/bin";
import { effectiveCapacity } from "../../../../domain/capacity";

// Rows that share a physical tunnel
const PAIRS = {
  B: "C", C: "B", D: "E", E: "D",
  F: "G", G: "F", H: "HH", HH: "H",
  I: "II", II: "I",
};

export function handleTunnelPair(ctx) {
  const { entities, binState, capOverrides, emptyBinsFromExport } = ctx;

  let row1 = entities.rows[0] || null;
  let row2 = entities.rows[1] || null;

  if (row1 && !row2) row2 = PAIRS[row1] || null;
  if (!row1 && entities.bins.length > 0) {
    const { rowKey } = parseBin(entities.bins[0]);
    row1 = rowKey;
    row2 = PAIRS[rowKey] || null;
  }

  if (!row1) {
    return {
      type: "list",
      text: "Which tunnel pair? Available paired rows:",
      items: [
        "**B / C** — shared tunnel",
        "**D / E** — shared tunnel",
        "**F / G** — shared tunnel",
        "**I / II** — shared tunnel",
        "**H / HH** — shared tunnel",
        "**A** — standalone",
        "**J** — standalone",
      ],
    };
  }

  if (!row2 || row1 === row2) {
    if (row1 === "A") return { type: "text", text: "**Row A** is standalone — no tunnel partner.\nStandard bins: **43** PAL | Side bins: **14** PAL" };
    if (row1 === "J") return { type: "text", text: "**Row J** is standalone — no tunnel partner.\nAll bins: **19** PAL" };
    return { type: "info", text: `Row **${row1}** has no known tunnel partner.` };
  }

  if (binState && Object.keys(binState).length > 0) {
    const allBinIds = new Set([
      ...Object.keys(binState),
      ...Array.from(emptyBinsFromExport || []),
    ]);

    let used1 = 0, used2 = 0, cap1 = 0, cap2 = 0, bins1 = 0, bins2 = 0;
    for (const id of allBinIds) {
      const { rowKey } = parseBin(id);
      const cap = effectiveCapacity(id, binState, capOverrides || {});
      const used = binState[id]?.totalQty || 0;
      if (rowKey === row1) { used1 += used; cap1 += cap; bins1++; }
      if (rowKey === row2) { used2 += used; cap2 += cap; bins2++; }
    }

    return {
      type: "list",
      text: `**${row1} / ${row2} Tunnel** (fixed capacities per bin)`,
      items: [
        `**${row1}**: ${bins1} bins — ${used1} PAL used, ${Math.max(0, cap1 - used1)} PAL free (total cap ${cap1})`,
        `**${row2}**: ${bins2} bins — ${used2} PAL used, ${Math.max(0, cap2 - used2)} PAL free (total cap ${cap2})`,
        `Combined used: **${used1 + used2}** PAL`,
      ],
    };
  }

  return {
    type: "list",
    text: `**${row1} / ${row2}** share a physical tunnel. Each bin has a fixed capacity.`,
    items: [
      "Load a SAP export to see live occupancy and free space.",
      "Capacities are fixed per bin — they do not change based on partner row occupancy.",
    ],
  };
}
