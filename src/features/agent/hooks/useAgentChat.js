import { useState, useCallback, useContext } from "react";
import { classifyIntent } from "../engine/intentEngine";
import { dispatch } from "../engine/handlerRegistry";
import { AgentDataContext } from "../context/AgentDataContext";
import { continueProximityWorkflow } from "../engine/handlers/proximityOrganize";
import { continueProductionPlanWorkflow } from "../engine/handlers/productionPlan";

let _msgId = 0;

function continueWorkflow(workflow, eventType, input, ctx) {
  switch (workflow.type) {
    case "productionPlan":
      return continueProductionPlanWorkflow(eventType, input, ctx, workflow.data);
    default:
      return continueProximityWorkflow(
        eventType === "optionSelected" || eventType === "actionSelected"
          ? eventType
          : workflow.step,
        input,
        ctx,
        workflow.data
      );
  }
}

export function useAgentChat() {
  const [messages, setMessages] = useState([]);
  const [workflow, setWorkflow] = useState(null);
  const data = useContext(AgentDataContext);

  const buildContext = useCallback(() => ({
    stockRows: data.stockRows,
    binState: data.binState,
    capOverrides: data.capOverrides,
    disabledBins: data.disabledBins,
    emptyBinsFromExport: data.emptyBinsFromExport,
    emptyBinTypes: data.emptyBinTypes,
    moves: data.moves,
    analytics: data.analytics,
    warehouse: data.warehouse,
    allowTgt110: data.allowTgt110,
    allowTgt111: data.allowTgt111,
    lineBins: data.lineBins,
    onProximityMovesReady: data.onProximityMovesReady,
    onProductionPlanApply: data.onProductionPlanApply,
  }), [data]);

  const applyWorkflowResponse = useCallback((response) => {
    if (response.endWorkflow) {
      setWorkflow(null);
    } else if (response.nextStep) {
      setWorkflow((prev) => ({
        ...prev,
        step: response.nextStep,
        data: { ...prev.data, ...response.workflowData },
      }));
    }
  }, []);

  const sendMessage = useCallback(
    (rawInput) => {
      const text = String(rawInput || "").trim();
      if (!text) return;

      const userMsg = { id: ++_msgId, role: "user", text };

      if (workflow) {
        const ctx = buildContext();
        const response = continueWorkflow(workflow, workflow.step, text, ctx);
        const agentMsg = { id: ++_msgId, role: "agent", ...response };
        setMessages((prev) => [...prev, userMsg, agentMsg]);
        applyWorkflowResponse(response);
        return;
      }

      const { intent, entities, rawInput: normalized } = classifyIntent(text);
      const context = { intent, entities, rawInput: normalized, ...buildContext() };
      const response = dispatch(intent, context);
      const agentMsg = { id: ++_msgId, role: "agent", ...response };
      setMessages((prev) => [...prev, userMsg, agentMsg]);

      if (response.startWorkflow) {
        setWorkflow({
          type: response.startWorkflow.type || "proximity",
          id: response.startWorkflow.id,
          step: response.startWorkflow.step,
          data: response.startWorkflow.data || {},
        });
      }
    },
    [data, workflow, buildContext, applyWorkflowResponse]
  );

  const selectOption = useCallback(
    (optionId) => {
      if (!workflow) return;
      const ctx = buildContext();
      const response = continueWorkflow(workflow, "optionSelected", optionId, ctx);
      const agentMsg = { id: ++_msgId, role: "agent", ...response };
      setMessages((prev) => [...prev, agentMsg]);
      applyWorkflowResponse(response);
    },
    [workflow, buildContext, applyWorkflowResponse]
  );

  const selectAction = useCallback(
    (actionId) => {
      if (!workflow) return;
      const ctx = buildContext();
      const response = continueWorkflow(workflow, "actionSelected", actionId, ctx);
      const agentMsg = { id: ++_msgId, role: "agent", ...response };
      setMessages((prev) => [...prev, agentMsg]);
      applyWorkflowResponse(response);
    },
    [workflow, buildContext, applyWorkflowResponse]
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
    setWorkflow(null);
  }, []);

  return { messages, sendMessage, clearMessages, selectOption, selectAction, workflow };
}
