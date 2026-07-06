import { extractEntities } from "./entityExtractor";

const INTENT_RULES = [
  {
    intent: "putaway",
    patterns: [
      /where\s+(should|can|do)\s+I\s+put/i,
      /best\s+bin\s+for/i,
      /put\s*away/i,
      /inbound.*(?:material|bin)/i,
      /receiving.*(?:material|where)/i,
      /\b(?:store|stash|slot|park|drop)\b/i,
    ],
  },
  {
    intent: "binInfo",
    patterns: [
      /what(?:'s| is)\s+in\s+(?:bin\s+)?(?:HM|HH|II|BS|[A-J])/i,
      /bin\s+info/i,
      /show\s+(?:me\s+)?bin\s+/i,
      /tell\s+(?:me\s+)?about\s+(?:bin\s+)?(?:HM|HH|II|BS|[A-J])/i,
      /\bcontents?\s+of\s+(?:bin\s+)?(?:HM|HH|II|BS|[A-J])/i,
    ],
  },
  {
    intent: "capacityQuery",
    patterns: [
      /how\s+much\s+(?:space|room|capacity|free)/i,
      /free\s+(?:space|capacity)/i,
      /available\s+(?:space|capacity)/i,
      /capacity\s+(?:in|of|for)\s+(?:row)?/i,
      /how\s+full/i,
    ],
  },
  {
    intent: "materialLookup",
    patterns: [
      /where\s+is\s+(?:material\s+)?\d/i,
      /find\s+(?:material\s+)?\d/i,
      /locate\s+(?:material\s+)?\d/i,
      /which\s+bin(?:s)?\s+(?:has|have|contain)/i,
      /search\s+(?:for\s+)?(?:material\s+)?\d/i,
      /what\s+bin(?:s)?\s+(?:has|have|hold)/i,
    ],
  },
  {
    intent: "ruleExplanation",
    patterns: [
      /why\s+can(?:'t| not|not)/i,
      /explain\s+(?:the\s+)?rule/i,
      /what(?:'s| is)\s+the\s+(?:rule|reason)/i,
      /(?:no.?mix|no.?target|segregat|r.?bin)\s*rule/i,
      /why\s+(?:is|are|was|were)\s+.*(?:block|restrict|prevent|not\s+allow)/i,
      /\b(?:blocked|prevented|restricted|allowed)\b/i,
    ],
  },
  {
    intent: "tunnelPair",
    patterns: [
      /tunnel\s+(?:capacity|pair|info)/i,
      /pair(?:ed)?\s+(?:tunnel|row|capacity)/i,
      /shared\s+tunnel/i,
      /\b[A-J]\s*[-\/]\s*(?:HH|II|[A-J])\s+(?:tunnel|pair|capacity)/i,
    ],
  },
  {
    intent: "rowInfo",
    patterns: [
      /show\s+(?:me\s+)?row\s+/i,
      /row\s+(?:HM|HH|II|[A-J])\s+(?:stats|info|status|summary|details)/i,
      /(?:stats|info|status|summary)\s+(?:for|of)\s+row/i,
      /\b(?:HM|HH|II|[A-J])\s+(?:stats|info|status|summary|details)\b/i,
    ],
  },
  {
    intent: "sideBin",
    patterns: [
      /side\s+bin/i,
      /which\s+(?:bins?\s+)?(?:are\s+)?side/i,
    ],
  },
  {
    intent: "warehouseScope",
    patterns: [
      /(?:what|which)\s+bins?\s+(?:are\s+)?in\s+WH/i,
      /(?:what|which)\s+bins?\s+(?:are\s+)?in\s+warehouse/i,
      /WH\d\s+bins/i,
      /warehouse\s+\d\s+(?:bins|scope|info)/i,
    ],
  },
  {
    intent: "moveExplanation",
    patterns: [
      /why\s+(?:was|is)\s+(?:this|that)\s+move/i,
      /(?:explain|describe)\s+(?:this|that|the)\s+move/i,
      /move\s+(?:explanation|reason|score)/i,
      /why\s+(?:move|suggest)/i,
    ],
  },
  {
    intent: "proximityOrganize",
    patterns: [
      /organize\s+(?:material\s+)?\d/i,
      /group\s+(?:material\s+)?\d/i,
      /bring\s+(?:material\s+)?\d.*together/i,
      /cluster\s+(?:material\s+)?\d/i,
      /pull\s+(?:material\s+)?\d.*together/i,
      /organize\s+by\s+aisle/i,
      /proximity\s+(?:organize|group|plan)/i,
    ],
  },
  {
    intent: "scatterAnalysis",
    patterns: [
      /how\s+scattered\s+(?:is\s+)?(?:material\s+)?\d/i,
      /where\s+is\s+(?:material\s+)?\d.*spread/i,
      /scatter\s+(?:analysis|report)\s+(?:for\s+)?(?:material\s+)?\d/i,
      /(?:show|check)\s+(?:material\s+)?\d.*distribution/i,
      /\d{5,}.*scatter/i,
      /distribution\s+(?:of|for)\s+(?:material\s+)?\d/i,
    ],
  },
  {
    intent: "productionPlan",
    patterns: [
      /production\s+(plan|schedule|run)/i,
      /plan\s+(?:the\s+)?production/i,
      /what(?:'s|\s+is)\s+running/i,
      /line\s+schedule/i,
      /putaway\s+plan/i,
      /run\s+plan/i,
      /schedule\s+plan/i,
    ],
  },
  {
    intent: "emptyBins",
    patterns: [
      /empty\s+bins?/i,
      /which\s+bins?\s+(?:are\s+)?empty/i,
      /(?:list|show|what(?:'s| are))\s+(?:the\s+)?empty\s+bins?/i,
      /available\s+bins?/i,
      /open\s+bins?/i,
    ],
  },
  {
    intent: "help",
    patterns: [
      /^help$/i,
      /^hi$/i,
      /^hello$/i,
      /^hey$/i,
      /what\s+can\s+you\s+do/i,
      /how\s+(?:do\s+I|can\s+I)\s+use/i,
    ],
  },
];

const INTENT_PRIORITY = {
  proximityOrganize: 11,
  moveExplanation: 10,
  putaway: 9,
  materialLookup: 8,
  productionPlan: 12,
  emptyBins: 8,
  scatterAnalysis: 7,
  capacityQuery: 7,
  binInfo: 6,
  rowInfo: 5,
  tunnelPair: 4,
  sideBin: 3,
  warehouseScope: 2,
  ruleExplanation: 1,
  help: 0,
};

function containsAny(input, phrases) {
  return phrases.some((phrase) => input.includes(phrase));
}

function scoreIntent(intent, input, entities) {
  const hasBin = entities.bins.length > 0;
  const hasRow = entities.rows.length > 0;
  const hasMaterial = entities.materials.length > 0;
  const hasWarehouse = Boolean(entities.warehouse);
  const hasQuantity = Number.isFinite(entities.quantity) && entities.quantity > 0;

  switch (intent) {
    case "putaway":
      return (hasMaterial ? 3 : 0) +
        (hasQuantity ? 1 : 0) +
        (containsAny(input, ["put", "put away", "putaway", "store", "stash", "slot", "park", "drop", "fit", "fits", "receiving", "inbound"]) ? 3 : 0) +
        (containsAny(input, ["where should", "where can", "best bin", "go in", "goes in"]) ? 2 : 0);
    case "binInfo":
      return (hasBin ? 4 : 0) +
        (containsAny(input, ["what's in", "what is in", "contents", "inside", "bin info", "tell me about", "show bin"]) ? 3 : 0);
    case "capacityQuery":
      return ((hasBin || hasRow) ? 2 : 0) +
        (containsAny(input, ["space", "room", "capacity", "free", "available", "open", "full"]) ? 3 : 0);
    case "materialLookup":
      return (hasMaterial ? 4 : 0) +
        (containsAny(input, ["where is", "where's", "find", "locate", "search", "which bin", "what bin", "holds", "holding", "contains", "contain"]) ? 3 : 0);
    case "ruleExplanation":
      return (containsAny(input, ["rule", "why can't", "why cant", "why not", "blocked", "prevented", "restricted", "allowed", "restriction"]) ? 4 : 0);
    case "tunnelPair":
      return (entities.rows.length >= 2 ? 4 : 0) +
        (containsAny(input, ["tunnel", "pair", "shared"]) ? 3 : 0);
    case "rowInfo":
      return (hasRow ? 3 : 0) +
        (containsAny(input, ["row", "stats", "status", "summary", "details", "info", "overview", "snapshot"]) ? 2 : 0);
    case "sideBin":
      return ((hasRow || hasBin) ? 1 : 0) +
        (containsAny(input, ["side bin", "side bins", "side"]) ? 4 : 0);
    case "warehouseScope":
      return (hasWarehouse ? 4 : 0) +
        (containsAny(input, ["warehouse", "wh1", "wh2", "wh3", "scope"]) ? 2 : 0);
    case "moveExplanation":
      return (containsAny(input, ["move", "suggested", "suggestion", "sequence", "seq", "#"]) ? 2 : 0) +
        (containsAny(input, ["why", "explain", "reason"]) ? 2 : 0);
    case "proximityOrganize":
      return (hasMaterial ? 3 : 0) +
        (containsAny(input, ["organize", "group", "cluster", "proximity", "pull together", "bring together"]) ? 4 : 0) +
        (containsAny(input, ["aisle", "drive aisle"]) ? 2 : 0);
    case "scatterAnalysis":
      return (hasMaterial ? 3 : 0) +
        (containsAny(input, ["scatter", "scattered", "spread", "distribution", "distributed"]) ? 4 : 0) +
        (containsAny(input, ["how", "where", "show", "check", "analysis"]) ? 1 : 0);
    case "productionPlan":
      return containsAny(input, ["production plan", "production schedule", "run plan", "line schedule", "putaway plan", "what's running", "whats running", "schedule plan"]) ? 6 : 0;
    case "emptyBins":
      return containsAny(input, ["empty bins", "empty bin", "which bins are empty", "available bins", "open bins", "no stock", "vacated"]) ? 5 : 0;
    case "help":
      return containsAny(input, ["help", "hello", "hi", "hey", "what can you do", "how can i use"]) ? 2 : 0;
    default:
      return 0;
  }
}

export function classifyIntent(rawInput) {
  const input = String(rawInput || "").trim();
  if (!input) return { intent: "help", entities: extractEntities(""), rawInput: input };

  const entities = extractEntities(input);

  for (const rule of INTENT_RULES) {
    for (const pat of rule.patterns) {
      if (pat.test(input)) {
        return { intent: rule.intent, entities, rawInput: input };
      }
    }
  }

  let bestIntent = "help";
  let bestScore = 0;
  const lowered = input.toLowerCase();

  for (const { intent } of INTENT_RULES) {
    const score = scoreIntent(intent, lowered, entities);
    if (
      score > bestScore ||
      (score === bestScore && (INTENT_PRIORITY[intent] ?? 0) > (INTENT_PRIORITY[bestIntent] ?? 0))
    ) {
      bestIntent = intent;
      bestScore = score;
    }
  }

  if (bestScore >= 4) {
    return { intent: bestIntent, entities, rawInput: input };
  }

  // Fallback heuristics
  const trimmed = input.replace(/[?.!]/g, "").trim();
  if (entities.bins.length > 0 && trimmed.length <= 6) {
    return { intent: "binInfo", entities, rawInput: input };
  }
  if (/^\d{5,18}$/.test(trimmed)) {
    return { intent: "materialLookup", entities, rawInput: input };
  }
  if (entities.rows.length > 0 && trimmed.length <= 18) {
    return { intent: "rowInfo", entities, rawInput: input };
  }
  if (entities.rows.length > 0 && containsAny(lowered, ["space", "room", "capacity", "free", "full"])) {
    return { intent: "capacityQuery", entities, rawInput: input };
  }
  if (entities.rows.length > 1) {
    return { intent: "tunnelPair", entities, rawInput: input };
  }
  if (entities.materials.length > 0) {
    return { intent: "materialLookup", entities, rawInput: input };
  }

  return { intent: "help", entities, rawInput: input };
}
