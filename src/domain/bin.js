import { LAYOUT_BIN_SET } from "./layout.js";

export function isIgnoredBin(v) {
  const raw = String(v ?? "").trim().toUpperCase();
  return !!raw && raw.endsWith("S");
}

export function normBin(v) {
  const raw = String(v ?? "").trim().toUpperCase();
  if (!raw || isIgnoredBin(raw)) return "";
  return raw;
}

export function isPhysicalBin(bin) {
  const raw = String(bin ?? "").trim().toUpperCase();
  if (!raw || isIgnoredBin(raw)) return false;
  return LAYOUT_BIN_SET.has(raw);
}

export function toNum(v) {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const n = parseFloat(v.replace(/,/g, ""));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

export function parseBin(bin) {
  const U = normBin(bin);
  if (!U) return { rowKey: "", num: "", upper: "" };
  const isHH = U.startsWith("HH");
  const isII = U.startsWith("II");
  // WH3 bins: format is 3<LETTER><num>, e.g. 3A01, 3B12
  const isWH3 = U[0] === "3" && U.length > 2 && /[A-Z]/.test(U[1]);
  const rowKey = isHH ? "HH" : isII ? "II" : isWH3 ? U.slice(0, 2) : U[0];
  const numRaw = (isHH || isII || isWH3) ? U.slice(2) : U.slice(1);
  const num = String(numRaw || "").padStart(2, "0");
  return { rowKey, num, upper: U };
}

export function getWarehouse(bin) {
  const b = normBin(bin);
  if (!b) return "UNKNOWN";
  if (b.startsWith("3")) return "WH3";
  if (b.includes("R")) return "WH2";
  if (b.startsWith("2A")) return "WH2";
  if ("ABCDEFGHIJ".includes(b[0])) return "WH1";
  return "OTHER";
}

export function inWarehouse(bin, selected) {
  return selected === "ALL" || getWarehouse(bin) === selected;
}
