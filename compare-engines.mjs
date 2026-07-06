/**
 * compare-engines.mjs
 *
 * Loads the real SAP export and runs both consolidation engines head-to-head
 * using the exact same parameters the UI would use at default settings.
 *
 * Usage:
 *   node --loader ./resolve-loader.mjs compare-engines.mjs
 */

import { createRequire } from "node:module";
import { performance } from "node:perf_hooks";

const require = createRequire(import.meta.url);
// xlsx is a CJS module — use require
const xlsx = require("./node_modules/xlsx/xlsx.js");

// ── Domain modules from THIS project (material-first) ─────────────────────
import { parseSapExport, buildBinState } from "./src/domain/sap.js";
import { normBin, parseBin } from "./src/domain/bin.js";
import { effectiveCapacity } from "./src/domain/capacity.js";
import { consolidate as consolidateMF } from "./src/domain/planning.js";

// ── Original comparison engine source ─────────────────────────────────────
const { consolidate: consolidateOrig } = await import(
  "file:///F:/warehouse-agent/src/domain/planning.js"
);

// ── Load & parse the SAP export ───────────────────────────────────────────
const EXPORT_PATH = "F:/EXPORT(1).XLSX";

console.log(`Loading ${EXPORT_PATH} ...`);
const wb = xlsx.readFile(EXPORT_PATH);
const ws = wb.Sheets[wb.SheetNames[0]];
const rawJson = xlsx.utils.sheet_to_json(ws, { defval: "" });
console.log(`Raw rows from XLSX: ${rawJson.length}`);

const {
  stockRows: allStock,
  emptyBinsFromExport: allEmpties,
  emptyBinTypes: allEmptyTypes,
} = parseSapExport(rawJson);

// ── Filter to WH1 only (no 3* or 2* prefix bins) ─────────────────────────
function isWH1(bin) {
  const b = String(bin || "").trim().toUpperCase();
  return b && !b.startsWith("3") && !b.startsWith("2");
}

const stockRows = allStock.filter((r) => isWH1(r.bin));
const emptyBinsSet = new Set([...allEmpties].filter(isWH1));
const emptyBinTypes = {};
for (const [b, t] of Object.entries(allEmptyTypes)) {
  if (isWH1(b)) emptyBinTypes[b] = t;
}

// ── Data summary ──────────────────────────────────────────────────────────
console.log("\n=== DATA SUMMARY ===");
console.log(`WH1 stock rows (qty > 0):     ${stockRows.length}`);
const occupiedSet = new Set(stockRows.map((r) => r.bin));
console.log(`WH1 occupied bins:            ${occupiedSet.size}`);
console.log(`WH1 empty bins:               ${emptyBinsSet.size}`);

const binQtyMap = {};
for (const r of stockRows) binQtyMap[r.bin] = (binQtyMap[r.bin] || 0) + r.qty;
const qtyVals = Object.values(binQtyMap);
console.log(`\nBin-level qty distribution:`);
console.log(`  totalQty <= 6:   ${qtyVals.filter((q) => q <= 6).length} bins`);
console.log(`  totalQty <= 12:  ${qtyVals.filter((q) => q <= 12).length} bins`);
console.log(`  totalQty <= 20:  ${qtyVals.filter((q) => q <= 20).length} bins`);
console.log(`  totalQty <= 30:  ${qtyVals.filter((q) => q <= 30).length} bins`);
console.log(`  total occupied:  ${qtyVals.length} bins`);

const typeBreak = {};
for (const r of stockRows) typeBreak[r.storageType] = (typeBreak[r.storageType] || 0) + 1;
console.log(`\nStorage type breakdown: ${JSON.stringify(typeBreak)}`);

const matBinMap = {};
for (const r of stockRows) {
  if (!matBinMap[r.materialId]) matBinMap[r.materialId] = new Set();
  matBinMap[r.materialId].add(r.bin);
}
const multiBinMats = Object.entries(matBinMap).filter(([, s]) => s.size > 1);
console.log(`Materials spread across 2+ WH1 bins: ${multiBinMats.length}`);
console.log(
  `Sample multi-bin materials: ${multiBinMats
    .slice(0, 5)
    .map(([m, s]) => `${m}(${s.size} bins)`)
    .join(", ")}`
);

