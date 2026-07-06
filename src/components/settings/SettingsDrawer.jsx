import React, { useState } from "react";
import { X, RotateCcw } from "lucide-react";

export default function SettingsDrawer({
  isOpen,
  onClose,
  onRebuild,
  warehouse, setWarehouse,
  excludeRbins, setExcludeRbins,
  globalThreshold, setGlobalThreshold,
  proximityAutoRun, setProximityAutoRun,
  excludeH, setExcludeH,
  excludeHH, setExcludeHH,
  excludeI, setExcludeI,
  excludeII, setExcludeII,
  allowSrc110, setAllowSrc110,
  allowTgt110, setAllowTgt110,
  allowTgt111, setAllowTgt111,
  excludeCustomBins, setExcludeCustomBins,
  CUSTOM_EXCLUDED_BINS,
  lineBins, setLineBins,
  ignoredMoves,
  protectABC, setProtectABC,
}) {
  const [showExcludedBinList, setShowExcludedBinList] = useState(false);
  const [closing, setClosing] = useState(false);

  function handleClose() {
    setClosing(true);
    setTimeout(() => {
      setClosing(false);
      onClose();
    }, 250);
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[90] flex justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 animate-fade-in bg-[rgba(88,65,33,0.18)] backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Drawer panel */}
      <div className={`relative w-full max-w-md overflow-y-auto border-l border-[#d9cfbe] bg-[#fbf8f1] shadow-[-20px_0_60px_rgba(72,56,33,0.16)] ${closing ? "animate-slide-out-right" : "animate-slide-in-right"}`}>
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#e6dccb] bg-[rgba(251,248,241,0.96)] px-5 py-4 backdrop-blur-xl">
          <div>
            <div className="text-lg font-bold text-slate-900">Adjustments</div>
            <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Engine Settings</div>
          </div>
          <button onClick={handleClose} className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-white hover:text-slate-700">
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-6">
          {/* Warehouse selector */}
          <Section title="Warehouse">
            <select
              value={warehouse}
              onChange={(e) => setWarehouse(e.target.value)}
              className="w-full rounded-xl border border-[#d9cfbe] bg-white px-3 py-3 text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-sky-200"
            >
              <option value="WH1">WH1 (A-J, no R)</option>
              <option value="WH2">WH2 (R-bins / 2A)</option>
              <option value="WH3">WH3 (3-bins)</option>
              <option value="ALL">All Areas</option>
            </select>
            <Toggle checked={excludeRbins} onChange={setExcludeRbins} label="Skip R-bins" hint="Don't use R-bins when planning moves." />
          </Section>

          {/* Move rules */}
          <Section title="Consolidation Threshold">
            <div>
              <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Global Max (PAL)</label>
              <input
                type="number"
                min="0"
                value={globalThreshold}
                onChange={(e) => setGlobalThreshold(e.target.value)}
                className="w-full rounded-lg border border-[#d9cfbe] bg-white px-3 py-2 font-mono text-sm font-medium text-slate-700"
              />
              <div className="mt-1 text-[10px] text-slate-500">Bins with this qty or less are consolidation candidates across all rows and phases.</div>
            </div>
            <Toggle checked={proximityAutoRun} onChange={setProximityAutoRun} label="Group by aisle" hint="Put same materials closer together." accent="forge" />
            <Toggle checked={protectABC} onChange={setProtectABC} label="Protect A/B/C rows (never target)" hint="Never consolidate INTO A/B/C production rows." accent="danger" />
          </Section>

          <Section title="Exclude as Source Row">
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "H",  checked: excludeH,  onChange: setExcludeH  },
                { label: "HH", checked: excludeHH, onChange: setExcludeHH },
                { label: "I",  checked: excludeI,  onChange: setExcludeI  },
                { label: "II", checked: excludeII, onChange: setExcludeII },
              ].map(({ label, checked, onChange }) => (
                <label
                  key={label}
                  className="flex cursor-pointer items-center gap-3 rounded-xl border border-[#e6dccb] bg-white px-4 py-3 transition-colors hover:bg-[#fffdf8]"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => onChange(e.target.checked)}
                    className="h-4 w-4 rounded border-[#cdbfa9] text-ppBlue-500"
                  />
                  <span className="font-mono text-sm font-bold text-slate-800">{label}</span>
                  <span className="ml-auto text-[11px] text-slate-500">{checked ? "excluded" : "allowed"}</span>
                </label>
              ))}
            </div>
          </Section>

          {/* Bin restrictions */}
          <Section title="Bin Limits">
            <Toggle checked={allowSrc110} onChange={setAllowSrc110} label="Allow moving FROM 110 bins" />
            <Toggle checked={allowTgt110} onChange={setAllowTgt110} label="Allow moving TO 110 bins" />
            <Toggle checked={allowTgt111} onChange={setAllowTgt111} label="Allow moving TO 111 bins" />
            <Toggle checked={excludeCustomBins} onChange={setExcludeCustomBins} label={`Block side bins (${CUSTOM_EXCLUDED_BINS.length})`} hint="Don't use side bins for any moves." accent="danger" />
            {excludeCustomBins && (
              <>
                <button onClick={() => setShowExcludedBinList((v) => !v)} className="text-[11px] font-semibold text-danger-300 transition-colors hover:text-danger-200">
                  {showExcludedBinList ? "Hide side-bin list" : "Show side-bin list"}
                </button>
                {showExcludedBinList && (
                  <div className="max-h-28 overflow-y-auto rounded-xl border border-rose-200 bg-rose-50 p-3 font-mono text-[10px] leading-relaxed text-rose-700">
                    {CUSTOM_EXCLUDED_BINS.join(", ")}
                  </div>
                )}
              </>
            )}
          </Section>

          {/* Line bins & ignored */}
          <Section title="Line Bins & Skipped">
            <div className="grid grid-cols-4 gap-2">
              {lineBins.map((v, i) => (
                <input
                  key={i}
                  value={v}
                  onChange={(e) => {
                    const next = [...lineBins];
                    next[i] = e.target.value.toUpperCase();
                    setLineBins(next);
                  }}
                  placeholder={`L${i + 1}`}
                  className="w-full rounded-lg border border-[#d9cfbe] bg-white px-2 py-2 text-center font-mono text-[10px] font-medium text-slate-700 placeholder:text-slate-400"
                />
              ))}
            </div>
            <div className="rounded-xl border border-[#e6dccb] bg-white p-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Skipped moves</div>
              <div className="mt-1 text-2xl font-black tracking-[-0.04em] text-slate-900">{ignoredMoves.size}</div>
            </div>
          </Section>

          {/* Apply button */}
          <button
            onClick={() => { onRebuild(); handleClose(); }}
            className="w-full rounded-xl border border-sky-200 bg-sky-50 py-3 text-sm font-bold text-sky-800 transition-all hover:bg-sky-100 active:translate-y-px"
          >
            <RotateCcw size={14} className="inline mr-2" />
            Apply & Rebuild
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="space-y-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">{title}</div>
      {children}
    </div>
  );
}

function Toggle({ checked, onChange, label, hint, accent = "ppBlue" }) {
  const borderClass = accent === "danger"
    ? "border-rose-200 bg-rose-50"
    : accent === "forge"
    ? "border-amber-200 bg-amber-50"
    : "border-[#e6dccb] bg-white";
  const checkClass = accent === "danger"
    ? "text-danger-500"
    : accent === "forge"
    ? "text-forge-500"
    : "text-ppBlue-500";

  return (
    <label className={`flex cursor-pointer items-start gap-3 rounded-xl border ${borderClass} px-3 py-3 text-sm text-slate-700`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className={`mt-0.5 h-4 w-4 rounded border-[#cdbfa9] ${checkClass}`}
      />
      <span>
        {label}
        {hint && <div className="mt-0.5 text-[11px] text-slate-500">{hint}</div>}
      </span>
    </label>
  );
}
