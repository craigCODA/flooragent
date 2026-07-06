import { parseBin } from "../../../../domain/bin";
import { effectiveCapacity } from "../../../../domain/capacity";
import { binValue } from "../../../../domain/planning";

// ROW_TIER is not exported from planning.js, duplicate for display
const ROW_TIER = {
  A: 1.5, B: 1.3, C: 1.3,
  D: 1.4, E: 1.4,
  F: 1.6, G: 1.6,
  H: 0.7, HH: 0.3,
  I: 0.8, II: 0.6,
  J: 1.0,
};

export function handleMoveExplanation(ctx) {
  const { entities, moves, binState, capOverrides } = ctx;

  if (!moves || moves.length === 0) {
    return { type: "error", text: "No moves have been generated. Load data and run the consolidation first." };
  }

  let move = null;

  const seqMatch = ctx.rawInput.match(/(?:move|seq(?:uence)?|#)\s*(\d+)/i);
  if (seqMatch) {
    const seq = parseInt(seqMatch[1]);
    move = moves.find((m) => m.id === seq);
  }

  if (!move && entities.bins.length > 0) {
    const binRef = entities.bins[0];
    move = moves.find((m) => m.from === binRef || m.to === binRef);
  }

  if (!move) move = moves[0];

  const { rowKey: fromRow } = parseBin(move.from);
  const { rowKey: toRow } = parseBin(move.to);
  const fromTier = ROW_TIER[fromRow] ?? 1.0;
  const toTier = ROW_TIER[toRow] ?? 1.0;
  const srcValue = binState ? binValue(move.from, binState, capOverrides || {}) : "?";
  const tgtCap = binState ? effectiveCapacity(move.to, binState, capOverrides || {}) : "?";

  const reasons = [];
  reasons.push(`Source **${move.from}** (row ${fromRow}, tier ${fromTier}) → Target **${move.to}** (row ${toRow}, tier ${toTier})`);
  reasons.push(`Material: **${move.materialId}** — ${move.qty} PAL`);
  reasons.push(`Source bin value: **${typeof srcValue === "number" ? srcValue.toFixed(1) : srcValue}** (capacity x tier — higher = more worth freeing)`);
  if (tgtCap !== "?") reasons.push(`Target capacity: **${tgtCap}** PAL`);
  if (move.tag === "hhii-followup") {
    reasons.push("Tag: **HH/II follow-up** — this topped off a target after the main move created compatible free space.");
  } else if (move.tag === "tight-empty-pack") {
    reasons.push("Tag: **tight empty pack** — multiple same-material source bins were packed into an empty target to free more bins.");
  } else if (move.tag === "suggested") {
    reasons.push("Tag: **111 override** — orphan material suggested for a type 111 bin");
  }
  if (fromRow === toRow) {
    reasons.push("Bonus: same-row move (+50K score)");
  }

  return {
    type: "list",
    text: `**Move #${move.id}**: ${move.from} → ${move.to}`,
    items: reasons,
  };
}
