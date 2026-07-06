import React, { useRef } from "react";
import { Upload, ListOrdered, Map, Search, BarChart3, HelpCircle, CheckCircle2, AlertCircle } from "lucide-react";
import logo from "../../assets/logo.png";

const MENU_ITEMS = [
  { id: "upload",       label: "Upload",          subtitle: "Load SAP export file",            icon: Upload,       gradient: "from-ppBlue-600 to-ppBlue-800",  type: null },
  { id: "consolidator", label: "Consolidator",     subtitle: "View & manage move list",         icon: ListOrdered,  gradient: "from-ppBlue-500 to-indigo-700",   type: "CONSOLIDATOR" },
  { id: "map",          label: "Bin Map (WH1)",    subtitle: "Interactive warehouse layout",     icon: Map,          gradient: "from-cyan-600 to-blue-800",       type: "MAP" },
  { id: "putaway",      label: "PutAway Finder",   subtitle: "Find optimal bin placement",      icon: Search,       gradient: "from-emerald-600 to-teal-800",    type: "PUTAWAY" },
  { id: "stats",        label: "Stats",            subtitle: "Analytics & capacity reports",     icon: BarChart3,    gradient: "from-violet-600 to-purple-800",   type: "STATS" },
  { id: "help",         label: "Help",             subtitle: "User guide & documentation",      icon: HelpCircle,   gradient: "from-slate-500 to-steel-700",     type: "HELP" },
];

export default function LauncherMenu({
  appVersion,
  onSpawnTab,
  onLoadFile,
  uploadFeedback,
  allMoves,
  freedBins,
  totalMoveQty,
  menuItemRefs,
}) {
  const fileInputRef = useRef(null);

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-56px)] py-10 px-4 animate-fade-in">
      {/* Logo + title */}
      <div className="flex flex-col items-center mb-10">
        <div className="flex h-20 w-20 items-center justify-center rounded-[26px] border border-ppBlue-500/30 bg-ppBlue-900/40 shadow-[0_0_44px_rgba(54,104,252,0.25)] mb-4">
          <img src={logo} alt="FloorAgent" className="h-14 w-14 object-contain drop-shadow-lg" />
        </div>
        <h1 className="text-3xl font-black tracking-[-0.04em] text-slate-50">FloorAgent</h1>
        <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.26em] text-steel-500">
          v{appVersion} &middot; Consolidation &middot; Putaway &middot; Floor Control
        </div>
      </div>

      {/* Menu grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full max-w-3xl">
        {MENU_ITEMS.map((item) => {
          const Icon = item.icon;
          const isUpload = item.type === null;

          return (
            <button
              key={item.id}
              ref={(el) => { if (menuItemRefs) menuItemRefs.current[item.id] = el; }}
              type="button"
              onClick={() => {
                if (isUpload) {
                  fileInputRef.current?.click();
                } else {
                  onSpawnTab(item.type, item.id);
                }
              }}
              className="group relative flex items-center gap-4 rounded-2xl border border-steel-700/50 bg-[#0b1320]/90 p-4 text-left transition-all duration-300 hover:-translate-y-1 hover:border-steel-500/60 hover:shadow-[0_18px_42px_rgba(0,0,0,0.32)]"
            >
              <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${item.gradient} shadow-lg transition-transform duration-300 group-hover:scale-110`}>
                <Icon size={22} className="text-white" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold text-slate-100">{item.label}</div>
                <div className="text-[11px] text-steel-400 mt-0.5">{item.subtitle}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Hidden file input for Upload */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept=".xlsx,.xls"
        onChange={onLoadFile}
      />

      {/* Upload feedback */}
      {uploadFeedback && (
        <div className={`mt-4 flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium animate-fade-in-up ${
          uploadFeedback.success
            ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
            : "border border-danger-500/30 bg-danger-500/10 text-danger-300"
        }`}>
          {uploadFeedback.success ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          {uploadFeedback.message}
        </div>
      )}

      {/* Bottom metric cards (only when data loaded) */}
      {allMoves?.length > 0 && (
        <div className="mt-8 flex gap-4 flex-wrap justify-center">
          <div className="min-w-[100px] rounded-2xl border border-ppBlue-700/40 bg-ppBlue-900/40 px-5 py-3 text-center shadow-[0_12px_30px_rgba(54,104,252,0.12)]">
            <div className="text-[10px] uppercase tracking-[0.18em] font-semibold text-ppBlue-300">Moves</div>
            <div className="text-2xl font-bold tabular-nums text-slate-100 mt-0.5">{allMoves.length}</div>
          </div>
          <div className="min-w-[100px] rounded-2xl border border-steel-700/40 bg-steel-900 px-5 py-3 text-center shadow-[0_10px_24px_rgba(0,0,0,0.25)]">
            <div className="text-[10px] uppercase tracking-[0.18em] font-semibold text-steel-400">Freed</div>
            <div className="text-2xl font-bold tabular-nums text-emerald-400 mt-0.5">{freedBins?.length || 0}</div>
          </div>
          <div className="min-w-[100px] rounded-2xl border border-steel-700/40 bg-steel-900 px-5 py-3 text-center shadow-[0_10px_24px_rgba(0,0,0,0.25)]">
            <div className="text-[10px] uppercase tracking-[0.18em] font-semibold text-steel-400">PAL</div>
            <div className="text-2xl font-bold tabular-nums text-forge-400 mt-0.5">{totalMoveQty?.toFixed(1) || "0.0"}</div>
          </div>
        </div>
      )}
    </div>
  );
}
