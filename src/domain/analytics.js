import { parseBin, toNum } from "./bin";
import { effectiveCapacity } from "./capacity";

const ROW_ORDER = {
  A: 1,
  B: 2,
  C: 3,
  D: 4,
  E: 5,
  F: 6,
  G: 7,
  H: 8,
  HH: 9,
  II: 10,
  I: 11,
  J: 12,
  "3A": 101,
  "3B": 102,
  "3C": 103,
  "3D": 104,
  "3E": 105,
  "3F": 106,
};

function pct(value, total) {
  if (!total) return 0;
  return +((value / total) * 100).toFixed(1);
}

function mean(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round1(value) {
  return +(Number(value || 0)).toFixed(1);
}

function collectMaterialBinCounts(binState = {}) {
  const counts = {};
  for (const binData of Object.values(binState)) {
    for (const materialId of binData?.materials || []) {
      counts[materialId] = (counts[materialId] || 0) + 1;
    }
  }
  return counts;
}

function sortRowImpact(rows) {
  return [...rows].sort((a, b) => {
    if (b.freedBins !== a.freedBins) return b.freedBins - a.freedBins;
    if (b.freedCapacity !== a.freedCapacity) return b.freedCapacity - a.freedCapacity;
    if (b.netCapacityChange !== a.netCapacityChange) return b.netCapacityChange - a.netCapacityChange;
    return (ROW_ORDER[a.rowKey] || 999) - (ROW_ORDER[b.rowKey] || 999);
  });
}

export function calculateAnalytics({
  moves,
  initialBinState,
  finalBinState,
  stockRows,
  freedBins,
  capOverrides,
  emptyBinsFromExport = new Set(),
}) {
  const moveList = moves || [];
  const freedBinList = freedBins || [];
  const initialState = initialBinState || {};
  const finalState = finalBinState || {};
  const overrides = capOverrides || {};

  const materialsMoved = new Set();
  const sourceBinsTouched = new Set();
  const targetBinsTouched = new Set();
  const sameRowMoves = [];
  const crossRowMoves = [];
  const targetFillRates = [];
  const targetHeadroom = [];
  const motionDistances = [];
  const rowSignals = new Map();
  const materialMovedPal = {};
  const materialDescMap = {};

  for (const row of stockRows || []) {
    if (!materialDescMap[row.materialId]) materialDescMap[row.materialId] = row.materialDesc || "";
  }

  const ensureRow = (rowKey) => {
    const key = rowKey || "UNKNOWN";
    if (!rowSignals.has(key)) {
      rowSignals.set(key, {
        rowKey: key,
        sourceMoves: 0,
        targetMoves: 0,
        palOut: 0,
        palIn: 0,
        freedBins: 0,
        freedCapacity: 0,
      });
    }
    return rowSignals.get(key);
  };

  for (const move of moveList) {
    const qty = toNum(move.qty);
    const srcRow = parseBin(move.from).rowKey;
    const tgtRow = parseBin(move.to).rowKey;
    const srcRank = ROW_ORDER[srcRow] || 0;
    const tgtRank = ROW_ORDER[tgtRow] || 0;

    materialsMoved.add(move.materialId);
    sourceBinsTouched.add(move.from);
    targetBinsTouched.add(move.to);
    materialMovedPal[move.materialId] = (materialMovedPal[move.materialId] || 0) + qty;

    const srcSignal = ensureRow(srcRow);
    srcSignal.sourceMoves += 1;
    srcSignal.palOut += qty;

    const tgtSignal = ensureRow(tgtRow);
    tgtSignal.targetMoves += 1;
    tgtSignal.palIn += qty;

    if (srcRow === tgtRow) sameRowMoves.push(move);
    else crossRowMoves.push(move);

    if (srcRank && tgtRank) motionDistances.push(Math.abs(srcRank - tgtRank));
  }

  for (const targetBin of targetBinsTouched) {
    const cap = effectiveCapacity(targetBin, finalState, overrides);
    const used = finalState[targetBin]?.totalQty || 0;
    if (cap > 0) {
      targetFillRates.push((used / cap) * 100);
      targetHeadroom.push(cap - used);
    }
  }

  const initialMaterialBins = collectMaterialBinCounts(initialState);
  const finalMaterialBins = collectMaterialBinCounts(finalState);
  const beforeMaterialIds = Object.keys(initialMaterialBins);
  const afterMaterialIds = Object.keys(finalMaterialBins);

  let materialsConsolidated = 0;
  let totalBinReductions = 0;
  const topReductionMaterials = [];

  for (const materialId of beforeMaterialIds) {
    const before = initialMaterialBins[materialId] || 0;
    const after = finalMaterialBins[materialId] || 0;
    const reduction = before - after;
    if (reduction > 0 && after > 0) {
      materialsConsolidated += 1;
      totalBinReductions += reduction;
      topReductionMaterials.push({
        materialId,
        materialDesc: materialDescMap[materialId] || "",
        binsBefore: before,
        binsAfter: after,
        reduction,
      });
    }
  }

  topReductionMaterials.sort((a, b) => {
    if (b.reduction !== a.reduction) return b.reduction - a.reduction;
    return (materialMovedPal[b.materialId] || 0) - (materialMovedPal[a.materialId] || 0);
  });

  const multiBinMaterialsBefore = beforeMaterialIds.filter((materialId) => (initialMaterialBins[materialId] || 0) > 1).length;
  const multiBinMaterialsAfter = afterMaterialIds.filter((materialId) => (finalMaterialBins[materialId] || 0) > 1).length;
  const avgBinsPerMaterialBefore = round1(mean(beforeMaterialIds.map((materialId) => initialMaterialBins[materialId] || 0)));
  const avgBinsPerMaterialAfter = round1(mean(afterMaterialIds.map((materialId) => finalMaterialBins[materialId] || 0)));

  const knownBins = new Set([
    ...Object.keys(initialState),
    ...Object.keys(finalState),
    ...Array.from(emptyBinsFromExport || []),
  ]);

  let totalCapacityBefore = 0;
  let totalCapacityAfter = 0;
  let usedCapacityBefore = 0;
  let usedCapacityAfter = 0;

  for (const binId of knownBins) {
    totalCapacityBefore += effectiveCapacity(binId, initialState, overrides);
    totalCapacityAfter += effectiveCapacity(binId, finalState, overrides);
    usedCapacityBefore += toNum(initialState[binId]?.totalQty);
    usedCapacityAfter += toNum(finalState[binId]?.totalQty);
  }

  const emptyBinsBefore = Array.from(emptyBinsFromExport || []);
  const filledAfter = new Set(
    Object.entries(finalState)
      .filter(([, data]) => (data?.totalQty || 0) > 0)
      .map(([binId]) => binId)
  );
  const stillEmptyOriginal = emptyBinsBefore.filter((binId) => !filledAfter.has(binId));
  const emptyBinsAfterSet = new Set([...stillEmptyOriginal, ...freedBinList]);

  const emptyCapacityBefore = emptyBinsBefore.reduce(
    (sum, binId) => sum + effectiveCapacity(binId, initialState, overrides),
    0
  );
  const emptyCapacityAfter = Array.from(emptyBinsAfterSet).reduce(
    (sum, binId) => sum + effectiveCapacity(binId, finalState, overrides),
    0
  );

  const freedBinDetails = freedBinList
    .map((binId) => ({
      bin: binId,
      rowKey: parseBin(binId).rowKey,
      capacity: effectiveCapacity(binId, initialState, overrides),
      startingQty: initialState[binId]?.totalQty || 0,
      startingMaterials: initialState[binId]?.materials?.size || 0,
    }))
    .sort((a, b) => {
      if (b.capacity !== a.capacity) return b.capacity - a.capacity;
      if (b.startingQty !== a.startingQty) return b.startingQty - a.startingQty;
      return a.bin.localeCompare(b.bin);
    });

  for (const detail of freedBinDetails) {
    const rowSignal = ensureRow(detail.rowKey);
    rowSignal.freedBins += 1;
    rowSignal.freedCapacity += detail.capacity;
  }

  const rowImpact = sortRowImpact(
    Array.from(rowSignals.values()).map((row) => ({
      ...row,
      palOut: round1(row.palOut),
      palIn: round1(row.palIn),
      netCapacityChange: round1(row.freedCapacity + row.palOut - row.palIn),
    }))
  );

  const topMovedMaterials = Object.entries(materialMovedPal)
    .map(([materialId, totalPAL]) => ({
      materialId,
      materialDesc: materialDescMap[materialId] || "",
      totalPAL: round1(totalPAL),
    }))
    .sort((a, b) => b.totalPAL - a.totalPAL)
    .slice(0, 8);

  const totalPALMoved = round1(moveList.reduce((sum, move) => sum + toNum(move.qty), 0));
  const sourceBinsFullyDrained = freedBinList.filter((binId) => sourceBinsTouched.has(binId)).length;

  return {
    totalMoves: moveList.length,
    totalFreedBins: freedBinList.length,
    uniqueMaterialsMoved: materialsMoved.size,
    materialsConsolidated,
    totalPALMoved,

    emptyCountBefore: emptyBinsBefore.length,
    emptyCapacityBefore: round1(emptyCapacityBefore),
    emptyCountAfter: emptyBinsAfterSet.size,
    emptyCapacityAfter: round1(emptyCapacityAfter),

    totalCapacityBefore: round1(totalCapacityBefore),
    totalCapacityAfter: round1(totalCapacityAfter),
    usedCapacityBefore: round1(usedCapacityBefore),
    usedCapacityAfter: round1(usedCapacityAfter),
    capacityUtilizationBefore: pct(usedCapacityBefore, totalCapacityBefore),
    capacityUtilizationAfter: pct(usedCapacityAfter, totalCapacityAfter),
    capacityFreed: round1(freedBinDetails.reduce((sum, item) => sum + item.capacity, 0)),

    sourceBinsTouched: sourceBinsTouched.size,
    targetBinsTouched: targetBinsTouched.size,
    sourceDrainRate: pct(sourceBinsFullyDrained, sourceBinsTouched.size),
    palPerMove: round1(totalPALMoved / Math.max(1, moveList.length)),
    movesPerFreedBin: round1(moveList.length / Math.max(1, freedBinList.length || 1)),
    sameRowMoves: sameRowMoves.length,
    crossRowMoves: crossRowMoves.length,
    sameRowRate: pct(sameRowMoves.length, moveList.length),
    avgRowDistance: round1(mean(motionDistances)),
    avgTargetFillRate: round1(mean(targetFillRates)),
    avgTargetHeadroom: round1(mean(targetHeadroom)),

    avgBinsPerMaterialBefore,
    avgBinsPerMaterialAfter,
    multiBinMaterialsBefore,
    multiBinMaterialsAfter,
    totalBinReductions,
    fragmentationReductionPct: pct(
      Math.max(0, multiBinMaterialsBefore - multiBinMaterialsAfter),
      Math.max(1, multiBinMaterialsBefore)
    ),

    rowImpact,
    topReductionMaterials: topReductionMaterials.slice(0, 8),
    topMovedMaterials,
    freedBinDetails: freedBinDetails.slice(0, 8),
  };
}
