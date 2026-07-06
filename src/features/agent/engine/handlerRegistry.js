import { handleHelp } from "./handlers/help";
import { handleBinInfo } from "./handlers/binInfo";
import { handlePutaway } from "./handlers/putaway";
import { handleCapacityQuery } from "./handlers/capacityQuery";
import { handleMaterialLookup } from "./handlers/materialLookup";
import { handleRuleExplanation } from "./handlers/ruleExplanation";
import { handleTunnelPair } from "./handlers/tunnelPair";
import { handleRowInfo } from "./handlers/rowInfo";
import { handleSideBin } from "./handlers/sideBin";
import { handleWarehouseScope } from "./handlers/warehouseScope";
import { handleMoveExplanation } from "./handlers/moveExplanation";
import { handleProximityOrganize } from "./handlers/proximityOrganize";
import { handleScatterAnalysis } from "./handlers/scatterAnalysis";
import { handleEmptyBins } from "./handlers/emptyBins";
import { handleProductionPlan } from "./handlers/productionPlan";

const HANDLERS = {
  help: handleHelp,
  binInfo: handleBinInfo,
  putaway: handlePutaway,
  capacityQuery: handleCapacityQuery,
  materialLookup: handleMaterialLookup,
  ruleExplanation: handleRuleExplanation,
  tunnelPair: handleTunnelPair,
  rowInfo: handleRowInfo,
  sideBin: handleSideBin,
  warehouseScope: handleWarehouseScope,
  moveExplanation: handleMoveExplanation,
  proximityOrganize: handleProximityOrganize,
  scatterAnalysis: handleScatterAnalysis,
  emptyBins: handleEmptyBins,
  productionPlan: handleProductionPlan,
};

export function dispatch(intent, context) {
  const handler = HANDLERS[intent] || HANDLERS.help;
  try {
    return handler(context);
  } catch (err) {
    return {
      type: "error",
      text: `Something went wrong processing that request. (${err.message || "Unknown error"})`,
    };
  }
}
