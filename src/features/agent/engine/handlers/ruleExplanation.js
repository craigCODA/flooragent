const RULES = {
  "no-target-abc": {
    title: "Never Target A/B/C Rows",
    explanation: "Rows A, B, and C are production-priority lanes. The consolidation engine never moves material INTO these rows — they are source-only. This protects high-throughput production bins from being filled with consolidated stock.",
  },
  "no-mix": {
    title: "Hard No-Mix Rule",
    explanation: "A non-empty bin can only receive the SAME material already inside it. You cannot mix different materials in one bin. Empty bins can receive any material (subject to other rules).",
  },
  "empty-bins-last": {
    title: "Empty-Bins-Last Rule",
    explanation: "Empty bins from the SAP export are only used as targets when there are zero non-empty bins with at least 3 PAL of free space for that material. This prevents wasteful moves that simply relocate material without consolidating.",
  },
  "r-bin-segregation": {
    title: "R-Bin Segregation",
    explanation: "R-bins (bins containing 'R' in the name) and non-R bins are completely segregated. Material from an R-bin can only go to another R-bin, and vice versa. They never mix.",
  },
  "tunnel-capacity": {
    title: "Tunnel Pairs & Fixed Capacity",
    explanation: "Paired rows (B/C, D/E, F/G, I/II, H/HH) share a physical tunnel, but each bin has a fixed capacity from the Master Bin Capacity Roster. Capacities do NOT change based on partner bin occupancy. Each bin's capacity is a standalone fixed value.",
  },
  "j-row": {
    title: "J-Row Special Rules",
    explanation: "J-row material can only consolidate into at most 2 non-empty same-material bins. J-row never uses empty bins as targets. This prevents scattering J-row stock across the warehouse.",
  },
  "side-bin-no-target": {
    title: "Side Bins Never Targets",
    explanation: "Side bins are never used as consolidation targets. They have restricted capacity due to physical constraints and are source-only in the consolidation engine. Most rows use positions 07, 13, 19, 25, 31, 37, 43. B row uses BS6, 09, 15, 21, 27, 33, 39, plus special-case B42. In the shared H/HH tunnel, HM03 replaces the H07/HH07 slot, then H and HH side bins continue at 09, 15, 21, 27, 33, and 39.",
  },
  "storage-111": {
    title: "Storage Type 111",
    explanation: "Type 111 bins are never used as consolidation sources. They can be targets only if the Target 111 toggle is enabled. When target 111 is disabled, orphan materials (1-2 PAL total) may still get a 111 suggestion as a last resort.",
  },
  "storage-110": {
    title: "Storage Type 110",
    explanation: "Type 110 bins can be toggled on or off as sources and targets independently. When Source 110 is off, those bins won't contribute material. When Target 110 is off, material won't be moved into them.",
  },
  "disabled-bins": {
    title: "Disabled Bins",
    explanation: "Bins can be manually disabled in the Bin Management tab. Disabled bins are excluded from both sourcing and targeting during consolidation.",
  },
  "protected-line-bins": {
    title: "Protected Line Bins",
    explanation: "Up to 17 bins can be designated as 'protected line bins' in the sidebar. These bins will never be used as consolidation targets, preserving their contents for production line use.",
  },
  "hi-source-exclusion": {
    title: "H/HH/I/II Source Exclusion",
    explanation: "When the 'Exclude H/I Sources' toggle is enabled, bins in rows H, HH, I, and II will not be used as consolidation sources. This protects low-throughput storage areas from being disrupted.",
  },
};

export function handleRuleExplanation(ctx) {
  const { rawInput } = ctx;
  const input = rawInput.toLowerCase();

  if (/\ba\s*(?:row|\/)\s*b|never\s+target|no.?target.?a/i.test(input)) return ruleResponse("no-target-abc");
  if (/no.?mix|same\s+material|mix.*material/i.test(input)) return ruleResponse("no-mix");
  if (/empty.?bin.?last|why\s+empty|use\s+empty/i.test(input)) return ruleResponse("empty-bins-last");
  if (/r.?bin|segregat/i.test(input)) return ruleResponse("r-bin-segregation");
  if (/tunnel|shared|pair/i.test(input)) return ruleResponse("tunnel-capacity");
  if (/\bj\s*row|j.?row/i.test(input)) return ruleResponse("j-row");
  if (/side\s*bin.*(?:target|rule|why)/i.test(input)) return ruleResponse("side-bin-no-target");
  if (/111|type\s*111/i.test(input)) return ruleResponse("storage-111");
  if (/110|type\s*110/i.test(input)) return ruleResponse("storage-110");
  if (/disabled?\s*bin/i.test(input)) return ruleResponse("disabled-bins");
  if (/protected|line\s*bin|lock/i.test(input)) return ruleResponse("protected-line-bins");
  if (/(?:h\s*\/\s*hh|i\s*\/\s*ii|exclude.*(?:h|hh|i|ii)\s*source|h\s*and\s*hh|i\s*and\s*ii)/i.test(input)) return ruleResponse("hi-source-exclusion");

  return {
    type: "list",
    text: "Here are the warehouse rules I can explain. Ask about any specific one:",
    items: Object.values(RULES).map((r) => `**${r.title}**`),
  };
}

function ruleResponse(key) {
  const rule = RULES[key];
  return { type: "text", text: `**${rule.title}**\n\n${rule.explanation}` };
}
