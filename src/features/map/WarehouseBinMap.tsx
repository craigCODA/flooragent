import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Upload, Search, AlertTriangle, CheckCircle2, Package, Download, Camera } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { APP_NAME, APP_SUBTITLE, APP_TAGLINE, APP_VERSION } from "./branding";
import { LAYOUT_BINS, LAYOUT_BIN_SET } from "../../domain/layout";
import { AgentDataContext } from "../agent/context/AgentDataContext";

type RowKey = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "HH" | "HM" | "II" | "I" | "J";

type ParsedRecord = {
  sourceRow: number;
  rawBin: string;
  bin: string;
  rowKey: RowKey | "";
  material: string;
  quantity: number;
  storageType: string;
  capacity: number | null;
  isSideBin: boolean;
  isOverflow: boolean;
  notes: string[];
  raw: Record<string, unknown>;
};

type ColumnMap = {
  bin: string | null;
  material: string | null;
  quantity: string | null;
  storageType: string | null;
};

type HeaderInfo = {
  original: string;
  norm: string;
};

type BinItem = {
  material: string;
  quantity: number;
  sourceRows: number[];
};

type BinSummary = {
  bin: string;
  rowKey: RowKey | "";
  capacity: number | null;
  isSideBin: boolean;
  totalQty: number;
  remaining: number | null;
  items: BinItem[];
  records: ParsedRecord[];
  isOverflow: boolean;
  isMapped: boolean;
};

type AlignmentBand = {
  key: string;
  a: string | null;
  b: string | null;
  c: string | null;
  d: string | null;
  e: string | null;
  f: string | null;
  g: string | null;
  h: string | null;
  hm: string | null;
  hh: string | null;
  ii: string | null;
  i: string | null;
  j: string | null;
};

type RenderEntry =
  | { kind: "row"; id: string; label: string; bins: (string | null)[] }
  | { kind: "lane"; id: string }
  | {
      kind: "tunnel";
      id: string;
      hhBins: (string | null)[];
      hmBins: (string | null)[];
      hBins: (string | null)[];
    };

type WarehouseColumn =
  | { kind: "row"; id: string; title: string; bins: string[]; description?: string }
  | { kind: "lane"; id: string; title: string; description?: string }
  | {
      kind: "hm_pair";
      id: string;
      title: string;
      hBinsBefore: string[];
      hmBins: string[];
      hBinsAfter: string[];
      hhBinsBefore: string[];
      hhBinsAfter: string[];
      description?: string;
    };

const NORMAL_SIDE_SUFFIXES = new Set(["07", "13", "19", "25", "31", "37", "43"]);
const B_SIDE_BINS = new Set(["BS6", "B09", "B15", "B21", "B27", "B33", "B39", "B42"]);
const H_SIDE_BINS = new Set(["H09", "H15", "H21", "H27", "H33", "H39"]);
const HH_SIDE_BINS = new Set(["HH09", "HH15", "HH21", "HH27", "HH33", "HH39"]);

const REGULAR_CAPACITY: Record<string, number> = {
  A: 43,
  B: 28,
  C: 28,
  D: 28,
  E: 28,
  F: 40,
  G: 25,
  H: 16,
  HH: 5,
  II: 10,
  I: 13,
  J: 19,
};

const SIDE_CAPACITY: Record<string, number> = {
  A: 14,
  B: 10,
  C: 10,
  D: 10,
  E: 10,
  F: 14,
  G: 10,
  H: 4,
  HH: 2,
  II: 4,
  I: 6,
};

const HM_CAPACITY: Record<string, number> = {
  HM01: 16,
  HM02: 16,
  HM03: 4,
  HM04: 16,
};

// Per-bin capacity overrides for bins that differ from their row's standard/side capacity
const BIN_CAPACITY_OVERRIDES: Record<string, number> = {
  B40: 22, B41: 22, B42: 22,
  C38: 22, C39: 22, C40: 22, C41: 22, C42: 22, C43: 8,
};

// Row heights in pixels — fixed sizes that keep bin buttons usable.
// H/HH are physically shallower (24 ft / 8 ft vs 51 ft standard) so they get
// reduced heights, but nothing below 28 px so bin labels remain readable.
const ROW_HEIGHTS: Record<string, number> = {
  A: 52, B: 52, C: 52, D: 52, E: 52, F: 52, G: 52,
  H: 40, HH: 28,
  I: 52, II: 52, J: 52,
};

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function makeRange(prefix: string, start: number, end: number): string[] {
  const bins: string[] = [];
  for (let n = start; n <= end; n += 1) {
    bins.push(`${prefix}${pad2(n)}`);
  }
  return bins;
}

function buildBRowBins(): string[] {
  return [
    "B02",
    "B03",
    "BS3",
    "BS4",
    "BS5",
    "BS6",
    "BS7",
    "B05",
    "B06",
    "B07",
    "B08",
    ...makeRange("B", 9, 42),
  ];
}

function buildHRowBins(): string[] {
  return makeRange("H", 2, 43);
}

function buildHHRowBins(): string[] {
  return makeRange("HH", 2, 43);
}

function buildJRowBins(): string[] {
  return makeRange("J", 1, 43);
}

function buildRenderBins(aligned: (string | null)[]): (string | null)[] {
  return [null, ...aligned.map((bin) => bin ?? null), ...Array(Math.max(0, MAIN_ALIGNMENT_COUNT - aligned.length)).fill(null)];
}

const A_ALIGNED = makeRange("A", 2, 47);
const B_ALIGNED = buildBRowBins();
const C_ALIGNED = makeRange("C", 2, 46);
const D_ALIGNED = makeRange("D", 2, 39);
const E_ALIGNED = makeRange("E", 2, 39);
const F_ALIGNED = makeRange("F", 2, 47);
const G_ALIGNED = makeRange("G", 2, 47);
const H_ALIGNED = [...makeRange("H", 2, 4), null, null, null, null, ...makeRange("H", 5, 43)];
const HM_ALIGNED = [null, null, null, "HM01", "HM02", "HM03", "HM04", ...Array(39).fill(null)];
const HH_ALIGNED = [...makeRange("HH", 2, 4), null, null, null, null, ...makeRange("HH", 5, 43)];
const II_ALIGNED = makeRange("II", 2, 47);
const I_ALIGNED = makeRange("I", 2, 47);
const J_PRE_ROW = "J01";
const J_ALIGNED = makeRange("J", 2, 43);