// ── Parameters — exact UI defaults ────────────────────────────────────────
//
//   globalThreshold = 20  (useState default in App.jsx line 296)
//   excludeH/HH/I/II = true  (App.jsx lines 300-303)
//   allowSrc110 = true, allowTgt110 = true, allowTgt111 = true  (lines 297-299)
//   protectABC = false, abcNeverTarget = true (engine hard-codes it)
//   excludeCustomBins = true (excluded set passed as excludedBinSet — we omit
//     CUSTOM_EXCLUDED_BINS since it lives in App.jsx and is UI-specific)
//
const THRESHOLD = 20;

const params = {
  stockRows,
  emptyBinsSet,
  emptyBinTypes,
  abcThreshold: THRESHOLD,
  phase2Enabled: true,
  phase2Threshold: THRESHOLD,
  allowSrc110: true,
  allowTgt110: true,
  allowTgt111: true,
  lockedBins: new Set(),
  capOverrides: {},
  disabledBins: new Set(),
  excludeHISource: false,           // overridden by avoidedSourceRows below
  avoidedSourceRows: new Set(["H", "HH", "I", "II"]),  // UI default: all four
  maxSourceQty: THRESHOLD,
  excludedBinSet: new Set(),
  ignoredMoveKeys: new Set(),
  avoidedTargetRows: new Set(),     // protectABC=false → no extra row exclusion
  abcNeverTarget: true,
};

console.log(`\n=== RUN PARAMETERS ===`);
console.log(`  threshold (abc/phase2/maxSourceQty): ${THRESHOLD}`);
console.log(`  avoidedSourceRows: H, HH, I, II`);
console.log(`  allowSrc110: true | allowTgt110: true | allowTgt111: true`);
console.log(`  abcNeverTarget: true`);

// ── Run original engine ───────────────────────────────────────────────────
console.log("\n--- Running ORIGINAL comparison engine (F:\\warehouse-agent) ---");
const origStart = performance.now();
let resultOrig;
try {
  resultOrig = consolidateOrig({ ...params });
} catch (err) {
  console.error("ORIGINAL engine threw:", err.message, err.stack);
  process.exit(1);
}
const origMs = performance.now() - origStart;

// ── Run material-first engine ─────────────────────────────────────────────
console.log("--- Running floor-engine comparison target (F:\\warehouse-agent-material-first) ---");
const mfStart = performance.now();
let resultMF;
try {
  resultMF = consolidateMF({ ...params });
} catch (err) {
  console.error("MATERIAL-FIRST engine threw:", err.message, err.stack);
  process.exit(1);
}
const mfMs = performance.now() - mfStart;

// ── Analysis ──────────────────────────────────────────────────────────────
function analyzeResult(label, result, elapsedMs) {
  const { moves: rawMoves, finalBinState } = result;
  const moves = (rawMoves || []).filter(Boolean).filter((m) => (m.qty || 0) > 1e-6);
  const initialState = buildBinState(stockRows);

  // Bins that started occupied and are now empty in finalBinState
  const binsEmptied = Object.keys(initialState).filter(
    (b) => (initialState[b]?.totalQty || 0) > 0 && (finalBinState[b]?.totalQty || 0) < 1e-6
  );

  const movedFromSet = new Set(moves.map((m) => m.from));
  const materialsSet = new Set(moves.map((m) => m.materialId));
  const totalQtyMoved = moves.reduce((s, m) => s + m.qty, 0);

  const tagBreak = {};
  for (const m of moves) {
    const t = m.tag || "normal";
    tagBreak[t] = (tagBreak[t] || 0) + 1;
  }

  return {
    label,
    elapsedMs,
    totalMoves: moves.length,
    binsEmptied: binsEmptied.length,
    emptiedBinList: binsEmptied.sort(),
    materialsConsolidated: materialsSet.size,
    totalQtyMoved: Math.round(totalQtyMoved * 1000) / 1000,
    tagBreak,
    moves,
  };
}

const origA = analyzeResult("ORIGINAL", resultOrig, origMs);
const mfA   = analyzeResult("MATERIAL-FIRST", resultMF, mfMs);

