import { normBin } from "./bin.js";

// ─── Master Bin Capacity Roster ──────────────────────────────────────
// Every bin has a FIXED capacity that does NOT change based on partner
// bin occupancy. The app ignores any capacity data from XLSX imports.
// These values are standalone law.

function buildRoster() {
  const m = {};

  function addRow(prefix, start, end, stdCap, sideCap, sidePositions) {
    for (let i = start; i <= end; i++) {
      const num = String(i).padStart(2, "0");
      const binId = `${prefix}${num}`;
      m[binId] = sidePositions.has(num) ? sideCap : stdCap;
    }
  }

  const STD_SIDE = new Set(["07", "13", "19", "25", "31", "37", "43"]);
  const B_SIDE = new Set(["09", "15", "21", "27", "33", "39"]);
  const H_HH_SIDE = new Set(["09", "15", "21", "27", "33", "39"]);

  // A row: 43 standard, 14 side (A02-A47); A02-A06 reduced to 37
  addRow("A", 2, 47, 43, 14, STD_SIDE);
  m["A02"] = 37; m["A03"] = 37; m["A04"] = 37; m["A05"] = 37; m["A06"] = 37;

  // B row: 28 standard, 10 side (shifted positions), end bins reduced
  addRow("B", 2, 39, 28, 10, B_SIDE);
  m["B40"] = 22; m["B41"] = 22; m["B42"] = 22;
  // BS bins (special B-row bins)
  m["BS3"] = 28; m["BS4"] = 28; m["BS5"] = 28; m["BS6"] = 10; m["BS7"] = 28;

  // C row: 28 standard, 10 side, end bins reduced (C02-C46)
  addRow("C", 2, 46, 28, 10, STD_SIDE);
  m["C38"] = 22; m["C39"] = 22; m["C40"] = 22; m["C41"] = 22; m["C42"] = 22; m["C43"] = 8;

  // D row: 28 standard, 10 side (ends at D39)
  addRow("D", 2, 39, 28, 10, STD_SIDE);

  // E row: 28 standard, 10 side (ends at E39)
  addRow("E", 2, 39, 28, 10, STD_SIDE);

  // F row: 37 standard, 14 side (F02-F47)
  addRow("F", 2, 47, 37, 14, STD_SIDE);

  // G row: 28 standard, 10 side (G02-G47)
  addRow("G", 2, 47, 28, 10, STD_SIDE);

  // H row: HM03 occupies the shared H/HH side-bin slot; H side bins resume at 09
  addRow("H", 2, 43, 16, 4, H_HH_SIDE);
  // HM bins (physically in H/HH zone, shared across the H/HH tunnel)
  m["HM01"] = 16; m["HM02"] = 16; m["HM03"] = 4; m["HM04"] = 16;

  // HH row: HM03 occupies the shared H/HH side-bin slot; HH side bins resume at 09
  addRow("HH", 2, 43, 5, 2, H_HH_SIDE);

  // I row: 13 standard, 6 side (I02-I47)
  addRow("I", 2, 47, 13, 6, STD_SIDE);

  // II row: 10 standard, 4 side (II02-II47)
  addRow("II", 2, 47, 10, 4, STD_SIDE);

  // J row: 19 all bins, no side distinction (J01-J43)
  m["J01"] = 19;
  addRow("J", 2, 43, 19, 19, new Set());

  // ─── WH3 bins — individual capacities from SAP export ───────────────
  // Note: 3B45S is an S-suffix (quarantine shadow) bin and is excluded.
  // 3D17 and 3F21 are absent from the export (physically do not exist).
  const WH3_CAPS = {
    "3A01":39,"3A02":40,"3A03":45,"3A04":45,"3A05":39,"3A06":39,"3A07":39,"3A08":39,
    "3A11":39,"3A13":48,"3A14":39,"3A15":39,"3A16":55,"3A17":60,"3A18":39,"3A19":41,
    "3A20":39,"3A21":39,"3A22":39,"3A23":35,"3A24":39,"3A25":42,"3A26":45,"3A27":40,
    "3A28":41,"3A29":45,"3A30":41,"3A31":42,"3A32":45,"3A33":39,"3A34":39,"3A35":100,
    "3A36":50,"3A37":45,
    "3B01":50,"3B02":42,"3B03":42,"3B04":40,"3B05":40,"3B06":39,"3B07":40,"3B08":47,
    "3B09":41,"3B10":43,"3B11":60,"3B12":45,"3B13":44,"3B14":50,"3B15":39,"3B16":41,
    "3B17":39,"3B18":42,"3B19":50,"3B20":40,"3B21":45,"3B22":39,"3B23":39,"3B24":45,
    "3B25":39,"3B26":39,"3B27":42,"3B28":50,"3B29":42,"3B30":42,"3B31":50,"3B32":39,
    "3B33":44,"3B34":42,"3B35":60,"3B36":41,"3B37":41,"3B38":39,"3B39":39,"3B40":39,
    "3B41":44,"3B42":39,"3B43":42,"3B44":45,"3B45":45,
    "3C00":40,"3C01":42,"3C02":50,"3C03":40,"3C04":39,"3C05":39,"3C06":32,"3C07":42,
    "3C08":42,"3C09":45,"3C10":39,"3C11":41,"3C12":39,"3C13":39,"3C14":39,"3C15":39,
    "3C16":51,"3C17":40,"3C18":42,"3C19":40,"3C20":40,"3C21":42,"3C22":40,"3C23":200,
    "3C24":39,"3C25":39,"3C26":51,"3C27":39,"3C28":42,"3C29":42,"3C30":39,"3C31":42,
    "3C32":50,"3C33":41,"3C34":40,"3C35":50,"3C36":34,"3C37":42,"3C38":50,"3C39":45,
    "3C40":43,"3C41":51,"3C42":39,
    "3D00":43,"3D01":42,"3D02":39,"3D03":50,"3D04":39,"3D05":50,"3D06":40,"3D07":39,
    "3D08":60,"3D09":42,"3D10":42,"3D11":42,"3D12":45,"3D13":39,"3D14":40,"3D15":39,
    "3D16":40,"3D17":40,"3D18":40,"3D19":40,"3D20":40,"3D21":35,"3D22":39,"3D23":35,"3D24":35,
    "3D25":39,"3D26":45,"3D27":39,"3D28":45,"3D29":39,"3D30":45,"3D31":39,"3D32":40,
    "3D33":39,"3D34":39,"3D35":39,"3D36":45,
    "3E01":21,"3E02":30,"3E03":36,"3E04":30,"3E05":30,"3E06":20,"3E07":18,"3E08":45,
    "3E09":20,"3E10":45,"3E11":24,"3E12":30,"3E13":30,"3E14":30,"3E15":18,"3E16":30,
    "3E17":30,"3E18":24,"3E19":18,"3E20":45,"3E21":30,"3E22":18,"3E23":21,"3E24":30,
    "3E25":18,"3E26":18,"3E27":18,"3E28":19,"3E29":18,"3E30":18,"3E31":30,"3E32":50,
    "3E33":18,"3E34":25,"3E35":42,"3E36":24,"3E37":18,"3E38":24,"3E39":18,"3E40":30,
    "3E41":24,"3E42":50,"3E43":24,"3E44":18,"3E45":30,"3E46":21,"3E47":20,"3E48":30,
    "3E49":18,"3E50":25,"3E51":40,"3E52":18,"3E53":18,"3E54":28,"3E55":40,"3E56":40,
    "3E57":18,"3E58":18,"3E59":18,
    "3F01":18,"3F02":20,"3F03":19,"3F04":24,"3F05":20,"3F06":18,"3F07":24,"3F08":24,
    "3F09":24,"3F10":18,"3F11":30,"3F12":42,"3F13":30,"3F14":30,"3F15":30,"3F16":30,
    "3F17":36,"3F18":26,"3F19":30,"3F20":30,"3F21":18,"3F22":18,"3F23":18,"3F24":45,"3F25":18,
    "3F26":45,"3F27":21,"3F28":23,"3F29":18,"3F30":70,"3F31":20,"3F32":21,"3F33":18,
    "3F34":18,"3F35":18,"3F36":18,"3F37":18,"3F38":21,"3F39":18,"3F40":23,"3F41":30,
    "3F42":18,"3F43":18,"3F44":24,"3F45":32,"3F46":20,"3F47":42,"3F48":18,"3F49":23,
    "3F50":40,"3F51":22,"3F52":26,"3F53":18,"3F54":18,"3F55":40,"3F56":18,"3F57":18,
    "3F58":18,"3F59":23,
  };
  Object.assign(m, WH3_CAPS);

  return Object.freeze(m);
}

