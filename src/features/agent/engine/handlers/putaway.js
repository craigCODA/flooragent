import { findBestBin } from "../../../../domain/planning";
import { extractFreeTextQuery } from "../queryText";

export function handlePutaway(ctx) {
  const {
    entities,
    stockRows,
    emptyBinsFromExport,
    emptyBinTypes,
    capOverrides,
    rawInput,
    allowTgt110,
    allowTgt111,
  } = ctx;

  if (!stockRows || stockRows.length === 0) {
    return { type: "error", text: "No SAP data loaded. Load an export first, then ask again." };
  }

  let query = entities.materials[0] || "";
  if (!query) {
    const cleaned = rawInput
      .replace(/where\s+should\s+I\s+put/i, "")
      .replace(/best\s+bin\s+for/i, "")
      .replace(/put\s*away/i, "")
      .replace(/material/i, "")
      .trim();
    if (cleaned) query = cleaned;
  }
  if (!query) {
    query = extractFreeTextQuery(rawInput);
  }
  if (!query) {
    return { type: "info", text: "Which material? Try **\"Where should I put 12345?\"** or describe the product in plain language." };
  }

  const result = findBestBin({
    query,
    qtyNeeded: entities.quantity || 0,
    stockRows,
    emptyBinsSet: emptyBinsFromExport,
    emptyBinTypes,
    allowTgt110: allowTgt110 !== false,
    allowTgt111: allowTgt111 !== false,
    capOverrides: capOverrides || {},
  });

  if (!result.ok) {
    return { type: "error", text: result.reason };
  }

  const best = result.best;
  const altRows = result.top.slice(1, 6).map((c) => ({
    Bin: c.bin,
    Free: `${c.free} PAL`,
    Type: c.storageType || "—",
    Note: c.sameMaterial ? "Same material" : "Empty",
  }));

  const resp = {
    type: "text",
    text: `**Recommended: ${best.bin}** — ${best.free} PAL free (cap ${best.cap})${best.sameMaterial ? ", already has this material" : ", empty bin"}`,
    highlight: best.bin,
  };

  if (altRows.length > 0) {
    resp.type = "table";
    resp.text += `\n\nMaterial: **${result.materialId}** ${result.materialDesc ? `(${result.materialDesc})` : ""}`;
    resp.table = { headers: ["Bin", "Free", "Type", "Note"], rows: altRows };
  }

  return resp;
}
