import React from "react";
import { Home, X, Settings2, ListOrdered, Map, Search, BarChart3, HelpCircle } from "lucide-react";

const TAB_ICONS = {
  CONSOLIDATOR: ListOrdered,
  MAP: Map,
  PUTAWAY: Search,
  STATS: BarChart3,
  HELP: HelpCircle,
};

export default function TabBar({
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  onGoHome,
  onOpenSettings,
  tabButtonRefs,
  newTabId,
  homeMode = false,
}) {
  return (
    <div className={`sticky top-0 z-50 flex h-14 items-center gap-2 px-3 backdrop-blur-xl ${
      homeMode
        ? "border-b border-steel-700/40 bg-[#070f1a]/95 shadow-[0_4px_20px_rgba(0,0,0,0.3)]"
        : "border-b border-[#ded3c1] bg-[rgba(252,249,243,0.92)] shadow-[0_10px_24px_rgba(79,63,39,0.08)]"
    }`}>
      {/* Home button */}
      <button
        type="button"
        onClick={onGoHome}
        className={`flex items-center justify-center h-9 w-9 rounded-xl transition-all duration-200 ${
          activeTabId === null
            ? homeMode
              ? "bg-ppBlue-600 text-white shadow-glow-blue"
              : "border border-sky-200 bg-sky-50 text-sky-700 shadow-[0_10px_20px_rgba(56,189,248,0.12)]"
            : homeMode
            ? "text-steel-400 hover:bg-steel-800 hover:text-slate-200"
            : "text-slate-500 hover:bg-white hover:text-slate-800"
        }`}
        title="Home"
      >
        <Home size={18} />
      </button>

      {/* Divider */}
      <div className={`mx-1 h-6 w-px ${homeMode ? "bg-steel-700/50" : "bg-[#ddd1bf]"}`} />

      {/* Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto flex-1 scrollbar-thin py-1">
        {tabs.map((tab) => {
          const Icon = TAB_ICONS[tab.type] || ListOrdered;
          const isActive = tab.id === activeTabId;
          const isNew = tab.id === newTabId;

          return (
            <div
              key={tab.id}
              ref={(el) => { if (tabButtonRefs) tabButtonRefs.current[tab.id] = el; }}
              className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition-all duration-200 cursor-pointer shrink-0 ${
                isNew ? "animate-tab-appear" : ""
              } ${
                isActive
                  ? homeMode
                    ? "border border-ppBlue-500/40 bg-ppBlue-600/20 text-ppBlue-200 shadow-[0_0_12px_rgba(54,104,252,0.15)]"
                    : "border border-[#d8cdbb] bg-white text-slate-800 shadow-[0_12px_24px_rgba(79,63,39,0.08)]"
                  : homeMode
                  ? "border border-transparent text-steel-400 hover:bg-steel-800/60 hover:text-slate-200"
                  : "border border-transparent text-slate-500 hover:bg-[rgba(255,255,255,0.7)] hover:text-slate-800"
              }`}
            >
              <button
                type="button"
                onClick={() => onSelectTab(tab.id)}
                className="flex items-center gap-2"
              >
                <Icon size={14} />
                <span className="tracking-wide">{tab.label}</span>
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onCloseTab(tab.id); }}
                className={`ml-1 rounded p-0.5 transition-colors ${
                  homeMode
                    ? "hover:bg-steel-700/60 hover:text-danger-400"
                    : "hover:bg-[#f7f0e4] hover:text-rose-500"
                }`}
                title="Close tab"
              >
                <X size={12} />
              </button>
            </div>
          );
        })}
      </div>

      {/* Divider */}
      <div className={`mx-1 h-6 w-px ${homeMode ? "bg-steel-700/50" : "bg-[#ddd1bf]"}`} />

      {/* Settings/Adjustments button */}
      <button
        type="button"
        onClick={onOpenSettings}
        className={`flex h-9 items-center gap-2 rounded-xl px-3 transition-all duration-200 ${
          homeMode
            ? "text-steel-400 hover:bg-steel-800 hover:text-slate-200"
            : "text-slate-500 hover:bg-white hover:text-slate-800"
        }`}
        title="Adjustments"
      >
        <Settings2 size={16} />
        <span className="text-[11px] font-semibold tracking-wide hidden sm:inline">Adjustments</span>
      </button>
    </div>
  );
}
