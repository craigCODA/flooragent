import { normBin, toNum } from "./bin.js";

const REQUIRED_HEADERS = ["Storage Bin", "Material", "Material Description", "Available stock", "Storage Type"];

export function validateSapHeaders(rows) {
  const keys = new Set();
  (rows || [])
    .slice(0, 25)
    .forEach((r) => Object.keys(r || {}).forEach((k) => keys.add(String(k))));
  return REQUIRED_HEADERS.filter((h) => !keys.has(h));
}

export function parseSapExport(json) {
  const stockRows = [];
  const emptyBinsFromExport = new Set();
  const emptyBinTypes = {};
  const occupiedBins = new Set();
  for (const r of json || []) {
    const bin = normBin(r["Storage Bin"]);
    if (!bin) continue;
    const materialId = String(r["Material"] ?? "").trim();
    const materialDesc = ""; // description intentionally ignored
    const qty = toNum(r["Available stock"]);
    const storageType = String(r["Storage Type"] ?? "").trim();
    const emptyIndicator = String(r["Empty indicator"] ?? "").trim().toUpperCase();
    const isEmpty = qty === 0 || emptyIndicator === "X";
    if (qty > 0) {
      occupiedBins.add(bin);
      emptyBinsFromExport.delete(bin);
      delete emptyBinTypes[bin];
    }
    if (isEmpty) {
      if (occupiedBins.has(bin)) continue;
      emptyBinsFromExport.add(bin);
      if (storageType) emptyBinTypes[bin] = storageType;
      continue;
    }
    if (materialId && qty > 0) {
      stockRows.push({ bin, materialId, materialDesc, qty, storageType });
    }
  }
  for (const bin of occupiedBins) {
    emptyBinsFromExport.delete(bin);
    delete emptyBinTypes[bin];
  }
  return { stockRows, emptyBinsFromExport, emptyBinTypes };
}

export function buildBinState(stockRows) {
  const bin = {};
  for (const r of stockRows) {
    if (!bin[r.bin]) {
      bin[r.bin] = {
        totalQty: 0,
        storageType: r.storageType || "",
        materials: new Set(),
        byMaterialQty: {},
        descByMaterial: {},
      };
    }
    bin[r.bin].totalQty += r.qty;
    bin[r.bin].materials.add(r.materialId);
    bin[r.bin].byMaterialQty[r.materialId] = (bin[r.bin].byMaterialQty[r.materialId] || 0) + r.qty;
    if (!bin[r.bin].descByMaterial[r.materialId]) {
      bin[r.bin].descByMaterial[r.materialId] = r.materialDesc || "";
    }
    if (!bin[r.bin].storageType && r.storageType) {
      bin[r.bin].storageType = r.storageType;
    }
  }
  return bin;
}
