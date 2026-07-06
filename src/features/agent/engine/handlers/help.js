export function handleHelp() {
  return {
    type: "list",
    text: "I'm the Floor Assistant. Here's what I can help with:",
    items: [
      "**\"What's in B07?\"** — bin contents and capacity",
      "**\"Where should I put material 12345?\"** — putaway recommendation",
      "**\"How much space in row D?\"** — row capacity summary",
      "**\"Where is material 12345?\"** — find which bins hold a material",
      "**\"Why can't I target A row?\"** — explain warehouse rules",
      "**\"Tunnel capacity for D-E?\"** — paired tunnel info",
      "**\"Show me row F stats\"** — row overview",
      "**\"Side bins in row B\"** — list side bin positions",
      "**\"What bins are in WH2?\"** — warehouse scope info",
      "**\"Why was this move suggested?\"** — move explanation",
      "**\"Organize material 12345\"** — group material into one aisle",
      "**\"How scattered is 12345?\"** — scatter analysis across aisles",
    ],
  };
}
