import { normBin, parseBin } from "./bin";
import { effectiveCapacity, SIDE_BINS } from "./capacity";

// ─── Drive Aisle Definitions ────────────────────────────────────────
// Drive aisles are the corridors forklifts drive through, pairing rows
// that face each other (the opposite of tunnel pairs which share a back wall).

export const DRIVE_AISLES = {
  1: { left: "A", right: "B" },
  2: { left: "C", right: "D" },
  3: { left: "E", right: "F" },
  4: { left: "G", right: "H" },
  5: { left: "HH", right: "II" },
  6: { left: "I", right: "J" },
};

export const ROW_TO_AISLE = {
  A: 1, B: 1,
  C: 2, D: 2,
  E: 3, F: 3,
  G: 4, H: 4,
  HH: 5, II: 5,
  I: 6, J: 6,
};

export function getDriveAisle(rowKey) {
  return ROW_TO_AISLE[rowKey] ?? null;
}

export function getAislePair(aisleNum) {
  return DRIVE_AISLES[aisleNum] ?? null;
}

// ─── Scatter Analysis ───────────────────────────────────────────────

export function analyzeMaterialScatter(materialId, binState) {
  const byAisle = {};
  let totalPAL = 0;
  let binCount = 0;
  let materialDesc = "";

  for (const [binId, entry] of Object.entries(binState)) {
    const qty = entry.byMaterialQty?.[materialId];
    if (!qty || qty <= 0) continue;

    if (!materialDesc && entry.descByMaterial?.[materialId]) {
      materialDesc = entry.descByMaterial[materialId];
    }

    const { rowKey } = parseBin(binId);
    const aisle = getDriveAisle(rowKey);
    if (aisle == null) continue;

    if (!byAisle[aisle]) {
      byAisle[aisle] = { bins: [], pal: 0, binCount: 0 };
    }
    byAisle[aisle].bins.push({ binId, qty, rowKey });
    byAisle[aisle].pal += qty;
    byAisle[aisle].binCount += 1;
    totalPAL += qty;
    binCount += 1;
  }

  // Pick recommendation: aisle with the most PAL already there
  let bestAisle = null;
  let bestPAL = -1;
  for (const [aisleStr, data] of Object.entries(byAisle)) {
    if (data.pal > bestPAL) {
      bestPAL = data.pal;
      bestAisle = Number(aisleStr);
    }
  }

  const aisleCount = Object.keys(byAisle).length;
  const recommendation = bestAisle != null
    ? {
        aisle: bestAisle,
        reason: aisleCount <= 1
          ? "Already concentrated in one aisle"
          : `Aisle ${bestAisle} has the most existing stock (${bestPAL} PAL)`,
      }
    : null;

  return { materialId, materialDesc, totalPAL, binCount, byAisle, recommendation };
}

// ─── Aisle Scoring ──────────────────────────────────────────────────

export function scoreAisleCandidate(aisleNum, materialId, binState, emptyBinsSet, capOverrides = {}) {
  const pair = getAislePair(aisleNum);
  if (!pair) return { score: 0, capacity: 0, existing: 0, gaps: 0 };

  const aisleRows = new Set([pair.left, pair.right]);
  let existing = 0;
  let existingBins = 0;
  let totalCapacity = 0;
  let freeSpace = 0;
  let emptyBinCount = 0;
  let gapCount = 0;

  // Count existing material and free space in occupied bins
  for (const [binId, entry] of Object.entries(binState)) {
    const { rowKey } = parseBin(binId);
    if (!aisleRows.has(rowKey)) continue;

    const cap = effectiveCapacity(binId, binState, capOverrides);
    totalCapacity += cap;
    const used = entry.totalQty || 0;
    freeSpace += Math.max(0, cap - used);

    const matQty = entry.byMaterialQty?.[materialId] || 0;
    if (matQty > 0) {
      existing += matQty;
      existingBins += 1;
    }

    // A gap is a bin occupied by different material between bins of our material
    if (used > 0 && matQty === 0) {
      gapCount += 1;
    }
  }

  // Count empty bins in this aisle
  for (const eb of emptyBinsSet) {
    const b = normBin(eb);
    const { rowKey } = parseBin(b);
    if (!aisleRows.has(rowKey)) continue;
    if ((binState[b]?.totalQty || 0) > 0) continue;
    const cap = effectiveCapacity(b, binState, capOverrides);
    totalCapacity += cap;
    freeSpace += cap;
    emptyBinCount += 1;
  }

  // Score: heavily weight existing material, then available space
  const score = existing * 10 + freeSpace * 2 + emptyBinCount * 5;

  return {
    score,
    capacity: totalCapacity,
    freeSpace,
    existing,
    existingBins,
    emptyBinCount,
    gaps: gapCount,
  };
}

