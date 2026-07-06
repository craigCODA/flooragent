import { getWarehouse, normBin, parseBin, toNum } from "./bin.js";
import { SIDE_BINS, effectiveCapacity } from "./capacity.js";
import { LAYOUT_BIN_SET } from "./layout.js";
import { buildBinState } from "./sap.js";

export const LINE_PREFERRED_ROWS = {
  1: new Set(["A", "B"]),
  2: new Set(["A", "B", "C"]),
  3: new Set(["C", "D", "E", "F"]),
  4: new Set(["C", "D", "E", "F"]),
  5: new Set(["C", "D", "E", "F"]),
  6: new Set(["D", "E", "F"]),
  7: new Set(["C", "D", "E", "F", "G"]),
  8: new Set(["E", "F", "G"]),
  9: new Set(["E", "F", "G", "H"]),
};

const MIN_FREE_FOR_NONEMPTY = 1;
const PLAN_GUARD_LIMIT = 500;
const LAST_RESORT_TARGET_ROWS = new Set(["H", "HH", "I", "II"]);
const HHII_ROWS = new Set(["HH", "II"]);
const HIGH_VALUE_ROWS = new Set(["D", "E", "F", "G"]);

function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return h;
}

const ROW_TIER = {
  A: 1.5, B: 1.3, C: 1.3,
  D: 1.4, E: 1.4,
  F: 1.6, G: 1.6,
  H: 0.7, HH: 0.3,
  I: 0.8, II: 0.6,
  J: 1.0,
  "3A": 1.2, "3B": 1.2, "3C": 1.1,
  "3D": 1.1, "3E": 1.0, "3F": 1.0,
};

export function binValue(binId, binState, overrides = {}) {
  const cap = effectiveCapacity(binId, binState, overrides);
  const { rowKey } = parseBin(binId);
  const tier = ROW_TIER[rowKey] ?? 1.0;
  return cap * tier;
}

export function moveKey(materialId, from, to) {
  return `${String(materialId || "").trim()}|${normBin(from)}|${normBin(to)}`;
}

function scaleQty(qty) {
  return Math.round(Number(qty || 0) * 1000);
}

function candidatePriorityTuple(candidate) {
  return [
    candidate.emptiesCreated || 0,
    Number((candidate.sourceValue || 0).toFixed(3)),
    -((candidate.moveCount || 0)),
    -Number((candidate.totalLeftover || 0).toFixed(3)),
    -Number((candidate.totalMoved || 0).toFixed(3)),
    Number((candidate.tieBreaker || 0).toFixed(6)),
  ];
}

function comparePriority(a, b) {
  const A = candidatePriorityTuple(a);
  const B = candidatePriorityTuple(b);
  for (let i = 0; i < A.length; i++) {
    if (A[i] !== B[i]) return B[i] - A[i];
  }
  return 0;
}