const MAIN_ALIGNMENT_COUNT = Math.max(
  A_ALIGNED.length,
  B_ALIGNED.length,
  C_ALIGNED.length,
  D_ALIGNED.length,
  E_ALIGNED.length,
  F_ALIGNED.length,
  G_ALIGNED.length,
  H_ALIGNED.length,
  HM_ALIGNED.length,
  HH_ALIGNED.length,
  II_ALIGNED.length,
  I_ALIGNED.length,
  J_ALIGNED.length
);

const ALIGNMENT_ROWS: AlignmentBand[] = [
  {
    key: "pre-j01",
    a: null,
    b: null,
    c: null,
    d: null,
    e: null,
    f: null,
    g: null,
    h: null,
    hm: null,
    hh: null,
    ii: null,
    i: null,
    j: J_PRE_ROW,
  },
  ...Array.from({ length: MAIN_ALIGNMENT_COUNT }, (_, index) => ({
    key: `align-${index + 1}`,
    a: A_ALIGNED[index] ?? null,
    b: B_ALIGNED[index] ?? null,
    c: C_ALIGNED[index] ?? null,
    d: D_ALIGNED[index] ?? null,
    e: E_ALIGNED[index] ?? null,
    f: F_ALIGNED[index] ?? null,
    g: G_ALIGNED[index] ?? null,
    h: H_ALIGNED[index] ?? null,
    hm: HM_ALIGNED[index] ?? null,
    hh: HH_ALIGNED[index] ?? null,
    ii: II_ALIGNED[index] ?? null,
    i: I_ALIGNED[index] ?? null,
    j: J_ALIGNED[index] ?? null,
  })),
];

// LAYOUT_BINS and LAYOUT_BIN_SET imported from ../../domain/layout

function normalizeBin(input: unknown): string {
  const raw = String(input ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[-_]/g, "");

  if (!raw) return "";
  if (raw.endsWith("S")) return "";

  const hm = raw.match(/^HM(\d{1,2})$/);
  if (hm) return `HM${hm[1].padStart(2, "0")}`;

  const bs = raw.match(/^BS(\d{1,2})$/);
  if (bs) return `BS${String(Number(bs[1]))}`;

  const hh = raw.match(/^HH(\d{1,2})$/);
  if (hh) return `HH${hh[1].padStart(2, "0")}`;

  const ii = raw.match(/^II(\d{1,2})$/);
  if (ii) return `II${ii[1].padStart(2, "0")}`;

  const single = raw.match(/^([A-J])(\d{1,2}[A-Z]?)$/);
  if (single) {
    const suffix = /^\d+$/.test(single[2]) ? String(Number(single[2])).padStart(2, "0") : single[2];
    return `${single[1]}${suffix}`;
  }

  return raw;
}

function getRowKey(bin: string): RowKey | "" {
  if (!bin) return "";
  if (bin.startsWith("HM")) return "HM";
  if (bin.startsWith("HH")) return "HH";
  if (bin.startsWith("II")) return "II";
  if (bin.startsWith("BS") || bin.startsWith("B")) return "B";
  const one = bin[0];
  if (["A", "C", "D", "E", "F", "G", "H", "I", "J"].includes(one)) return one as RowKey;
  return "";
}

function getSuffix(bin: string): string {
  const match = bin.match(/(\d{2})$/);
  return match ? match[1] : "";
}

function isSideBin(bin: string): boolean {
  const rowKey = getRowKey(bin);
  const suffix = getSuffix(bin);

  if (!rowKey) return false;
  if (rowKey === "HM") return bin === "HM03";
  if (rowKey === "B") return B_SIDE_BINS.has(bin);
  if (rowKey === "H") return H_SIDE_BINS.has(bin);
  if (rowKey === "HH") return HH_SIDE_BINS.has(bin);
  if (rowKey === "J") return false;
  return NORMAL_SIDE_SUFFIXES.has(suffix);
}

function getBinCapacity(bin: string): number | null {
  if (!bin) return null;
  if (bin in HM_CAPACITY) return HM_CAPACITY[bin as keyof typeof HM_CAPACITY];
  if (bin in BIN_CAPACITY_OVERRIDES) return BIN_CAPACITY_OVERRIDES[bin];

  const rowKey = getRowKey(bin);
  if (!rowKey || rowKey === "HM") return null;

  if (isSideBin(bin)) {
    return SIDE_CAPACITY[rowKey] ?? null;
  }

  return REGULAR_CAPACITY[rowKey] ?? null;
}

function scoreHeader(
  header: HeaderInfo,
  exact: string[],
  includes: string[],
  excludes: string[] = []
): number {
  if (excludes.some((bad) => header.norm.includes(bad))) return -100;
  if (exact.includes(header.norm)) return 100;

  let score = 0;
  for (const token of includes) {
    if (header.norm.includes(token)) score += 10;
  }

  return score;
}

