import { findBestBin, LINE_PREFERRED_ROWS } from "../../../../domain/planning";
import { normBin, parseBin } from "../../../../domain/bin";
import { effectiveCapacity } from "../../../../domain/capacity";

// ─── Entry point ─────────────────────────────────────────────────────

export function handleProductionPlan(ctx) {
  if (!ctx.stockRows || ctx.stockRows.length === 0) {
    return { type: "error", text: "No SAP data loaded. Load an export first, then ask again." };
  }

  return {
    type: "info",
    highlight: "Production Schedule",
    text: "Let's build a putaway plan for your production run.\n\n**Which lines are running today?** (e.g. `1 3 7` or `1, 3, 7`)",
    startWorkflow: {
      type: "productionPlan",
      id: `prod-plan-${Date.now()}`,
      step: "awaitLines",
      data: { schedule: [] },
    },
  };
}

// ─── Workflow continuation ────────────────────────────────────────────

export function continueProductionPlanWorkflow(eventType, input, ctx, workflowData) {
  const text = String(input || "").trim();

  if (eventType === "actionSelected") {
    return handleActionSelected(input, ctx, workflowData);
  }

  if (/\b(cancel|stop|quit|exit|nevermind)\b/i.test(text)) {
    return { type: "info", text: "Production plan cancelled.", endWorkflow: true };
  }

  const step = workflowData?.currentStep || "awaitLines";

  switch (step) {
    case "awaitLines":
      return handleAwaitLines(text, workflowData);
    case "awaitMaterial":
      return handleAwaitMaterial(text, ctx, workflowData);
    case "awaitQty":
      return handleAwaitQty(text, ctx, workflowData);
    case "awaitApply":
      if (/\b(apply|yes|do it|confirm|rebuild)\b/i.test(text)) {
        return handleActionSelected("apply", ctx, workflowData);
      }
      if (/\b(no|done|skip|cancel)\b/i.test(text)) {
        return handleActionSelected("done", ctx, workflowData);
      }
      return {
        type: "info",
        text: "Type **apply** to push bins to the app and rebuild, or **done** to finish without applying.",
        nextStep: "awaitApply",
        workflowData,
      };
    default:
      return { type: "info", text: "Workflow step not recognized.", endWorkflow: true };
  }
}

// ─── Step 1: Which lines? ─────────────────────────────────────────────

function handleAwaitLines(text, workflowData) {
  const nums = [...text.matchAll(/\b([1-9])\b/g)].map((m) => Number(m[1]));
  const lines = [...new Set(nums)].filter((n) => LINE_PREFERRED_ROWS[n]).sort((a, b) => a - b);

  if (!lines.length) {
    return {
      type: "info",
      text: "I didn't catch any valid line numbers (1–9). Which lines are running? (e.g. `1 3 7`)",
      nextStep: "awaitLines",
      workflowData: {},
    };
  }

  const [first, ...rest] = lines;
  return {
    type: "info",
    text: `Got it — Lines **${lines.join(", ")}**.\n\nWhat material is running on **Line ${first}**?`,
    nextStep: "awaitMaterial",
    workflowData: {
      currentStep: "awaitMaterial",
      pendingLines: rest,
      currentLine: first,
      schedule: [],
    },
  };
}

// ─── Step 2: What material per line? ─────────────────────────────────

function handleAwaitMaterial(text, ctx, workflowData) {
  const { currentLine, pendingLines, schedule } = workflowData;

  // Try to match to a known material
  const q = text.trim().toLowerCase();
  const materialMap = {};
  for (const r of ctx.stockRows || []) {
    if (!materialMap[r.materialId]) materialMap[r.materialId] = r.materialDesc || "";
  }
  const ids = Object.keys(materialMap);

  const matchedId =
    ids.find((id) => id.toLowerCase() === q) ||
    ids.find((id) => id.toLowerCase().startsWith(q)) ||
    ids.find((id) => (materialMap[id] || "").toLowerCase().includes(q));

  if (!matchedId) {
    return {
      type: "info",
      text: `No material found matching **"${text}"** in the loaded data. Try a material number or partial description.`,
      nextStep: "awaitMaterial",
      workflowData,
    };
  }

  return {
    type: "info",
    text: `**${matchedId}** — ${materialMap[matchedId] || ""}.\n\nHow many pallets of this material are planned for **Line ${currentLine}**?`,
    nextStep: "awaitQty",
    workflowData: {
      ...workflowData,
      currentStep: "awaitQty",
      pendingMaterial: matchedId,
      pendingMaterialDesc: materialMap[matchedId] || "",
    },
  };
}