export function consolidate({
  stockRows,
  emptyBinsSet,
  emptyBinTypes,
  abcThreshold,
  phase2Enabled,
  phase2Threshold,
  allowSrc110,
  allowTgt110,
  allowTgt111,
  lockedBins,
  capOverrides = {},
  disabledBins = new Set(),
  excludeHISource = true,
  avoidedSourceRows = null,
  maxSourceQty = null,
  excludedBinSet = new Set(),
  avoidedTargetRows = new Set(),
  ignoredMoveKeys = new Set(),
  abcNeverTarget = true,
}) {
  const binState = buildBinState(stockRows);
  const moves = [];
  let moveId = 1;
  const materialDescMap = {};
  const hhiiFollowupTargets = new Set();
  const recentlyFreed = new Set();
  const emptyBins = Array.from(emptyBinsSet || []).map(normBin).filter(Boolean);
  const sourceQtyLimit = maxSourceQty ?? (phase2Enabled ? phase2Threshold : abcThreshold);
  const NEVER_SOURCE_ROWS = avoidedSourceRows ?? (excludeHISource ? new Set(["H", "I"]) : new Set());

  for (const r of stockRows) materialDescMap[r.materialId] = r.materialDesc || "";

  const liveFree = (binId) => {
    const cap = effectiveCapacity(binId, binState, capOverrides);
    const used = binState[binId]?.totalQty || 0;
    return Math.max(0, cap - used);
  };

  const isNonEmpty = (binId) => (binState[binId]?.totalQty || 0) > 0;
  const typeOf = (binId) => String(binState[binId]?.storageType || emptyBinTypes?.[binId] || "");

  const canTargetType = (binId) => {
    const t = typeOf(binId);
    if (t === "110" && !allowTgt110) return false;
    if (t === "111" && !allowTgt111) return false;
    return true;
  };

  const isSourceEligibleBin = (binId, st) => {
    if (!st || (st.totalQty || 0) <= 0) return false;
    if (lockedBins?.has(binId)) return false;
    if (disabledBins?.has(binId)) return false;
    if (st.storageType === "111") return false;
    if (st.storageType === "110" && !allowSrc110) return false;
    if (!LAYOUT_BIN_SET.has(normBin(binId))) return false;
    const { rowKey } = parseBin(binId);
    if (HHII_ROWS.has(rowKey)) return false;
    if (NEVER_SOURCE_ROWS.has(rowKey)) return false;
    if (excludedBinSet.has(binId)) return false;
    return true;
  };

  const canReceiveMaterial = (binId, materialId, fromBinId) => {
    const { rowKey, upper } = parseBin(binId);
    if (abcNeverTarget && (rowKey === "A" || rowKey === "B" || rowKey === "C")) return false;
    if (avoidedTargetRows.has(rowKey)) return false;
    if (SIDE_BINS.has(upper)) return false;
    if (!LAYOUT_BIN_SET.has(upper)) return false;
    if (lockedBins?.has(normBin(binId))) return false;
    if (disabledBins?.has(normBin(binId))) return false;
    if (excludedBinSet.has(normBin(binId))) return false;
    if (!canTargetType(binId)) return false;
    if (getWarehouse(binId) !== getWarehouse(fromBinId)) return false;
    const binHasR = normBin(binId).includes("R");
    const fromHasR = normBin(fromBinId).includes("R");
    if (binHasR !== fromHasR) return false;
    if (isNonEmpty(binId)) {
      return binState[binId]?.materials?.has(materialId) === true;
    }
    return true;
  };

  const applyMove = (materialId, from, to, qty, tag = "normal") => {
    const q = Number(qty.toFixed(3));
    if (q <= 0) return;
    if (ignoredMoveKeys.has(moveKey(materialId, from, to))) return;

    moves.push({
      id: moveId++,
      materialId,
      materialDesc: materialDescMap[materialId] || "",
      from,
      to,
      qty: q,
      tag,
    });
    const newIdx = moves.length - 1;

    for (let i = 0; i < newIdx; i++) {
      const prev = moves[i];
      if (!prev) continue;
      if (prev.to !== from || prev.materialId !== materialId) continue;
      if (prev.from === to) continue;

      if (prev.qty <= moves[newIdx].qty + 1e-6) {
        if (ignoredMoveKeys.has(moveKey(materialId, prev.from, to))) continue;
        prev.to = to;
        moves[newIdx].qty = Number((moves[newIdx].qty - prev.qty).toFixed(3));
        if (moves[newIdx].qty < 1e-6) {
          moves[newIdx] = null;
          break;
        }
      } else {
        if (ignoredMoveKeys.has(moveKey(materialId, prev.from, to))) continue;
        const absorbed = moves[newIdx].qty;
        prev.qty = Number((prev.qty - absorbed).toFixed(3));
        moves.push({
          id: moveId++,
          materialId,
          materialDesc: materialDescMap[materialId] || "",
          from: prev.from,
          to,
          qty: Number(absorbed.toFixed(3)),
          tag: prev.tag,
        });
        moves[newIdx] = null;
        break;
      }
    }

    if (binState[from]) {
      binState[from].totalQty -= q;
      if (binState[from].totalQty < 1e-6) binState[from].totalQty = 0;
      binState[from].byMaterialQty[materialId] = (binState[from].byMaterialQty[materialId] || 0) - q;
      if (binState[from].byMaterialQty[materialId] < 1e-6) binState[from].byMaterialQty[materialId] = 0;
      if (binState[from].byMaterialQty[materialId] <= 0) {
        delete binState[from].byMaterialQty[materialId];
        binState[from].materials.delete(materialId);
      }
    }

    if (!binState[to]) {
      binState[to] = {
        totalQty: 0,
        storageType: emptyBinTypes?.[to] || "",
        materials: new Set(),
        byMaterialQty: {},
        descByMaterial: {},
      };
    }
    if (!binState[to].storageType) binState[to].storageType = emptyBinTypes?.[to] || "";
    binState[to].totalQty += q;
    binState[to].materials.add(materialId);
    binState[to].byMaterialQty[materialId] = (binState[to].byMaterialQty[materialId] || 0) + q;
    if (!binState[to].descByMaterial[materialId]) {
      binState[to].descByMaterial[materialId] = materialDescMap[materialId] || "";
    }
  };

  const maybeApplyHhIiFollowup = (materialId, targetBin) => {
    if (hhiiFollowupTargets.has(targetBin)) return false;

    const targetFree = liveFree(targetBin);
    if (targetFree <= 0) return false;

    const followup = Object.entries(binState)
      .map(([binId, st]) => ({ binId, st, rowKey: parseBin(binId).rowKey }))
      .filter(({ binId, st, rowKey }) => {
        if (!HHII_ROWS.has(rowKey)) return false;
        if (binId === targetBin) return false;
        if ((st?.totalQty || 0) <= 0) return false;
        if (st.storageType === "111") return false;
        if (st.storageType === "110" && !allowSrc110) return false;
        if (lockedBins?.has(binId)) return false;
        if (disabledBins?.has(binId)) return false;
        if (excludedBinSet.has(binId)) return false;
        if (!canReceiveMaterial(targetBin, materialId, binId)) return false;
        if (ignoredMoveKeys.has(moveKey(materialId, binId, targetBin))) return false;
        if (st.materials?.size !== 1 || !st.materials.has(materialId)) return false;
        const qty = st.byMaterialQty?.[materialId] || 0;
        return qty > 0 && qty <= targetFree;
      })
      .sort((a, b) => {
        const aQty = a.st.byMaterialQty?.[materialId] || 0;
        const bQty = b.st.byMaterialQty?.[materialId] || 0;
        if (bQty !== aQty) return bQty - aQty;
        if (a.rowKey !== b.rowKey) return a.rowKey.localeCompare(b.rowKey);
        return a.binId.localeCompare(b.binId);
      })[0];

    if (!followup) return false;

    applyMove(
      materialId,
      followup.binId,
      targetBin,
      followup.st.byMaterialQty[materialId],
      "hhii-followup"
    );
    if ((binState[followup.binId]?.totalQty || 0) < 1e-6) recentlyFreed.add(followup.binId);
    hhiiFollowupTargets.add(targetBin);
    return true;
  };

  // Material-first planning:
  // 1. Start from live bin state, not from a flat move search.
  // 2. Group candidate source bins by warehouse + material so moves stay physical.
  // 3. Score plans by emptied bins first, then by row/value quality and move count.
  const buildMaterialGroups = () => {
    const groups = {};
    for (const [binId, st] of Object.entries(binState)) {
      if (!isSourceEligibleBin(binId, st)) continue;
      if (st.materials.size !== 1) continue;
      const materialId = Array.from(st.materials)[0];
      const qty = st.byMaterialQty?.[materialId] || 0;
      if (qty <= 0) continue;
      if (sourceQtyLimit !== null && qty > sourceQtyLimit) continue;

      const warehouse = getWarehouse(binId);
      const groupKey = `${warehouse}|${materialId}`;
      if (!groups[groupKey]) groups[groupKey] = [];
      groups[groupKey].push({
        binId,
        warehouse,
        materialId,
        qty,
        rowKey: parseBin(binId).rowKey,
        sourceValue: binValue(binId, binState, capOverrides),
      });
    }
    return groups;
  };

  const scoreTarget = (targetBin, source, fillQty = source.qty) => {
    const free = liveFree(targetBin);
    const { rowKey: tRow } = parseBin(targetBin);
    const leftover = Math.max(0, free - fillQty);
    const sameRow = tRow === source.rowKey ? 1 : 0;
    const preferredRow = LAST_RESORT_TARGET_ROWS.has(tRow) ? 0 : 1;
    const highValueTarget = HIGH_VALUE_ROWS.has(tRow) ? 1 : 0;
    const cap = effectiveCapacity(targetBin, binState, capOverrides);
    const lex = 1 / (1 + Math.abs(hashString(targetBin) % 997));
    return (
      preferredRow * 1_000_000 +
      highValueTarget * 100_000 +
      sameRow * 10_000 +
      Math.max(0, 200 - leftover) * 100 +
      Math.max(0, 60 - cap) * 10 +
      lex
    );
  };

  const chooseBestNonEmptyPlan = (materialId, sources) => {
    const existingBins = Object.keys(binState);
    let best = null;

    for (const source of sources) {
      const targets = existingBins
        .filter((t) => t !== source.binId && isNonEmpty(t))
        .filter((t) => canReceiveMaterial(t, materialId, source.binId))
        .filter((t) => !ignoredMoveKeys.has(moveKey(materialId, source.binId, t)))
        .filter((t) => liveFree(t) >= MIN_FREE_FOR_NONEMPTY)
        .sort((a, b) => scoreTarget(b, source) - scoreTarget(a, source) || a.localeCompare(b));

      if (!targets.length) continue;

      const oneShot = targets
        .filter((t) => liveFree(t) >= source.qty)
        .sort((a, b) => {
          const aLeft = liveFree(a) - source.qty;
          const bLeft = liveFree(b) - source.qty;
          if (aLeft !== bLeft) return aLeft - bLeft;
          return scoreTarget(b, source) - scoreTarget(a, source);
        })[0];

      if (oneShot) {
        const candidate = {
          kind: "material-fill",
          materialId,
          tag: "normal",
          emptiesCreated: 1,
          sourceValue: source.sourceValue,
          moveCount: 1,
          totalMoved: source.qty,
          totalLeftover: liveFree(oneShot) - source.qty,
          tieBreaker: hashString(`${source.binId}|${oneShot}`),
          sourceBins: [source.binId],
          moves: [{ from: source.binId, to: oneShot, qty: source.qty, tag: "normal" }],
        };
        if (!best || comparePriority(best, candidate) > 0) best = candidate;
        continue;
      }

      const limitedTargets = targets.slice(0, 8);
      for (let i = 0; i < limitedTargets.length; i++) {
        for (let j = i + 1; j < limitedTargets.length; j++) {
          const tA = limitedTargets[i];
          const tB = limitedTargets[j];
          const freeA = liveFree(tA);
          const freeB = liveFree(tB);
          if (freeA + freeB < source.qty) continue;

          // Try both orderings — pick the one where each target scores better
          // against the qty it will actually receive.
          let first, second, firstQty, secondQty;
          const qtyIfFirst_A = Math.min(freeA, source.qty);
          const qtyIfFirst_B = Math.min(freeB, source.qty);
          const scoreA_asFirst  = scoreTarget(tA, source, qtyIfFirst_A);
          const scoreB_asFirst  = scoreTarget(tB, source, qtyIfFirst_B);
          const remA = source.qty - qtyIfFirst_A;
          const remB = source.qty - qtyIfFirst_B;
          // Order A: tA gets the larger chunk
          const orderA_valid = remA >= 0 && remA <= freeB;
          // Order B: tB gets the larger chunk
          const orderB_valid = remB >= 0 && remB <= freeA;

          if (!orderA_valid && !orderB_valid) continue;

          if (!orderA_valid) {
            first = tB; second = tA; firstQty = qtyIfFirst_B; secondQty = remB;
          } else if (!orderB_valid) {
            first = tA; second = tB; firstQty = qtyIfFirst_A; secondQty = remA;
          } else {
            // Both valid — pick the order where the "first" target scores higher
            // against its actual fill qty (better row fit, less leftover).
            const scoreA_asSec = scoreTarget(tA, source, remB);
            const scoreB_asSec = scoreTarget(tB, source, remA);
            const scoreOrderA = scoreA_asFirst + scoreB_asSec;
            const scoreOrderB = scoreB_asFirst + scoreA_asSec;
            if (scoreOrderA >= scoreOrderB) {
              first = tA; second = tB; firstQty = qtyIfFirst_A; secondQty = remA;
            } else {
              first = tB; second = tA; firstQty = qtyIfFirst_B; secondQty = remB;
            }
          }

          if (secondQty <= 0) continue;

          const candidate = {
            kind: "material-fill",
            materialId,
            tag: "normal",
            emptiesCreated: 1,
            sourceValue: source.sourceValue,
            moveCount: 2,
            totalMoved: source.qty,
            totalLeftover: (liveFree(first) - firstQty) + (liveFree(second) - secondQty),
            tieBreaker: hashString(`${source.binId}|${first}|${second}`),
            sourceBins: [source.binId],
            moves: [
              { from: source.binId, to: first, qty: firstQty, tag: "normal" },
              { from: source.binId, to: second, qty: secondQty, tag: "normal" },
            ],
          };
          if (!best || comparePriority(best, candidate) > 0) best = candidate;
        }
      }
    }

    return best;
  };

  const chooseBestEmptyPackPlan = (materialId, sources) => {
    const candidates = sources.filter((src) => src.qty > 0);
    if (candidates.length < 2) return null;

    let best = null;
    for (const emptyBin of emptyBins) {
      if (isNonEmpty(emptyBin)) continue;
      if (recentlyFreed.has(emptyBin)) continue;
      if (!canReceiveMaterial(emptyBin, materialId, candidates[0].binId)) continue;

      const targetCap = effectiveCapacity(emptyBin, binState, capOverrides);
      if (targetCap <= 0) continue;

      const states = new Map([[0, { indices: [], sourceValue: 0 }]]);
      candidates.forEach((src, idx) => {
        const qtyScaled = scaleQty(src.qty);
        const snapshot = Array.from(states.entries());
        for (const [filledScaled, state] of snapshot) {
          const nextFilled = filledScaled + qtyScaled;
          if (nextFilled > scaleQty(targetCap)) continue;
          const nextState = {
            indices: [...state.indices, idx],
            sourceValue: state.sourceValue + src.sourceValue,
          };
          const existing = states.get(nextFilled);
          // Prefer: more bins emptied first (more empties = better plan score),
          // then higher total source value as tiebreaker (frees more valuable bins).
          if (
            !existing ||
            nextState.indices.length > existing.indices.length ||
            (nextState.indices.length === existing.indices.length &&
              nextState.sourceValue > existing.sourceValue)
          ) {
            states.set(nextFilled, nextState);
          }
        }
      });

      for (const [filledScaled, state] of states.entries()) {
        if (state.indices.length < 2) continue;
        const totalMoved = filledScaled / 1000;
        const leftover = targetCap - totalMoved;
        const selectedSources = state.indices.map((idx) => candidates[idx]);
        const sourceValue = selectedSources.reduce((sum, src) => sum + src.sourceValue, 0);
        const candidate = {
          kind: "tight-pack",
          materialId,
          tag: "tight-empty-pack",
          emptiesCreated: selectedSources.length,
          sourceValue,
          moveCount: selectedSources.length,
          totalMoved,
          totalLeftover: leftover,
          tieBreaker: hashString(`${materialId}|${emptyBin}|${selectedSources.map((s) => s.binId).join("|")}`),
          sourceBins: selectedSources.map((s) => s.binId),
          moves: selectedSources.map((src) => ({
            from: src.binId,
            to: emptyBin,
            qty: src.qty,
            tag: "tight-empty-pack",
          })),
        };
        if (!best || comparePriority(best, candidate) > 0) best = candidate;
      }
    }

    return best;
  };

  for (let guard = 0; guard < PLAN_GUARD_LIMIT; guard++) {
    const materialGroups = buildMaterialGroups();
    let bestCandidate = null;

    for (const [groupKey, sources] of Object.entries(materialGroups)) {
      const materialId = sources[0]?.materialId || groupKey.split("|")[1];
      const sortedSources = [...sources].sort((a, b) => {
        if (a.qty !== b.qty) return a.qty - b.qty;
        if (b.sourceValue !== a.sourceValue) return b.sourceValue - a.sourceValue;
        return a.binId.localeCompare(b.binId);
      });

      const nonEmptyPlan = chooseBestNonEmptyPlan(materialId, sortedSources);
      if (nonEmptyPlan && (!bestCandidate || comparePriority(bestCandidate, nonEmptyPlan) > 0)) {
        bestCandidate = nonEmptyPlan;
      }

      const emptyPackPlan = chooseBestEmptyPackPlan(materialId, sortedSources);
      if (emptyPackPlan && (!bestCandidate || comparePriority(bestCandidate, emptyPackPlan) > 0)) {
        bestCandidate = emptyPackPlan;
      }
    }

    if (!bestCandidate) break;

    for (const move of bestCandidate.moves) {
      applyMove(bestCandidate.materialId, move.from, move.to, move.qty, move.tag);
      if ((binState[move.from]?.totalQty || 0) < 1e-6) recentlyFreed.add(move.from);
    }

    if (bestCandidate.kind === "material-fill" && bestCandidate.moves.length > 0) {
      const finalTarget = bestCandidate.moves[bestCandidate.moves.length - 1].to;
      maybeApplyHhIiFollowup(bestCandidate.materialId, finalTarget);
    }
  }

  const finalMoves = moves
    .filter(Boolean)
    .filter((m) => m.qty > 1e-6)
    .map((m, i) => ({ ...m, id: i + 1 }));

  return { moves: finalMoves, finalBinState: binState };
}

