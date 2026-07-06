import {
  analyzeMaterialScatter,
  scoreAisleCandidate,
  generateProximityPlan,
  DRIVE_AISLES,
} from "../../../../domain/proximity";
import { resolveMaterial } from "./materialResolver";

// ─── Phase 1: Analyze ────────────────────────────────────────────────
export function handleProximityOrganize(ctx) {
  const { entities, binState, rawInput, emptyBinsFromExport, capOverrides } = ctx;

  if (!binState || Object.keys(binState).length === 0) {
    return { type: "error", text: "No SAP data loaded. Load an export first." };
  }

  const resolved = resolveMaterial(entities, rawInput, binState);
  if (!resolved.id && resolved.ambiguous) {
    const list = resolved.ambiguous.map((m) => `**${m.materialId}** — ${m.desc}`);
    return {
      type: "list",
      text: "Multiple materials match. Which one did you mean?",
      items: list,
    };
  }
  if (!resolved.id) {
    return { type: "info", text: "Which material? Try **\"organize material 12345\"** or use a description like **\"organize blue caps\"**." };
  }
  const materialId = resolved.id;

  const scatter = analyzeMaterialScatter(materialId, binState);

  if (scatter.binCount === 0) {
    return { type: "info", text: `Material **${materialId}** not found in any bin.` };
  }

  const aisleCount = Object.keys(scatter.byAisle).length;
  if (aisleCount <= 1) {
    return {
      type: "info",
      highlight: "Already Organized",
      text: `Material **${materialId}** is already in a single aisle. No proximity moves needed.`,
    };
  }

  // Score each aisle
  const emptySet = emptyBinsFromExport || new Set();
  const aisleScores = [];
  for (const [aisleStr, pair] of Object.entries(DRIVE_AISLES)) {
    const aisleNum = Number(aisleStr);
    const score = scoreAisleCandidate(aisleNum, materialId, binState, emptySet, capOverrides || {});
    const aisleData = scatter.byAisle[aisleStr];
    aisleScores.push({
      aisleNum,
      label: `Aisle ${aisleStr} (${pair.left}/${pair.right})`,
      existing: aisleData ? aisleData.pal : 0,
      existingBins: aisleData ? aisleData.binCount : 0,
      freeSpace: score.freeSpace,
      emptyBinCount: score.emptyBinCount,
      score: score.score,
    });
  }

  aisleScores.sort((a, b) => b.score - a.score);

  const recommended = aisleScores[0];
  const desc = scatter.materialDesc ? ` — ${scatter.materialDesc}` : "";

  const options = aisleScores
    .filter((a) => a.score > 0)
    .slice(0, 5)
    .map((a) => ({
      id: String(a.aisleNum),
      label: `${a.label}: ${a.existing} PAL existing, ${a.freeSpace} free, ${a.emptyBinCount} empty bins`,
      badge: a.aisleNum === recommended.aisleNum ? "Recommended" : undefined,
    }));

  return {
    type: "choice",
    highlight: "Proximity Organizer",
    text: `Material **${materialId}**${desc}\nSpread across **${aisleCount} aisles** (${scatter.totalPAL.toFixed(1)} PAL in ${scatter.binCount} bins).\n\nSelect a target aisle to group this material:`,
    options,
    startWorkflow: {
      id: `proximity-${materialId}-${Date.now()}`,
      step: "awaitAisleChoice",
      data: { materialId, materialDesc: scatter.materialDesc, scatter },
    },
  };
}

// ─── Workflow Continuation ───────────────────────────────────────────

export function continueProximityWorkflow(step, userInput, ctx, workflowData) {
  const input = String(userInput || "").trim().toLowerCase();

  switch (step) {
    case "optionSelected":
      return handleAisleSelected(userInput, ctx, workflowData);
    case "actionSelected":
      return handleActionSelected(userInput, ctx, workflowData);

    // Typed text during aisle selection phase
    case "awaitAisleChoice": {
      if (/\b(cancel|nevermind|stop|quit|exit)\b/.test(input)) {
        return { type: "info", text: "Proximity organize cancelled.", endWorkflow: true };
      }
      const aisleMatch = input.match(/\b([1-6])\b/);
      if (aisleMatch) {
        return handleAisleSelected(aisleMatch[1], ctx, workflowData);
      }
      return {
        type: "info",
        text: "Type an **aisle number** (1–6), click a button above, or type **cancel** to stop.",
      };
    }

    // Typed text during confirm/adjust/cancel phase
    case "awaitAction": {
      // Check multi-word phrases first so "go back" → adjust, not confirm
      if (/\bgo\s*back\b/.test(input)) {
        return handleActionSelected("adjust", ctx, workflowData);
      }
      if (/\b(adjust|change|different|back|redo|other)\b/.test(input)) {
        return handleActionSelected("adjust", ctx, workflowData);
      }
      if (/\b(confirm|yes|add|queue|ok|go)\b/.test(input)) {
        return handleActionSelected("confirm", ctx, workflowData);
      }
      if (/\b(cancel|no|stop|nevermind|quit|exit)\b/.test(input)) {
        return handleActionSelected("cancel", ctx, workflowData);
      }
      return {
        type: "info",
        text: "Type **confirm** to add moves to the queue, **adjust** to pick a different aisle, or **cancel** to stop.",
      };
    }

    default:
      return { type: "info", text: "Workflow step not recognized.", endWorkflow: true };
  }
}

// ─── Phase 2: Plan ───────────────────────────────────────────────────

