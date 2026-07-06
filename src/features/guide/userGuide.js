const USER_GUIDE = `
FloorAgent – User Guide
What this tool does
This app reads a standard SAP bin export and produces a consolidation move list designed to free bins while respecting hard physical and business rules (paired tunnel capacity, no-mix, restricted types, R-bin segregation, etc.). It also includes a Putaway Finder to recommend a destination bin for incoming material.
1) Generating the SAP Export (LX03)
Before loading the app, you need to pull the bin report from SAP.
Step 1 — Open SAP and run transaction LX03 (Bin Status Report).
Step 2 — Set Plant: 076.
Step 3 — Set Storage Type from: 110 and to: 111. This captures all regular and mixed-material bins that are eligible for movement throughout the warehouse. Leave all other fields blank.
Step 4 — Execute the report.
Step 5 — Press Shift + F4 to save the report as a spreadsheet in .xlsx format. Overwrite the previous saved file every time so the app always reads the most current data and doesn't get confused by multiple versions.
2) Loading into FloorAgent
Step 1 — Open FloorAgent.
Step 2 — Click Upload from the home screen.
Step 3 — Select the saved .xlsx file and click Open.
Step 4 — The consolidation move list generates automatically. No additional steps needed.
Step 5 — If you change any settings after loading, click Rebuild — no need to re-upload the file.
Required columns in the export: Storage Bin, Material, Material Description, Available stock, Storage Type. Empty indicator column is optional but supported.
A row is treated as empty if Available stock = 0 or Empty indicator = X.
3) Scope Controls
Warehouse selector:
- WH1: bins that start with A–J and do not include "R"
- WH2: any bin containing "R" anywhere, plus bins starting with 2A
- WH3: bins starting with 3
- ALL: everything
Exclude bins with "R":
When enabled, any bin with R anywhere in the bin string is excluded from stock rows, empty-bin candidates, and targets/sources.
4) Consolidation Settings
ABC Threshold (PAL)
Phase 1 sources: Only bins in rows A / B / C. Any material quantity in a bin <= ABC Threshold becomes eligible to move out.
Protect A/B/C rows (never target):
When ON (default), rows A, B, and C are never used as consolidation targets — they are kept clear for production line putaway. Turn this OFF only if you need to temporarily allow consolidation into those rows.
Phase 2:
When enabled, Phase 2 sources apply to all rows. Any material quantity in a bin <= Phase 2 Threshold becomes eligible as a source.
5) Move Workflow
Selecting a move:
Click any pending move row to select it. The row highlights blue and a confirmation bar appears below it.
Confirming a move:
Click "Confirm Done" in the confirmation bar to mark the move as completed. The row turns green. This two-step process prevents accidental marks on the floor.
Canceling a selection:
Click "Cancel" in the confirmation bar, or click the row again, to deselect without marking done.
Undoing a completed move:
Click the undo icon on any completed (green) row to mark it back to pending.
Flagging a move as undoable:
Click the flag icon on any pending row, enter a reason, and submit. The move is excluded on the next rebuild.
6) Storage Type Rules and Toggles
Hard rule: 111 is never used as a source.
Type 110 (source toggle): If Source 110 is unchecked, type 110 bins will not be used as sources.
Target 110 / 111: Controls whether those types can receive material.
7) Rules That Are Always Enforced
A) HARD NO-MIX (global)
- Non-empty targets only receive the same material already in the bin.
- Empty targets may receive any material (subject to type, scope, segregation, and capacity).
B) A/B/C row protection (toggleable)
By default, rows A, B, and C are never used as consolidation targets. They are kept clear for production line putaway. Can be disabled in Settings if needed.
C) Side bins are never used as targets
Side bin positions can be sourced from but never receive material during consolidation.
D) Empty bin net-positive rule
Empty bins are only consumed when 2 or more single-material source bins can be combined into one, netting freed bins.
E) R-bin segregation
R-bins and non-R bins never share the same material during consolidation or putaway.
8) Capacity Engine (How "Free Space" is Calculated)
Capacity is dynamic. Many rows are paired as shared tunnels, so space depends on occupancy across the pair.
Standalone rows:
- A: 43 standard, 16 side bins
- J: 19
Paired tunnels:
- B <-> C, D <-> E: shared tunnel behavior
- F <-> G: shared tunnel behavior
- I <-> II: shared tunnel behavior (asymmetric max per side)
- H <-> HH: special behavior
9) Putaway Finder
Use this for inbound receiving. Enter a material number (or a partial match), optional PAL requirement, and run Search Optimal Bin.
The result prioritizes existing bins with the same material (no-mix), then empty bins that match the segregation and type rules.
10) Exporting
Use Export Route Slips to download the full move list as an Excel file.
Use Printable Move List to open a clean print-ready window that can be printed or saved as PDF.
`.trim();

export default USER_GUIDE;