// ── Print per-engine report ───────────────────────────────────────────────
function printReport(a) {
  const bar = "─".repeat(62);
  console.log(`\n${bar}`);
  console.log(`ENGINE: ${a.label}   (${(a.elapsedMs / 1000).toFixed(3)}s)`);
  console.log(bar);
  console.log(`  Total moves:              ${a.totalMoves}`);
  console.log(`  Bins emptied:             ${a.binsEmptied}`);
  console.log(`  Materials consolidated:   ${a.materialsConsolidated}`);
  console.log(`  Total qty moved:          ${a.totalQtyMoved} pallets`);
  console.log(`  Move tags:                ${JSON.stringify(a.tagBreak)}`);
  if (a.binsEmptied > 0) {
    console.log(`  Emptied bin list:         ${a.emptiedBinList.join(", ")}`);
  }

  if (a.totalMoves === 0) {
    console.log(`\n  *** ZERO MOVES — see diagnosis section below ***`);
    return;
  }

  console.log(`\n  First 15 moves:`);
  for (const m of a.moves.slice(0, 15)) {
    console.log(
      `    #${String(m.id).padStart(3)}  ` +
        `mat=${String(m.materialId).padEnd(10)} ` +
        `${String(m.from).padEnd(8)} -> ${String(m.to).padEnd(8)}  ` +
        `qty=${String(m.qty.toFixed(3)).padStart(7)}  [${m.tag || "normal"}]`
    );
  }
  if (a.moves.length > 15) console.log(`    ... and ${a.moves.length - 15} more moves`);
}

printReport(origA);
printReport(mfA);

// ── Head-to-head comparison ───────────────────────────────────────────────
console.log(`\n${"═".repeat(62)}`);
console.log(`HEAD-TO-HEAD COMPARISON`);
console.log(`${"═".repeat(62)}`);

function fmtDelta(orig, mf) {
  const d = mf - orig;
  if (d === 0) return "   tie";
  return (d > 0 ? `MF +${d}` : `ORIG +${Math.abs(d)}`).padStart(10);
}

const rows = [
  ["Total moves",            origA.totalMoves,           mfA.totalMoves],
  ["Bins emptied",           origA.binsEmptied,          mfA.binsEmptied],
  ["Materials consolidated", origA.materialsConsolidated, mfA.materialsConsolidated],
  ["Total qty moved",        origA.totalQtyMoved,        mfA.totalQtyMoved],
];

console.log(
  `\n  ${"Metric".padEnd(28)} ${"ORIGINAL".padStart(10)} ${"MAT-FIRST".padStart(10)} ${"Delta".padStart(12)}`
);
console.log(`  ${"─".repeat(62)}`);
for (const [label, orig, mf] of rows) {
  console.log(
    `  ${label.padEnd(28)} ${String(orig).padStart(10)} ${String(mf).padStart(10)} ${fmtDelta(orig, mf)}`
  );
}

const origEff =
  origA.binsEmptied > 0 ? (origA.totalMoves / origA.binsEmptied).toFixed(2) : "N/A";
const mfEff =
  mfA.binsEmptied > 0 ? (mfA.totalMoves / mfA.binsEmptied).toFixed(2) : "N/A";
console.log(`\n  Moves per bin emptied (lower=better):  ORIG=${origEff}  MF=${mfEff}`);
console.log(`  Time:                                  ORIG=${(origA.elapsedMs/1000).toFixed(3)}s  MF=${(mfA.elapsedMs/1000).toFixed(3)}s`);

// Which bins each engine empties (overlap analysis)
if (origA.binsEmptied > 0 || mfA.binsEmptied > 0) {
  const origSet = new Set(origA.emptiedBinList);
  const mfSet   = new Set(mfA.emptiedBinList);
  const both     = origA.emptiedBinList.filter((b) => mfSet.has(b));
  const onlyOrig = origA.emptiedBinList.filter((b) => !mfSet.has(b));
  const onlyMF   = mfA.emptiedBinList.filter((b) => !origSet.has(b));
  console.log(`\n  Bins both engines empty (${both.length}):    ${both.join(", ") || "none"}`);
  if (onlyOrig.length) console.log(`  Only ORIGINAL empties  (${onlyOrig.length}):    ${onlyOrig.join(", ")}`);
  if (onlyMF.length)   console.log(`  Only MAT-FIRST empties (${onlyMF.length}):    ${onlyMF.join(", ")}`);
}