// ─── Gap Opportunities ──────────────────────────────────────────────

export function findGapOpportunities(materialId, aisleNum, binState) {
  const pair = getAislePair(aisleNum);
  if (!pair) return [];

  const opportunities = [];
  const aisleRows = [pair.left, pair.right];

  for (const rowKey of aisleRows) {
    // Collect bins in this row that have our material, sorted by position
    const materialBins = [];
    const otherBins = [];

    for (const [binId, entry] of Object.entries(binState)) {
      const parsed = parseBin(binId);
      if (parsed.rowKey !== rowKey) continue;
      const pos = parseInt(parsed.num, 10);
      if (!Number.isFinite(pos)) continue; // skip HM and other non-numeric positions
      const matQty = entry.byMaterialQty?.[materialId] || 0;
      if (matQty > 0) {
        materialBins.push({ binId, num: pos, qty: matQty });
      } else if ((entry.totalQty || 0) > 0) {
        otherBins.push({
          binId,
          num: pos,
          totalQty: entry.totalQty,
          materials: entry.materials ? Array.from(entry.materials) : [],
        });
      }
    }

    if (materialBins.length < 2) continue;
    materialBins.sort((a, b) => a.num - b.num);

    // Look for other-material bins that fall between two of our material bins
    for (const other of otherBins) {
      const between = materialBins.some((a, i) => {
        const b = materialBins[i + 1];
        if (!b) return false;
        return other.num > a.num && other.num < b.num && (b.num - a.num) <= 6;
      });

      if (between) {
        opportunities.push({
          gapBin: other.binId,
          rowKey,
          occupiedBy: other.materials,
          qtyToMove: other.totalQty,
        });
      }
    }
  }

  return opportunities;
}

// ─── Proximity Plan Generation ──────────────────────────────────────

