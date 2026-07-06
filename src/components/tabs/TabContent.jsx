import React from "react";
import WarehouseBinMap from "../../features/map/WarehouseBinMap.tsx";
import UserGuidePanel from "../../features/guide/UserGuidePanel";

export default function TabContent({ tab, children, preloadedJson }) {
  if (!tab) return null;

  switch (tab.type) {
    case "MAP":
      return (
        <div className="animate-fade-in p-4 lg:p-6">
          <div className="mx-auto overflow-hidden rounded-[32px] border border-[#d9cfbe] bg-[#fffdf8] shadow-[0_22px_44px_rgba(79,63,39,0.1)]">
            <WarehouseBinMap preloadedJson={preloadedJson} />
          </div>
        </div>
      );

    case "HELP":
      return (
        <div className="animate-fade-in p-4 lg:p-6">
          <div className="mx-auto rounded-[32px] border border-[#d9cfbe] bg-[#fbf8f1] p-6 shadow-[0_18px_36px_rgba(79,63,39,0.08)]">
            <div className="mb-1 text-lg font-bold text-slate-900">Field Notes</div>
            <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Reference Guide</div>
            <UserGuidePanel />
          </div>
        </div>
      );

    case "CONSOLIDATOR":
    case "PUTAWAY":
    case "STATS":
      return (
        <div className="animate-fade-in p-4 lg:p-6">
          <div className="mx-auto max-w-[1660px]">
            {children}
          </div>
        </div>
      );

    default:
      return (
        <div className="p-6 text-center text-slate-500">
          Unknown tab type: {tab.type}
        </div>
      );
  }
}
