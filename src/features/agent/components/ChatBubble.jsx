import React, { useState, useRef, useCallback, useEffect } from "react";
import { MessageSquare, X, Trash2, GripVertical } from "lucide-react";
import { MessageList } from "./MessageList";
import { AgentInput } from "./AgentInput";
import { useAgentChat } from "../hooks/useAgentChat";

const MIN_W = 320;
const MIN_H = 360;
const DEFAULT_W = 384;
const DEFAULT_H = 520;

export function ChatBubble() {
  const [open, setOpen] = useState(false);
  const { messages, sendMessage, clearMessages, selectOption, selectAction } = useAgentChat();
  const hasMessages = messages.length > 0;

  // Position & size state — default to bottom-right corner
  const [pos, setPos] = useState(() => ({
    x: window.innerWidth - DEFAULT_W - 24,
    y: window.innerHeight - DEFAULT_H - 24,
  }));
  const [size, setSize] = useState({ w: DEFAULT_W, h: DEFAULT_H });

  // Refs for drag / resize tracking
  const dragRef = useRef(null);
  const resizeRef = useRef(null);
  const containerRef = useRef(null);

  // ── Drag (header) ────────────────────────────────────────────────────
  const onDragStart = useCallback((e) => {
    // Ignore if clicking a button inside the header
    if (e.target.closest("button")) return;
    e.preventDefault();
    dragRef.current = { startX: e.clientX - pos.x, startY: e.clientY - pos.y };
  }, [pos.x, pos.y]);

  // ── Resize (corner handle) ──────────────────────────────────────────
  const onResizeStart = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    resizeRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startW: size.w,
      startH: size.h,
      startPosX: pos.x,
      startPosY: pos.y,
    };
  }, [size.w, size.h, pos.x, pos.y]);

  useEffect(() => {
    const onMouseMove = (e) => {
      if (dragRef.current) {
        const nx = Math.max(0, Math.min(e.clientX - dragRef.current.startX, window.innerWidth - size.w));
        const ny = Math.max(0, Math.min(e.clientY - dragRef.current.startY, window.innerHeight - size.h));
        setPos({ x: nx, y: ny });
      }
      if (resizeRef.current) {
        const r = resizeRef.current;
        // Resize from top-left corner: mouse moves left → wider, mouse moves up → taller
        const dw = r.startX - e.clientX;
        const dh = r.startY - e.clientY;
        const newW = Math.max(MIN_W, Math.min(r.startW + dw, r.startPosX + r.startW));
        const newH = Math.max(MIN_H, Math.min(r.startH + dh, r.startPosY + r.startH));
        // Shift position so the bottom-right corner stays fixed
        setSize({ w: newW, h: newH });
        setPos({
          x: r.startPosX + (r.startW - newW),
          y: r.startPosY + (r.startH - newH),
        });
      }
    };
    const onMouseUp = () => {
      dragRef.current = null;
      resizeRef.current = null;
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [size.w, size.h]);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-[90] h-[52px] w-[52px] rounded-full bg-ppBlue-600 text-white shadow-[0_4px_24px_rgba(54,104,252,0.4)] hover:bg-ppBlue-500 transition-all flex items-center justify-center border border-ppBlue-500/50"
        aria-label="Open Floor Assistant"
        title="Floor Assistant"
      >
        <MessageSquare size={22} />
        {hasMessages && (
          <span className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-forge-400 border-2 border-steel-950 animate-pulse" />
        )}
      </button>
    );
  }

  return (
    <div
      ref={containerRef}
      className="fixed z-[90] rounded-[24px] bg-steel-900 border border-steel-700/50 shadow-[0_24px_60px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden"
      style={{ left: pos.x, top: pos.y, width: size.w, height: size.h }}
    >
      {/* Resize handle — top-left corner */}
      <div
        onMouseDown={onResizeStart}
        className="absolute top-0 left-0 w-5 h-5 cursor-nw-resize z-10 flex items-center justify-center"
        title="Resize"
      >
        <GripVertical size={10} className="text-steel-600 -rotate-45" />
      </div>
      {/* Header — draggable */}
      <div
        onMouseDown={onDragStart}
        className="bg-gradient-to-r from-[#0a1628] to-[#0f1f3d] text-slate-100 px-5 py-3.5 flex items-center justify-between shrink-0 cursor-move select-none"
      >
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-lg bg-ppBlue-600/30 flex items-center justify-center border border-ppBlue-500/30">
            <MessageSquare size={15} className="text-ppBlue-400" />
          </div>
          <div>
            <div className="font-bold text-sm tracking-tight">Floor Assistant</div>
            <div className="text-[9px] text-steel-400 font-semibold uppercase tracking-widest">
              Ask about bins, materials &amp; rules
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {hasMessages && (
            <button
              onClick={clearMessages}
              className="p-1.5 rounded-lg hover:bg-white/10 transition text-steel-500 hover:text-slate-200"
              aria-label="Clear messages"
              title="Clear chat"
            >
              <Trash2 size={14} />
            </button>
          )}
          <button
            onClick={() => setOpen(false)}
            className="p-1.5 rounded-lg hover:bg-white/10 transition text-steel-500 hover:text-slate-200"
            aria-label="Close"
            title="Minimize"
          >
            <X size={16} />
          </button>
        </div>
      </div>
      {/* Safety yellow accent stripe */}
      <div
        className="h-[3px] w-full shrink-0"
        style={{
          background: "repeating-linear-gradient(-45deg, #eab308, #eab308 6px, #0b1120 6px, #0b1120 12px)",
        }}
      />
      {/* Messages */}
      <MessageList messages={messages} onSelect={selectOption} onAction={selectAction} />
      {/* Input */}
      <AgentInput onSend={sendMessage} />
    </div>
  );
}
