import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import xlsx from 'xlsx';
import { consolidate } from './src/domain/planning.js';
import { parseSapExport, validateSapHeaders } from './src/domain/sap.js';

// Load EXPORT.XLSX
const excelFile = 'C:\\Users\\NeverAMoment\\Documents\\EXPORT.XLSX';
const workbook = xlsx.readFile(excelFile);

console.log('Available sheets:', workbook.SheetNames);
const ws = workbook.Sheets[workbook.SheetNames[0]];
const data = xlsx.utils.sheet_to_json(ws);

console.log(`Loaded ${data.length} rows from Excel`);
console.log('First row:', JSON.stringify(data[0]));

// Validate headers
try {
  validateSapHeaders(data);
  console.log('✓ Headers validated');
} catch (err) {
  console.error('Header validation error:', err.message);
}

// Parse SAP data
try {
  const { stockRows, emptyBins, emptyBinTypes } = parseSapExport(data);
  console.log(`Parsed: ${stockRows.length} stock rows, ${emptyBins.length} empty bins`);
  
  // Run consolidation v2 with absolute threshold
  const resultAbsolute = consolidate({
    stockRows,
    emptyBinsSet: new Set(emptyBins),
    emptyBinTypes,
    globalThreshold: 20,
    thresholdMode: 'absolute',
    allowSrc110: false,
    allowTgt110: false,
    allowTgt111: false,
    lockedBins: new Set(),
    capOverrides: {},
    disabledBins: new Set(),
    excludeHISource: true,
    excludedBinSet: new Set(),
    avoidedTargetRows: new Set(),
    ignoredMoveKeys: new Set(),
  });
  
  console.log('\n=== CONSOLIDATION PLAN (V2 - Absolute Threshold: 20 PAL) ===');
  console.log(`Total moves: ${resultAbsolute.moves.length}`);
  console.log(`Total quantity to move: ${resultAbsolute.totalQty.toFixed(2)} PAL`);
  console.log(`Free space used: ${resultAbsolute.totalFree.toFixed(2)} PAL`);
  
  if (resultAbsolute.moves.length > 0) {
    console.log('\nFirst 20 moves:');
    resultAbsolute.moves.slice(0, 20).forEach((move, i) => {
      console.log(`${i+1}. Material ${move.materialId}: ${move.qty.toFixed(3)} PAL from ${move.from} to ${move.to}`);
    });
  }
  
  // Save results
  fs.writeFileSync('C:\\Users\\NeverAMoment\\consolidation-v2-absolute-result.json', JSON.stringify({
    version: 'V2-Absolute-Threshold',
    parameters: {
      globalThreshold: 20,
      thresholdMode: 'absolute',
    },
    summary: {
      totalMoves: resultAbsolute.moves.length,
      totalQty: resultAbsolute.totalQty,
      totalFree: resultAbsolute.totalFree,
    },
    moves: resultAbsolute.moves
  }, null, 2));
  console.log('\n✓ Results saved to consolidation-v2-absolute-result.json');
  
  // Also run with percentage threshold
  const resultPercent = consolidate({
    stockRows,
    emptyBinsSet: new Set(emptyBins),
    emptyBinTypes,
    globalThreshold: 30,  // 30% fill
    thresholdMode: 'percent',
    allowSrc110: false,
    allowTgt110: false,
    allowTgt111: false,
    lockedBins: new Set(),
    capOverrides: {},
    disabledBins: new Set(),
    excludeHISource: true,
    excludedBinSet: new Set(),
    avoidedTargetRows: new Set(),
    ignoredMoveKeys: new Set(),
  });
  
  console.log('\n=== CONSOLIDATION PLAN (V2 - Percent Threshold: 30%) ===');
  console.log(`Total moves: ${resultPercent.moves.length}`);
  console.log(`Total quantity to move: ${resultPercent.totalQty.toFixed(2)} PAL`);
  console.log(`Free space used: ${resultPercent.totalFree.toFixed(2)} PAL`);
  
  if (resultPercent.moves.length > 0) {
    console.log('\nFirst 20 moves:');
    resultPercent.moves.slice(0, 20).forEach((move, i) => {
      console.log(`${i+1}. Material ${move.materialId}: ${move.qty.toFixed(3)} PAL from ${move.from} to ${move.to}`);
    });
  }
  
  fs.writeFileSync('C:\\Users\\NeverAMoment\\consolidation-v2-percent-result.json', JSON.stringify({
    version: 'V2-Percent-Threshold',
    parameters: {
      globalThreshold: 30,
      thresholdMode: 'percent',
    },
    summary: {
      totalMoves: resultPercent.moves.length,
      totalQty: resultPercent.totalQty,
      totalFree: resultPercent.totalFree,
    },
    moves: resultPercent.moves
  }, null, 2));
  console.log('\n✓ Results saved to consolidation-v2-percent-result.json');
  
} catch (err) {
  console.error('Error running consolidation:', err.message);
  console.error(err.stack);
}
