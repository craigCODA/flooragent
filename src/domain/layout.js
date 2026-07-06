// ─── Warehouse Bin Layout ─────────────────────────────────────────────
// Authoritative set of every physical bin that exists on the warehouse map.
// If a bin ID is not in this set, it does not exist in the warehouse and
// should never participate in consolidation, putaway, or proximity plans.

function pad2(n) {
  return String(n).padStart(2, "0");
}

function makeRange(prefix, start, end) {
  const bins = [];
  for (let n = start; n <= end; n++) {
    bins.push(`${prefix}${pad2(n)}`);
  }
  return bins;
}

export const LAYOUT_BINS = [
  ...makeRange("A", 2, 47),
  // B row: special layout with BS bins between B03 and B05
  "B02", "B03", "BS3", "BS4", "BS5", "BS6", "BS7",
  "B05", "B06", "B07", "B08",
  ...makeRange("B", 9, 42),
  ...makeRange("C", 2, 46),
  ...makeRange("D", 2, 39),
  ...makeRange("E", 2, 39),
  ...makeRange("F", 2, 47),
  ...makeRange("G", 2, 47),
  ...makeRange("H", 2, 43),
  "HM01", "HM02", "HM03", "HM04",
  ...makeRange("HH", 2, 43),
  ...makeRange("II", 2, 47),
  ...makeRange("I", 2, 47),
  "J01",
  ...makeRange("J", 2, 43),
  // ─── WH3 bins (bins starting with "3") ─────────────────────────────
  // 3A row
  "3A01","3A02","3A03","3A04","3A05","3A06","3A07","3A08",
  "3A11","3A13","3A14","3A15","3A16","3A17","3A18","3A19",
  "3A20","3A21","3A22","3A23","3A24","3A25","3A26","3A27",
  "3A28","3A29","3A30","3A31","3A32","3A33","3A34","3A35","3A36","3A37",
  // 3B row (3B45S is an S-suffix quarantine shadow — kept in layout; engine excludes it as a target)
  "3B01","3B02","3B03","3B04","3B05","3B06","3B07","3B08",
  "3B09","3B10","3B11","3B12","3B13","3B14","3B15","3B16",
  "3B17","3B18","3B19","3B20","3B21","3B22","3B23","3B24",
  "3B25","3B26","3B27","3B28","3B29","3B30","3B31","3B32",
  "3B33","3B34","3B35","3B36","3B37","3B38","3B39","3B40",
  "3B41","3B42","3B43","3B44","3B45","3B45S",
  // 3C row
  "3C00","3C01","3C02","3C03","3C04","3C05","3C06","3C07",
  "3C08","3C09","3C10","3C11","3C12","3C13","3C14","3C15",
  "3C16","3C17","3C18","3C19","3C20","3C21","3C22","3C23",
  "3C24","3C25","3C26","3C27","3C28","3C29","3C30","3C31",
  "3C32","3C33","3C34","3C35","3C36","3C37","3C38","3C39",
  "3C40","3C41","3C42",
  // 3D row (3D17 exists physically; absent from export — capacity estimated from neighbors)
  "3D00","3D01","3D02","3D03","3D04","3D05","3D06","3D07",
  "3D08","3D09","3D10","3D11","3D12","3D13","3D14","3D15",
  "3D16","3D17","3D18","3D19","3D20","3D21","3D22","3D23","3D24",
  "3D25","3D26","3D27","3D28","3D29","3D30","3D31","3D32",
  "3D33","3D34","3D35","3D36",
  // 3E row
  "3E01","3E02","3E03","3E04","3E05","3E06","3E07","3E08",
  "3E09","3E10","3E11","3E12","3E13","3E14","3E15","3E16",
  "3E17","3E18","3E19","3E20","3E21","3E22","3E23","3E24",
  "3E25","3E26","3E27","3E28","3E29","3E30","3E31","3E32",
  "3E33","3E34","3E35","3E36","3E37","3E38","3E39","3E40",
  "3E41","3E42","3E43","3E44","3E45","3E46","3E47","3E48",
  "3E49","3E50","3E51","3E52","3E53","3E54","3E55","3E56",
  "3E57","3E58","3E59",
  // 3F row (3F21 exists physically; absent from export — capacity estimated from neighbors)
  "3F01","3F02","3F03","3F04","3F05","3F06","3F07","3F08",
  "3F09","3F10","3F11","3F12","3F13","3F14","3F15","3F16",
  "3F17","3F18","3F19","3F20","3F21","3F22","3F23","3F24","3F25",
  "3F26","3F27","3F28","3F29","3F30","3F31","3F32","3F33",
  "3F34","3F35","3F36","3F37","3F38","3F39","3F40","3F41",
  "3F42","3F43","3F44","3F45","3F46","3F47","3F48","3F49",
  "3F50","3F51","3F52","3F53","3F54","3F55","3F56","3F57",
  "3F58","3F59",
];

export const LAYOUT_BIN_SET = new Set(LAYOUT_BINS);