function pickBestHeader(
  headers: HeaderInfo[],
  exact: string[],
  includes: string[],
  excludes: string[] = []
): string | null {
  const scored = headers
    .map((header) => ({
      original: header.original,
      score: scoreHeader(header, exact, includes, excludes),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored[0]?.original ?? null;
}

function detectColumns(rows: Record<string, unknown>[]): ColumnMap {
  const headers: HeaderInfo[] = Object.keys(rows[0] || {}).map((h) => ({
    original: h,
    norm: h.toLowerCase().replace(/\s+/g, " ").trim(),
  }));

  return {
    bin: pickBestHeader(
      headers,
      ["storage bin", "bin", "target bin", "to bin", "location"],
      ["storage bin", "location", "bin"],
      ["capacity", "date", "material"]
    ),
    material: pickBestHeader(
      headers,
      ["material", "material number", "item number", "sku", "part", "product"],
      ["material", "item", "sku", "part", "product"],
      ["description", "date", "capacity"]
    ),
    quantity: pickBestHeader(
      headers,
      ["total stock", "available stock", "quantity", "qty", "on hand"],
      ["total stock", "available stock", "quantity", "qty", "on hand", "available", "stock"],
      ["capacity", "block", "date", "inventory", "base unit", "category", "type", "section", "bin", "material"]
    ),
    storageType: pickBestHeader(
      headers,
      ["storage type"],
      ["storage type"],
      ["section", "bin", "material", "capacity"]
    ),
  };
}

function toNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = Number(String(value ?? "").replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

function exportCsv(rows: ParsedRecord[]) {
  const headers = ["Bin", "Row", "Material", "Quantity", "Capacity", "Side Bin", "Overflow", "Notes"];
  const lines = [headers.join(",")];

  for (const row of rows) {
    const values = [
      row.bin,
      row.rowKey,
      row.material,
      row.quantity,
      row.capacity ?? "",
      row.isSideBin ? "YES" : "NO",
      row.isOverflow ? "YES" : "NO",
      row.notes.join(" | "),
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`);
    lines.push(values.join(","));
  }

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "warehouse-bin-analysis.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function summarizeBin(records: ParsedRecord[], bin: string, isMapped: boolean): BinSummary {
  const rowKey = getRowKey(bin);
  const capacity = getBinCapacity(bin);
  const itemsMap = new Map<string, BinItem>();
  let totalQty = 0;

  for (const record of records) {
    totalQty += record.quantity;
    const existing = itemsMap.get(record.material);
    if (existing) {
      existing.quantity += record.quantity;
      existing.sourceRows.push(record.sourceRow);
    } else {
      itemsMap.set(record.material, {
        material: record.material,
        quantity: record.quantity,
        sourceRows: [record.sourceRow],
      });
    }
  }

  const items = Array.from(itemsMap.values()).sort((a, b) => {
    if (b.quantity !== a.quantity) return b.quantity - a.quantity;
    return a.material.localeCompare(b.material);
  });

  return {
    bin,
    rowKey,
    capacity,
    isSideBin: isSideBin(bin),
    totalQty,
    remaining: capacity == null ? null : capacity - totalQty,
    items,
    records,
    isOverflow: capacity != null ? totalQty > capacity : false,
    isMapped,
  };
}

function getStorageTypes(summary: BinSummary): string[] {
  return Array.from(new Set(summary.records.map((record) => record.storageType).filter(Boolean))).sort();
}

function isType111(summary: BinSummary): boolean {
  return getStorageTypes(summary).includes("111");
}

function matchesSummary(summary: BinSummary, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  const haystack = [
    summary.bin,
    summary.rowKey,
    ...summary.items.map((item) => item.material),
    ...summary.records.flatMap((record) => [record.rawBin, record.notes.join(" ")]),
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(q);
}

function getBinButtonClass(summary: BinSummary, selected: boolean, matched: boolean, fillPct: number, overflow: boolean): string {
  let tone = "border-slate-300 text-slate-800";
  if (summary.isSideBin) tone = "border-rose-300 text-slate-800";
  if (overflow) tone = "border-amber-400 text-slate-900";

  const selectedTone = selected ? " ring-2 ring-slate-900 ring-offset-0 shadow-[0_0_0_1px_rgba(15,23,42,0.08)]" : "";
  const hiddenTone = matched ? "" : " opacity-25";
  const fillTone =
    overflow
      ? " bg-amber-100"
      : fillPct >= 0.99
      ? " bg-emerald-500 text-white"
      : fillPct > 0
      ? " bg-white"
      : " bg-white";

  return `w-full rounded-[3px] border px-0.5 py-0.5 text-center transition hover:-translate-y-[1px] ${tone}${selectedTone}${hiddenTone}${fillTone}`;
}

interface MapProps {
  preloadedJson?: Record<string, unknown>[];
  fullWindow?: boolean;
}

type SimBinState = {
  totalQty: number;
  storageType: string;
  materials: Set<string>;
  byMaterialQty: Record<string, number>;
};

type MapMode = "before" | "current" | "after";

function cloneSimState(source: Record<string, SimBinState>): Record<string, SimBinState> {
  const next: Record<string, SimBinState> = {};
  for (const [binId, bin] of Object.entries(source || {})) {
    next[binId] = {
      totalQty: Number(bin?.totalQty || 0),
      storageType: String(bin?.storageType || ""),
      materials: new Set(Array.from(bin?.materials || [])),
      byMaterialQty: { ...(bin?.byMaterialQty || {}) },
    };
  }
  return next;
}

function ensureSimBin(state: Record<string, SimBinState>, binId: string, storageType = ""): SimBinState {
  if (!state[binId]) {
    state[binId] = {
      totalQty: 0,
      storageType,
      materials: new Set(),
      byMaterialQty: {},
    };
  }
  if (!state[binId].storageType && storageType) state[binId].storageType = storageType;
  return state[binId];
}

function applyMovesToSimState(
  baseState: Record<string, SimBinState>,
  moves: Array<{ from?: string; to?: string; qty?: number; materialId?: string }> = []
): Record<string, SimBinState> {
  const state = cloneSimState(baseState);

  for (const move of moves) {
    const from = normalizeBin(move.from);
    const to = normalizeBin(move.to);
    const materialId = String(move.materialId || "").trim();
    const qty = Number(move.qty || 0);
    if (!from || !to || !materialId || qty <= 0) continue;

    const fromBin = ensureSimBin(state, from);
    fromBin.totalQty = Math.max(0, fromBin.totalQty - qty);
    fromBin.byMaterialQty[materialId] = Math.max(0, Number(fromBin.byMaterialQty[materialId] || 0) - qty);
    if (fromBin.byMaterialQty[materialId] <= 0.0001) {
      delete fromBin.byMaterialQty[materialId];
      fromBin.materials.delete(materialId);
    }

    const toBin = ensureSimBin(state, to);
    toBin.totalQty += qty;
    toBin.byMaterialQty[materialId] = Number(toBin.byMaterialQty[materialId] || 0) + qty;
    toBin.materials.add(materialId);
  }

  return state;
}

export default function WarehouseBinMapClickableBSequenceFixed({ preloadedJson, fullWindow = false }: MapProps = {}) {
  const agentData = useContext(AgentDataContext);
  const [records, setRecords] = useState<ParsedRecord[]>([]);
  const [search, setSearch] = useState("");
  const [fileName, setFileName] = useState("");
  const [sheetName, setSheetName] = useState("");
  const [columnMap, setColumnMap] = useState<ColumnMap>({ bin: null, material: null, quantity: null, storageType: null });
  const [error, setError] = useState("");
  const [selectedBin, setSelectedBin] = useState<string>("A02");
  const [mapMode, setMapMode] = useState<MapMode>("before");
  const mapRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function exportMapImage() {
    if (!mapRef.current) return;
    const html2canvas = (await import("html2canvas")).default;
    const canvas = await html2canvas(mapRef.current, { scale: 2, backgroundColor: "#e2e8f0" });
    const link = document.createElement("a");
    link.download = `warehouse-map-${new Date().toISOString().slice(0, 10)}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  // Function to process raw JSON data (used for both file upload and localStorage)
  const processRawData = (rawRows: Record<string, unknown>[], source: string) => {
    if (!rawRows.length) {
      setError("The data is empty.");
      setRecords([]);
      return;
    }

    const detected = detectColumns(rawRows);
    setColumnMap(detected);
    setFileName(source);
    setSheetName("Sheet1");
    setError("");

    if (!detected.bin || !detected.material || !detected.quantity) {
      setError("Could not detect Bin, Material, and Quantity columns.");
    }

    const parsed = rawRows.map((row, index) => {
      const rawBin = detected.bin ? row[detected.bin] : "";
      const material = detected.material ? String(row[detected.material] ?? "").trim() : "";
      const quantity = detected.quantity ? toNumber(row[detected.quantity]) : 0;
      const storageType = detected.storageType ? String(row[detected.storageType] ?? "").trim() : "";
      const bin = normalizeBin(rawBin);
      const rowKey = getRowKey(bin);
      const side = isSideBin(bin);
      const capacity = getBinCapacity(bin);
      const notes: string[] = [];

      if (!bin) notes.push("Missing bin");
      if (!rowKey) notes.push("Unknown bin format");
      if (!material) notes.push("Missing material");
      if (capacity == null && bin) notes.push("No capacity rule found in warehouse map");

      return {
        sourceRow: index + 2,
        rawBin: String(rawBin ?? ""),
        bin,
        rowKey,
        material,
        quantity,
        storageType,
        capacity,
        isSideBin: side,
        isOverflow: capacity != null ? quantity > capacity : false,
        notes,
        raw: row,
      } satisfies ParsedRecord;
    });

    setRecords(parsed);
  };

  // Auto-load from consolidation import — bypass detectColumns, use known SAP column names directly
  useEffect(() => {
    if (!preloadedJson || preloadedJson.length === 0) return;

    const keys = Object.keys(preloadedJson[0] || {});
    const findCol = (...candidates: string[]) =>
      keys.find((k) => candidates.includes(k.trim().toLowerCase())) ??
      keys.find((k) => candidates.some((c) => k.trim().toLowerCase().includes(c))) ??
      null;

    const BIN_COL  = findCol("storage bin", "bin");
    const MAT_COL  = findCol("material");
    const QTY_COL  = findCol("available stock", "total stock", "quantity", "qty");
    const TYPE_COL = findCol("storage type");

    if (!BIN_COL || !QTY_COL) return; // can't parse without bin + qty

    const parsed: ParsedRecord[] = preloadedJson
      .map((row, index) => {
        const rawBin   = String(row[BIN_COL]  ?? "").trim();
        const material = MAT_COL  ? String(row[MAT_COL]  ?? "").trim() : "";
        const quantity = QTY_COL  ? toNumber(row[QTY_COL]) : 0;
        const storageType = TYPE_COL ? String(row[TYPE_COL] ?? "").trim() : "";
        const bin      = normalizeBin(rawBin);
        const rowKey   = getRowKey(bin);
        const side     = isSideBin(bin);
        const capacity = getBinCapacity(bin);
        const notes: string[] = [];
        if (!bin)    notes.push("Missing bin");
        if (!rowKey) notes.push("Unknown bin format");
        if (capacity == null && bin) notes.push("No capacity rule found");
        return {
          sourceRow: index + 2,
          rawBin,
          bin,
          rowKey,
          material,
          quantity,
          storageType,
          capacity,
          isSideBin: side,
          isOverflow: capacity != null ? quantity > capacity : false,
          notes,
          raw: row,
        } satisfies ParsedRecord;
      })
      .filter((r) => !!r.bin); // drop blank-bin rows (empty Excel rows, totals, etc.)

    setRecords(parsed);
    setFileName("SAP Import");
    setSheetName("Sheet1");
    setError("");
    setColumnMap({ bin: BIN_COL, material: MAT_COL, quantity: QTY_COL, storageType: TYPE_COL });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preloadedJson]);

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError("");

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const activeSheet = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[activeSheet];
      const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: "" });

      processRawData(rawRows, file.name);
    } catch (e) {
      console.error(e);
      setError("The file could not be read as a valid .xlsx export.");
      setRecords([]);
    }
  };

  const summaries = useMemo(() => {
    const recordMap = new Map<string, ParsedRecord[]>();
    for (const record of records) {
      if (!record.bin) continue;
      const existing = recordMap.get(record.bin) ?? [];
      existing.push(record);
      recordMap.set(record.bin, existing);
    }

    const summaryMap = new Map<string, BinSummary>();

    for (const bin of LAYOUT_BINS) {
      summaryMap.set(bin, summarizeBin(recordMap.get(bin) ?? [], bin, true));
    }

    for (const [bin, binRecords] of recordMap.entries()) {
      if (!summaryMap.has(bin)) {
        summaryMap.set(bin, summarizeBin(binRecords, bin, false));
      }
    }

    return summaryMap;
  }, [records]);

  const initialSimState = useMemo(() => {
    if (records.length > 0) {
      const fallback: Record<string, SimBinState> = {};
      for (const summary of Array.from(summaries.values())) {
        if (summary.totalQty <= 0) continue;
        const bin = ensureSimBin(fallback, summary.bin, summary.records[0]?.storageType || "");
        bin.totalQty = summary.totalQty;
        for (const item of summary.items) {
          bin.byMaterialQty[item.material] = Number(item.quantity || 0);
          if (item.quantity > 0) bin.materials.add(item.material);
        }
      }
      return fallback;
    }

    const contextBins = agentData?.binState || {};
    if (Object.keys(contextBins).length > 0) {
      return cloneSimState(contextBins as Record<string, SimBinState>);
    }

    const fallback: Record<string, SimBinState> = {};
    for (const summary of Array.from(summaries.values())) {
      if (summary.totalQty <= 0) continue;
      const bin = ensureSimBin(fallback, summary.bin, summary.records[0]?.storageType || "");
      bin.totalQty = summary.totalQty;
      for (const item of summary.items) {
        bin.byMaterialQty[item.material] = Number(item.quantity || 0);
        if (item.quantity > 0) bin.materials.add(item.material);
      }
    }
    return fallback;
  }, [agentData?.binState, records.length, summaries]);

  const movesForMode = useMemo(() => {
    const allMoves = Array.isArray(agentData?.moves) ? agentData.moves : [];
    const completed = agentData?.completed || new Set();
    if (mapMode === "after") return allMoves;
    if (mapMode === "current") return allMoves.filter((move) => completed.has(move.id));
    return [];
  }, [agentData?.completed, agentData?.moves, mapMode]);

  const simulatedState = useMemo(
    () => applyMovesToSimState(initialSimState, movesForMode as Array<{ from?: string; to?: string; qty?: number; materialId?: string }>),
    [initialSimState, movesForMode]
  );

  const getDisplayedQty = (binId: string): number => Number(simulatedState[binId]?.totalQty || 0);
  const getDisplayedCapacity = (binId: string): number | null => getBinCapacity(binId);
  const getDisplayedRemaining = (binId: string): number | null => {
    const cap = getDisplayedCapacity(binId);
    if (cap == null) return null;
    return +(cap - getDisplayedQty(binId)).toFixed(1);
  };
  const getDisplayedFillPct = (binId: string): number => {
    const cap = getDisplayedCapacity(binId);
    if (!cap || cap <= 0) return 0;
    return Math.max(0, getDisplayedQty(binId) / cap);
  };

  const visibleUnknownBins = useMemo(() => {
    return Array.from(summaries.values())
      .filter((summary) => !summary.isMapped)
      .sort((a, b) => a.bin.localeCompare(b.bin));
  }, [summaries]);

  const activeSelectedBin = useMemo(() => {
    if (selectedBin && summaries.has(selectedBin)) return selectedBin;
    const firstOccupied = Array.from(summaries.values()).find((summary) => getDisplayedQty(summary.bin) > 0 && summary.isMapped);
    return firstOccupied?.bin ?? "A02";
  }, [selectedBin, summaries, simulatedState]);

  const selectedSummary = summaries.get(activeSelectedBin) ?? summarizeBin([], activeSelectedBin, LAYOUT_BIN_SET.has(activeSelectedBin));
  const selectedCapacity = getDisplayedCapacity(activeSelectedBin);
  const selectedQty = getDisplayedQty(activeSelectedBin);
  const selectedRemaining = getDisplayedRemaining(activeSelectedBin);
  const selectedProjectedItems = useMemo(() => {
    const bin = simulatedState[activeSelectedBin];
    return Object.entries(bin?.byMaterialQty || {})
      .map(([material, quantity]) => ({
        material,
        quantity: Number(quantity || 0),
        sourceRows: selectedSummary.items.find((item) => item.material === material)?.sourceRows || [],
      }))
      .sort((a, b) => b.quantity - a.quantity || a.material.localeCompare(b.material));
  }, [activeSelectedBin, selectedSummary.items, simulatedState]);

  const totals = useMemo(() => {
    const all = Array.from(summaries.values()).filter((summary) => summary.isMapped);
    const occupiedBins = all.filter((summary) => getDisplayedQty(summary.bin) > 0.001).length;
    const emptyBins = all.filter((summary) => getDisplayedQty(summary.bin) <= 0.001).length;
    const overflows = all.filter((summary) => {
      const cap = getDisplayedCapacity(summary.bin);
      return cap != null && getDisplayedQty(summary.bin) > cap + 0.001;
    }).length;
    const fullBins = all.filter((summary) => {
      const cap = getDisplayedCapacity(summary.bin);
      return cap != null && getDisplayedQty(summary.bin) >= cap - 0.001;
    }).length;
    const partialBins = all.filter((summary) => getDisplayedQty(summary.bin) > 0.001 && getDisplayedFillPct(summary.bin) < 0.999).length;
    return { occupiedBins, emptyBins, overflows, fullBins, partialBins };
  }, [summaries, simulatedState]);

  // ─── Rotated layout: rows run horizontally (bottom=A, top=J), alignment slots are columns ───
  // Row order from bottom to top (reversed for rendering top-to-bottom)
  const ROW_RENDER_ORDER: RenderEntry[] = (() => {
    // We want top=J, bottom=A, lanes between row pairs
    // Each row's bins array is indexed by alignment slot (0..MAIN_ALIGNMENT_COUNT)
    // Slot 0 = the pre-J01 slot (only J has a bin there)
    const rowEntries: Extract<RenderEntry, { kind: "row" }>[] = [
      { kind: "row", id: "j",  label: "J",  bins: [J_PRE_ROW, ...J_ALIGNED.map((b) => b ?? null), ...Array(Math.max(0, MAIN_ALIGNMENT_COUNT - J_ALIGNED.length)).fill(null)] },
      { kind: "row", id: "i",  label: "I",  bins: buildRenderBins(I_ALIGNED) },
      { kind: "row", id: "ii", label: "II", bins: buildRenderBins(II_ALIGNED) },
      { kind: "row", id: "g",  label: "G",  bins: buildRenderBins(G_ALIGNED) },
      { kind: "row", id: "f",  label: "F",  bins: buildRenderBins(F_ALIGNED) },
      { kind: "row", id: "e",  label: "E",  bins: buildRenderBins(E_ALIGNED) },
      { kind: "row", id: "d",  label: "D",  bins: buildRenderBins(D_ALIGNED) },
      { kind: "row", id: "c",  label: "C",  bins: buildRenderBins(C_ALIGNED) },
      { kind: "row", id: "b",  label: "B",  bins: buildRenderBins(B_ALIGNED) },
      { kind: "row", id: "a",  label: "A",  bins: buildRenderBins(A_ALIGNED) },
    ];
    // Insert lanes between row pairs (top to bottom: J, lane, I above II, lane, HH/HM/H, lane, G/F, lane, E/D, lane, C/B, lane, A)
    const result: RenderEntry[] = [];
    result.push(rowEntries[0]);  // J
    result.push({ kind: "lane", id: "lane-6" });
    result.push(rowEntries[1]);  // I   appears above II
    result.push(rowEntries[2]);  // II  appears below I
    result.push({ kind: "lane", id: "lane-5" });
    result.push({
      kind: "tunnel",
      id: "tunnel-h-hh",
      hhBins: buildRenderBins(HH_ALIGNED),
      hmBins: buildRenderBins(HM_ALIGNED),
      hBins: buildRenderBins(H_ALIGNED),
    });
    result.push({ kind: "lane", id: "lane-4" });
    result.push(rowEntries[3]);  // G
    result.push(rowEntries[4]);  // F
    result.push({ kind: "lane", id: "lane-3" });
    result.push(rowEntries[5]);  // E
    result.push(rowEntries[6]);  // D
    result.push({ kind: "lane", id: "lane-2" });
    result.push(rowEntries[7]);  // C
    result.push(rowEntries[8]);  // B
    result.push({ kind: "lane", id: "lane-1" });
    result.push(rowEntries[9]);  // A
    return result;
  })();

  const TOTAL_COLS = 1 + MAIN_ALIGNMENT_COUNT; // slot 0 (pre-J01) + main alignment slots
  const LABEL_COL_WIDTH = 0;
  const HAS_LABEL_COLUMN = LABEL_COL_WIDTH > 0;
  const COL_WIDTH = 28;
  const GRID_ROW_HEIGHT = 52;
  const GRID_ROW_GAP = 2;
  const HM_INSERT_HEIGHT = ROW_HEIGHTS.HH + ROW_HEIGHTS.H + GRID_ROW_GAP;
  const ROTATED_GRID_COLS = HAS_LABEL_COLUMN
    ? `${LABEL_COL_WIDTH}px repeat(${TOTAL_COLS}, ${COL_WIDTH}px)`
    : `repeat(${TOTAL_COLS}, ${COL_WIDTH}px)`;
  const FIRST_BIN_GRID_COL = HAS_LABEL_COLUMN ? 2 : 1;

  const renderBinCell = (bin: string, style?: React.CSSProperties) => {
    const summary = summaries.get(bin) ?? summarizeBin([], bin, true);
    const matched = matchesSummary(summary, search);
    const selected = activeSelectedBin === bin;
    const cap = getBinCapacity(bin);
    const fillPct = getDisplayedFillPct(bin);
    const qty = getDisplayedQty(bin);
    const overflow = cap != null && qty > cap + 0.001;
    const fillPercent = `${Math.max(0, Math.min(100, fillPct * 100)).toFixed(1)}%`;
    const backgroundImage =
      overflow
        ? "linear-gradient(180deg, rgba(251,191,36,0.32), rgba(251,191,36,0.32))"
        : fillPct >= 0.999
        ? "linear-gradient(180deg, rgba(16,185,129,0.9), rgba(16,185,129,0.9))"
        : fillPct > 0
        ? `linear-gradient(180deg, rgba(255,255,255,1) 0%, rgba(255,255,255,1) ${100 - fillPct * 100}%, rgba(125,211,252,0.55) ${100 - fillPct * 100}%, rgba(56,189,248,0.72) 100%)`
        : undefined;

    return (
      <button
        key={bin}
        type="button"
        onClick={() => setSelectedBin(bin)}
        className={`${getBinButtonClass(summary, selected, matched, fillPct, overflow)}`.trim()}
        style={{
          height: "auto",
          minHeight: GRID_ROW_HEIGHT,
          backgroundImage,
          ...style,
        }}
        title={`${bin} · ${qty.toFixed(1)} / ${cap ?? "?"} PAL · ${fillPercent}`}
      >
        <span className="block text-[7px] font-semibold leading-tight">{bin}</span>
        <span className={`block text-[6px] leading-tight ${fillPct >= 0.999 ? "text-white/90" : "text-slate-500"}`}>{cap ?? "—"}</span>
      </button>
    );
  };

  const renderEmptyCell = (key: string) => (
    <div
      key={key}
      className="rounded-[3px] border border-transparent bg-transparent"
      style={{ minHeight: 32 }}
    />
  );

  const renderLaneRow = (id: string) => (
    <div
      key={id}
      className="grid gap-[2px] items-center"
      style={{ gridTemplateColumns: ROTATED_GRID_COLS }}
    >
      {HAS_LABEL_COLUMN ? (
        <div className="flex h-3 items-center justify-center">
          <span className="text-[7px] font-semibold uppercase tracking-wide text-slate-400"></span>
        </div>
      ) : null}
      {Array.from({ length: TOTAL_COLS }, (_, i) => (
        <div key={`${id}-${i}`} className="h-3 bg-transparent" />
      ))}
    </div>
  );

  const renderLabelSpacer = (key: string, style?: React.CSSProperties) => (
    <div
      key={key}
      className="bg-transparent"
      style={{ minHeight: GRID_ROW_HEIGHT, ...style }}
    />
  );

  const renderTunnelSection = (entry: Extract<RenderEntry, { kind: "tunnel" }>) => (
    <div
      key={entry.id}
      className="grid gap-[2px]"
      style={{
        gridTemplateColumns: ROTATED_GRID_COLS,
        gridTemplateRows: `${ROW_HEIGHTS.HH}px ${ROW_HEIGHTS.H}px`,
      }}
    >
      {HAS_LABEL_COLUMN ? renderLabelSpacer(`${entry.id}-hh-spacer`, { gridColumn: 1, gridRow: 1 }) : null}
      {HAS_LABEL_COLUMN ? renderLabelSpacer(`${entry.id}-h-spacer`, { gridColumn: 1, gridRow: 2 }) : null}
      {entry.hhBins.map((bin, colIdx) =>
        bin
          ? renderBinCell(bin, { gridColumn: colIdx + FIRST_BIN_GRID_COL, gridRow: 1, minHeight: ROW_HEIGHTS.HH })
          : null
      )}
      {entry.hBins.map((bin, colIdx) =>
        bin
          ? renderBinCell(bin, { gridColumn: colIdx + FIRST_BIN_GRID_COL, gridRow: 2, minHeight: ROW_HEIGHTS.H })
          : null
      )}
      {entry.hmBins.map((bin, colIdx) =>
        bin
          ? renderBinCell(bin, {
              gridColumn: colIdx + FIRST_BIN_GRID_COL,
              gridRow: "1 / span 2",
              minHeight: HM_INSERT_HEIGHT,
              position: "relative",
              zIndex: 10,
            })
          : null
      )}
    </div>
  );

  return (
    <div className={fullWindow ? "h-full bg-slate-50 p-2" : "min-h-screen bg-slate-50 p-2"}>
      <div className={`mx-auto max-w-[1920px] space-y-4 ${fullWindow ? "h-full overflow-auto pr-1" : ""}`}>
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">{APP_NAME}</h1>
          <Badge variant="outline">v{APP_VERSION}</Badge>
        </div>
          <div className="text-sm font-medium text-slate-700">{APP_TAGLINE}</div>
          <p className="max-w-4xl text-sm text-slate-600">
            {APP_SUBTITLE}
          </p>
        </div>

        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Map controls</CardTitle>
          </CardHeader>
            <CardContent className="space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleUpload}
              />
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload export
                </Button>
                {fileName ? (
                  <div className="flex items-center rounded-full border border-[#ddd4c5] bg-white px-3 py-2 text-xs font-medium text-slate-600">
                    {fileName}
                  </div>
                ) : null}
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" placeholder="Search bin or material" />
              </div>
              {error ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {error}
                </div>
              ) : null}
              <div className="text-sm text-slate-600">Each horizontal band is a physical warehouse alignment slot. A02/B02/C02 line up, A04/BS3/C04 line up, and A07/BS6/C07/.../HM03/II07/I07 line up.</div>
              <div className="text-sm text-slate-600">Row B continues B05, B06, B07, B08, B09... so the next side-bin band lands at B09. The H/HH tunnel resumes side bins at H09/HH09.</div>
              <div className="text-sm text-slate-600">Row J runs straight from J01 to J43. Rows F, G, I, and II continue through 47.</div>
              <div className="flex flex-wrap gap-2">
                {[
                  { id: "before", label: "Before plan" },
                  { id: "current", label: "Completed only" },
                  { id: "after", label: "After plan" },
                ].map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setMapMode(option.id as MapMode)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                      mapMode === option.id
                        ? "border border-sky-200 bg-sky-50 text-sky-700"
                        : "border border-[#ddd4c5] bg-white text-slate-600 hover:bg-[#f8f4ec]"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <div className="grid gap-2 text-xs text-slate-600 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-[#e6dccb] bg-white p-3">
                  <div className="font-semibold text-slate-800">Empty</div>
                  <div className="mt-1 flex items-center gap-2"><span className="inline-block h-3 w-3 rounded-sm border border-slate-300 bg-white" /> No stock in the chosen state.</div>
                </div>
                <div className="rounded-xl border border-[#e6dccb] bg-white p-3">
                  <div className="font-semibold text-slate-800">Partial</div>
                  <div className="mt-1 flex items-center gap-2"><span className="inline-block h-3 w-3 rounded-sm border border-sky-300 bg-sky-200" /> Blue fill shows live utilization.</div>
                </div>
                <div className="rounded-xl border border-[#e6dccb] bg-white p-3">
                  <div className="font-semibold text-slate-800">Full</div>
                  <div className="mt-1 flex items-center gap-2"><span className="inline-block h-3 w-3 rounded-sm bg-emerald-500" /> Bin is at or above planned capacity.</div>
                </div>
                <div className="rounded-xl border border-[#e6dccb] bg-white p-3">
                  <div className="font-semibold text-slate-800">Side bin</div>
                  <div className="mt-1 flex items-center gap-2"><span className="inline-block h-3 w-3 rounded-sm border-2 border-rose-400 bg-white" /> Red edge keeps side bins visible.</div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => exportCsv(records)} disabled={!records.length}>
                  <Download className="mr-2 h-4 w-4" />
                  Export data
                </Button>
                <Button variant="outline" onClick={exportMapImage}>
                  <Camera className="mr-2 h-4 w-4" />
                  Save Map as PNG
                </Button>
              </div>
            </CardContent>
          </Card>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="rounded-2xl shadow-sm"><CardContent className="p-5"><div className="text-2xl font-semibold">{records.length}</div><div className="text-sm text-slate-500">Imported rows</div></CardContent></Card>
          <Card className="rounded-2xl shadow-sm"><CardContent className="p-5"><div className="text-2xl font-semibold">{totals.occupiedBins}</div><div className="text-sm text-slate-500">Occupied bins</div></CardContent></Card>
          <Card className="rounded-2xl shadow-sm"><CardContent className="p-5"><div className="text-2xl font-semibold">{totals.emptyBins}</div><div className="text-sm text-slate-500">Empty bins</div></CardContent></Card>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card className="rounded-2xl shadow-sm"><CardContent className="p-5"><div className="text-2xl font-semibold">{totals.partialBins}</div><div className="text-sm text-slate-500">Partial bins</div></CardContent></Card>
          <Card className="rounded-2xl shadow-sm"><CardContent className="p-5"><div className="text-2xl font-semibold">{totals.fullBins}</div><div className="text-sm text-slate-500">Full bins</div></CardContent></Card>
          <Card className="rounded-2xl shadow-sm"><CardContent className="p-5"><div className="text-2xl font-semibold">{totals.overflows}</div><div className="text-sm text-slate-500">Overflow bins</div></CardContent></Card>
          <Card className="rounded-2xl shadow-sm"><CardContent className="p-5"><div className="text-2xl font-semibold capitalize">{mapMode}</div><div className="text-sm text-slate-500">Map state</div></CardContent></Card>
        </div>

        <div className="grid gap-4">
          <Card className="rounded-2xl shadow-sm">
            <CardHeader><CardTitle className="text-lg">Warehouse layout</CardTitle></CardHeader>
            <CardContent className={fullWindow ? "min-h-0" : undefined}>
              <div
                ref={mapRef}
                className={`rounded-2xl border border-slate-300 bg-slate-200 py-3 pr-3 pl-0 ${fullWindow ? "max-h-[calc(100vh-14rem)] overflow-auto" : "overflow-x-auto"}`}
              >
                <div className="min-w-max space-y-0">
                  {ROW_RENDER_ORDER.map((entry) => {
                    if (entry.kind === "lane") {
                      return renderLaneRow(entry.id);
                    }
                    if (entry.kind === "tunnel") {
                      return renderTunnelSection(entry);
                    }
                    // Row rendering
                    const row = entry;
                    return (
                      <div
                        key={row.id}
                        className="grid gap-[2px]"
                        style={{ gridTemplateColumns: ROTATED_GRID_COLS }}
                      >
                        {HAS_LABEL_COLUMN ? renderLabelSpacer(`${row.id}-spacer`) : null}
                        {/* Bin cells */}
                        {row.bins.map((bin, colIdx) =>
                          bin
                            ? renderBinCell(bin, { minHeight: ROW_HEIGHTS[row.label] ?? GRID_ROW_HEIGHT })
                            : renderEmptyCell(`${row.id}-empty-${colIdx}`)
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-sm">
            <CardHeader><CardTitle className="text-lg">Selected bin</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl border bg-slate-50 p-4">
                <div className="text-2xl font-semibold tracking-tight">{selectedSummary.bin}</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge variant="outline">Row {selectedSummary.rowKey || "—"}</Badge>
                  <Badge variant={selectedSummary.isSideBin ? "secondary" : "outline"}>{selectedSummary.isSideBin ? "Side bin" : "Regular bin"}</Badge>
                  {isType111(selectedSummary) ? <Badge>Type 111</Badge> : null}
                </div>
                <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                  <div className="rounded-xl bg-white p-3"><div className="text-slate-500">Total qty</div><div className="text-lg font-semibold">{selectedQty.toFixed(1)}</div></div>
                  <div className="rounded-xl bg-white p-3"><div className="text-slate-500">Capacity</div><div className="text-lg font-semibold">{selectedCapacity ?? "—"}</div></div>
                  <div className="rounded-xl bg-white p-3"><div className="text-slate-500">Remaining</div><div className="text-lg font-semibold">{selectedRemaining ?? "—"}</div></div>
                </div>
                <div className="mt-4">
                  <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
                    <span>Utilization</span>
                    <span>{(getDisplayedFillPct(activeSelectedBin) * 100).toFixed(1)}%</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full border border-slate-200 bg-white">
                    <div
                      className={`h-full transition-all ${
                        getDisplayedFillPct(activeSelectedBin) >= 0.999 ? "bg-emerald-500" : "bg-sky-400"
                      }`}
                      style={{ width: `${Math.max(0, Math.min(100, getDisplayedFillPct(activeSelectedBin) * 100))}%` }}
                    />
                  </div>
                </div>
              </div>
              <div className="overflow-hidden rounded-2xl border bg-white">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-100 text-left text-slate-600"><tr><th className="px-3 py-2 font-medium">Material</th><th className="px-3 py-2 font-medium">Qty</th><th className="px-3 py-2 font-medium">Lines</th></tr></thead>
                  <tbody>
                    {selectedProjectedItems.length === 0 ? (
                      <tr><td colSpan={3} className="px-3 py-6 text-center text-slate-500">This bin is empty in the current export.</td></tr>
                    ) : selectedProjectedItems.map((item) => (
                      <tr key={`${selectedSummary.bin}-${item.material}`} className="border-t"><td className="px-3 py-2 font-medium">{item.material}</td><td className="px-3 py-2">{item.quantity.toFixed(1)}</td><td className="px-3 py-2 text-slate-600">{item.sourceRows.length ? item.sourceRows.join(", ") : "planned"}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
          <Card className="rounded-2xl shadow-sm">
            <CardHeader><CardTitle className="text-lg">Import details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border bg-white p-3">
                  <div className="text-xs uppercase tracking-wide text-slate-500">File</div>
                  <div className="mt-1 text-sm font-medium text-slate-900">{fileName || "No file loaded"}</div>
                </div>
                <div className="rounded-xl border bg-white p-3">
                  <div className="text-xs uppercase tracking-wide text-slate-500">Worksheet</div>
                  <div className="mt-1 text-sm font-medium text-slate-900">{sheetName || "—"}</div>
                </div>
                <div className="rounded-xl border bg-white p-3">
                  <div className="text-xs uppercase tracking-wide text-slate-500">Detected Bin column</div>
                  <div className="mt-1 text-sm font-medium text-slate-900">{columnMap.bin || "Not detected"}</div>
                </div>
                <div className="rounded-xl border bg-white p-3">
                  <div className="text-xs uppercase tracking-wide text-slate-500">Detected Material column</div>
                  <div className="mt-1 text-sm font-medium text-slate-900">{columnMap.material || "Not detected"}</div>
                </div>
                <div className="rounded-xl border bg-white p-3">
                  <div className="text-xs uppercase tracking-wide text-slate-500">Detected Quantity column</div>
                  <div className="mt-1 text-sm font-medium text-slate-900">{columnMap.quantity || "Not detected"}</div>
                </div>
                <div className="rounded-xl border bg-white p-3">
                  <div className="text-xs uppercase tracking-wide text-slate-500">Detected Storage Type column</div>
                  <div className="mt-1 text-sm font-medium text-slate-900">{columnMap.storageType || "Not detected"}</div>
                </div>
              </div>
              <div className="text-sm text-slate-600">Mapped empty bins currently available: {totals.emptyBins}</div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-sm">
            <CardHeader><CardTitle className="text-lg">Unknown or unmapped bins</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {visibleUnknownBins.length === 0 ? (
                <div className="rounded-xl border bg-white p-3 text-sm text-slate-500">Every detected bin matched the current warehouse layout.</div>
              ) : (
                visibleUnknownBins.slice(0, 20).map((summary) => (
                  <div key={summary.bin} className="rounded-xl border bg-white p-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-medium">{summary.bin}</div>
                      <Badge variant="outline">Qty {summary.totalQty}</Badge>
                    </div>
                    <div className="mt-1 text-slate-600">{summary.items.map((item) => `${item.material} (${item.quantity})`).join(", ") || "No material lines"}</div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500 shadow-sm">
          <div>{APP_NAME} v{APP_VERSION}</div>
          <div>Installer-ready desktop build with portable and NSIS targets.</div>
        </div>
      </div>
    </div>
  );
}
