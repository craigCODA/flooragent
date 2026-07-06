import { normBin } from "../../../domain/bin";

// Bin pattern: HH/II/HM/BS prefix, 2A prefix, 3+letter prefix, or single A-J letter, followed by digits
const BIN_RE = /\b(HH|II|HM|BS|2A|3[A-Z]|[A-J])(\d{1,3}[A-Z]?)\b/gi;

// Row patterns: "row D", "HH row", "D-E", "F/G"
const ROW_SINGLE_RE = /\brow\s+(HH|II|HM|[A-J])\b/gi;
const ROW_SUFFIX_RE = /\b(HH|II|HM|[A-J])\s+row\b/gi;
const ROW_TOPIC_RE = /\b(HH|II|HM|[A-J])\s+(?:stats|status|summary|info|details|capacity|space|room|side|bins?|tunnel)\b/gi;
const ROW_PAIR_RE = /\b(HH|II|HM|[A-J])\s*[-\/]\s*(HH|II|HM|[A-J])\b/gi;

// Material IDs: 5-18 digit numbers
const MATERIAL_RE = /\b(\d{5,18})\b/g;

// Warehouse: WH1, WH2, WH3, "warehouse 2", etc.
const WH_RE = /\b(?:WH\s*(\d)|warehouse\s+(\d))\b/gi;

// Quantity: number + optional "pal" or "pallets"
const QTY_RE = /\b(\d+(?:\.\d+)?)\s*(?:pal(?:lets?)?)\b/gi;
const QTY_CONTEXT_RE = /\b(?:need|needs|qty|quantity|around|about|roughly)\s+(\d+(?:\.\d+)?)\b/gi;

function pushRow(result, rowKey) {
  const row = String(rowKey || "").toUpperCase();
  if (!row) return;
  if (!result.rows.includes(row)) result.rows.push(row);
}

export function extractEntities(raw) {
  const input = String(raw || "");
  const result = { bins: [], rows: [], materials: [], warehouse: null, quantity: null };

  let m;
  BIN_RE.lastIndex = 0;
  while ((m = BIN_RE.exec(input)) !== null) {
    const bin = normBin(m[1] + m[2]);
    if (bin && !result.bins.includes(bin)) result.bins.push(bin);
  }

  ROW_PAIR_RE.lastIndex = 0;
  while ((m = ROW_PAIR_RE.exec(input)) !== null) {
    pushRow(result, m[1]);
    pushRow(result, m[2]);
  }

  ROW_SINGLE_RE.lastIndex = 0;
  while ((m = ROW_SINGLE_RE.exec(input)) !== null) {
    pushRow(result, m[1]);
  }

  ROW_SUFFIX_RE.lastIndex = 0;
  while ((m = ROW_SUFFIX_RE.exec(input)) !== null) {
    pushRow(result, m[1]);
  }

  ROW_TOPIC_RE.lastIndex = 0;
  while ((m = ROW_TOPIC_RE.exec(input)) !== null) {
    pushRow(result, m[1]);
  }

  const binDigits = new Set(result.bins.map((b) => b.replace(/^[A-Z]+/i, "")));
  MATERIAL_RE.lastIndex = 0;
  while ((m = MATERIAL_RE.exec(input)) !== null) {
    const id = m[1];
    if (!binDigits.has(id) && !result.materials.includes(id)) {
      result.materials.push(id);
    }
  }

  WH_RE.lastIndex = 0;
  m = WH_RE.exec(input);
  if (m) {
    const num = m[1] || m[2];
    result.warehouse = `WH${num}`;
  }

  QTY_RE.lastIndex = 0;
  m = QTY_RE.exec(input);
  if (m) {
    result.quantity = parseFloat(m[1]);
  }

  QTY_CONTEXT_RE.lastIndex = 0;
  m = QTY_CONTEXT_RE.exec(input);
  if (m) {
    const parsed = parseFloat(m[1]);
    if (Number.isFinite(parsed) && parsed <= 1000) {
      result.quantity = parsed;
    }
  }

  const simplePrompt = input.replace(/[?.!]/g, "").trim().toUpperCase();
  const simpleRowMatch = simplePrompt.match(/^(?:WHAT ABOUT|HOW ABOUT|SHOW ME|TELL ME ABOUT)?\s*(HH|II|HM|[A-J])(?:\s+ROW)?$/);
  if (simpleRowMatch) {
    pushRow(result, simpleRowMatch[1]);
  }

  return result;
}
