import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Upload, Settings2, Eye, Download, CheckCircle2, AlertCircle,
  FileText, RotateCcw, ChevronRight, Calculator,
} from "lucide-react";
import { normBin, toNum, inWarehouse, isPhysicalBin } from "../../domain/bin";
import { validateSapHeaders, parseSapExport, buildBinState } from "../../domain/sap";
import { consolidate } from "../../domain/planning";

// ─── Side-bin exclusion list (mirrors App.jsx) ────────────────────────────────
const SIDE_BIN_LIST = [
  "A07","A13","A19","A25","A31","A37","A43",
  "BS6","B09","B15","B21","B27","B33","B39","B42",
  "C07","C13","C19","C25","C31","C37",
  "D07","D13","D19","D25","D31","D37",
  "E07","E13","E19","E25","E31","E37",
  "F07","F13","F19","F25","F31","F37","F43",
  "G07","G13","G19","G25","G31","G37","G43",
  "HM03","H09","HH09","H15","HH15","H21","HH21","H27","HH27","H33","HH33","H39","HH39",
  "I07","II07","I13","II13","I19","II19","I25","II25","I31","II31","I37","II37","I43","II43",
];

const DEFAULT_SETTINGS = {
  warehouse: "WH1",
  excludeRbins: true,
  globalThreshold: 20,
  excludeH: true,
  excludeHH: true,
  excludeI: true,
  excludeII: true,
  protectABC: false,
  allowSrc110: true,
  allowTgt110: true,
  allowTgt111: true,
  excludeSideBins: true,
  lineBins: Array(17).fill(""),
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function binInScope(bin, warehouse, excludeR) {
  const B = normBin(bin);
  if (!B) return false;
  if (!isPhysicalBin(B)) return false;
  if (excludeR && B.includes("R")) return false;
  return inWarehouse(B, warehouse);
}

function pad(str, len, right = false) {
  const s = String(str ?? "");
  const p = " ".repeat(Math.max(0, len - s.length));
  return right ? s + p : p + s;
}

function buildOutputText(result, settings, fileName) {
  const now = new Date();
  const dateStr = now.toLocaleString();
  const line = "─".repeat(60);
  const thin = "─".repeat(30);

  const {
    warehouse, globalThreshold,
    excludeH, excludeHH, excludeI, excludeII,
    protectABC, allowSrc110, allowTgt110, allowTgt111,
    excludeSideBins, excludeRbins,
  } = settings;

  const srcRows = [
    excludeH  ? null : "H",
    excludeHH ? null : "HH",
    excludeI  ? null : "I",
    excludeII ? null : "II",
  ].filter(Boolean);

  const settingLines = [
    `  Source File  : ${fileName || "—"}`,
    `  Generated    : ${dateStr}`,
    `  Warehouse    : ${warehouse}`,
    `  Skip R-bins  : ${excludeRbins ? "YES" : "NO"}`,
    `  Threshold    : ${globalThreshold} PAL (all phases)`,
    `  Source rows  : H ${excludeH ? "excluded" : "allowed"} | HH ${excludeHH ? "excluded" : "allowed"} | I ${excludeI ? "excluded" : "allowed"} | II ${excludeII ? "excluded" : "allowed"}`,
    `  Protect ABC  : ${protectABC ? "YES" : "NO"}`,
    `  Side Bins    : ${excludeSideBins ? "blocked" : "allowed"}`,
    `  Src 110      : ${allowSrc110 ? "allowed" : "blocked"}`,
    `  Tgt 110      : ${allowTgt110 ? "allowed" : "blocked"}`,
    `  Tgt 111      : ${allowTgt111 ? "allowed" : "blocked"}`,
  ];

  const { moves, freedBins } = result;
  const totalPAL = moves.reduce((s, m) => s + m.qty, 0);

  const summaryLines = [
    `  Total Moves : ${moves.length}`,
    `  Bins Freed  : ${freedBins.length}`,
    `  PAL Moved   : ${totalPAL.toFixed(1)}`,
    `  Freed Bins  : ${freedBins.length ? freedBins.join(", ") : "none"}`,
  ];

  const header =
    `  #    ${pad("FROM", 8, true)}  ${pad("TO", 8, true)}  ${pad("MATERIAL", 16, true)}  ${pad("QTY", 7, true)}`;
  const separator = `  ${thin}`;

  const moveLines = moves.map((m) => {
    const num = pad(m.id, 3);
    const from = pad(m.from, 8, true);
    const to   = pad(m.to,   8, true);
    const mat  = pad(m.materialId, 16, true);
    const qty  = pad(m.qty.toFixed(1), 7);
    return `  ${num}  ${from}  ${to}  ${mat}  ${qty}`;
  });

  return [
    "WAREHOUSE CONSOLIDATION PLAN",
    line,
    "",
    "SETTINGS",
    thin,
    ...settingLines,
    "",
    "SUMMARY",
    thin,
    ...summaryLines,
    "",
    "MOVE LIST",
    thin,
    header,
    separator,
    ...moveLines,
    "",
    line,
    `  Total: ${moves.length} moves  |  ${freedBins.length} bins freed  |  ${totalPAL.toFixed(1)} PAL moved`,
  ].join("\n");
}

// ─── Toggle component ─────────────────────────────────────────────────────────
function Toggle({ checked, onChange, label, hint, accent = "blue" }) {
  const colors = {
    blue:   "border-blue-700/30 bg-blue-500/5",
    red:    "border-red-700/30 bg-red-500/5",
    amber:  "border-amber-700/30 bg-amber-500/5",
  };
  return (
    <label className={`flex items-start gap-3 rounded-xl border ${colors[accent] ?? colors.blue} px-3 py-3 text-sm text-slate-300 cursor-pointer`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-slate-600 accent-blue-500"
      />
      <span>
        {label}
        {hint && <div className="mt-0.5 text-[11px] text-slate-500">{hint}</div>}
      </span>
    </label>
  );
}

function SectionLabel({ children }) {
  return (
    <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 mt-5 mb-2">
      {children}
    </div>
  );
}

// ─── Step indicator ───────────────────────────────────────────────────────────
function StepBar({ step }) {
  const steps = ["Upload", "Configure", "Output"];
  return (
    <div className="flex items-center gap-2 mb-8">
      {steps.map((label, i) => {
        const n = i + 1;
        const active = n === step;
        const done = n < step;
        return (
          <React.Fragment key={n}>
            <div className="flex items-center gap-2">
              <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold border transition-all ${
                done  ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300"
                : active ? "bg-blue-600/20 border-blue-500/60 text-blue-200"
                : "bg-slate-800/60 border-slate-700/40 text-slate-500"
              }`}>
                {done ? <CheckCircle2 size={14} /> : n}
              </div>
              <span className={`text-sm font-semibold ${active ? "text-slate-100" : done ? "text-emerald-400" : "text-slate-500"}`}>
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <ChevronRight size={14} className={`text-slate-600 mx-1 ${done ? "text-emerald-500/50" : ""}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function LiteCalculator() {
  const [xlsxMod, setXlsxMod] = useState(null);
  const [xlsxReady, setXlsxReady] = useState(false);

  const [step, setStep] = useState(1);
  const [rawJson, setRawJson] = useState(null);
  const [fileName, setFileName] = useState("");
  const [uploadError, setUploadError] = useState("");

  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [result, setResult] = useState(null);
  const [calcError, setCalcError] = useState("");

  const fileRef = useRef(null);

  // Load xlsx dynamically
  useEffect(() => {
    let cancelled = false;
    import("xlsx").then((mod) => { if (!cancelled) { setXlsxMod(mod); setXlsxReady(true); } }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // ── File upload ──────────────────────────────────────────────────────────────
  const handleFile = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!xlsxReady) { setUploadError("Spreadsheet tools still loading — try again."); return; }
    setUploadError("");
    try {
      const XLSX = xlsxMod;
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(new Uint8Array(buf), { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(sheet, { defval: "" });
      const missing = validateSapHeaders(json);
      if (missing.length) {
        setUploadError(`Missing columns: ${missing.join(", ")}`);
        e.target.value = "";
        return;
      }
      setRawJson(json);
      setFileName(file.name);
      setResult(null);
      setCalcError("");
      setStep(2);
    } catch {
      setUploadError("Could not read file. Provide a standard SAP export (XLS/XLSX).");
    }
    e.target.value = "";
  }, [xlsxMod, xlsxReady]);

  // ── Setting helpers ──────────────────────────────────────────────────────────
  const set = (key) => (val) => setSettings((prev) => ({ ...prev, [key]: val }));

  // ── Calculate ────────────────────────────────────────────────────────────────
  const calculate = useCallback(() => {
    if (!rawJson) return;
    setCalcError("");
    try {
      const s = settings;
      const { stockRows: parsed, emptyBinsFromExport: empties, emptyBinTypes: types } = parseSapExport(rawJson);

      const filteredStock = parsed.filter(
        (r) => binInScope(r.bin, s.warehouse, s.excludeRbins)
      );

      const occupiedInScope = new Set(filteredStock.map((r) => r.bin));

      const filteredEmpties = new Set(
        Array.from(empties)
          .map(normBin)
          .filter((b) => binInScope(b, s.warehouse, s.excludeRbins) && !occupiedInScope.has(b))
      );

      const filteredTypes = {};
      for (const [b, t] of Object.entries(types || {})) {
        const B = normBin(b);
        if (filteredEmpties.has(B)) filteredTypes[B] = String(t);
      }

      const lockedSet = new Set((s.lineBins || []).map(normBin).filter(Boolean));
      const excludedBinSet = s.excludeSideBins ? new Set(SIDE_BIN_LIST) : new Set();
      const avoidedTargetRows = s.protectABC ? new Set(["A", "B", "C"]) : new Set();
      const threshold = toNum(s.globalThreshold) || 20;

      const avoidedSourceRows = new Set();
      if (s.excludeH)  avoidedSourceRows.add("H");
      if (s.excludeHH) avoidedSourceRows.add("HH");
      if (s.excludeI)  avoidedSourceRows.add("I");
      if (s.excludeII) avoidedSourceRows.add("II");

      const initialState = buildBinState(filteredStock);

      const { moves: plan, finalBinState: finalState } = consolidate({
        stockRows: filteredStock,
        emptyBinsSet: filteredEmpties,
        emptyBinTypes: filteredTypes,
        abcThreshold: threshold,
        phase2Enabled: true,
        phase2Threshold: threshold,
        allowSrc110: !!s.allowSrc110,
        allowTgt110: !!s.allowTgt110,
        allowTgt111: !!s.allowTgt111,
        lockedBins: lockedSet,
        capOverrides: {},
        disabledBins: new Set(),
        excludeHISource: false,
        avoidedSourceRows,
        maxSourceQty: threshold,
        excludedBinSet,
        ignoredMoveKeys: new Set(),
        avoidedTargetRows,
        abcNeverTarget: s.protectABC || true,
      });

      const freedBins = Object.keys(initialState)
        .filter((b) => (initialState[b]?.totalQty || 0) > 0)
        .filter((b) => (finalState[b]?.totalQty || 0) === 0)
        .sort((a, b) => a.localeCompare(b));

      setResult({ moves: plan, freedBins });
      setStep(3);
    } catch (err) {
      setCalcError("Calculation failed: " + (err?.message || "unknown error"));
    }
  }, [rawJson, settings]);

  // ── Output actions ────────────────────────────────────────────────────────────
  const getOutputText = () => buildOutputText(result, settings, fileName);

  const handleView = () => {
    const text = getOutputText();
    const win = window.open("", "_blank", "width=860,height=680");
    if (!win) return;
    win.document.write(
      `<!DOCTYPE html><html><head><title>Consolidation Plan</title>` +
      `<style>*{box-sizing:border-box}body{margin:0;background:#0d1c2a;color:#e2e8f0;` +
      `font-family:'Courier New',monospace;padding:28px;font-size:13px;line-height:1.7}` +
      `pre{white-space:pre-wrap;word-break:break-word}` +
      `h2{font-size:11px;text-transform:uppercase;letter-spacing:.16em;color:#64748b;` +
      `margin:0 0 16px}` +
      `</style></head><body>` +
      `<h2>Warehouse Consolidation Plan</h2>` +
      `<pre>${text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre>` +
      `</body></html>`
    );
    win.document.close();
  };

  const handleDownload = () => {
    const text = getOutputText();
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `consolidation_plan_${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const reset = () => {
    setStep(1);
    setRawJson(null);
    setFileName("");
    setResult(null);
    setCalcError("");
    setUploadError("");
    setSettings(DEFAULT_SETTINGS);
  };

  // ─── Render ──────────────────────────────────────────────────────────────────
  const totalPAL = result ? result.moves.reduce((s, m) => s + m.qty, 0) : 0;

  return (
    <div className="min-h-full py-8 px-4 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-amber-500/15 border border-amber-500/30">
          <Calculator size={20} className="text-amber-400" />
        </div>
        <div>
          <div className="font-bold text-lg text-slate-100 leading-tight">Lite Calculator</div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500 font-semibold">Upload · Configure · Export</div>
        </div>
        {step > 1 && (
          <button
            onClick={reset}
            className="ml-auto flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors px-3 py-1.5 rounded-lg hover:bg-slate-800/60 border border-transparent hover:border-slate-700/50"
          >
            <RotateCcw size={12} /> Reset
          </button>
        )}
      </div>

      <StepBar step={step} />

      {/* ── STEP 1: Upload ─────────────────────────────────────────────────────── */}
      {step === 1 && (
        <div className="space-y-4">
          <div
            className="rounded-2xl border-2 border-dashed border-slate-700/60 bg-slate-900/40 p-12 text-center cursor-pointer hover:border-blue-500/50 hover:bg-blue-500/5 transition-all group"
            onClick={() => xlsxReady && fileRef.current?.click()}
          >
            <div className="flex flex-col items-center gap-4">
              <div className={`h-16 w-16 rounded-2xl flex items-center justify-center border transition-all ${
                xlsxReady
                  ? "bg-blue-600/15 border-blue-500/40 group-hover:bg-blue-600/25"
                  : "bg-slate-800 border-slate-700/40"
              }`}>
                <Upload size={28} className={xlsxReady ? "text-blue-400" : "text-slate-600"} />
              </div>
              <div>
                <div className="font-bold text-slate-100 text-base">
                  {xlsxReady ? "Click to upload SAP export" : "Loading spreadsheet tools…"}
                </div>
                <div className="text-sm text-slate-500 mt-1">XLS or XLSX format</div>
              </div>
            </div>
          </div>
          {uploadError && (
            <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              {uploadError}
            </div>
          )}
          <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile} />
        </div>
      )}

      {/* ── STEP 2: Configure ──────────────────────────────────────────────────── */}
      {step === 2 && (
        <div className="space-y-1">
          {/* File badge */}
          <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/8 px-4 py-2.5 text-sm mb-5">
            <FileText size={14} className="text-emerald-400 shrink-0" />
            <span className="text-emerald-300 font-medium truncate">{fileName}</span>
            <button
              onClick={() => { setStep(1); setRawJson(null); setFileName(""); }}
              className="ml-auto text-xs text-slate-500 hover:text-slate-300 shrink-0"
            >
              Change
            </button>
          </div>

          {/* Warehouse */}
          <SectionLabel>Warehouse Scope</SectionLabel>
          <select
            value={settings.warehouse}
            onChange={(e) => set("warehouse")(e.target.value)}
            className="w-full rounded-xl border border-slate-600/50 bg-slate-800/80 px-3 py-3 text-sm font-medium text-slate-200 outline-none focus:ring-2 focus:ring-blue-500/30"
          >
            <option value="WH1">WH1 (A–J, no R)</option>
            <option value="WH2">WH2 (R-bins / 2A)</option>
            <option value="WH3">WH3 (3-bins)</option>
            <option value="ALL">All Areas</option>
          </select>
          <Toggle
            checked={settings.excludeRbins}
            onChange={set("excludeRbins")}
            label="Skip R-bins"
            hint="Don't use R-bins when planning moves."
          />

          {/* Global threshold */}
          <SectionLabel>Consolidation Threshold</SectionLabel>
          <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 px-4 py-3 space-y-1">
            <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 block">
              Global Max (PAL)
            </label>
            <input
              type="number"
              min="0"
              value={settings.globalThreshold}
              onChange={(e) => set("globalThreshold")(e.target.value)}
              className="w-full rounded-lg border border-slate-600/50 bg-slate-900 px-3 py-2 font-mono text-sm font-medium text-slate-200 outline-none"
            />
            <div className="text-[10px] text-slate-500">
              Bins with this qty or less are consolidation candidates across all rows and phases.
            </div>
          </div>

          {/* Source row exclusions */}
          <SectionLabel>Exclude as Source Row</SectionLabel>
          <div className="grid grid-cols-2 gap-2">
            {[
              { key: "excludeH",  label: "H"  },
              { key: "excludeHH", label: "HH" },
              { key: "excludeI",  label: "I"  },
              { key: "excludeII", label: "II" },
            ].map(({ key, label }) => (
              <label
                key={key}
                className="flex items-center gap-3 rounded-xl border border-slate-700/50 bg-slate-800/50 px-4 py-3 cursor-pointer hover:bg-slate-800 transition-colors"
              >
                <input
                  type="checkbox"
                  checked={settings[key]}
                  onChange={(e) => set(key)(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-600 accent-blue-500"
                />
                <span className="font-mono font-bold text-slate-200 text-sm">{label}</span>
                <span className="text-[11px] text-slate-500 ml-auto">
                  {settings[key] ? "excluded" : "allowed"}
                </span>
              </label>
            ))}
          </div>

          {/* Other row rules */}
          <SectionLabel>Row Rules</SectionLabel>
          <Toggle
            checked={settings.protectABC}
            onChange={set("protectABC")}
            label="Protect A/B/C rows (never target)"
            hint="Never consolidate INTO A/B/C production rows."
            accent="red"
          />

          {/* Bin limits */}
          <SectionLabel>Bin Limits</SectionLabel>
          <Toggle
            checked={settings.allowSrc110}
            onChange={set("allowSrc110")}
            label="Allow moving FROM 110 bins"
          />
          <Toggle
            checked={settings.allowTgt110}
            onChange={set("allowTgt110")}
            label="Allow moving TO 110 bins"
          />
          <Toggle
            checked={settings.allowTgt111}
            onChange={set("allowTgt111")}
            label="Allow moving TO 111 bins"
          />
          <Toggle
            checked={settings.excludeSideBins}
            onChange={set("excludeSideBins")}
            label={`Block side bins (${SIDE_BIN_LIST.length})`}
            hint="Don't use side bins for any moves."
            accent="red"
          />

          {/* Line bins */}
          <SectionLabel>Locked Line Bins (optional)</SectionLabel>
          <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 px-4 py-3">
            <div className="text-[10px] text-slate-500 mb-2">Enter bin IDs that should never be used as targets.</div>
            <div className="grid grid-cols-4 gap-2">
              {settings.lineBins.map((v, i) => (
                <input
                  key={i}
                  value={v}
                  onChange={(e) => {
                    const next = [...settings.lineBins];
                    next[i] = e.target.value.toUpperCase();
                    set("lineBins")(next);
                  }}
                  placeholder={`L${i + 1}`}
                  className="w-full rounded-lg border border-slate-600/50 bg-slate-800 px-2 py-2 text-center font-mono text-[10px] font-medium text-slate-200 placeholder:text-slate-600 outline-none"
                />
              ))}
            </div>
          </div>

          {calcError && (
            <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300 mt-3">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              {calcError}
            </div>
          )}

          {/* Calculate button */}
          <button
            onClick={calculate}
            className="w-full mt-6 py-4 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm transition-all active:scale-[0.98] shadow-[0_8px_24px_rgba(59,130,246,0.3)] flex items-center justify-center gap-2"
          >
            <Calculator size={16} />
            Calculate Consolidation Plan
          </button>
        </div>
      )}

      {/* ── STEP 3: Output ─────────────────────────────────────────────────────── */}
      {step === 3 && result && (
        <div className="space-y-5">
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-2xl border border-blue-700/40 bg-blue-900/20 p-4 text-center">
              <div className="text-[10px] uppercase tracking-[0.18em] font-semibold text-blue-300 mb-1">Moves</div>
              <div className="text-3xl font-bold tabular-nums text-slate-100">{result.moves.length}</div>
            </div>
            <div className="rounded-2xl border border-slate-700/40 bg-slate-900 p-4 text-center">
              <div className="text-[10px] uppercase tracking-[0.18em] font-semibold text-slate-400 mb-1">Freed</div>
              <div className="text-3xl font-bold tabular-nums text-emerald-400">{result.freedBins.length}</div>
            </div>
            <div className="rounded-2xl border border-slate-700/40 bg-slate-900 p-4 text-center">
              <div className="text-[10px] uppercase tracking-[0.18em] font-semibold text-slate-400 mb-1">PAL</div>
              <div className="text-3xl font-bold tabular-nums text-amber-400">{totalPAL.toFixed(1)}</div>
            </div>
          </div>

          {/* Freed bins */}
          {result.freedBins.length > 0 && (
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
              <div className="text-[10px] uppercase tracking-[0.18em] font-semibold text-emerald-400 mb-1.5">Freed Bins</div>
              <div className="font-mono text-[12px] leading-relaxed text-emerald-300">
                {result.freedBins.join(", ")}
              </div>
            </div>
          )}

          {/* Output buttons */}
          <div className="rounded-2xl border border-slate-700/50 bg-slate-900/60 p-5 space-y-3">
            <div className="text-[10px] uppercase tracking-[0.18em] font-semibold text-slate-400">Output</div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleView}
                className="flex items-center justify-center gap-2 py-3.5 rounded-xl bg-slate-700/60 hover:bg-slate-700 border border-slate-600/50 text-slate-200 font-semibold text-sm transition-all active:scale-[0.98]"
              >
                <Eye size={16} className="text-blue-400" />
                View
              </button>
              <button
                onClick={handleDownload}
                className="flex items-center justify-center gap-2 py-3.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-200 font-semibold text-sm transition-all active:scale-[0.98]"
              >
                <Download size={16} />
                Download .txt
              </button>
            </div>
          </div>

          {/* Recalculate / change settings */}
          <div className="flex gap-2">
            <button
              onClick={() => setStep(2)}
              className="flex-1 py-2.5 rounded-xl border border-slate-700/50 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 text-sm font-semibold transition-colors flex items-center justify-center gap-2"
            >
              <Settings2 size={14} />
              Adjust Settings
            </button>
            <button
              onClick={calculate}
              className="flex-1 py-2.5 rounded-xl border border-blue-700/40 bg-blue-900/20 text-blue-300 hover:bg-blue-900/30 text-sm font-semibold transition-colors flex items-center justify-center gap-2"
            >
              <RotateCcw size={14} />
              Recalculate
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
