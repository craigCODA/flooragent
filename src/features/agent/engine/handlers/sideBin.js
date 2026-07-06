import { parseBin } from "../../../../domain/bin";
import { SIDE_BINS, baseCapacity } from "../../../../domain/capacity";

// Side bin positions per row for fallback display (no data loaded)
const ROW_SIDE_POSITIONS = {
  A:  ["A07","A13","A19","A25","A31","A37","A43"],
  B:  ["BS6","B09","B15","B21","B27","B33","B39","B42"],
  C:  ["C07","C13","C19","C25","C31","C37","C43"],
  D:  ["D07","D13","D19","D25","D31","D37"],
  E:  ["E07","E13","E19","E25","E31","E37"],
  F:  ["F07","F13","F19","F25","F31","F37","F43"],
  G:  ["G07","G13","G19","G25","G31","G37","G43"],
  H:  ["HM03","H09","H15","H21","H27","H33","H39"],
  HH: ["HM03","HH09","HH15","HH21","HH27","HH33","HH39"],
  I:  ["I07","I13","I19","I25","I31","I37","I43"],
  II: ["II07","II13","II19","II25","II31","II37","II43"],
};

export function handleSideBin(ctx) {
  const { entities, binState, emptyBinsFromExport } = ctx;

  const targetRow = entities.rows[0] || (entities.bins[0] ? parseBin(entities.bins[0]).rowKey : null);

  if (!targetRow) {
    return {
      type: "list",
      text: "Side bins have reduced capacity and are never used as consolidation targets.",
      items: [
        "Most rows: positions **07, 13, 19, 25, 31, 37, 43**",
        "B row: positions **BS6, 09, 15, 21, 27, 33, 39**, plus special-case **B42**",
        "H / HH tunnel: **HM03** is the shared side-bin slot, then **09, 15, 21, 27, 33, 39**",
        "Specify a row to see details, e.g. **\"side bins in row B\"**",
      ],
    };
  }

  if (targetRow === "J") {
    return { type: "text", text: "**Row J** has no side bins — all bins are **19** PAL." };
  }

  // Find side bins in the target row from SIDE_BINS
  const allBinIds = new Set([
    ...Object.keys(binState || {}),
    ...Array.from(emptyBinsFromExport || []),
  ]);

  const sideBins = [];
  for (const id of allBinIds) {
    const { rowKey } = parseBin(id);
    const inRequestedRow =
      rowKey === targetRow ||
      (id === "HM03" && (targetRow === "H" || targetRow === "HH"));
    if (!inRequestedRow) continue;
    if (SIDE_BINS.has(id)) {
      const used = binState?.[id]?.totalQty || 0;
      const cap = baseCapacity(id);
      sideBins.push({ bin: id, used, cap });
    }
  }

  if (sideBins.length === 0) {
    const fallback = ROW_SIDE_POSITIONS[targetRow];
    if (!fallback) {
      return { type: "info", text: `No side bin data for row **${targetRow}**.` };
    }
    const items = fallback.map((b) => `**${b}** — ${baseCapacity(b)} PAL`);
    return {
      type: "list",
      text: `Side bins in row **${targetRow}** (no data loaded):`,
      items,
    };
  }

  const preferredOrder = ROW_SIDE_POSITIONS[targetRow] || [];
  sideBins.sort((a, b) => {
    const aIndex = preferredOrder.indexOf(a.bin);
    const bIndex = preferredOrder.indexOf(b.bin);
    if (aIndex !== -1 || bIndex !== -1) {
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      return aIndex - bIndex;
    }
    return a.bin.localeCompare(b.bin);
  });
  const items = sideBins.map((sb) =>
    `**${sb.bin}** — cap ${sb.cap} PAL, ${sb.used > 0 ? `${sb.used} PAL used` : "empty"}`
  );

  return {
    type: "list",
    text: `**${sideBins.length}** side bins in row **${targetRow}**:`,
    items,
  };
}