// ── Zero-move diagnosis ───────────────────────────────────────────────────
if (origA.totalMoves === 0 || mfA.totalMoves === 0) {
  const zeroLabel = origA.totalMoves === 0 ? "ORIGINAL" : "MATERIAL-FIRST";
  console.log(`\n${"═".repeat(62)}`);
  console.log(`ZERO-MOVE DIAGNOSIS (${zeroLabel})`);
  console.log(`${"═".repeat(62)}`);

  const initialState = buildBinState(stockRows);
  const HHII = new Set(["H", "HH", "I", "II"]);
  const ABC  = new Set(["A", "B", "C"]);

  const srcCandidates = [];
  for (const [binId, st] of Object.entries(initialState)) {
    const { rowKey } = parseBin(binId);
    if (HHII.has(rowKey)) continue;
    if ((st.storageType || "") === "111") continue;
    if ((st.totalQty || 0) <= 0) continue;
    if ((st.totalQty || 0) > THRESHOLD) continue;
    srcCandidates.push({ binId, qty: st.totalQty, row: rowKey, nMats: st.materials.size });
  }

  const singleMatSrc = srcCandidates.filter((b) => b.nMats === 1);
  console.log(`\n  Source-eligible bins (qty<=20, not H/HH/I/II, not t111): ${srcCandidates.length}`);
  console.log(`    Single-material among those: ${singleMatSrc.length}`);

  // Non-empty potential targets
  let nonEmptyTgt = 0;
  for (const [binId, st] of Object.entries(initialState)) {
    const { rowKey } = parseBin(binId);
    if (ABC.has(rowKey) || HHII.has(rowKey)) continue;
    if ((st.totalQty || 0) <= 0) continue;
    if ((st.storageType || "") === "111") continue;
    nonEmptyTgt++;
  }
  console.log(`  Non-empty potential targets (not A/B/C, not HH/II, not t111): ${nonEmptyTgt}`);
  console.log(`  Empty bins available for TEP: ${emptyBinsSet.size}`);

  // Multi-material source bins (blocked by material-first engine's single-mat requirement)
  const multiMatSrc = srcCandidates.filter((b) => b.nMats > 1);
  if (multiMatSrc.length > 0) {
    console.log(`\n  NOTE: ${multiMatSrc.length} source-eligible bins have >1 material.`);
    console.log(`  Material-first engine skips these (requires single-material bins).`);
    console.log(`  ${multiMatSrc.map((b) => `${b.binId}(${b.nMats}mats)`).join(", ")}`);
  }

  // Materials that have 2+ single-mat source bins (TEP candidates)
  const matToBins = {};
  for (const b of singleMatSrc) {
    if (!matToBins[b.binId]) {
      // we need material ID — re-scan binState
    }
  }
  // Re-scan with materialId
  const matSrcMap = {};
  for (const [binId, st] of Object.entries(initialState)) {
    const { rowKey } = parseBin(binId);
    if (HHII.has(rowKey)) continue;
    if ((st.storageType || "") === "111") continue;
    if ((st.totalQty || 0) <= 0 || (st.totalQty || 0) > THRESHOLD) continue;
    if (st.materials.size !== 1) continue;
    const matId = Array.from(st.materials)[0];
    if (!matSrcMap[matId]) matSrcMap[matId] = [];
    matSrcMap[matId].push({ binId, qty: st.totalQty });
  }
  const tepMats = Object.entries(matSrcMap).filter(([, bins]) => bins.length >= 2);
  console.log(`\n  Materials with 2+ single-mat source bins (TEP candidates): ${tepMats.length}`);
  for (const [matId, bins] of tepMats.slice(0, 10)) {
    console.log(`    ${matId}: ${bins.map((b) => `${b.binId}(${b.qty})`).join(", ")}`);
  }

  if (srcCandidates.length === 0) {
    console.log(`\n  ROOT CAUSE: No source candidates. Raise threshold above ${THRESHOLD}.`);
  } else if (emptyBinsSet.size === 0 && nonEmptyTgt === 0) {
    console.log(`\n  ROOT CAUSE: Source candidates exist but there are no valid targets.`);
  } else if (tepMats.length === 0 && nonEmptyTgt === 0) {
    console.log(
      `\n  ROOT CAUSE: No material has 2+ bins for TEP, and no non-empty targets share materials.`
    );
  } else {
    console.log(`\n  Sources and targets both exist — check LAYOUT_BIN_SET filtering.`);
    console.log(`  Empty bin sample: ${[...emptyBinsSet].slice(0, 10).join(", ")}`);
  }
}

console.log("\nDone.\n");
