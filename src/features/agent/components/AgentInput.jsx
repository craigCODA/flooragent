import React, { useState } from "react";
import { Send } from "lucide-react";

export function AgentInput({ onSend }) {
  const [value, setValue] = useState("");

  function handleSubmit(e) {
    e.preventDefault();
    const text = value.trim();
    if (!text) return;
    onSend(text);
    setValue("");
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 p-3 border-t border-steel-700/40 bg-[#0c1320]">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Ask about a bin, material, or rule..."
        className="flex-1 rounded-xl border border-steel-600/50 bg-steel-800 px-3 py-2 text-sm font-semibold text-slate-200 outline-none focus:ring-2 focus:ring-ppBlue-500/40 transition placeholder:text-steel-500"
      />
      <button
        type="submit"
        disabled={!value.trim()}
        className="rounded-xl bg-ppBlue-600 text-white p-2.5 hover:bg-ppBlue-500 disabled:opacity-30 transition"
        aria-label="Send"
      >
        <Send size={16} />
      </button>
    </form>
  );
}
