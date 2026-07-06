import XLSX from 'xlsx';
import { consolidate } from './src/domain/planning.js';
import { normBin } from './src/domain/bin.js';

const wb = XLSX.readFile('E:\\EXPORT.xlsx');
const stockSheet = wb.Sheets['Stock'];
const emptySheet = wb.Sheets['Empty Bins'];

const stockRows = XLSX.utils.sheet_to_json(stockSheet).map(row => ({
  binId: normBin(row.BIN_ID || ''),
  materialId: String(row.MATERIAL_ID || '').trim(),
  materialDesc: String(row.MATERIAL_DESCRIPTION || '').trim(),
  qty: Number(row.QTY || 0),
  storageType: String(row.STORAGE_TYPE || ''),
})).filter(r => r.binId && r.qty > 0);

const emptyData = XLSX.utils.sheet_to_json(emptySheet);
const emptyBinsSet = new Set();
const emptyBinTypes = {};
emptyData.forEach(row => {
  const bn = normBin(row.BIN_ID);
  if (bn) {
    emptyBinsSet.add(bn);
    emptyBinTypes[bn] = String(row.STORAGE_TYPE || '');
  }
});

// Test with V2 settings: 20 PAL threshold, min-dest mode enabled
const result = consolidate({
  stockRows,
  emptyBinsSet,
  emptyBinTypes,
  abcThreshold: 20,
  phase2Enabled: true,
  phase2Threshold: 20,
  allowSrc110: true,
  allowTgt110: true,
  allowTgt111: true,
  excludeHISource: true,
  abcNeverTarget: true,
});

// Find all moves from E16
const e16Moves = result.moves.filter(m => m.from === 'E16');
const e16Qty = e16Moves.reduce((s, m) => s + m.qty, 0);
const e16Dests = new Set(e16Moves.map(m => m.to));

console.log(`\n=== V2 MINIMIZED DESTINATIONS TEST ===\n`);
console.log(`E16 moves: ${e16Moves.length}`);
console.log(`E16 total qty: ${e16Qty.toFixed(1)} PAL`);
console.log(`E16 destination bins: ${Array.from(e16Dests).sort().join(', ')}`);
console.log(`E16 destination count: ${e16Dests.size}`);
console.log(`\nAll E16 moves:`);
e16Moves.forEach((m, i) => {
  console.log(`  ${i + 1}. ${m.from} -> ${m.to}: ${m.qty.toFixed(1)} PAL (${m.materialId})`);
});

console.log(`\nTotal moves: ${result.moves.length}`);
console.log(`PAL moved: ${result.moves.reduce((s, m) => s + m.qty, 0).toFixed(1)}`);

// Count frequencies of destination counts per source
const srcDestMap = {};
result.moves.forEach(m => {
  if (!srcDestMap[m.from]) srcDestMap[m.from] = new Set();
  srcDestMap[m.from].add(m.to);
});

const destCounts = Object.values(srcDestMap).map(s => s.size);
const maxDest = Math.max(...destCounts);
const avgDest = (destCounts.reduce((s, x) => s + x, 0) / destCounts.length).toFixed(2);

console.log(`\nDestination stats:`);
console.log(`  Max destinations per source: ${maxDest}`);
console.log(`  Avg destinations per source: ${avgDest}`);
console.log(`  Sources with 1 destination: ${destCounts.filter(x => x === 1).length}`);
console.log(`  Sources with 2 destinations: ${destCounts.filter(x => x === 2).length}`);
console.log(`  Sources with 3+ destinations: ${destCounts.filter(x => x >= 3).length}`);
