import React from "react";
import {
  Upload,
  Settings2,
  ListOrdered,
  Search,
  Map,
  BarChart3,
  HardDrive,
  Info,
  ChevronRight,
  Printer,
} from "lucide-react";

function Section({ icon: Icon, title, children }) {
  return (
    <div className="rounded-2xl border border-steel-700/40 bg-steel-900/80 p-5 shadow-[0_6px_20px_rgba(0,0,0,0.2)]">
      <div className="mb-3 flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-ppBlue-600/20 text-ppBlue-400">
          <Icon size={18} />
        </div>
        <h3 className="text-[15px] font-bold text-slate-100">{title}</h3>
      </div>
      <div className="space-y-2 text-sm leading-relaxed text-steel-300">{children}</div>
    </div>
  );
}

function Step({ n, children }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ppBlue-600 text-[10px] font-bold text-white">
        {n}
      </span>
      <span>{children}</span>
    </div>
  );
}

function Bullet({ children }) {
  return (
    <div className="flex items-start gap-2">
      <ChevronRight size={14} className="mt-0.5 shrink-0 text-steel-500" />
      <span>{children}</span>
    </div>
  );
}

function openGuideWindow() {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>FloorAgent – User Guide</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #1e293b; padding: 32px; max-width: 820px; margin: 0 auto; font-size: 13px; line-height: 1.6; }
  h1 { font-size: 22px; font-weight: 800; margin-bottom: 4px; }
  .subtitle { font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.12em; font-weight: 600; margin-bottom: 28px; }
  .toolbar { display: flex; gap: 8px; margin-bottom: 24px; }
  .toolbar button { padding: 8px 18px; border: 1px solid #cbd5e1; border-radius: 8px; background: #f8fafc; font-size: 13px; font-weight: 600; cursor: pointer; }
  .toolbar button:hover { background: #e2e8f0; }
  .section { border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px 20px; margin-bottom: 16px; page-break-inside: avoid; }
  .section-title { font-size: 15px; font-weight: 700; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 12px; }
  .section-title span { background: #0f172a; color: white; border-radius: 6px; padding: 2px 8px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; margin-right: 8px; }
  .sub { font-weight: 600; margin-top: 12px; margin-bottom: 4px; color: #0f172a; }
  p { margin-bottom: 6px; }
  .step { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 6px; }
  .step-n { background: #0f172a; color: white; border-radius: 50%; min-width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 700; margin-top: 1px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .bullet { display: flex; align-items: flex-start; gap: 8px; margin-bottom: 4px; }
  .bullet::before { content: "›"; font-weight: 700; color: #64748b; margin-top: 0; }
  .note { font-size: 11px; color: #64748b; margin-top: 8px; }
  kbd { background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 4px; padding: 1px 6px; font-family: monospace; font-size: 12px; }
  @media print {
    .toolbar { display: none; }
    body { padding: 16px; }
    .section { page-break-inside: avoid; border: 1px solid #ccc; }
  }
</style>
</head>
<body>
  <h1>FloorAgent</h1>
  <div class="subtitle">User Guide &nbsp;·&nbsp; Plastipak WH1</div>
  <div class="toolbar">
    <button onclick="window.print()">Print / Save as PDF</button>
    <button onclick="window.close()">Close</button>
  </div>

  <div class="section">
    <div class="section-title"><span>Overview</span>What This Tool Does</div>
    <p>FloorAgent reads a standard SAP bin export and produces a consolidation move list designed to free bins while respecting hard physical and business rules — paired tunnel capacity, no-mix, restricted storage types, R-bin segregation, and more.</p>
    <p>It also includes a <strong>Putaway Finder</strong> to recommend the best destination bin for incoming material and a <strong>Warehouse Map</strong> showing every bin on a physical-layout grid.</p>
  </div>

  <div class="section">
    <div class="section-title"><span>Step 1</span>Generate the SAP Export (LX03)</div>
    <div class="step"><div class="step-n">1</div><div>Open SAP and run transaction <strong>LX03</strong> (Bin Status Report).</div></div>
    <div class="step"><div class="step-n">2</div><div>Set <strong>Plant: 076</strong>.</div></div>
    <div class="step"><div class="step-n">3</div><div>Set <strong>Storage Type from: 110</strong> and <strong>to: 111</strong>. This captures all regular and mixed bins eligible for movement throughout the warehouse. Leave all other fields blank.</div></div>
    <div class="step"><div class="step-n">4</div><div>Execute the report.</div></div>
    <div class="step"><div class="step-n">5</div><div>Press <kbd>Shift + F4</kbd> to save the report as a spreadsheet in <strong>.xlsx format</strong>. Overwrite the previous file every time so the app always reads the most current data.</div></div>
  </div>

  <div class="section">
    <div class="section-title"><span>Step 2</span>Load into FloorAgent</div>
    <div class="step"><div class="step-n">1</div><div>Open <strong>FloorAgent</strong>.</div></div>
    <div class="step"><div class="step-n">2</div><div>Click <strong>Upload</strong> from the home screen.</div></div>
    <div class="step"><div class="step-n">3</div><div>Select the saved .xlsx file and click Open.</div></div>
    <div class="step"><div class="step-n">4</div><div>The consolidation move list generates automatically.</div></div>
    <div class="step"><div class="step-n">5</div><div>If you change settings later, click <strong>Rebuild</strong> — no need to re-upload.</div></div>
    <p class="note">Required columns: Storage Bin, Material, Material Description, Available stock, Storage Type. Empty indicator is optional.</p>
  </div>

  <div class="section">
    <div class="section-title"><span>Moves</span>Using the Move List</div>
    <div class="step"><div class="step-n">1</div><div>Review the consolidation queue on the main screen.</div></div>
    <div class="step"><div class="step-n">2</div><div>Execute moves on the warehouse floor in order.</div></div>
    <div class="step"><div class="step-n">3</div><div><strong>Click a move row to select it</strong> (highlights blue). A confirmation bar appears below the row.</div></div>
    <div class="step"><div class="step-n">4</div><div>Click <strong>Confirm Done</strong> to mark the move complete. Click <strong>Cancel</strong> to deselect without marking.</div></div>
    <div class="step"><div class="step-n">5</div><div>To undo a completed move, click the undo icon on the green row.</div></div>
    <div class="step"><div class="step-n">6</div><div>To flag a move as undoable, click the flag icon, enter a reason, and submit. It will be excluded on the next rebuild.</div></div>
    <div class="step"><div class="step-n">7</div><div>Use <strong>Export Route Slips</strong> to download as Excel, or <strong>Printable Move List</strong> to open a print-ready window.</div></div>
  </div>

  <div class="section">
    <div class="section-title"><span>Settings</span>Settings &amp; Rules</div>
    <p class="sub">Warehouse scope</p>
    <div class="bullet"><div><strong>WH1</strong> — bins A through J, excluding R-bins.</div></div>
    <div class="bullet"><div><strong>WH2</strong> — any bin containing "R", plus bins starting with 2A.</div></div>
    <div class="bullet"><div><strong>WH3</strong> — bins starting with 3.</div></div>
    <div class="bullet"><div><strong>ALL</strong> — everything.</div></div>
    <p class="sub">ABC Threshold (Phase 1)</p>
    <p>Only sources from rows A / B / C. Material quantity in a bin ≤ the threshold becomes eligible to move out.</p>
    <p class="sub">Protect A/B/C rows (toggleable)</p>
    <p>On by default — keeps A/B/C rows clear for production line putaway. Disable in Settings only when needed.</p>
    <p class="sub">Phase 2</p>
    <p>When enabled, all rows become eligible sources at the Phase 2 threshold.</p>
    <p class="sub">Storage type toggles</p>
    <div class="bullet"><div>Type 111 is <strong>never</strong> used as a source (hard rule).</div></div>
    <div class="bullet"><div>Source 110 — uncheck to exclude type 110 bins from sourcing.</div></div>
    <div class="bullet"><div>Target 110 / 111 — controls whether those types can receive material.</div></div>
    <p class="sub">Rules always enforced</p>
    <div class="bullet"><div><strong>No-mix</strong> — non-empty targets only receive the same material already there.</div></div>
    <div class="bullet"><div><strong>Side bins never targeted</strong> — can be sourced but never receive material.</div></div>
    <div class="bullet"><div><strong>Empty-bin net-positive</strong> — empty bins only consumed when 2+ sources combine into one.</div></div>
    <div class="bullet"><div><strong>R-bin segregation</strong> — R and non-R bins never share material.</div></div>
  </div>

  <div class="section">
    <div class="section-title"><span>Putaway</span>Putaway Finder</div>
    <p>For inbound receiving. Enter a material number (or partial match) and optional PAL quantity, then click <strong>Search Optimal Bin</strong>.</p>
    <p>Prioritizes existing bins with the same material (no-mix), then empty bins matching segregation and type rules. Capacity is checked dynamically including tunnel pairing.</p>
  </div>

  <div class="section">
    <div class="section-title"><span>Exports</span>Analytics &amp; Exports</div>
    <div class="bullet"><div><strong>Route Slips (Excel)</strong> — full move list with sequence, bins, materials, quantities, and status.</div></div>
    <div class="bullet"><div><strong>PDF Route Slips</strong> — printable route slips grouped per move with summary statistics.</div></div>
    <div class="bullet"><div><strong>Printable Move List</strong> — opens in a separate window with Print and Save as Text options.</div></div>
    <div class="bullet"><div><strong>Before / After</strong> — shows bin state before and after all proposed moves are applied.</div></div>
  </div>
</body>
</html>`;

  const win = window.open("", "_blank");
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}

export default function UserGuidePanel() {

  return (
    <div className="space-y-4" data-guide-panel>
      <div className="flex justify-end print:hidden">
        <button
          onClick={openGuideWindow}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-steel-800 border border-steel-700/50 text-sm font-semibold text-steel-200 hover:bg-steel-700 transition-colors"
        >
          <Printer size={15} />
          Print Guide
        </button>
      </div>
      <Section icon={Info} title="What This Tool Does">
        <p>
          FloorAgent reads a standard SAP bin export and produces a consolidation move list
          designed to free bins while respecting hard physical and business rules &mdash; paired tunnel
          capacity, no-mix, restricted storage types, R-bin segregation, and more.
        </p>
        <p>
          It also includes a <strong>Putaway Finder</strong> to recommend the best destination bin
          for incoming material and a <strong>Warehouse Map</strong> that shows every bin on a
          physical-layout grid.
        </p>
      </Section>

      <Section icon={Upload} title="How to Load Data">
        <p className="font-semibold text-steel-200">Step 1 — Generate the SAP export (transaction LX03)</p>
        <div className="mt-1 ml-1 space-y-1">
          <Step n={1}>Open SAP and run transaction <strong>LX03</strong> (Bin Status Report).</Step>
          <Step n={2}>Set <strong>Plant: 076</strong>.</Step>
          <Step n={3}>Set <strong>Storage Type from: 110</strong> and <strong>to: 111</strong>. This captures all regular and mixed bins that can be moved throughout the warehouse.</Step>
          <Step n={4}>Execute the report.</Step>
          <Step n={5}>Press <strong>Shift + F4</strong> to save the report as a spreadsheet in <strong>.xlsx format</strong>. Overwrite the previous file every time so the app always reads the most current data.</Step>
        </div>
        <p className="mt-3 font-semibold text-steel-200">Step 2 — Load into FloorAgent</p>
        <div className="mt-1 ml-1 space-y-1">
          <Step n={1}>Open <strong>FloorAgent</strong>.</Step>
          <Step n={2}>Click <strong>Upload</strong> from the home screen.</Step>
          <Step n={3}>Select the saved .xlsx file and click Open.</Step>
          <Step n={4}>The consolidation move list generates automatically.</Step>
          <Step n={5}>If you change settings later, click <strong>Rebuild</strong> &mdash; no need to re-upload.</Step>
        </div>
        <p className="mt-3 text-[11px] text-steel-500">Required columns: Storage Bin, Material, Material Description, Available stock, Storage Type. Empty indicator is optional.</p>
      </Section>

      <Section icon={Settings2} title="Settings &amp; Rules">
        <p className="font-semibold text-steel-200">Warehouse scope</p>
        <div className="ml-1 space-y-1">
          <Bullet><strong>WH1</strong> &mdash; bins A through J, excluding R-bins.</Bullet>
          <Bullet><strong>WH2</strong> &mdash; any bin containing "R", plus bins starting with 2A.</Bullet>
          <Bullet><strong>WH3</strong> &mdash; bins starting with 3.</Bullet>
          <Bullet><strong>ALL</strong> &mdash; everything.</Bullet>
        </div>

        <p className="mt-3 font-semibold text-steel-200">ABC Threshold (Phase 1)</p>
        <p>
          Only sources from rows A / B / C. Material quantity in a bin &le; the threshold becomes
          eligible to move out. Targets are never A / B / C rows.
        </p>

        <p className="mt-3 font-semibold text-steel-200">Phase 2</p>
        <p>
          When enabled, all rows become eligible sources. Material quantity &le; the Phase 2
          threshold becomes a source. Targets are still never A / B / C.
        </p>

        <p className="mt-3 font-semibold text-steel-200">Storage type toggles</p>
        <div className="ml-1 space-y-1">
          <Bullet>Type 111 is <strong>never</strong> used as a source (hard rule).</Bullet>
          <Bullet>Source 110 &mdash; uncheck to exclude type 110 bins from sourcing.</Bullet>
          <Bullet>Target 110 / 111 &mdash; controls whether those types can receive material.</Bullet>
        </div>

        <p className="mt-3 font-semibold text-steel-200">Rules that are always enforced</p>
        <div className="ml-1 space-y-1">
          <Bullet><strong>No-mix</strong> &mdash; non-empty targets only receive the same material already there. Empty targets accept any material (subject to other rules).</Bullet>
          <Bullet><strong>A / B / C row protection (toggleable)</strong> &mdash; on by default, keeps these rows clear for production line putaway. Can be disabled in Settings if needed.</Bullet>
          <Bullet><strong>Side bins are never targets</strong> &mdash; they can be sourced but never receive material during consolidation.</Bullet>
          <Bullet><strong>Empty-bin net-positive rule</strong> &mdash; empty bins are only consumed when 2+ single-material sources combine into one, netting freed bins.</Bullet>
          <Bullet><strong>R-bin segregation</strong> &mdash; R and non-R bins never share material during consolidation or putaway.</Bullet>
        </div>
      </Section>

      <Section icon={ListOrdered} title="Using the Move List">
        <Step n={1}>Review the consolidation queue on the main screen.</Step>
        <Step n={2}>Execute moves on the warehouse floor in order.</Step>
        <Step n={3}><strong>Click a move row to select it</strong> (highlights blue). A confirmation bar appears below the row.</Step>
        <Step n={4}>Click <strong>Confirm Done</strong> to mark the move complete. Click <strong>Cancel</strong> to deselect without marking.</Step>
        <Step n={5}>To undo a completed move, click the undo icon on the green row.</Step>
        <Step n={6}>To flag a move as undoable, click the flag icon and enter a reason. It will be excluded on the next rebuild.</Step>
        <Step n={7}>Use <strong>Export Route Slips</strong> to download the full list as an Excel file, or <strong>Printable Move List</strong> to open a print-ready window.</Step>
      </Section>

      <Section icon={Search} title="Putaway Finder">
        <p>
          Use this for inbound receiving. Enter a material number (or partial match) and an optional
          PAL quantity, then click <strong>Search Optimal Bin</strong>.
        </p>
        <p>
          The result prioritizes existing bins with the same material (no-mix), then empty bins that
          match segregation and type rules. Capacity is checked dynamically including tunnel pairing.
        </p>
      </Section>

      <Section icon={Map} title="Warehouse Map">
        <p>
          Click <strong>Open Map</strong> to launch the full warehouse layout in a separate window.
          Every bin is shown on a physical-position grid &mdash; click any bin to see its contents,
          capacity, and materials.
        </p>
        <p>
          Use the search box to highlight bins or materials. You can also <strong>Save Map as PNG</strong> to
          export the current view as an image.
        </p>
      </Section>

      <Section icon={BarChart3} title="Analytics &amp; Exports">
        <div className="ml-1 space-y-1">
          <Bullet><strong>Route Slips (Excel)</strong> &mdash; full move list with sequence, bins, materials, quantities, and status.</Bullet>
          <Bullet><strong>PDF Route Slips</strong> &mdash; printable route slips grouped per move with summary statistics.</Bullet>
          <Bullet><strong>Printable Move List</strong> &mdash; opens in a separate window with Print and Save as Text options.</Bullet>
          <Bullet><strong>Before / After</strong> &mdash; shows bin state before and after all proposed moves are applied.</Bullet>
        </div>
      </Section>

      <Section icon={HardDrive} title="Bin Settings">
        <p>
          You can override individual bin capacities or disable specific bins from being used as
          sources or targets. Changes persist across sessions and are applied when you rebuild.
        </p>
        <div className="ml-1 space-y-1">
          <Bullet><strong>Capacity overrides</strong> &mdash; set a custom max-PAL for any bin.</Bullet>
          <Bullet><strong>Disabled bins</strong> &mdash; completely exclude a bin from all planning.</Bullet>
        </div>
      </Section>
    </div>
  );
}