const BIN_CAPACITY = buildRoster();

export const SIDE_BINS = new Set([
  // A row
  "A07","A13","A19","A25","A31","A37","A43",
  // B row (side positions shifted to 09,15,21,27,33,39)
  "BS6","B09","B15","B21","B27","B33","B39","B42",
  // C row
  "C07","C13","C19","C25","C31","C37","C43",
  // D row (ends at D39)
  "D07","D13","D19","D25","D31","D37",
  // E row (ends at E39)
  "E07","E13","E19","E25","E31","E37",
  // F row
  "F07","F13","F19","F25","F31","F37","F43",
  // G row
  "G07","G13","G19","G25","G31","G37","G43",
  // H / HH shared tunnel: HM03 replaces the H07/HH07 slot, then side bins continue every 6
  "HM03","H09","H15","H21","H27","H33","H39",
  "HH09","HH15","HH21","HH27","HH33","HH39",
  // I row
  "I07","I13","I19","I25","I31","I37","I43",
  // II row
  "II07","II13","II19","II25","II31","II37","II43",
]);

export function baseCapacity(bin) {
  const key = normBin(bin);
  if (!key) return 0;
  if (Object.prototype.hasOwnProperty.call(BIN_CAPACITY, key)) {
    return BIN_CAPACITY[key];
  }
  return 20;
}

export function effectiveCapacity(bin, binState = {}, overrides = {}) {
  const key = normBin(bin);
  if (key && Object.prototype.hasOwnProperty.call(overrides, key)) {
    return overrides[key];
  }
  return baseCapacity(bin);
}