// ─── Step 3: How many pallets? ────────────────────────────────────────

function handleAwaitQty(text, ctx, workflowData) {
  const { currentLine, pendingLines, schedule, pendingMaterial, pendingMaterialDesc } = workflowData;

  const qtyMatch = text.match(/[\d.]+/);
  if (!qtyMatch) {
    return {
      type: "info",
      text: "Enter a pallet count (e.g. `24`).",
      nextStep: "awaitQty",
      workflowData,
    };
  }

  const qty = parseFloat(qtyMatch[0]);
  const updatedSchedule = [
    ...schedule,
    { line: currentLine, material: pendingMaterial, materialDesc: pendingMaterialDesc, qty },
  ];

  if (pendingLines.length > 0) {
    const [next, ...rest] = pendingLines;
    return {
      type: "info",
      text: `Got it — **${qty} PAL** of **${pendingMaterial}** on Line ${currentLine}.\n\nWhat material is running on **Line ${next}**?`,
      nextStep: "awaitMaterial",
      workflowData: {
        currentStep: "awaitMaterial",
        pendingLines: rest,
        currentLine: next,
        schedule: updatedSchedule,
      },
    };
  }

  // All lines collected — generate the plan
  return generatePlan(updatedSchedule, ctx);
}

// ─── Final: Generate plan ─────────────────────────────────────────────