export function generateProximityPlan(materialId, targetAisle, binState, emptyBinsSet, emptyBinTypes, options = {}) {
  const { capOverrides = {}, maxCascadeDepth = 2 } = options;
  const pair = getAislePair(targetAisle);
  if (!pair) return { materialId, targetAisle, directMoves: [], cascadingMoves: [], summary: { directCount: 0, cascadeCount: 0, totalPAL: 0, gapsFilled: 0 } };

  const aisleRows = new Set([pair.left, pair.right]);

  // Deep-clone the relevant binState fields so we can simulate moves
  const simState = {};
  for (const [binId, entry] of Object.entries(binState)) {
    simState[binId] = {
      totalQty: entry.totalQty || 0,
      materials: new Set(entry.materials || []),
      byMaterialQty: { ...entry.byMaterialQty },
      storageType: entry.storageType || "",
      descByMaterial: { ...(entry.descByMaterial || {}) },
    };
  }

  const materialDesc = (() => {
    for (const entry of Object.values(binState)) {
      if (entry.descByMaterial?.[materialId]) return entry.descByMaterial[materialId];
    }
    return "";
  })();

  const liveFree = (binId) => {
    const cap = effectiveCapacity(binId, simState, capOverrides);
    const used = simState[binId]?.totalQty || 0;
    return Math.max(0, cap - used);
  };

  const canReceive = (binId, matId) => {
    const b = normBin(binId);
    // R-bin segregation
    const binHasR = b.includes("R");
    // Check if material is from R-bins
    let materialIsR = null;
    for (const [bId, entry] of Object.entries(binState)) {
      if (entry.byMaterialQty?.[matId] > 0) {
        materialIsR = normBin(bId).includes("R");
        break;
      }
    }
    if (materialIsR !== null && binHasR !== materialIsR) return false;

    // No-mix: if bin is occupied, must contain same material
    const entry = simState[b];
    if (entry && entry.totalQty > 0) {
      if (!entry.materials.has(matId)) return false;
    }
    return true;
  };

  const applySimMove = (from, to, qty, matId) => {
    // Deduct from source
    if (simState[from]) {
      simState[from].totalQty -= qty;
      if (simState[from].totalQty < 1e-6) simState[from].totalQty = 0;
      simState[from].byMaterialQty[matId] = (simState[from].byMaterialQty[matId] || 0) - qty;
      if (simState[from].byMaterialQty[matId] < 1e-6) {
        delete simState[from].byMaterialQty[matId];
        simState[from].materials.delete(matId);
      }
    }
    // Add to target
    if (!simState[to]) {
      simState[to] = {
        totalQty: 0,
        materials: new Set(),
        byMaterialQty: {},
        storageType: emptyBinTypes?.[to] || "",
        descByMaterial: {},
      };
    }
    simState[to].totalQty += qty;
    simState[to].materials.add(matId);
    simState[to].byMaterialQty[matId] = (simState[to].byMaterialQty[matId] || 0) + qty;
  };

  const directMoves = [];
  const cascadingMoves = [];

  // Step 1: Find all bins with our material outside the target aisle
  const sourceBins = [];
  for (const [binId, entry] of Object.entries(binState)) {
    const qty = entry.byMaterialQty?.[materialId];
    if (!qty || qty <= 0) continue;
    const { rowKey } = parseBin(binId);
    if (aisleRows.has(rowKey)) continue; // already in target aisle
    sourceBins.push({ binId, qty, rowKey });
  }

  // Sort: prefer smaller quantities first (easier to place)
  sourceBins.sort((a, b) => a.qty - b.qty);

  // Step 2: Find available target bins in the aisle
  const getTargetBins = () => {
    const targets = [];

    // Occupied bins with our material that have free space
    for (const [binId, entry] of Object.entries(simState)) {
      const { rowKey } = parseBin(binId);
      if (!aisleRows.has(rowKey)) continue;
      if ((entry.totalQty || 0) <= 0) continue;
      if (!entry.materials.has(materialId)) continue;
      const free = liveFree(binId);
      if (free <= 0) continue;
      targets.push({ binId, free, hasMaterial: true });
    }

    // Empty bins in the aisle
    for (const eb of emptyBinsSet) {
      const b = normBin(eb);
      const { rowKey } = parseBin(b);
      if (!aisleRows.has(rowKey)) continue;
      if ((simState[b]?.totalQty || 0) > 0) continue;
      if (!canReceive(b, materialId)) continue;
      const cap = effectiveCapacity(b, simState, capOverrides);
      if (cap <= 0) continue;
      targets.push({ binId: b, free: cap, hasMaterial: false });
    }

    // Sort: prefer bins that already have our material, then by most free space
    targets.sort((a, b) => {
      if (a.hasMaterial !== b.hasMaterial) return a.hasMaterial ? -1 : 1;
      return b.free - a.free;
    });

    return targets;
  };

  // Step 3: Place material from outside aisles into target aisle
  for (const src of sourceBins) {
    let remaining = simState[src.binId]?.byMaterialQty?.[materialId] || 0;
    if (remaining <= 0) continue;

    const targets = getTargetBins();
    for (const tgt of targets) {
      if (remaining <= 0) break;
      const free = liveFree(tgt.binId);
      if (free <= 0) continue;
      if (!canReceive(tgt.binId, materialId)) continue;

      const moveQty = Math.min(remaining, free);
      if (moveQty <= 0) continue;

      directMoves.push({
        from: src.binId,
        to: tgt.binId,
        qty: Number(moveQty.toFixed(3)),
        materialId,
        materialDesc,
        reason: `Move to aisle ${targetAisle} (${pair.left}/${pair.right})`,
      });
      applySimMove(src.binId, tgt.binId, moveQty, materialId);
      remaining -= moveQty;
    }

    // If no space found and cascading is allowed, try to cascade
    if (remaining > 0 && maxCascadeDepth > 0) {
      // Find occupied-by-other bins in the aisle we could clear
      const clearable = [];
      for (const [binId, entry] of Object.entries(simState)) {
        const { rowKey } = parseBin(binId);
        if (!aisleRows.has(rowKey)) continue;
        if ((entry.totalQty || 0) <= 0) continue;
        if (entry.materials.has(materialId)) continue;
        // Only cascade single-material bins
        if (entry.materials.size !== 1) continue;
        const blockerMat = Array.from(entry.materials)[0];
        const blockerQty = entry.totalQty;
        const cap = effectiveCapacity(binId, simState, capOverrides);

        // Can we relocate the blocker?
        let relocTarget = null;
        for (const eb of emptyBinsSet) {
          const b = normBin(eb);
          if ((simState[b]?.totalQty || 0) > 0) continue;
          if (!canReceive(b, blockerMat)) continue;
          const eCap = effectiveCapacity(b, simState, capOverrides);
          if (eCap >= blockerQty) {
            relocTarget = b;
            break;
          }
        }
        // Also check non-empty bins with same material and space
        if (!relocTarget) {
          for (const [bId, bEntry] of Object.entries(simState)) {
            if (bId === binId) continue;
            if ((bEntry.totalQty || 0) <= 0) continue;
            if (!bEntry.materials.has(blockerMat)) continue;
            if (bEntry.materials.size > 1) continue;
            const bFree = liveFree(bId);
            if (bFree >= blockerQty) {
              relocTarget = bId;
              break;
            }
          }
        }

        if (relocTarget) {
          clearable.push({ binId, blockerMat, blockerQty, cap, relocTarget });
        }
      }

      // Sort by capacity (prefer clearing larger bins)
      clearable.sort((a, b) => b.cap - a.cap);

      for (const c of clearable) {
        if (remaining <= 0) break;

        const blockerDesc = simState[c.binId]?.descByMaterial?.[c.blockerMat] || "";
        // Cascade: move blocker out
        cascadingMoves.push({
          from: c.binId,
          to: c.relocTarget,
          qty: Number(c.blockerQty.toFixed(3)),
          materialId: c.blockerMat,
          materialDesc: blockerDesc,
          reason: `Cascade: clear ${c.binId} for ${materialId}`,
        });
        applySimMove(c.binId, c.relocTarget, c.blockerQty, c.blockerMat);

        // Now move our material into the cleared bin
        const free = liveFree(c.binId);
        const moveQty = Math.min(remaining, free);
        if (moveQty > 0) {
          directMoves.push({
            from: src.binId,
            to: c.binId,
            qty: Number(moveQty.toFixed(3)),
            materialId,
            materialDesc,
            reason: `Move to aisle ${targetAisle} (after cascade)`,
          });
          applySimMove(src.binId, c.binId, moveQty, materialId);
          remaining -= moveQty;
        }
      }
    }
  }

  // Step 4: Fill gaps within the aisle (already-in-aisle optimization)
  const gaps = findGapOpportunities(materialId, targetAisle, simState);
  let gapsFilled = 0;
  for (const gap of gaps) {
    const gapEntry = simState[gap.gapBin];
    if (!gapEntry || gapEntry.totalQty <= 0) continue;
    if (gapEntry.materials.size !== 1) continue;

    const blockerMat = Array.from(gapEntry.materials)[0];
    const blockerQty = gapEntry.totalQty;

    // Find somewhere to relocate the gap occupant
    let relocTarget = null;
    for (const eb of emptyBinsSet) {
      const b = normBin(eb);
      if ((simState[b]?.totalQty || 0) > 0) continue;
      if (!canReceive(b, blockerMat)) continue;
      const eCap = effectiveCapacity(b, simState, capOverrides);
      if (eCap >= blockerQty) {
        relocTarget = b;
        break;
      }
    }

    if (!relocTarget) continue;

    const blockerDesc = gapEntry.descByMaterial?.[blockerMat] || "";
    cascadingMoves.push({
      from: gap.gapBin,
      to: relocTarget,
      qty: Number(blockerQty.toFixed(3)),
      materialId: blockerMat,
      materialDesc: blockerDesc,
      reason: `Gap fill: clear ${gap.gapBin} to create contiguous cluster`,
    });
    applySimMove(gap.gapBin, relocTarget, blockerQty, blockerMat);
    gapsFilled += 1;
  }

  return {
    materialId,
    materialDesc,
    targetAisle,
    directMoves,
    cascadingMoves,
    summary: {
      directCount: directMoves.length,
      cascadeCount: cascadingMoves.length,
      totalPAL: directMoves.reduce((s, m) => s + m.qty, 0),
      gapsFilled,
    },
  };
}

// ─── Post-Consolidation Scatter Detection ───────────────────────────

export function findMostScatteredMaterials(binState, topN = 5) {
  const materialAisles = {};

  for (const [binId, entry] of Object.entries(binState)) {
    if ((entry.totalQty || 0) <= 0) continue;
    const { rowKey } = parseBin(binId);
    const aisle = getDriveAisle(rowKey);
    if (aisle == null) continue;

    for (const [matId, qty] of Object.entries(entry.byMaterialQty || {})) {
      if (qty <= 0) continue;
      if (!materialAisles[matId]) {
        materialAisles[matId] = { aisles: new Set(), totalPAL: 0, desc: entry.descByMaterial?.[matId] || "" };
      }
      materialAisles[matId].aisles.add(aisle);
      materialAisles[matId].totalPAL += qty;
    }
  }

  return Object.entries(materialAisles)
    .filter(([, data]) => data.aisles.size >= 3)
    .map(([matId, data]) => ({
      materialId: matId,
      materialDesc: data.desc,
      aisleCount: data.aisles.size,
      totalPAL: data.totalPAL,
    }))
    .sort((a, b) => b.aisleCount - a.aisleCount || b.totalPAL - a.totalPAL)
    .slice(0, topN);
}
