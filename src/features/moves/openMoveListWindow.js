/**
 * Opens a clean printable move-list window with Print / Save as PDF / Save as Text.
 *
 * @param {{ moves: Array, completed: Set, ignoredMoves: Map, warehouse: string, appVersion: string }} opts
 */
export default function openMoveListWindow({ moves, completed, ignoredMoves, warehouse, appVersion }) {
  const dateStr = new Date().toLocaleDateString("en-US", {
    year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });

  // Sort moves: group by source bin, then by qty ascending within each group
  const sortedMoves = [...moves].sort((a, b) => {
    if (a.from !== b.from) return a.from.localeCompare(b.from);
    return a.qty - b.qty;
  });

  const rows = sortedMoves.map((m, i) => {
    const status = completed.has(m.id) ? "DONE" : ignoredMoves.has(m.id) ? "IGNORED" : "PENDING";
    return { seq: i + 1, ...m, status };
  });

  const escHtml = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // Build table rows with source-bin group headers
  let lastFrom = null;
  let seqInBin = 0;
  const tableRows = rows.map((r) => {
    const isNewBin = r.from !== lastFrom;
    if (isNewBin) { lastFrom = r.from; seqInBin = 0; }
    seqInBin++;
    const binHeader = isNewBin ? `
    <tr class="bin-header">
      <td colspan="8">Source bin: <strong>${escHtml(r.from)}</strong></td>
    </tr>` : "";
    return binHeader + `
    <tr class="${r.status === "DONE" ? "done" : r.status === "IGNORED" ? "ignored" : ""}">
      <td>${r.seq}</td>
      <td>${escHtml(r.materialId)}</td>
      <td>${escHtml(r.materialDesc)}</td>
      <td>${escHtml(r.from)}</td>
      <td>${escHtml(r.to)}</td>
      <td class="num">${r.qty}</td>
      <td>${escHtml(r.tag === "proximity" ? "Proximity" : (r.tag || "Consol."))}</td>
      <td class="status-${r.status.toLowerCase()}">${r.status}</td>
    </tr>`;
  }).join("\n");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>Move List - FloorAgent</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #1e293b; padding: 24px; }
  h1 { font-size: 20px; font-weight: 700; }
  .meta { font-size: 12px; color: #64748b; margin-top: 4px; }
  .toolbar { display: flex; gap: 8px; margin: 16px 0; }
  .toolbar button { padding: 8px 16px; border: 1px solid #cbd5e1; border-radius: 8px; background: #f8fafc; font-size: 13px; font-weight: 600; cursor: pointer; }
  .toolbar button:hover { background: #e2e8f0; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 8px; }
  th { background: #0f172a; color: #f1f5f9; padding: 8px 10px; text-align: left; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; }
  td { padding: 6px 10px; border-bottom: 1px solid #e2e8f0; }
  tr:nth-child(even) { background: #f8fafc; }
  tr.bin-header td { background: #e8f0fb; color: #1e3a6e; font-size: 11px; font-weight: 600; padding: 4px 10px; letter-spacing: 0.04em; text-transform: uppercase; border-bottom: 1px solid #c7d8f0; }
  tr.done td { color: #16a34a; }
  tr.ignored td { color: #94a3b8; text-decoration: line-through; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .status-done { color: #16a34a; font-weight: 600; }
  .status-ignored { color: #94a3b8; }
  .status-pending { color: #0f172a; }
  @media print {
    .toolbar { display: none; }
    body { padding: 12px; }
    th { background: #0f172a !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>
  <h1>FloorAgent - Move List</h1>
  <div class="meta">Warehouse: ${escHtml(warehouse)} &nbsp;|&nbsp; ${escHtml(dateStr)} &nbsp;|&nbsp; v${escHtml(appVersion)} &nbsp;|&nbsp; ${rows.length} moves</div>
  <div class="toolbar">
    <button onclick="window.print()">Print / Save as PDF</button>
    <button id="btn-txt">Save as Text File</button>
  </div>
  <table>
    <thead>
      <tr><th>#</th><th>Material</th><th>Description</th><th>From</th><th>To</th><th>Qty</th><th>Tag</th><th>Status</th></tr>
    </thead>
    <tbody>${tableRows}</tbody>
  </table>
  <script>
    document.getElementById("btn-txt").addEventListener("click", function() {
      var sep = "\\t";
      var header = ["#","Material","Description","From","To","Qty","Tag","Status"].join(sep);
      var lines = [header];
      document.querySelectorAll("tbody tr").forEach(function(tr) {
        var cells = [];
        tr.querySelectorAll("td").forEach(function(td) { cells.push(td.textContent.trim()); });
        lines.push(cells.join(sep));
      });
      var blob = new Blob([lines.join("\\n")], { type: "text/plain;charset=utf-8" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "move-list.txt";
      a.click();
      URL.revokeObjectURL(a.href);
    });
  </script>
</body>
</html>`;

  const win = window.open("", "_blank");
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}
