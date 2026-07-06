import React, { useEffect, useRef } from "react";
import { MessageBubble } from "./MessageBubble";

export function MessageList({ messages, onSelect, onAction }) {
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 text-center">
        <div className="space-y-2">
          <div className="text-steel-400 font-semibold text-sm">No messages yet</div>
          <div className="text-steel-500 text-xs">
            Try &quot;help&quot; or ask about a bin, material, or rule
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#0b1120]">
      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} onSelect={onSelect} onAction={onAction} />
      ))}
      <div ref={endRef} />
    </div>
  );
}
