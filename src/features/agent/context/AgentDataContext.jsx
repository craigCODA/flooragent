import { createContext } from "react";

export const AgentDataContext = createContext({
  stockRows: [],
  binState: {},
  capOverrides: {},
  disabledBins: new Set(),
  emptyBinsFromExport: new Set(),
  emptyBinTypes: {},
  moves: [],
  completed: new Set(),
  analytics: null,
  warehouse: "WH1",
  allowTgt110: true,
  allowTgt111: true,
  lineBins: [],
  onProximityMovesReady: null,
  onProductionPlanApply: null,
});

export function AgentDataProvider({ value, children }) {
  return (
    <AgentDataContext.Provider value={value}>
      {children}
    </AgentDataContext.Provider>
  );
}