function generatePlan(schedule, ctx) {
  const {
    stockRows, emptyBinsFromExport, emptyBinTypes,
    capOverrides, allowTgt110, allowTgt111, binState, lineBins,
  } = ctx;

  const lineBinMap = {};
  (lineBins || []).forEach((bin, i) => {
    const b = normBin(bin);
    if (b) lineBinMap[i + 1] = b;
  });

  const tableRows = [];
  const consolidationNeeded = [];

  for (const entry of schedule) {
    const preferredRows = LINE_PREFERRED_ROWS[entry.line] || new Set();
    const preferredRowList = [...preferredRows].join(", ");

    // Current bin from line bins setting
    const currentBin = lineBinMap[entry.line];
    let currentBinFree = null;
    if (currentBin && binState) {
      const cap = effectiveCapacity(currentBin, binState, capOverrides || {});
      const used = binState[currentBin]?.totalQty || 0;
      currentBinFree = Math.max(0, cap - used);
    }

    // Find best bin for this material + qty in preferred rows
    const result = findBestBin({
      query: entry.material,
      qtyNeeded: entry.qty,
      stockRows,
      emptyBinsSet: emptyBinsFromExport,
      emptyBinTypes,
      allowTgt110: allowTgt110 !== false,
      allowTgt111: allowTgt111 !== false,
      capOverrides: capOverrides || {},
      preferredRows,
    });

    // Also find the next bin (second candidate) for overflow
    const resultNoQty = findBestBin({
      query: entry.material,
      qtyNeeded: 0,
      stockRows,
      emptyBinsSet: emptyBinsFromExport,
      emptyBinTypes,
      allowTgt110: allowTgt110 !== false,
      allowTgt111: allowTgt111 !== false,
      capOverrides: capOverrides || {},
      preferredRows,
    });

    const inPreferredZone = result.ok && result.best?.preferred;
    const bestBin = result.ok ? result.best.bin : "—";
    const bestFree = result.ok ? `${result.best.free} PAL` : "—";

    // Second bin: next candidate after the primary
    const secondCandidate = resultNoQty.ok
      ? resultNoQty.top?.find((c) => c.bin !== bestBin && c.preferred)
      : null;
    const nextBin = secondCandidate ? secondCandidate.bin : (result.ok ? (result.top?.[1]?.bin || "—") : "—");

    let currentStatus = "";
    if (currentBin) {
      if (currentBinFree !== null && currentBinFree < entry.qty) {
        currentStatus = `Current ${currentBin} fills (${currentBinFree} PAL left)`;
      } else if (currentBin) {
        currentStatus = `Using ${currentBin}`;
      }
    }

    const status = !result.ok
      ? "No bin available"
      : inPreferredZone
      ? "In preferred zone"
      : `Outside zone (${preferredRowList})`;

    tableRows.push({
      Line: String(entry.line),
      Material: entry.material,
      "PAL Planned": String(entry.qty),
      "Best Bin": bestBin,
      Free: bestFree,
      "Next Bin": nextBin,
      Status: status,
      ...(currentStatus ? { "Current Bin": currentStatus } : {}),
    });

    if (!result.ok || !inPreferredZone) {
      consolidationNeeded.push({
        line: entry.line,
        material: entry.material,
        rows: preferredRowList,
        reason: !result.ok ? "No bin found" : "No preferred-row space",
      });
    }
  }

  const hasCurrentBin = tableRows.some((r) => r["Current Bin"]);
  const headers = ["Line", "Material", "PAL Planned", "Best Bin", "Free", "Next Bin", "Status"];
  if (hasCurrentBin) headers.push("Current Bin");

  // Build bin assignments for apply step (line index → bin)
  const binAssignments = schedule
    .map((entry, i) => {
      const row = tableRows[i];
      const bin = row?.["Best Bin"];
      return bin && bin !== "—" ? { lineIndex: entry.line - 1, bin } : null;
    })
    .filter(Boolean);

  let summaryText = `Production plan for **${schedule.length} line${schedule.length !== 1 ? "s" : ""}**.`;
  if (consolidationNeeded.length > 0) {
    const lineNums = consolidationNeeded.map((c) => `Line ${c.line} (rows ${c.rows})`).join(", ");
    summaryText += `\n\n⚠ **Consolidation needed** before these runs: ${lineNums} — preferred rows have no space. Run consolidation prioritizing those rows first.`;
  }
  summaryText += `\n\nApply to the app to lock these bins in settings and rebuild the consolidation plan around your production schedule?`;

  return {
    type: "table",
    highlight: "Production Putaway Plan",
    text: summaryText,
    table: { headers, rows: tableRows },
    actions: [
      { id: "apply", label: "Apply to App & Rebuild", variant: "primary" },
      { id: "done", label: "Done", variant: "ghost" },
    ],
    nextStep: "awaitApply",
    workflowData: { currentStep: "awaitApply", binAssignments, schedule },
  };
}

// ─── Apply / Done ─────────────────────────────────────────────────────

function handleActionSelected(actionId, ctx, workflowData) {
  const { binAssignments = [], schedule = [] } = workflowData;

  if (actionId === "apply") {
    if (!ctx.onProductionPlanApply) {
      return {
        type: "error",
        text: "Apply callback not available — please rebuild manually from the settings drawer.",
        endWorkflow: true,
      };
    }

    ctx.onProductionPlanApply(binAssignments);

    const applied = binAssignments
      .map(({ lineIndex, bin }) => `Line ${lineIndex + 1} → **${bin}**`)
      .join(", ");

    return {
      type: "info",
      highlight: "Applied",
      text: `Line bins updated and consolidation plan rebuilt.\n\n${applied}\n\nThose bins are now locked from consolidation moves. The consolidator reflects your production schedule.`,
      endWorkflow: true,
    };
  }

  return {
    type: "info",
    text: "Done. Run consolidation manually whenever you're ready.",
    endWorkflow: true,
  };
}
