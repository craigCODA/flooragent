Recorded partial custom space-maker carryover from the original repo:

- File changed: `src/domain/planning.js`
- Purpose: begin engine support for targeted space-making goals
- Recorded behavior added in this clone:
  - accept `customEmptyByRow` and `customEmptyBins` planner inputs
  - prioritize candidates that empty explicit target bins first
  - then prioritize candidates that satisfy requested row-level empty counts
  - allow targeted source bins to bypass normal source-row and qty-threshold limits
  - stop the planning loop once all requested custom goals are satisfied

This is only the recorded planner edit that had been started before the revert in the original checkout.
