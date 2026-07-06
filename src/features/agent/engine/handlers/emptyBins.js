import { normBin, parseBin } from "../../../../domain/bin";

export function handleEmptyBins(ctx) {
  const { emptyBinsFromExport, binState, stockRows } = ctx;

  if (!stockRows || stockRows.length === 0) {
    return { type: "error", text: "No SAP data loaded. Load an export first, then ask again." };
  }

  const empties = Array.from(emptyBinsFromExport || [])
    .map(normBin)
    .filter((b) => {
      if (!b) return false;
      // Exclude bins that have stock in binState (shouldn't happen but be safe)
      if ((binState[b]?.totalQty || 0) > 0) return false;
      return true;
    })
    .sort((a, b) => a.localeCompare(b));

  if (!empties.length) {
    return { type: "info", text: "No empty bins found in the current data." };
  }

  // Group by row
  const byRow = {};
  for (const bin of empties) {
    const { rowKey } = parseBin(bin);
    if (!byRow[rowKey]) byRow[rowKey] = [];
    byRow[rowKey].push(bin);
  }

  const rows = Object.keys(byRow).sort((a, b) => a.localeCompare(b));
  const tableRows = rows.map((row) => ({
    Row: row,
    Count: String(byRow[row].length),
    Bins: byRow[row].join(", "),
  }));

  return {
    type: "table",
    text: `**${empties.length} empty bin${empties.length !== 1 ? "s" : ""}** across ${rows.length} row${rows.length !== 1 ? "s" : ""}.`,
    table: { headers: ["Row", "Count", "Bins"], rows: tableRows },
  };
}
