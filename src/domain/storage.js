import { normBin } from "./bin";

const CAP_OVERRIDES_KEY = "wo_capacity_overrides";
const DISABLED_BINS_KEY = "wo_disabled_bins";

export function loadCapOverrides() {
  try {
    const raw = localStorage.getItem(CAP_OVERRIDES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};
    const clean = {};
    for (const [k, v] of Object.entries(parsed)) {
      const nk = normBin(k);
      if (nk && typeof v === "number" && Number.isInteger(v) && v >= 0) {
        clean[nk] = v;
      }
    }
    return clean;
  } catch {
    return {};
  }
}

export function saveCapOverrides(overrides) {
  try {
    localStorage.setItem(CAP_OVERRIDES_KEY, JSON.stringify(overrides));
  } catch {}
}

export function loadDisabledBins() {
  try {
    const raw = localStorage.getItem(DISABLED_BINS_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    const bins = new Set();
    for (const b of parsed) {
      const nb = normBin(b);
      if (nb) bins.add(nb);
    }
    return bins;
  } catch {
    return new Set();
  }
}

export function saveDisabledBins(disabledSet) {
  try {
    localStorage.setItem(DISABLED_BINS_KEY, JSON.stringify(Array.from(disabledSet)));
  } catch {}
}
