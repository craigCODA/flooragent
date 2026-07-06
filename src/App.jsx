import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import logo from "./Assets/logo.png";
import WarehouseBinMap from "./features/map/WarehouseBinMap.tsx";
import FeedbackSystem from "./features/support/components/FeedbackSystem";
import BeforeAfterModal from "./features/analytics/components/BeforeAfterModal";
import UserGuidePanel from "./features/guide/UserGuidePanel";
import openMoveListWindow from "./features/moves/openMoveListWindow";
import { Button } from "./components/ui/button";
import { Card } from "./components/ui/card";
import { Input } from "./components/ui/input";
import { Badge } from "./components/ui/badge";
import { normBin, toNum, parseBin, inWarehouse, isPhysicalBin } from "./domain/bin";
import { baseCapacity } from "./domain/capacity";
import { loadCapOverrides, saveCapOverrides, loadDisabledBins, saveDisabledBins } from "./domain/storage";
import { validateSapHeaders, parseSapExport, buildBinState } from "./domain/sap";
import { calculateAnalytics } from "./domain/analytics";
import { consolidate, findBestBin, moveKey, LINE_PREFERRED_ROWS } from "./domain/planning";
import { findMostScatteredMaterials, generateProximityPlan, scoreAisleCandidate, DRIVE_AISLES } from "./domain/proximity";
import { AgentDataProvider } from "./features/agent";
import LauncherMenu from "./components/launcher/LauncherMenu";
import TabBar from "./components/tabs/TabBar";
import TabContent from "./components/tabs/TabContent";
import SettingsDrawer from "./components/settings/SettingsDrawer";
import OrbAnimation from "./components/animation/OrbAnimation";
import {
  Upload,
  RefreshCcw,
  Download,
  Copy,
  Search,
  Lock,
  Settings2,
  Loader2,
  ArrowRight,
  X,
  Trash2,
  RotateCcw,
  Ban,
  Printer,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

function Eyebrow({ children, className = "" }) {
  return <div className={`text-[11px] uppercase tracking-[0.18em] font-semibold ${className}`}>{children}</div>;
}

function HazardStripe() {
  return (
    <div
      className="h-1 w-full animate-hazard"
      style={{
        background: "repeating-linear-gradient(-45deg, #eab308, #eab308 8px, #0b1120 8px, #0b1120 16px)",
        backgroundSize: "28px 100%",
      }}
    />
  );
}

function MetricCard({ label, value, tone = "paper" }) {
  const toneClasses = {
    console: "bg-ppBlue-900/40 border-ppBlue-700/40 text-slate-100 shadow-[0_12px_30px_rgba(54,104,252,0.15)]",
    paper: "bg-steel-900 border-steel-700/40 text-slate-100 shadow-[0_10px_24px_rgba(0,0,0,0.25)]",
    danger: "bg-danger-500/10 border-danger-500/30 text-danger-300 shadow-[0_10px_24px_rgba(239,68,68,0.1)]",
  };
  const labelClasses = {
    console: "text-ppBlue-300",
    paper: "text-steel-400",
    danger: "text-danger-400",
  };
  return (
    <Card className={`min-w-[92px] p-4 text-center ${toneClasses[tone]}`} variant="paper">
      <div className={`text-[10px] uppercase tracking-[0.18em] font-semibold ${labelClasses[tone]}`}>{label}</div>
      <div className="text-3xl font-bold tabular-nums mt-1">{value}</div>
    </Card>
  );
}

function MoveSection({ cluster, isFirst, completed, selectedMoveId, onSelectMove, onConfirmMove, onUndoMove, onCopy, onIgnore }) {
  const [collapsed, setCollapsed] = React.useState(false);
  const allDone = cluster.doneCount === cluster.moves.length;
  const progress = cluster.moves.length > 0 ? Math.round((cluster.doneCount / cluster.moves.length) * 100) : 0;

  return (
    <div className={`${!isFirst ? "mt-3" : ""} rounded-[26px] border border-[#d7cfbf] bg-[#fbf8f1] shadow-[0_18px_34px_rgba(61,52,38,0.08)] overflow-hidden`}>
      <button
        type="button"
        onClick={() => setCollapsed(v => !v)}
        className={`w-full text-left transition-colors ${
          allDone ? "bg-[#edf8f0]" : "bg-[#f4efe4]"
        }`}
      >
        <div className="flex flex-wrap items-center gap-4 px-5 py-4">
          <div className="flex items-center gap-3">
            {collapsed ? <ChevronRight size={18} className="text-slate-500 shrink-0" /> : <ChevronDown size={18} className="text-slate-500 shrink-0" />}
            <div className={`flex h-11 w-11 items-center justify-center rounded-2xl border font-mono text-sm font-bold ${
              allDone ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-slate-300 bg-white text-slate-700"
            }`}>
              {cluster.title}
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Source pocket</div>
            <div className="mt-1 text-lg font-black tracking-[-0.03em] text-slate-800">{cluster.title}</div>
            <div className="mt-1 text-sm text-slate-500">{cluster.subtitle}</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-slate-300 bg-white px-3 py-1 text-[11px] font-semibold text-slate-600">{cluster.moves.length} slips</span>
            <span className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-[11px] font-semibold text-amber-700">{cluster.totalQty.toFixed(1)} PAL</span>
            <span className="rounded-full border border-slate-300 bg-white px-3 py-1 text-[11px] font-semibold text-slate-600">{cluster.materialCount} materials</span>
            <div className="flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-1">
              <div className="h-2 w-20 overflow-hidden rounded-full bg-[#e7dfd1]">
                <div className={`h-full rounded-full transition-all ${allDone ? "bg-emerald-500" : "bg-sky-500"}`} style={{ width: `${progress}%` }} />
              </div>
              <span className="text-[11px] font-semibold text-slate-600">{cluster.doneCount}/{cluster.moves.length}</span>
            </div>
          </div>
        </div>
      </button>

      {!collapsed && (
        <div className="grid gap-3 border-t border-[#e3dacb] bg-[#fffdf8] p-4 md:grid-cols-2">
          {cluster.moves.map((move) => {
            const done = completed.has(move.id);
            const selected = selectedMoveId === move.id;
            return (
              <div
                key={move.id}
                className={`rounded-[22px] border transition-all ${
                  done
                    ? "border-emerald-200 bg-emerald-50/80"
                    : selected
                    ? "border-sky-300 bg-sky-50 shadow-[0_10px_24px_rgba(56,189,248,0.14)]"
                    : "border-[#ddd4c5] bg-white hover:border-slate-300"
                }`}
              >
                <button
                  type="button"
                  onClick={() => !done && onSelectMove(move.id)}
                  className="w-full text-left"
                >
                  <div className="flex items-start justify-between gap-3 px-4 py-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="rounded-full border border-slate-300 bg-[#f5f1e8] px-2 py-0.5 font-mono text-[10px] font-semibold text-slate-600">#{move.id}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          move.tag === "proximity" ? "bg-sky-100 text-sky-700" : "bg-stone-100 text-stone-600"
                        }`}>
                          {move.tag === "proximity" ? "Aisle pull" : "Consolidation"}
                        </span>
                      </div>
                      <div className="mt-3 font-mono text-sm font-bold text-slate-800">{move.materialId}</div>
                      <div className="mt-1 text-xs leading-relaxed text-slate-500">{move.materialDesc || "No description carried in export"}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">To</div>
                      <div className="mt-1 font-mono text-2xl font-black tracking-[-0.04em] text-slate-800">{move.to}</div>
                      <div className="mt-1 text-sm font-semibold text-amber-700">{Number(move.qty).toFixed(1)} PAL</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between border-t border-[#ece4d8] px-4 py-3">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span>Lift from</span>
                      <span className="rounded-full border border-[#ddd4c5] bg-[#f8f5ee] px-2 py-0.5 font-mono font-semibold text-slate-700">{move.from}</span>
                      <ArrowRight size={12} className="text-slate-400" />
                      <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 font-mono font-semibold text-sky-700">{move.to}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {done ? <CheckCircle2 size={16} className="text-emerald-500" /> : selected ? <span className="h-3 w-3 rounded-full bg-sky-500" /> : <span className="h-3 w-3 rounded-full border border-slate-300 bg-white" />}
                    </div>
                  </div>
                </button>
                <div className="flex items-center justify-between gap-2 border-t border-[#ece4d8] px-4 py-3">
                  <button
                    type="button"
                    onClick={() => onCopy(`${move.from}\t${move.to}\t${move.materialId}\t${move.qty}`)}
                    className="rounded-full border border-slate-300 bg-[#f7f3ea] px-3 py-1.5 text-[11px] font-semibold text-slate-600 transition-colors hover:bg-white"
                  >
                    Copy slip
                  </button>
                  {done ? (
                    <button
                      type="button"
                      onClick={() => onUndoMove(move.id)}
                      className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-[11px] font-semibold text-amber-700 transition-colors hover:bg-amber-100"
                    >
                      Undo
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onIgnore(move)}
                      className="rounded-full border border-rose-300 bg-rose-50 px-3 py-1.5 text-[11px] font-semibold text-rose-700 transition-colors hover:bg-rose-100"
                    >
                      Skip on rebuild
                    </button>
                  )}
                </div>
                {selected && !done && (
                  <div className="border-t border-sky-200 bg-sky-50 px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="text-sm font-medium text-sky-800">Mark this slip complete when the source has been cleared and the target has been loaded.</div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onConfirmMove(move.id)}
                          className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-emerald-500"
                        >
                          Confirm done
                        </button>
                        <button
                          type="button"
                          onClick={() => onSelectMove(move.id)}
                          className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-[#f8f4ec]"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const TAB_LABELS = {
  CONSOLIDATOR: "Consolidator",
  MAP: "Bin Map",
  PUTAWAY: "PutAway",
  STATS: "Stats",
  HELP: "Help",
};

export default function App() {
  const APP_VERSION = window.wo?.version ?? "2.B";
  const mapOnlyMode = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("view") === "map";
  }, []);
  const [xlsxReady, setXlsxReady] = useState(false);
  const xlsxRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mod = await import("xlsx");
        if (!cancelled) { xlsxRef.current = mod; setXlsxReady(true); }
      } catch {
        if (!cancelled) setXlsxReady(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const [supportOpen, setSupportOpen] = useState(false);
  const [rawSapJson, setRawSapJson] = useState(null);
  const [stockRows, setStockRows] = useState([]);
  const [emptyBinsFromExport, setEmptyBinsFromExport] = useState(new Set());
  const [emptyBinTypes, setEmptyBinTypes] = useState({});
  const [moves, setMoves] = useState([]);
  const [freedBins, setFreedBins] = useState([]);
  const [completed, setCompleted] = useState(new Set());
  const [ignoredMoves, setIgnoredMoves] = useState(new Map());
  const [ignoreModalMove, setIgnoreModalMove] = useState(null);
  const [ignoreReason, setIgnoreReason] = useState("");
  const [analytics, setAnalytics] = useState(null);
  const [showBeforeAfter, setShowBeforeAfter] = useState(false);
  const [initialBinState, setInitialBinState] = useState(null);
  const [finalBinState, setFinalBinState] = useState(null);
  const [loadError, setLoadError] = useState("");

  // --- New tab system state ---
  const [openTabs, setOpenTabs] = useState([]);
  const [activeTabId, setActiveTabId] = useState(null); // null = launcher menu
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [uploadFeedback, setUploadFeedback] = useState(null);
  const [orbAnimation, setOrbAnimation] = useState(null);
  const [newTabId, setNewTabId] = useState(null);
  const menuItemRefs = useRef({});
  const tabButtonRefs = useRef({});

  const [searchTerm, setSearchTerm] = useState("");
  const [hideCompleted, setHideCompleted] = useState(true);
  const [pageSize, setPageSize] = useState(18);
  const [page, setPage] = useState(1);
  const [warehouse, setWarehouse] = useState("WH1");
  const [excludeRbins, setExcludeRbins] = useState(true);
  const [globalThreshold, setGlobalThreshold] = useState(20);
  const [allowSrc110, setAllowSrc110] = useState(true);
  const [allowTgt110, setAllowTgt110] = useState(true);
  const [allowTgt111, setAllowTgt111] = useState(true);
  const [excludeH,  setExcludeH]  = useState(true);
  const [excludeHH, setExcludeHH] = useState(true);
  const [excludeI,  setExcludeI]  = useState(true);
  const [excludeII, setExcludeII] = useState(true);
  const [protectABC, setProtectABC] = useState(false);
  const CUSTOM_EXCLUDED_BINS = [
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
  const [excludeCustomBins, setExcludeCustomBins] = useState(true);
  const [lineBins, setLineBins] = useState(Array(17).fill(""));
  const [finderQuery, setFinderQuery] = useState("");
  const [finderQty, setFinderQty] = useState("");
  const [finderLine, setFinderLine] = useState(null);
  const [finderResult, setFinderResult] = useState(null);
  const [rejectedBins, setRejectedBins] = useState(new Map());
  const [rejectingBin, setRejectingBin] = useState(null);
  const [rejectReasonInput, setRejectReasonInput] = useState("");
  const [capOverrides, setCapOverrides] = useState(() => ({})); // localStorage disabled - always empty
  const [disabledBins, setDisabledBins] = useState(() => new Set()); // localStorage disabled - always empty
  const [proximityMoves, setProximityMoves] = useState([]);
  const [proximityAutoRun, setProximityAutoRun] = useState(false);
  const [selectedMoveId, setSelectedMoveId] = useState(null);

  const autoDisabledRbinsRef = useRef(new Set());
  const settingsRef = useRef({});

  useEffect(() => {
    settingsRef.current = {
      warehouse, excludeRbins, globalThreshold,
      allowSrc110, allowTgt110, allowTgt111,
      excludeH, excludeHH, excludeI, excludeII,
      excludeCustomBins, lineBins, capOverrides, disabledBins, ignoredMoves, protectABC,
    };
  }, [warehouse, excludeRbins, globalThreshold, allowSrc110, allowTgt110, allowTgt111, excludeH, excludeHH, excludeI, excludeII, excludeCustomBins, lineBins, capOverrides, disabledBins, ignoredMoves, protectABC]);

  // localStorage disabled - always start fresh with hardcoded defaults
  // useEffect(() => { saveCapOverrides(capOverrides); }, [capOverrides]);
  // useEffect(() => { saveDisabledBins(disabledBins); }, [disabledBins]);

  const memoizedBinState = useMemo(() => buildBinState(stockRows), [stockRows]);

  useEffect(() => {
    if (stockRows.length === 0) return;
    const binState = memoizedBinState;
    const emptyBins = Array.from(emptyBinsFromExport).map(normBin).filter(Boolean);
    const allBins = new Set([...Object.keys(binState), ...emptyBins]);
    const rBins = Array.from(allBins).filter(b => b.includes("R"));

    if (excludeRbins) {
      const newAutoDisabled = new Set();
      setDisabledBins(prev => {
        const updated = new Set(prev);
        rBins.forEach(bin => {
          if (!prev.has(bin)) newAutoDisabled.add(bin);
          updated.add(bin);
        });
        return updated;
      });
      autoDisabledRbinsRef.current = newAutoDisabled;
    } else {
      setDisabledBins(prev => {
        const updated = new Set(prev);
        autoDisabledRbinsRef.current.forEach(bin => updated.delete(bin));
        return updated;
      });
      autoDisabledRbinsRef.current.clear();
    }
  }, [excludeRbins, stockRows, emptyBinsFromExport]);

  // --- Tab management ---
  const spawnTab = useCallback((type, menuItemId) => {
    if (type === "MAP") {
      if (window.wo?.openMapWindow) {
        window.wo.openMapWindow();
        return;
      }
    }

    // Check for duplicate
    const existing = openTabs.find(t => t.type === type);
    if (existing) {
      setActiveTabId(existing.id);
      return;
    }

    const id = `${type}-${Date.now()}`;
    const label = TAB_LABELS[type] || type;
    const newTab = { id, type, label };

    // Get menu item position for orb animation
    const fromEl = menuItemId && menuItemRefs.current[menuItemId];
    const fromRect = fromEl?.getBoundingClientRect();

    setOpenTabs(prev => [...prev, newTab]);
    setNewTabId(id);

    // Trigger orb animation after DOM updates
    if (fromRect) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const toEl = tabButtonRefs.current[id];
          const toRect = toEl?.getBoundingClientRect();
          if (toRect) {
            setOrbAnimation({ fromRect, toRect });
          }
        });
      });
    }

    // Clear new tab animation after a delay
    setTimeout(() => setNewTabId(null), 500);
  }, [openTabs]);

  const closeTab = useCallback((tabId) => {
    setOpenTabs(prev => {
      const idx = prev.findIndex(t => t.id === tabId);
      const next = prev.filter(t => t.id !== tabId);
      if (activeTabId === tabId) {
        // Fall back to previous tab or menu
        if (next.length > 0) {
          const fallbackIdx = Math.min(idx, next.length - 1);
          setActiveTabId(next[fallbackIdx].id);
        } else {
          setActiveTabId(null);
        }
      }
      return next;
    });
  }, [activeTabId]);

  function binInScope(bin, scopeWarehouse, excludeR) {
    const B = normBin(bin);
    if (!B) return false;
    if (!isPhysicalBin(B)) return false;
    if (excludeR && B.includes("R")) return false;
    return inWarehouse(B, scopeWarehouse);
  }

  function buildPlanFromRaw(jsonRows) {
    setLoadError("");
    setFinderResult(null);
    if (!jsonRows || !Array.isArray(jsonRows)) return;
    const missing = validateSapHeaders(jsonRows);
    if (missing.length) { setLoadError(`Missing columns: ${missing.join(", ")}`); return; }
    const s = settingsRef.current;
    const { stockRows: parsed, emptyBinsFromExport: empties, emptyBinTypes: types } = parseSapExport(jsonRows);
    const filteredStock = parsed.filter((r) => binInScope(r.bin, s.warehouse, s.excludeRbins) && !s.disabledBins?.has(normBin(r.bin)));
    const occupiedBinsInScope = new Set(
      (jsonRows || [])
        .map((r) => ({
          bin: normBin(r["Storage Bin"]),
          qty: toNum(r["Available stock"]),
        }))
        .filter(({ bin, qty }) => bin && qty > 0 && binInScope(bin, s.warehouse, s.excludeRbins) && !s.disabledBins?.has(bin))
        .map(({ bin }) => bin)
    );
    const filteredEmpties = new Set(
      Array.from(empties)
        .map(normBin)
        .filter((b) => binInScope(b, s.warehouse, s.excludeRbins) && !s.disabledBins?.has(b))
        .filter((b) => !occupiedBinsInScope.has(b))
    );
    const filteredTypes = {};
    for (const [b, t] of Object.entries(types || {})) {
      const B = normBin(b);
      if (filteredEmpties.has(B)) filteredTypes[B] = String(t);
    }
    const lockedSet = new Set((s.lineBins || []).map(normBin).filter(Boolean));
    const initialState = buildBinState(filteredStock);

    const threshold = toNum(s.globalThreshold) || 20;
    const avoidedSourceRows = new Set();
    if (s.excludeH)  avoidedSourceRows.add("H");
    if (s.excludeHH) avoidedSourceRows.add("HH");
    if (s.excludeI)  avoidedSourceRows.add("I");
    if (s.excludeII) avoidedSourceRows.add("II");

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
      capOverrides: s.capOverrides || {},
      disabledBins: s.disabledBins || new Set(),
      excludeHISource: false,
      avoidedSourceRows,
      maxSourceQty: threshold,
      excludedBinSet: s.excludeCustomBins ? new Set(CUSTOM_EXCLUDED_BINS) : new Set(),
      ignoredMoveKeys: new Set(Array.from((s.ignoredMoves || new Map()).keys())),
      avoidedTargetRows: (s.protectABC || (s.abcNeverTarget !== false)) ? new Set(["A", "B", "C"]) : new Set(),
      abcNeverTarget: s.protectABC || (s.abcNeverTarget !== false),
    });

    const freed = Object.keys(initialState)
      .filter((b) => (initialState[b]?.totalQty || 0) > 0)
      .filter((b) => (finalState[b]?.totalQty || 0) === 0)
      .sort((a, b) => a.localeCompare(b));

    const analyticsData = calculateAnalytics({
      moves: plan, initialBinState: initialState, finalBinState: finalState,
      stockRows: filteredStock, freedBins: freed, capOverrides: s.capOverrides || {},
      emptyBinsFromExport: filteredEmpties,
    });

    setStockRows(filteredStock);
    setEmptyBinsFromExport(filteredEmpties);
    setEmptyBinTypes(filteredTypes);
    setMoves(plan);
    setFreedBins(freed);
    setInitialBinState(initialState);
    setFinalBinState(finalState);
    setAnalytics(analyticsData);
    setShowBeforeAfter(false);
    setCompleted(new Set());
    setProximityMoves([]);
    setPage(1);

    // Post-consolidation proximity pass
    if (proximityAutoRun) {
      const scattered = findMostScatteredMaterials(finalState, 5);
      if (scattered.length > 0) {
        const workingState = {};
        for (const [binId, entry] of Object.entries(finalState)) {
          workingState[binId] = {
            totalQty: entry.totalQty || 0,
            materials: new Set(entry.materials || []),
            byMaterialQty: { ...(entry.byMaterialQty || {}) },
            storageType: entry.storageType || "",
            descByMaterial: { ...(entry.descByMaterial || {}) },
          };
        }
        const workingEmpties = new Set(filteredEmpties);

        const autoMoves = [];
        let nextId = plan.length + 1;
        for (const mat of scattered) {
          let bestAisle = null;
          let bestScore = -1;
          for (const [aisleStr] of Object.entries(DRIVE_AISLES)) {
            const aisleNum = Number(aisleStr);
            const score = scoreAisleCandidate(aisleNum, mat.materialId, workingState, workingEmpties, s.capOverrides || {});
            if (score.score > bestScore) {
              bestScore = score.score;
              bestAisle = aisleNum;
            }
          }
          if (bestAisle == null) continue;

          const proximityPlan = generateProximityPlan(
            mat.materialId, bestAisle, workingState, workingEmpties, filteredTypes,
            { capOverrides: s.capOverrides || {} }
          );

          const allPlanMoves = [...proximityPlan.cascadingMoves, ...proximityPlan.directMoves];
          for (const m of allPlanMoves) {
            autoMoves.push({
              id: nextId++,
              materialId: m.materialId,
              materialDesc: m.materialDesc,
              from: m.from,
              to: m.to,
              qty: m.qty,
              tag: "proximity",
              targetAisle: bestAisle,
            });
            if (workingState[m.from]) {
              workingState[m.from].totalQty -= m.qty;
              if (workingState[m.from].totalQty < 1e-6) workingState[m.from].totalQty = 0;
              workingState[m.from].byMaterialQty[m.materialId] = (workingState[m.from].byMaterialQty[m.materialId] || 0) - m.qty;
              if (workingState[m.from].byMaterialQty[m.materialId] < 1e-6) {
                delete workingState[m.from].byMaterialQty[m.materialId];
                workingState[m.from].materials.delete(m.materialId);
              }
            }
            if (!workingState[m.to]) {
              workingState[m.to] = { totalQty: 0, materials: new Set(), byMaterialQty: {}, storageType: "", descByMaterial: {} };
            }
            workingState[m.to].totalQty += m.qty;
            workingState[m.to].materials.add(m.materialId);
            workingState[m.to].byMaterialQty[m.materialId] = (workingState[m.to].byMaterialQty[m.materialId] || 0) + m.qty;
            if (workingState[m.to].totalQty > 0) workingEmpties.delete(normBin(m.to));
            if (workingState[m.from] && workingState[m.from].totalQty < 1e-6) workingEmpties.add(normBin(m.from));
          }
        }
        if (autoMoves.length > 0) {
          setProximityMoves(autoMoves);
        }
      }
    }
  }

  async function loadFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!xlsxReady) { setUploadFeedback({ success: false, message: "Spreadsheet tools are still loading. Try again in a moment." }); return; }
    try {
      const clearedIgnoredMoves = new Map();
      setIgnoredMoves(clearedIgnoredMoves);
      settingsRef.current = { ...settingsRef.current, ignoredMoves: clearedIgnoredMoves };
      const XLSX = xlsxRef.current;
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(new Uint8Array(buf), { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(sheet, { defval: "" });
      setRawSapJson(json);
      try {
        localStorage.setItem("warehouse-sap-data", JSON.stringify(json));
      } catch (err) {
        console.warn("Could not save SAP data to localStorage:", err);
      }
      buildPlanFromRaw(json);
      setUploadFeedback({ success: true, message: `Data loaded — ${file.name}` });
      setTimeout(() => setUploadFeedback(null), 5000);
    } catch (err) {
      const errMsg = err?.message?.toLowerCase() || "";
      let msg;
      if (errMsg.includes("password") || errMsg.includes("encrypted")) {
        msg = "File is password-protected. Please remove the password and try again.";
      } else if (errMsg.includes("unsupported") || errMsg.includes("format")) {
        msg = "Unsupported file format. Please provide a standard Excel file (XLS/XLSX).";
      } else {
        msg = "Could not read the file. Confirm it is a standard SAP export (XLS/XLSX).";
      }
      setUploadFeedback({ success: false, message: msg });
      setLoadError(msg);
      setTimeout(() => setUploadFeedback(null), 8000);
      console.error(err);
    } finally {
      e.target.value = "";
    }
  }

  function selectMove(id) {
    setSelectedMoveId((prev) => (prev === id ? null : id));
  }

  function confirmMove(id) {
    setCompleted((prev) => { const next = new Set(prev); next.add(id); return next; });
    setSelectedMoveId(null);
  }

  function undoMove(id) {
    setCompleted((prev) => { const next = new Set(prev); next.delete(id); return next; });
    setSelectedMoveId(null);
  }

  function openIgnoreModal(move) {
    setIgnoreModalMove(move);
    setIgnoreReason("");
  }

  function handleIgnoreMove(e) {
    e.preventDefault();
    if (!ignoreModalMove || !rawSapJson) return;
    const ignoredKey = moveKey(ignoreModalMove.materialId, ignoreModalMove.from, ignoreModalMove.to);
    const nextIgnoredMoves = new Map(ignoredMoves);
    nextIgnoredMoves.set(ignoredKey, {
      reason: ignoreReason.trim(),
      timestamp: new Date().toISOString(),
      move: ignoreModalMove,
    });
    setIgnoredMoves(nextIgnoredMoves);
    setIgnoreModalMove(null);
    setIgnoreReason("");
    buildPlanFromRaw(rawSapJson);
  }

  function copyText(t) {
    try { navigator.clipboard?.writeText(String(t)); } catch {}
  }

  async function exportMoves() {
    if (!xlsxReady || !allMoves.length) return;
    try {
      const XLSX = xlsxRef.current;
      // allMoves is already sorted by source bin then qty
      const data = allMoves.map((m) => ({
        "From Bin": m.from,
        "To Bin": m.to,
        Material: m.materialId,
        Quantity: m.qty,
        Tag: m.tag === "proximity" ? `Proximity → Aisle ${m.targetAisle}` : (m.tag || "consolidation"),
        Status: completed.has(m.id) ? "DONE" : "PENDING",
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Consolidation");
      const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const blob = new Blob([out], { type: "application/octet-stream" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Warehouse_Plan_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error("Export failed:", err);
      setLoadError("Export failed. If this persists, try restarting the app.");
    }
  }

  async function exportAnalyticsToExcel() {
    if (!xlsxReady || !analytics) return;
    try {
      const XLSX = xlsxRef.current;
      const summaryData = [
        ["Metric", "Value"],
        ["Total Moves", analytics.totalMoves],
        ["Bins Freed", analytics.totalFreedBins],
        ["Materials Moved", analytics.uniqueMaterialsMoved],
        ["Materials Consolidated", analytics.materialsConsolidated],
        ["Total PAL Moved", analytics.totalPALMoved],
        ["Multi-bin Materials Before", analytics.multiBinMaterialsBefore],
        ["Multi-bin Materials After", analytics.multiBinMaterialsAfter],
        ["Fragmentation Reduction", `${analytics.fragmentationReductionPct}%`],
        ["Source Drain Rate", `${analytics.sourceDrainRate}%`],
        ["Average Target Fill", `${analytics.avgTargetFillRate}%`],
        ["Same-row Move Rate", `${analytics.sameRowRate}%`],
        ["Average Row Distance", analytics.avgRowDistance],
        ["Moves per Freed Bin", analytics.movesPerFreedBin],
        ["PAL per Move", analytics.palPerMove],
        ["Capacity Utilization Before", `${analytics.capacityUtilizationBefore}%`],
        ["Capacity Utilization After", `${analytics.capacityUtilizationAfter}%`],
        ["Capacity Freed (PAL)", analytics.capacityFreed],
      ];
      const rowImpactData = [
        ["Row", "Freed Bins", "Freed Capacity", "Moves Out", "Moves In", "PAL Out", "PAL In", "Net Capacity Change"],
        ...(analytics.rowImpact || []).map((row) => [
          row.rowKey,
          row.freedBins,
          row.freedCapacity,
          row.sourceMoves,
          row.targetMoves,
          row.palOut,
          row.palIn,
          row.netCapacityChange,
        ]),
      ];
      const fragmentationData = [
        ["Material ID", "Description", "Bins Before", "Bins After", "Reduction"],
        ...(analytics.topReductionMaterials || []).map((item) => [
          item.materialId,
          item.materialDesc || "",
          item.binsBefore,
          item.binsAfter,
          item.reduction,
        ]),
      ];
      const freedBinsData = [
        ["Bin", "Row", "Capacity", "Starting Qty", "Starting Materials"],
        ...(analytics.freedBinDetails || []).map((item) => [
          item.bin,
          item.rowKey,
          item.capacity,
          item.startingQty,
          item.startingMaterials,
        ]),
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryData), "Summary");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rowImpactData), "Row Impact");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(fragmentationData), "Fragmentation");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(freedBinsData), "Freed Bins");
      const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const blob = new Blob([out], { type: "application/octet-stream" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Warehouse_Analytics_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error("Analytics export failed:", err);
      setLoadError("Analytics export failed. Please try again.");
    }
  }

  async function generatePDFReport() {
    if (!allMoves.length || !analytics) return;
    const PDF_MOVE_LIMIT = 200;
    const truncated = allMoves.length > PDF_MOVE_LIMIT;
    const movesToPrint = truncated ? allMoves.slice(0, PDF_MOVE_LIMIT) : allMoves;
    if (truncated) {
      console.info(`PDF report: truncated to first ${PDF_MOVE_LIMIT} moves. Use Excel export for full dataset.`);
    }
    try {
      const { jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 14;
      const dateStr = new Date().toLocaleString();

      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, pageW, 36, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text("FloorAgent Flow Brief", pageW / 2, 14, { align: "center" });
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text(`Generated: ${dateStr}   |   Warehouse: ${warehouse}   |   v${APP_VERSION}`, pageW / 2, 22, { align: "center" });
      doc.text(`${allMoves.length} moves  •  ${freedBins.length} bins freed  •  ${analytics.totalPALMoved.toFixed(1)} PAL moved`, pageW / 2, 29, { align: "center" });
      doc.setTextColor(0, 0, 0);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("Summary", margin, 46);

      autoTable(doc, {
        startY: 50,
        margin: { left: margin, right: margin },
        theme: "grid",
        head: [["Metric", "Value"]],
        body: [
          ["Total Moves", allMoves.length.toString()],
          ["Bins Freed", freedBins.length.toString()],
          ["Freed Bin IDs", freedBins.join(", ") || "None"],
          ["Materials Moved", analytics.uniqueMaterialsMoved.toString()],
          ["Materials Consolidated", analytics.materialsConsolidated.toString()],
          ["Total PAL Moved", analytics.totalPALMoved.toFixed(1)],
          ["Multi-bin Materials Before", analytics.multiBinMaterialsBefore.toString()],
          ["Multi-bin Materials After", analytics.multiBinMaterialsAfter.toString()],
          ["Fragmentation Reduction", `${analytics.fragmentationReductionPct}%`],
          ["Source Drain Rate", `${analytics.sourceDrainRate}%`],
          ["Average Target Fill", `${analytics.avgTargetFillRate}%`],
          ["Same-row Move Rate", `${analytics.sameRowRate}%`],
          ["Moves per Freed Bin", analytics.movesPerFreedBin.toString()],
          ["Capacity Utilization Before", `${analytics.capacityUtilizationBefore}%`],
          ["Capacity Utilization After", `${analytics.capacityUtilizationAfter}%`],
          ["Capacity Freed", `${analytics.capacityFreed.toFixed(1)} PAL`],
        ],
        styles: { fontSize: 9, cellPadding: 2.5 },
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: "bold" },
        alternateRowStyles: { fillColor: [249, 250, 251] },
        columnStyles: { 0: { fontStyle: "bold", cellWidth: 70 } },
      });

      const afterSummary = doc.lastAutoTable?.finalY ?? 130;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      const moveListY = afterSummary + 10;
      doc.text(
        truncated
          ? `Move List (first ${PDF_MOVE_LIMIT} of ${allMoves.length} — use Excel for full list)`
          : `Move List (${allMoves.length} moves)`,
        margin,
        moveListY
      );

      autoTable(doc, {
        startY: moveListY + 4,
        margin: { left: margin, right: margin },
        theme: "striped",
        head: [["Seq", "From", "To", "Material", "Description", "PAL", "Status"]],
        body: movesToPrint.map((m) => [
          m.id.toString(),
          m.from,
          m.to,
          m.materialId,
          m.materialDesc ? m.materialDesc.slice(0, 30) : "",
          m.qty.toFixed(1),
          completed.has(m.id) ? "DONE" : "",
        ]),
        styles: { fontSize: 7.5, cellPadding: 1.8 },
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: "bold" },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: {
          0: { cellWidth: 10, halign: "center" },
          1: { cellWidth: 18 },
          2: { cellWidth: 18 },
          3: { cellWidth: 22 },
          4: { cellWidth: "auto" },
          5: { cellWidth: 12, halign: "right" },
          6: { cellWidth: 14, halign: "center" },
        },
      });

      const pdfPageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pdfPageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setTextColor(160, 160, 160);
        doc.text(
          `Page ${i} of ${pdfPageCount}  |  FloorAgent v${APP_VERSION}  |  ${dateStr}`,
          pageW / 2,
          pageH - 6,
          { align: "center" }
        );
        doc.setDrawColor(220, 220, 220);
        doc.line(margin, pageH - 10, pageW - margin, pageH - 10);
      }

      doc.save(`Consolidation_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err) {
      console.error("PDF generation failed:", err);
      setLoadError("PDF generation failed. Ensure jspdf and jspdf-autotable are installed.");
    }
  }

  const allMoves = useMemo(
    () =>
      [...moves, ...proximityMoves].sort((a, b) => {
        // Primary: group by source bin
        const fromCmp = String(a.from || "").localeCompare(String(b.from || ""));
        if (fromCmp !== 0) return fromCmp;
        // Secondary: qty ascending within each source bin
        if (Number(a.qty || 0) !== Number(b.qty || 0)) return Number(a.qty || 0) - Number(b.qty || 0);
        return Number(a.id || 0) - Number(b.id || 0);
      }),
    [moves, proximityMoves]
  );

  const filteredMoves = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return allMoves.filter((m) => {
      if (hideCompleted && completed.has(m.id)) return false;
      if (!q) return true;
      return (
        String(m.materialId || "").toLowerCase().includes(q) ||
        String(m.materialDesc || "").toLowerCase().includes(q) ||
        String(m.from || "").toLowerCase().includes(q) ||
        String(m.to || "").toLowerCase().includes(q)
      );
    });
  }, [allMoves, completed, searchTerm, hideCompleted]);

  useEffect(() => { setPage(1); }, [searchTerm, hideCompleted]);

  const pageCount = Math.max(1, Math.ceil(filteredMoves.length / Math.max(1, pageSize)));

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const visibleMoves = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredMoves.slice(start, start + pageSize);
  }, [filteredMoves, page, pageSize]);

  const moveClusters = useMemo(() => {
    if (!visibleMoves.length) return [];
    const groups = new Map();
    for (const move of visibleMoves) {
      const key = move.from || "Unknown";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(move);
    }
    return Array.from(groups.entries()).map(([fromBin, clusterMoves]) => ({
      key: fromBin,
      title: fromBin,
      subtitle: `${clusterMoves.length} move${clusterMoves.length !== 1 ? "s" : ""} · ${clusterMoves.reduce((s, m) => s + Number(m.qty || 0), 0).toFixed(1)} PAL`,
      moves: clusterMoves,
      materialCount: new Set(clusterMoves.map((move) => move.materialId)).size,
      totalQty: clusterMoves.reduce((sum, m) => sum + Number(m.qty || 0), 0),
      doneCount: clusterMoves.reduce((sum, m) => sum + (completed.has(m.id) ? 1 : 0), 0),
    }));
  }, [visibleMoves, completed]);

  const totalMoveQty = useMemo(
    () => allMoves.reduce((sum, move) => sum + Number(move.qty || 0), 0),
    [allMoves]
  );

  const activeTab = openTabs.find(t => t.id === activeTabId) || null;
  const isHomeView = activeTabId === null;

  // ──────────────── Render ────────────────

  if (mapOnlyMode) {
    return (
      <div
        className="h-screen overflow-hidden p-4"
        style={{
          backgroundColor: "#f5f0e6",
          backgroundImage: `
            radial-gradient(circle at 18% 14%, rgba(59,130,246,0.12), transparent 28%),
            radial-gradient(circle at 78% 18%, rgba(245,158,11,0.14), transparent 24%),
            linear-gradient(180deg, #f8f4ec 0%, #efe6d8 100%)
          `,
        }}
      >
        <div className="mx-auto h-full max-w-[1920px] rounded-[32px] border border-[#d9cfbe] bg-[#fffdf8] shadow-[0_24px_48px_rgba(72,56,33,0.12)]">
          <WarehouseBinMap fullWindow />
        </div>
      </div>
    );
  }

  if (!xlsxReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f6f1e8]">
        <div className="flex items-center gap-3 rounded-full border border-[#d9cfbe] bg-white px-5 py-3 text-sm font-semibold tracking-wide text-slate-600 shadow-[0_16px_36px_rgba(79,63,39,0.08)]">
          <Loader2 className="animate-spin text-sky-600" size={20} /> Loading spreadsheet tools…
        </div>
      </div>
    );
  }

  // --- Pane content rendered inside TabContent for CONSOLIDATOR / PUTAWAY / STATS ---
  function renderPaneContent() {
    if (!activeTab) return null;

    if (activeTab.type === "CONSOLIDATOR") {
      return (
        <div className="space-y-5 text-slate-800">
          <div className="rounded-[30px] border border-[#d9cfbe] bg-[#f4efe6] p-5 shadow-[0_22px_44px_rgba(79,63,39,0.08)]">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-2xl">
                <Eyebrow className="text-slate-500">Route workboard</Eyebrow>
                <div className="mt-2 text-3xl font-black tracking-[-0.04em] text-slate-900">Moves stay beside their source.</div>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">
                  This board is built for the floor, not for a website. Each source pocket owns its own slips so you can work one release at a time without hunting across a table.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => rawSapJson && buildPlanFromRaw(rawSapJson)} disabled={!rawSapJson} size="lg" className="border border-slate-300 bg-white text-slate-700 shadow-none hover:bg-[#fffaf2]">
                  <RefreshCcw size={16} /> Rebuild
                </Button>
                <Button onClick={exportMoves} disabled={!allMoves.length} size="lg" className="border border-amber-300 bg-amber-50 text-amber-800 shadow-none hover:bg-amber-100">
                  <Download size={16} /> Export Slips
                </Button>
                <Button
                  onClick={() => openMoveListWindow({ moves: allMoves, completed, ignoredMoves, warehouse, appVersion: APP_VERSION })}
                  disabled={!allMoves.length}
                  size="lg"
                  className="border border-slate-300 bg-[#f8f4ec] text-slate-700 shadow-none hover:bg-white"
                >
                  <Printer size={16} /> Print
                </Button>
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-4">
              <div className="rounded-[24px] border border-white/70 bg-white/80 p-4">
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Pending</div>
                <div className="mt-2 text-3xl font-black tracking-[-0.04em] text-slate-900">{Math.max(0, allMoves.length - completed.size)}</div>
              </div>
              <div className="rounded-[24px] border border-white/70 bg-white/80 p-4">
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Completed</div>
                <div className="mt-2 text-3xl font-black tracking-[-0.04em] text-emerald-700">{completed.size}</div>
              </div>
              <div className="rounded-[24px] border border-white/70 bg-white/80 p-4">
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Bins freed</div>
                <div className="mt-2 text-3xl font-black tracking-[-0.04em] text-slate-900">{freedBins.length}</div>
              </div>
              <div className="rounded-[24px] border border-white/70 bg-white/80 p-4">
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">PAL in motion</div>
                <div className="mt-2 text-3xl font-black tracking-[-0.04em] text-amber-700">{totalMoveQty.toFixed(1)}</div>
              </div>
            </div>

            <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto]">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search material, source, or target"
                  className="h-12 rounded-[20px] border-[#d9cfbe] bg-white pl-11 text-slate-800 placeholder:text-slate-400 focus:border-sky-400 focus:ring-sky-200"
                />
              </div>
              <Button
                onClick={() => setHideCompleted(!hideCompleted)}
                size="lg"
                className={hideCompleted ? "border border-emerald-300 bg-emerald-50 text-emerald-800 shadow-none hover:bg-emerald-100" : "border border-slate-300 bg-white text-slate-700 shadow-none hover:bg-[#fffaf2]"}
              >
                {hideCompleted ? "Remaining only" : "Show all"}
              </Button>
              <div className="flex items-center gap-2 rounded-full border border-[#d9cfbe] bg-white px-3 py-2">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-600 disabled:opacity-30">Prev</button>
                <div className="min-w-[68px] text-center text-sm font-semibold text-slate-700">{page} / {pageCount}</div>
                <button onClick={() => setPage((p) => Math.min(pageCount, p + 1))} disabled={page >= pageCount} className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-600 disabled:opacity-30">Next</button>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#ddd4c6] pt-4 text-sm text-slate-600">
              <div>
                Showing {filteredMoves.length ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, filteredMoves.length)} of {filteredMoves.length} slips
              </div>
              <div className="flex flex-wrap gap-2">
                {proximityMoves.length > 0 && <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-semibold text-sky-700">{proximityMoves.length} aisle pulls</span>}
                {ignoredMoves.size > 0 && <span className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-[11px] font-semibold text-rose-700">{ignoredMoves.size} skipped on rebuild</span>}
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 font-mono text-[11px] text-emerald-700">
                  {freedBins.length ? freedBins.slice(0, 6).join(", ") + (freedBins.length > 6 ? "..." : "") : "No pockets cleared yet"}
                </span>
              </div>
            </div>
          </div>

          {!allMoves.length ? (
            <div className="rounded-[30px] border border-[#d9cfbe] bg-[#fbf7ef] px-6 py-12 text-center shadow-[0_18px_34px_rgba(79,63,39,0.06)]">
              <Eyebrow className="text-slate-500">No route slips yet</Eyebrow>
              <div className="mt-3 text-2xl font-black tracking-[-0.04em] text-slate-900">Load a file and the workboard will assemble itself.</div>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-slate-600">
                Use Upload from the home screen. Once stock is loaded, the slips will gather here by source so the release work is easy to read.
              </p>
            </div>
          ) : moveClusters.length ? (
            <div className="space-y-0">
              {moveClusters.map((cluster, clusterIndex) => (
                <MoveSection
                  key={cluster.key}
                  cluster={cluster}
                  isFirst={clusterIndex === 0}
                  completed={completed}
                  selectedMoveId={selectedMoveId}
                  onSelectMove={selectMove}
                  onConfirmMove={confirmMove}
                  onUndoMove={undoMove}
                  onCopy={copyText}
                  onIgnore={openIgnoreModal}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-[30px] border border-[#d9cfbe] bg-[#fbf7ef] px-6 py-12 text-center shadow-[0_18px_34px_rgba(79,63,39,0.06)]">
              <div className="text-2xl font-black tracking-[-0.04em] text-slate-900">No slips match this view.</div>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-slate-600">
                Clear the search or bring completed slips back in to widen the view again.
              </p>
            </div>
          )}
        </div>
      );
    }

    if (activeTab.type === "PUTAWAY") {
      return (
        <div className="space-y-5 text-slate-800">
          <div className="rounded-[30px] border border-[#d9cfbe] bg-[#f4efe6] p-5 shadow-[0_22px_44px_rgba(79,63,39,0.08)]">
            <Eyebrow className="text-slate-500">Landing brief</Eyebrow>
            <div className="mt-2 text-3xl font-black tracking-[-0.04em] text-slate-900">Find the bin without reading a dashboard.</div>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600">
              Give the line, material, and needed pallet count. The result sheet below stays focused on one recommendation at a time, with a few fallback pockets if the floor reality disagrees.
            </p>

            <div className="mt-5 grid gap-4">
              <div className="rounded-[26px] border border-white/70 bg-white/80 p-4">
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Production line</div>
                <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-9">
                  {[1,2,3,4,5,6,7,8,9].map((n) => (
                    <button
                      key={n}
                      onClick={() => setFinderLine(finderLine === n ? null : n)}
                      className={`rounded-full border px-3 py-2 text-sm font-bold transition-colors ${
                        finderLine === n ? "border-sky-400 bg-sky-500 text-white" : "border-slate-300 bg-[#f8f4ec] text-slate-600 hover:bg-white"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                {finderLine && (
                  <div className="mt-3 text-sm text-slate-600">
                    Preferred rows for line {finderLine}: <span className="font-semibold text-slate-800">{[...LINE_PREFERRED_ROWS[finderLine]].join(", ")}</span>
                  </div>
                )}
              </div>

              <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_220px_auto]">
                <Input
                  value={finderQuery}
                  onChange={(e) => setFinderQuery(e.target.value)}
                  placeholder="Material number or plain-language description"
                  className="h-12 rounded-[20px] border-[#d9cfbe] bg-white text-slate-800 placeholder:text-slate-400 focus:border-sky-400 focus:ring-sky-200"
                />
                <Input
                  value={finderQty}
                  onChange={(e) => setFinderQty(e.target.value)}
                  placeholder="PAL needed"
                  className="h-12 rounded-[20px] border-[#d9cfbe] bg-white text-slate-800 placeholder:text-slate-400 focus:border-sky-400 focus:ring-sky-200"
                />
                <Button
                  onClick={() => {
                    const res = findBestBin({
                      query: finderQuery, qtyNeeded: finderQty, stockRows,
                      emptyBinsSet: emptyBinsFromExport, emptyBinTypes,
                      allowTgt110, allowTgt111, capOverrides,
                      preferredRows: finderLine ? LINE_PREFERRED_ROWS[finderLine] : new Set(),
                    });
                    setFinderResult(res);
                  }}
                  disabled={stockRows.length === 0}
                  size="lg"
                  className="border border-sky-500 bg-sky-500 text-white shadow-none hover:bg-sky-400"
                >
                  Search floor
                </Button>
              </div>
            </div>
          </div>

          {finderResult && (
            <div className="rounded-[30px] border border-[#d9cfbe] bg-[#fbf7ef] p-5 shadow-[0_18px_34px_rgba(79,63,39,0.06)]">
              <Eyebrow className="text-slate-500">Recommendation sheet</Eyebrow>
              {!finderResult.ok ? (
                <div className="mt-4 space-y-3">
                  <div className="rounded-[24px] border border-rose-200 bg-rose-50 px-4 py-4 text-sm font-medium text-rose-700">{finderResult.reason}</div>
                  {finderLine && (
                    <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
                      Preferred rows for line {finderLine} are full. Clear those rows first if you need the recommendation to stay in that production zone.
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-4 space-y-4">
                  {finderLine && !finderResult.best.preferred && (
                    <div className="rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                      The best live option is outside the preferred line zone, which usually means the line rows are saturated right now.
                    </div>
                  )}

                  <div className="rounded-[28px] border border-slate-300 bg-white p-5">
                    <div className="flex flex-wrap items-end justify-between gap-4">
                      <div className="min-w-0">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Best landing pocket</div>
                        <div className={`mt-2 font-mono text-5xl font-black tracking-[-0.05em] ${rejectedBins.has(finderResult.best.bin) ? "line-through text-slate-400" : "text-slate-900"}`}>{finderResult.best.bin}</div>
                        <div className="mt-2 text-sm font-semibold text-slate-800">{finderResult.materialId}</div>
                        <div className="mt-1 text-sm text-slate-500">{finderResult.materialDesc || "No description carried in export"}</div>
                        {rejectedBins.has(finderResult.best.bin) && (
                          <div className="mt-2 text-sm font-medium text-rose-700">Rejected: {rejectedBins.get(finderResult.best.bin)}</div>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button onClick={() => copyText(finderResult.best.bin)} className="rounded-full border border-slate-300 bg-[#f8f4ec] px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-white">Copy bin</button>
                        {!rejectedBins.has(finderResult.best.bin) && rejectingBin !== finderResult.best.bin && (
                          <button onClick={() => { setRejectingBin(finderResult.best.bin); setRejectReasonInput(""); }} className="rounded-full border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100">Reject</button>
                        )}
                      </div>
                    </div>
                    {rejectingBin === finderResult.best.bin && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        <input
                          autoFocus
                          value={rejectReasonInput}
                          onChange={e => setRejectReasonInput(e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter") { setRejectedBins(prev => new Map(prev).set(finderResult.best.bin, rejectReasonInput || "Rejected")); setRejectingBin(null); } if (e.key === "Escape") setRejectingBin(null); }}
                          placeholder="Reason"
                          className="min-w-[220px] flex-1 rounded-full border border-rose-200 bg-white px-4 py-2 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-rose-200"
                        />
                        <button onClick={() => { setRejectedBins(prev => new Map(prev).set(finderResult.best.bin, rejectReasonInput || "Rejected")); setRejectingBin(null); }} className="rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-500">Save</button>
                        <button onClick={() => setRejectingBin(null)} className="rounded-full border border-slate-300 bg-[#f8f4ec] px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-white">Cancel</button>
                      </div>
                    )}
                  </div>

                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="rounded-[24px] border border-white/70 bg-white/80 p-4">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Free space</div>
                      <div className="mt-2 text-3xl font-black tracking-[-0.04em] text-slate-900">{finderResult.best.free}</div>
                    </div>
                    <div className="rounded-[24px] border border-white/70 bg-white/80 p-4">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Capacity</div>
                      <div className="mt-2 text-3xl font-black tracking-[-0.04em] text-slate-900">{finderResult.best.cap}</div>
                    </div>
                    <div className="rounded-[24px] border border-white/70 bg-white/80 p-4">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Storage type</div>
                      <div className="mt-2 text-3xl font-black tracking-[-0.04em] text-slate-900">{finderResult.best.storageType || "STD"}</div>
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-[#ddd4c5] bg-white p-4">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Fallback pockets</div>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      {finderResult.top.slice(1, 5).map((c) => (
                        <div key={c.bin} className="rounded-[20px] border border-[#e7dece] bg-[#fbf8f1] p-3">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <div className={`font-mono text-lg font-bold ${rejectedBins.has(c.bin) ? "line-through text-slate-400" : "text-slate-800"}`}>{c.bin}</div>
                              <div className="text-xs text-slate-500">{c.free} free of {c.cap}</div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button onClick={() => copyText(c.bin)} className="rounded-full border border-slate-300 bg-white px-3 py-1 text-[11px] font-semibold text-slate-600 hover:bg-[#f8f4ec]">Copy</button>
                              {!rejectedBins.has(c.bin) && rejectingBin !== c.bin && (
                                <button onClick={() => { setRejectingBin(c.bin); setRejectReasonInput(""); }} className="rounded-full border border-rose-300 bg-rose-50 px-3 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-100">Reject</button>
                              )}
                            </div>
                          </div>
                          {rejectingBin === c.bin && (
                            <div className="mt-3 flex flex-wrap gap-2">
                              <input
                                autoFocus
                                value={rejectReasonInput}
                                onChange={e => setRejectReasonInput(e.target.value)}
                                onKeyDown={e => { if (e.key === "Enter") { setRejectedBins(prev => new Map(prev).set(c.bin, rejectReasonInput || "Rejected")); setRejectingBin(null); } if (e.key === "Escape") setRejectingBin(null); }}
                                placeholder="Reason"
                                className="min-w-[180px] flex-1 rounded-full border border-rose-200 bg-white px-4 py-2 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-rose-200"
                              />
                              <button onClick={() => { setRejectedBins(prev => new Map(prev).set(c.bin, rejectReasonInput || "Rejected")); setRejectingBin(null); }} className="rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-500">Save</button>
                              <button onClick={() => setRejectingBin(null)} className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-[#f8f4ec]">Cancel</button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      );
    }

    if (activeTab.type === "STATS") {
      return (
        <div className="space-y-5 text-slate-800">
          {!moves.length || !analytics ? (
            <div className="rounded-[30px] border border-[#d9cfbe] bg-[#fbf7ef] p-10 text-center shadow-[0_18px_34px_rgba(79,63,39,0.06)]">
              <Eyebrow className="text-slate-500">No floor brief yet</Eyebrow>
              <div className="mt-3 text-2xl font-black tracking-[-0.04em] text-slate-900">Run a consolidation and the signal sheet will appear here.</div>
            </div>
          ) : (
            <>
              <div className="rounded-[30px] border border-[#d9cfbe] bg-[#f4efe6] p-5 shadow-[0_22px_44px_rgba(79,63,39,0.08)]">
                <Eyebrow className="text-slate-500">Operations brief</Eyebrow>
                <div className="mt-2 text-3xl font-black tracking-[-0.04em] text-slate-900">What changed on the floor, and whether it was worth the work.</div>
                <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600">
                  This summary drops the repetitive row charts and focuses on the signals teams usually care about when judging a consolidation run: space made, spread reduced, work intensity, and whether the targets ended up meaningfully fuller.
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                {[
                  { label: "Bins freed", value: analytics.totalFreedBins, tone: "text-emerald-700" },
                  { label: "PAL moved", value: analytics.totalPALMoved.toFixed(1), tone: "text-amber-700" },
                  { label: "Materials collapsed", value: analytics.materialsConsolidated, tone: "text-slate-900" },
                  { label: "Source drain rate", value: `${analytics.sourceDrainRate}%`, tone: "text-sky-700" },
                  { label: "Avg target fill", value: `${analytics.avgTargetFillRate}%`, tone: "text-slate-900" },
                ].map((item) => (
                  <div key={item.label} className="rounded-[26px] border border-[#d9cfbe] bg-[#fbf8f1] p-4 shadow-[0_16px_28px_rgba(79,63,39,0.05)]">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">{item.label}</div>
                    <div className={`mt-2 text-3xl font-black tracking-[-0.04em] ${item.tone}`}>{item.value}</div>
                  </div>
                ))}
              </div>

              <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
                <div className="rounded-[28px] border border-[#d9cfbe] bg-[#fbf8f1] p-5 shadow-[0_16px_28px_rgba(79,63,39,0.05)]">
                  <Eyebrow className="text-slate-500">Space made</Eyebrow>
                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    {[
                      { label: "Before", bins: analytics.emptyCountBefore, cap: analytics.emptyCapacityBefore, accent: "text-slate-900" },
                      { label: "After", bins: analytics.emptyCountAfter, cap: analytics.emptyCapacityAfter, accent: "text-emerald-700" },
                      { label: "Gain", bins: analytics.emptyCountAfter - analytics.emptyCountBefore, cap: analytics.emptyCapacityAfter - analytics.emptyCapacityBefore, accent: (analytics.emptyCountAfter - analytics.emptyCountBefore) >= 0 ? "text-sky-700" : "text-rose-700" },
                    ].map((item) => (
                      <div key={item.label} className="rounded-[22px] border border-white/70 bg-white p-4">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">{item.label}</div>
                        <div className={`mt-2 text-3xl font-black tracking-[-0.04em] ${item.accent}`}>{item.bins >= 0 && item.label === "Gain" ? "+" : ""}{item.bins}</div>
                        <div className="text-xs text-slate-500">empty bins</div>
                        <div className={`mt-3 text-lg font-bold ${item.accent}`}>{item.cap >= 0 && item.label === "Gain" ? "+" : ""}{Number(item.cap).toFixed(1)} PAL</div>
                        <div className="text-xs text-slate-500">free capacity</div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="rounded-[22px] border border-white/70 bg-white p-4">
                      <div className="flex items-center justify-between text-sm text-slate-600">
                        <span>Utilization before</span>
                        <span className="font-semibold text-slate-900">{analytics.capacityUtilizationBefore}%</span>
                      </div>
                      <div className="mt-3 h-3 overflow-hidden rounded-full bg-[#e9e2d5]">
                        <div className="h-full rounded-full bg-slate-700" style={{ width: `${analytics.capacityUtilizationBefore}%` }} />
                      </div>
                    </div>
                    <div className="rounded-[22px] border border-white/70 bg-white p-4">
                      <div className="flex items-center justify-between text-sm text-slate-600">
                        <span>Utilization after</span>
                        <span className="font-semibold text-slate-900">{analytics.capacityUtilizationAfter}%</span>
                      </div>
                      <div className="mt-3 h-3 overflow-hidden rounded-full bg-[#e9e2d5]">
                        <div className="h-full rounded-full bg-emerald-600" style={{ width: `${analytics.capacityUtilizationAfter}%` }} />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-[28px] border border-[#d9cfbe] bg-[#fbf8f1] p-5 shadow-[0_16px_28px_rgba(79,63,39,0.05)]">
                  <Eyebrow className="text-slate-500">Work quality</Eyebrow>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {[
                      { label: "Same-row moves", value: `${analytics.sameRowRate}%`, note: `${analytics.sameRowMoves} of ${analytics.totalMoves} slips stayed in-row` },
                      { label: "Average row distance", value: analytics.avgRowDistance, note: "Lower means less cross-floor travel pressure" },
                      { label: "Moves per freed bin", value: analytics.movesPerFreedBin, note: "How much handling it took to create one empty pocket" },
                      { label: "PAL per move", value: analytics.palPerMove, note: "Higher usually means cleaner, heavier slips" },
                    ].map((item) => (
                      <div key={item.label} className="rounded-[22px] border border-white/70 bg-white p-4">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">{item.label}</div>
                        <div className="mt-2 text-3xl font-black tracking-[-0.04em] text-slate-900">{item.value}</div>
                        <div className="mt-2 text-xs leading-relaxed text-slate-500">{item.note}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
                <div className="rounded-[28px] border border-[#d9cfbe] bg-[#fbf8f1] p-5 shadow-[0_16px_28px_rgba(79,63,39,0.05)]">
                  <Eyebrow className="text-slate-500">Fragmentation change</Eyebrow>
                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <div className="rounded-[22px] border border-white/70 bg-white p-4">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Multi-bin before</div>
                      <div className="mt-2 text-3xl font-black tracking-[-0.04em] text-slate-900">{analytics.multiBinMaterialsBefore}</div>
                    </div>
                    <div className="rounded-[22px] border border-white/70 bg-white p-4">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Multi-bin after</div>
                      <div className="mt-2 text-3xl font-black tracking-[-0.04em] text-slate-900">{analytics.multiBinMaterialsAfter}</div>
                    </div>
                    <div className="rounded-[22px] border border-white/70 bg-white p-4">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Reduction</div>
                      <div className="mt-2 text-3xl font-black tracking-[-0.04em] text-sky-700">{analytics.fragmentationReductionPct}%</div>
                    </div>
                  </div>
                  <div className="mt-4 space-y-3">
                    {(analytics.topReductionMaterials || []).slice(0, 6).map((item) => (
                      <div key={item.materialId} className="rounded-[20px] border border-[#e7dece] bg-white p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-mono text-sm font-bold text-slate-800">{item.materialId}</div>
                            <div className="mt-1 text-xs text-slate-500">{item.materialDesc || "No description carried in export"}</div>
                          </div>
                          <div className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-semibold text-sky-700">-{item.reduction} bins</div>
                        </div>
                        <div className="mt-2 text-xs text-slate-500">Spread changed from {item.binsBefore} pockets to {item.binsAfter}.</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-5">
                  <div className="rounded-[28px] border border-[#d9cfbe] bg-[#fbf8f1] p-5 shadow-[0_16px_28px_rgba(79,63,39,0.05)]">
                    <Eyebrow className="text-slate-500">Row pressure shift</Eyebrow>
                    <div className="mt-4 space-y-3">
                      {(analytics.rowImpact || []).slice(0, 8).map((row) => (
                        <div key={row.rowKey} className="rounded-[20px] border border-[#e7dece] bg-white p-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <div className="font-mono text-lg font-bold text-slate-800">{row.rowKey}</div>
                              <div className="text-xs text-slate-500">{row.sourceMoves} out · {row.targetMoves} in</div>
                            </div>
                            <div className="flex flex-wrap gap-2 text-[11px] font-semibold">
                              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700">{row.freedBins} bins freed</span>
                              <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-amber-700">{row.freedCapacity.toFixed(1)} PAL cleared</span>
                              <span className="rounded-full border border-slate-300 bg-[#f8f4ec] px-3 py-1 text-slate-700">net {row.netCapacityChange >= 0 ? "+" : ""}{row.netCapacityChange.toFixed(1)}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-[28px] border border-[#d9cfbe] bg-[#fbf8f1] p-5 shadow-[0_16px_28px_rgba(79,63,39,0.05)]">
                    <Eyebrow className="text-slate-500">Largest releases</Eyebrow>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      {(analytics.freedBinDetails || []).slice(0, 6).map((item) => (
                        <div key={item.bin} className="rounded-[20px] border border-[#e7dece] bg-white p-4">
                          <div className="flex items-end justify-between gap-3">
                            <div>
                              <div className="font-mono text-xl font-black tracking-[-0.04em] text-slate-900">{item.bin}</div>
                              <div className="text-xs text-slate-500">row {item.rowKey}</div>
                            </div>
                            <div className="text-right">
                              <div className="text-lg font-bold text-emerald-700">{item.capacity.toFixed(1)} PAL</div>
                              <div className="text-xs text-slate-500">released</div>
                            </div>
                          </div>
                          <div className="mt-3 text-xs text-slate-500">Started with {item.startingQty.toFixed(1)} PAL across {item.startingMaterials} material slot{item.startingMaterials === 1 ? "" : "s"}.</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={exportAnalyticsToExcel}
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-[#f8f4ec]"
                >
                  <Download size={15} /> Export brief
                </button>
                <button
                  onClick={generatePDFReport}
                  className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-800 transition-colors hover:bg-amber-100"
                >
                  <Download size={15} /> PDF brief
                </button>
                <button
                  onClick={() => initialBinState && finalBinState && setShowBeforeAfter(true)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-800 transition-colors hover:bg-emerald-100"
                >
                  <RefreshCcw size={15} /> Before / after
                </button>
              </div>
            </>
          )}
        </div>
      );
    }

    return null;
  }

  return (
    <AgentDataProvider value={{
      stockRows, binState: memoizedBinState, capOverrides,
      disabledBins, emptyBinsFromExport, emptyBinTypes, moves: allMoves, completed, analytics, warehouse,
      allowTgt110, allowTgt111, lineBins,
      onProductionPlanApply: (binAssignments) => {
        setLineBins((prev) => {
          const next = [...prev];
          for (const { lineIndex, bin } of binAssignments) {
            if (lineIndex >= 0 && lineIndex < next.length) next[lineIndex] = bin;
          }
          return next;
        });
        setTimeout(() => { if (rawSapJson) buildPlanFromRaw(rawSapJson); }, 0);
      },
      onProximityMovesReady: (newMoves) => {
        const startId = moves.length + proximityMoves.length + 1;
        const tagged = newMoves.map((m, i) => ({ ...m, id: startId + i }));
        setProximityMoves((prev) => [...prev, ...tagged]);
        // Auto-open consolidator tab if needed
        spawnTab("CONSOLIDATOR");
      },
    }}>
    <div
      className={`min-h-screen overflow-hidden ${isHomeView ? "text-slate-200" : "text-slate-800"}`}
      style={isHomeView ? {
        backgroundColor: "#0e1e2e",
        backgroundImage: `
          radial-gradient(circle at 15% 20%, rgba(49,115,255,0.18), transparent 34%),
          radial-gradient(circle at 82% 12%, rgba(234,179,8,0.12), transparent 28%),
          radial-gradient(circle at 76% 78%, rgba(16,185,129,0.09), transparent 24%),
          linear-gradient(180deg, #12202e 0%, #0e1e2e 55%, #0b1a28 100%)
        `,
      } : {
        backgroundColor: "#f5f0e6",
        backgroundImage: `
          radial-gradient(circle at 12% 18%, rgba(59,130,246,0.11), transparent 28%),
          radial-gradient(circle at 84% 14%, rgba(245,158,11,0.14), transparent 24%),
          radial-gradient(circle at 78% 72%, rgba(16,185,129,0.08), transparent 20%),
          linear-gradient(180deg, #f8f4ec 0%, #efe6d8 54%, #eadfcd 100%)
        `,
      }}
    >
      <div
        className={`pointer-events-none absolute inset-0 ${isHomeView ? "opacity-[0.13]" : "opacity-[0.22]"}`}
        style={isHomeView ? {
          backgroundImage: "linear-gradient(rgba(148,163,184,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.08) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          maskImage: "linear-gradient(180deg, rgba(0,0,0,0.6), transparent 92%)",
        } : {
          backgroundImage: "linear-gradient(rgba(161,132,94,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(161,132,94,0.12) 1px, transparent 1px)",
          backgroundSize: "52px 52px",
          maskImage: "linear-gradient(180deg, rgba(0,0,0,0.35), transparent 92%)",
        }}
      />
      <div
        className={`pointer-events-none absolute inset-0 ${isHomeView ? "opacity-[0.035]" : "opacity-[0.05]"}`}
        style={{
          backgroundImage: `url(${logo})`,
          backgroundSize: isHomeView ? "40rem" : "34rem",
          backgroundPosition: isHomeView ? "center 20rem" : "right 8rem top 10rem",
          backgroundRepeat: "no-repeat",
          filter: isHomeView ? "grayscale(1)" : "grayscale(1) contrast(0.8)",
        }}
      />

      {/* Tab bar — always visible */}
      <TabBar
        tabs={openTabs}
        activeTabId={activeTabId}
        onSelectTab={setActiveTabId}
        onCloseTab={closeTab}
        onGoHome={() => setActiveTabId(null)}
        onOpenSettings={() => setSettingsOpen(true)}
        tabButtonRefs={tabButtonRefs}
        newTabId={newTabId}
        homeMode={isHomeView}
      />

      {/* Main content area */}
      <div className="relative z-10">
        {loadError && (
          <div className={`mx-4 mt-4 rounded-[24px] px-5 py-4 text-sm font-medium shadow-[0_14px_34px_rgba(127,29,29,0.18)] ${
            isHomeView
              ? "border border-danger-500/30 bg-danger-500/10 text-danger-300"
              : "border border-rose-200 bg-rose-50 text-rose-700"
          }`}>
            {loadError}
          </div>
        )}

        {activeTabId === null ? (
          <LauncherMenu
            appVersion={APP_VERSION}
            onSpawnTab={spawnTab}
            onLoadFile={loadFile}
            uploadFeedback={uploadFeedback}
            allMoves={allMoves}
            freedBins={freedBins}
            totalMoveQty={totalMoveQty}
            menuItemRefs={menuItemRefs}
          />
        ) : (
          <TabContent tab={activeTab} preloadedJson={rawSapJson}>
            {renderPaneContent()}
          </TabContent>
        )}
      </div>

      {/* Orb animation */}
      {orbAnimation && (
        <OrbAnimation
          fromRect={orbAnimation.fromRect}
          toRect={orbAnimation.toRect}
          onComplete={() => setOrbAnimation(null)}
        />
      )}

      {/* Settings drawer */}
      <SettingsDrawer
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onRebuild={() => rawSapJson && buildPlanFromRaw(rawSapJson)}
        warehouse={warehouse} setWarehouse={setWarehouse}
        excludeRbins={excludeRbins} setExcludeRbins={setExcludeRbins}
        globalThreshold={globalThreshold} setGlobalThreshold={setGlobalThreshold}
        proximityAutoRun={proximityAutoRun} setProximityAutoRun={setProximityAutoRun}
        excludeH={excludeH} setExcludeH={setExcludeH}
        excludeHH={excludeHH} setExcludeHH={setExcludeHH}
        excludeI={excludeI} setExcludeI={setExcludeI}
        excludeII={excludeII} setExcludeII={setExcludeII}
        allowSrc110={allowSrc110} setAllowSrc110={setAllowSrc110}
        allowTgt110={allowTgt110} setAllowTgt110={setAllowTgt110}
        allowTgt111={allowTgt111} setAllowTgt111={setAllowTgt111}
        excludeCustomBins={excludeCustomBins} setExcludeCustomBins={setExcludeCustomBins}
        CUSTOM_EXCLUDED_BINS={CUSTOM_EXCLUDED_BINS}
        lineBins={lineBins} setLineBins={setLineBins}
        protectABC={protectABC} setProtectABC={setProtectABC}
        ignoredMoves={ignoredMoves}
      />

      {/* Before/After modal */}
      <BeforeAfterModal
        isOpen={showBeforeAfter}
        onClose={() => setShowBeforeAfter(false)}
        initialBinState={initialBinState}
        finalBinState={finalBinState}
        freedBins={freedBins}
        parseBin={parseBin}
      />

      {/* Skip reason modal */}
      {ignoreModalMove && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-[rgba(88,65,33,0.18)] backdrop-blur-sm"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setIgnoreModalMove(null); }}
        >
          <div className="w-full max-w-lg overflow-hidden rounded-[28px] border border-[#d9cfbe] bg-[#fffdf8] shadow-[0_28px_56px_rgba(72,56,33,0.16)]">
            <div className="border-b border-[#e6dccb] bg-[linear-gradient(135deg,rgba(254,242,242,0.95),rgba(255,251,245,0.95))] p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 text-rose-500 shadow-[0_12px_24px_rgba(244,63,94,0.12)]">
                    <Ban size={24} />
                  </div>
                  <div>
                    <div className="text-lg font-bold tracking-tight text-slate-900">Ignore Move</div>
                    <div className="text-sm font-medium text-slate-500">Exclude this route and rebuild the plan</div>
                  </div>
                </div>
                <button onClick={() => setIgnoreModalMove(null)} className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-white hover:text-slate-700" aria-label="Close">
                  <X size={20} />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-5">
              <form onSubmit={handleIgnoreMove} className="space-y-5">
                <div className="space-y-3 rounded-[22px] border border-[#e7dece] bg-[#f7f2e8] p-5">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Move details</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-xl border border-white/80 bg-white p-3">
                      <div className="mb-1 text-xs font-medium text-slate-500">Material</div>
                      <div className="font-mono font-semibold text-slate-800">{ignoreModalMove.materialId}</div>
                    </div>
                    <div className="rounded-xl border border-white/80 bg-white p-3">
                      <div className="mb-1 text-xs font-medium text-slate-500">Quantity</div>
                      <div className="font-mono font-semibold text-slate-800">{ignoreModalMove.qty} PAL</div>
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/80 bg-white p-4">
                    <div className="mb-2 text-xs font-medium text-slate-500">Route</div>
                    <div className="flex items-center justify-between rounded-xl border border-[#ece4d8] bg-[#fbf8f1] p-3">
                      <span className="font-mono font-medium text-slate-700">{ignoreModalMove.from}</span>
                      <ArrowRight className="mx-2 text-amber-600" size={20} />
                      <span className="font-mono font-medium text-slate-700">{ignoreModalMove.to}</span>
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/80 bg-white p-3">
                    <div className="mb-1 text-xs font-medium text-slate-500">Description</div>
                    <div className="text-sm text-slate-600">{ignoreModalMove.materialDesc}</div>
                  </div>
                </div>
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-amber-500"></div>
                    <div className="text-sm text-amber-800">
                      This will rebuild the plan from the current SAP snapshot and forbid this exact route for this material. The material can still appear in other moves.
                    </div>
                  </div>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">Reason for ignoring (optional)</label>
                  <textarea
                    value={ignoreReason}
                    onChange={(e) => setIgnoreReason(e.target.value)}
                    placeholder="Optional note, e.g. keep this target row open for production"
                    className="h-28 w-full resize-none rounded-xl border border-[#d9cfbe] bg-white p-4 text-sm font-medium text-slate-700 outline-none transition-all placeholder:text-slate-400 focus:border-rose-300 focus:ring-2 focus:ring-rose-200"
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIgnoreModalMove(null)}
                    className="flex-1 rounded-xl border border-[#d9cfbe] py-3 font-semibold text-slate-600 transition-colors hover:bg-[#f6f0e5]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 rounded-xl bg-gradient-to-r from-rose-500 to-rose-600 py-3 font-semibold text-white transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-rose-500/20"
                  >
                    <div className="flex items-center justify-center gap-2">
                      <Ban size={18} />
                      <span>Ignore Move & Rebuild</span>
                    </div>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Support modal */}
      <FeedbackSystem
        isOpen={supportOpen}
        onClose={() => setSupportOpen(false)}
        appContext={{
          appVersion: APP_VERSION,
          warehouse, excludeRbins,
          allowSrc110, allowTgt110, allowTgt111,
          movesCount: moves.length,
        }}
      />
    </div>
    </AgentDataProvider>
  );
}