export function findBestBin({
  query,
  qtyNeeded,
  stockRows,
  emptyBinsSet,
  emptyBinTypes,
  allowAB,
  allowTgt110,
  allowTgt111,
  capOverrides = {},
  avoidedTargetRows = new Set(),
}) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return { ok: false, reason: "Enter a material number or description." };
  const normalizeSearchText = (value) =>
    String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  const searchTokens = normalizeSearchText(q)
    .split(" ")
    .filter((token) => token.length >= 2);
  const scoreMaterialMatch = (materialId, materialDesc) => {
    const idText = normalizeSearchText(materialId);
    const descText = normalizeSearchText(materialDesc);
    const combined = `${idText} ${descText}`.trim();
    if (!combined) return 0;
    if (combined.includes(normalizeSearchText(q))) return 100 + normalizeSearchText(q).length;
    if (searchTokens.length === 0) return 0;
    let score = 0;
    for (const token of searchTokens) {
      if (combined.includes(token)) {
        score += token.length >= 4 ? 12 : 8;
      }
    }
    return score;
  };
  const need = toNum(qtyNeeded);
  const binState = buildBinState(stockRows);
  const materialMap = {};
  for (const r of stockRows) {
    if (!materialMap[r.materialId]) materialMap[r.materialId] = r.materialDesc || "";
  }
  const ids = Object.keys(materialMap);
  const matchedId =
    ids.find((id) => id.toLowerCase() === q) ||
    ids.find((id) => id.toLowerCase().startsWith(q)) ||
    ids
      .map((id) => ({ id, score: scoreMaterialMatch(id, materialMap[id] || "") }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))[0]?.id;
  if (!matchedId) return { ok: false, reason: "No material match found in the loaded export." };

  let materialIsR = null;
  let materialWarehouse = null;
  for (const b of Object.keys(binState)) {
    if (binState[b]?.materials?.has(matchedId)) {
      materialIsR = b.includes("R");
      materialWarehouse = getWarehouse(b);
      break;
    }
  }

  const allowedTargetType = (type) => {
    if (type === "110") return !!allowTgt110;
    if (type === "111") return !!allowTgt111;
    return true;
  };

  const free = (bin) => {
    const cap = effectiveCapacity(bin, binState, capOverrides);
    const used = binState[bin]?.totalQty || 0;
    return Math.max(0, cap - used);
  };

  const typeOf = (bin) => String(binState[bin]?.storageType || emptyBinTypes?.[bin] || "");
  const isNonEmpty = (bin) => (binState[bin]?.totalQty || 0) > 0;

  const canUse = (bin) => {
    const B = normBin(bin);
    if (!B) return false;
    if (!LAYOUT_BIN_SET.has(B)) return false;
    const { rowKey } = parseBin(B);
    if (!allowAB && (rowKey === "A" || rowKey === "B" || rowKey === "C")) return false;
    if (avoidedTargetRows.has(rowKey)) return false;
    const t = typeOf(B);
    if (!allowedTargetType(t)) return false;
    if (materialIsR !== null && B.includes("R") !== materialIsR) return false;
    if (materialWarehouse && getWarehouse(B) !== materialWarehouse) return false;
    const f = free(B);
    if (f <= 0) return false;
    if (need > 0 && f < need) return false;
    if (isNonEmpty(B)) {
      if (!binState[B]?.materials?.has(matchedId)) return false;
    }
    return true;
  };

  const candidates = [];
  for (const b of Object.keys(binState)) {
    if (binState[b]?.materials?.has(matchedId) && canUse(b)) {
      candidates.push({
        bin: b,
        free: free(b),
        cap: effectiveCapacity(b, binState, capOverrides),
        storageType: typeOf(b),
        sameMaterial: true,
        emptyPreferred: false,
      });
    }
  }
  for (const b of Array.from(emptyBinsSet || [])) {
    const B = normBin(b);
    if (!B || (binState[B]?.totalQty || 0) > 0) continue;
    const t = String(emptyBinTypes?.[B] || "");
    if (t && !allowedTargetType(t)) continue;
    if (canUse(B)) {
      candidates.push({
        bin: B,
        free: effectiveCapacity(B, binState, capOverrides),
        cap: effectiveCapacity(B, binState, capOverrides),
        storageType: t,
        sameMaterial: false,
        emptyPreferred: true,
      });
    }
  }

  if (!candidates.length) return { ok: false, reason: "No suitable bin found under the current rules." };

  candidates.sort((a, b) => {
    if (a.sameMaterial !== b.sameMaterial) return a.sameMaterial ? -1 : 1;
    if (a.emptyPreferred !== b.emptyPreferred) return a.emptyPreferred ? -1 : 1;
    if (a.free !== b.free) return b.free - a.free;
    return a.bin.localeCompare(b.bin);
  });

  return {
    ok: true,
    materialId: matchedId,
    materialDesc: materialMap[matchedId] || "",
    best: candidates[0],
    top: candidates.slice(0, 10),
  };
}