function handleAisleSelected(aisleId, ctx, workflowData) {
  const { binState, emptyBinsFromExport, emptyBinTypes, capOverrides } = ctx;
  const { materialId, materialDesc } = workflowData;
  const targetAisle = Number(aisleId);
  const pair = DRIVE_AISLES[targetAisle];

  if (!pair) {
    return { type: "error", text: "Invalid aisle selection.", endWorkflow: true };
  }

  const plan = generateProximityPlan(
    materialId,
    targetAisle,
    binState,
    emptyBinsFromExport || new Set(),
    emptyBinTypes || {},
    { capOverrides: capOverrides || {} }
  );

  if (plan.directMoves.length === 0 && plan.cascadingMoves.length === 0) {
    return {
      type: "info",
      text: `No moves needed — material **${materialId}** either already in aisle ${targetAisle} or no space available.`,
      endWorkflow: true,
    };
  }

  // Build the move table
  const allMoves = [
    ...plan.cascadingMoves.map((m) => ({ ...m, type: "Cascade" })),
    ...plan.directMoves.map((m) => ({ ...m, type: "Direct" })),
  ];

  const tableRows = allMoves.map((m) => ({
    Type: m.type,
    From: m.from,
    To: m.to,
    Material: m.materialId,
    PAL: Number(m.qty.toFixed(1)),
    Reason: m.reason,
  }));

  const desc = materialDesc ? ` — ${materialDesc}` : "";

  return {
    type: "table",
    highlight: `Plan → Aisle ${targetAisle} (${pair.left}/${pair.right})`,
    text: `**${plan.summary.directCount}** direct move${plan.summary.directCount !== 1 ? "s" : ""}, **${plan.summary.cascadeCount}** cascading move${plan.summary.cascadeCount !== 1 ? "s" : ""} — **${plan.summary.totalPAL.toFixed(1)}** PAL total${plan.summary.gapsFilled > 0 ? `, ${plan.summary.gapsFilled} gap${plan.summary.gapsFilled !== 1 ? "s" : ""} filled` : ""}.`,
    table: {
      headers: ["Type", "From", "To", "Material", "PAL", "Reason"],
      rows: tableRows,
    },
    actions: [
      { id: "confirm", label: "Add to Queue", variant: "primary" },
      { id: "adjust", label: "Choose Different Aisle", variant: "secondary" },
      { id: "cancel", label: "Cancel", variant: "ghost" },
    ],
    nextStep: "awaitAction",
    workflowData: { plan, targetAisle },
  };
}

// ─── Phase 3: Confirm / Adjust / Cancel ──────────────────────────────

function handleActionSelected(actionId, ctx, workflowData) {
  const { materialId, materialDesc, plan, targetAisle } = workflowData;

  switch (actionId) {
    case "confirm": {
      if (!plan) {
        return { type: "error", text: "No plan to confirm.", endWorkflow: true };
      }

      const pair = DRIVE_AISLES[targetAisle];
      const allMoves = [
        ...plan.cascadingMoves.map((m) => ({
          materialId: m.materialId,
          materialDesc: m.materialDesc,
          from: m.from,
          to: m.to,
          qty: m.qty,
          tag: "proximity",
          targetAisle,
        })),
        ...plan.directMoves.map((m) => ({
          materialId: m.materialId,
          materialDesc: m.materialDesc,
          from: m.from,
          to: m.to,
          qty: m.qty,
          tag: "proximity",
          targetAisle,
        })),
      ];

      // Trigger the callback to add moves to the queue
      if (ctx.onProximityMovesReady && allMoves.length > 0) {
        ctx.onProximityMovesReady(allMoves);
      }

      const aisleLabel = pair ? `${pair.left}/${pair.right}` : targetAisle;
      return {
        type: "info",
        highlight: "Moves Queued",
        text: `**${allMoves.length}** proximity moves added to the queue for material **${materialId}** → Aisle ${targetAisle} (${aisleLabel}).`,
        endWorkflow: true,
      };
    }

    case "adjust": {
      // Re-run the analysis to re-present aisle choices
      const { binState, emptyBinsFromExport, capOverrides } = ctx;
      const scatter = analyzeMaterialScatter(materialId, binState);
      const emptySet = emptyBinsFromExport || new Set();
      const aisleScores = [];

      for (const [aisleStr, pair] of Object.entries(DRIVE_AISLES)) {
        const aisleNum = Number(aisleStr);
        const score = scoreAisleCandidate(aisleNum, materialId, binState, emptySet, capOverrides || {});
        const aisleData = scatter.byAisle[aisleStr];
        aisleScores.push({
          aisleNum,
          label: `Aisle ${aisleStr} (${pair.left}/${pair.right})`,
          existing: aisleData ? aisleData.pal : 0,
          freeSpace: score.freeSpace,
          emptyBinCount: score.emptyBinCount,
          score: score.score,
        });
      }

      aisleScores.sort((a, b) => b.score - a.score);
      const recommended = aisleScores[0];

      const options = aisleScores
        .filter((a) => a.score > 0)
        .slice(0, 5)
        .map((a) => ({
          id: String(a.aisleNum),
          label: `${a.label}: ${a.existing} PAL existing, ${a.freeSpace} free, ${a.emptyBinCount} empty bins`,
          badge: a.aisleNum === recommended.aisleNum ? "Recommended" : undefined,
        }));

      return {
        type: "choice",
        text: "Select a different target aisle:",
        options,
        nextStep: "awaitAisleChoice",
        workflowData: { materialId, materialDesc, scatter },
      };
    }

    case "cancel":
      return {
        type: "info",
        text: `Proximity organize for **${materialId}** cancelled.`,
        endWorkflow: true,
      };

    default:
      return { type: "info", text: "Unrecognized action.", endWorkflow: true };
  }
}
