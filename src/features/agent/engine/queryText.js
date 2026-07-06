const FILLER_WORDS = new Set([
  "a", "about", "an", "any", "are", "best", "bin", "bins", "can", "could",
  "do", "does", "find", "for", "go", "goes", "have", "hello", "help", "hey",
  "how", "i", "in", "into", "is", "it", "locate", "lookup", "me", "my",
  "of", "on", "please", "put", "putaway", "receive", "receiving", "search",
  "should", "show", "slot", "space", "spot", "stash", "status", "store",
  "summary", "tell", "that", "the", "this", "to", "up", "what", "where",
  "which", "with",
]);

export function normalizeSearchText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractSearchTokens(value) {
  return normalizeSearchText(value)
    .split(" ")
    .filter((token) => token && !FILLER_WORDS.has(token) && token.length >= 2);
}

export function extractFreeTextQuery(rawInput) {
  return extractSearchTokens(rawInput).join(" ");
}

export function scoreTextMatch(query, candidate) {
  const normalizedQuery = normalizeSearchText(query);
  const normalizedCandidate = normalizeSearchText(candidate);
  if (!normalizedQuery || !normalizedCandidate) return 0;

  if (normalizedCandidate.includes(normalizedQuery)) {
    return 100 + normalizedQuery.length;
  }

  const queryTokens = extractSearchTokens(normalizedQuery);
  if (queryTokens.length === 0) return 0;

  let score = 0;
  for (const token of queryTokens) {
    if (normalizedCandidate.includes(token)) {
      score += token.length >= 4 ? 12 : 8;
    }
  }

  return score;
}
