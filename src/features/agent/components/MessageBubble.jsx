import React from "react";

export function MessageBubble({ message, onSelect, onAction }) {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-ppBlue-600 text-white px-4 py-2.5 text-sm font-semibold">
          {message.text}
        </div>
      </div>
    );
  }

  const isError = message.type === "error";
  const bgClass = isError
    ? "bg-danger-500/10 border-danger-500/30"
    : "bg-steel-800/80 border-steel-700/40";

  return (
    <div className="flex justify-start">
      <div className={`max-w-[90%] rounded-2xl rounded-bl-md border ${bgClass} px-4 py-3 text-sm space-y-2`}>
        {message.highlight && (
          <span className="inline-block bg-forge-500/15 text-forge-400 font-bold text-xs px-2 py-0.5 rounded-lg mb-1 border border-forge-500/30">
            {message.highlight}
          </span>
        )}

        {message.text && (
          <div className={`font-semibold leading-relaxed ${isError ? "text-danger-400" : "text-slate-200"}`}>
            <BoldText text={message.text} />
          </div>
        )}

        {message.items && message.items.length > 0 && (
          <ul className="space-y-1 pl-1">
            {message.items.map((item, i) => (
              <li key={i} className="flex gap-2 text-steel-300">
                <span className="text-forge-500 font-bold mt-0.5">&#8250;</span>
                <span><BoldText text={item} /></span>
              </li>
            ))}
          </ul>
        )}

        {message.table && (
          <div className="overflow-x-auto mt-2">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-steel-900/80">
                  {message.table.headers.map((h, i) => (
                    <th key={i} className="px-2 py-1.5 text-left font-bold text-steel-400 uppercase tracking-wider text-[10px] border-b border-steel-700/40">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {message.table.rows.map((row, ri) => (
                  <tr key={ri} className="border-b border-steel-800/40 last:border-0">
                    {message.table.headers.map((h, ci) => (
                      <td key={ci} className="px-2 py-1.5 text-slate-300 font-mono font-semibold">
                        {row[h] ?? "\u2014"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Option buttons (aisle selection, etc.) */}
        {message.options && message.options.length > 0 && (
          <div className="space-y-2 mt-3">
            {message.options.map((opt) => (
              <button
                key={opt.id}
                onClick={() => onSelect && onSelect(opt.id)}
                className="w-full text-left px-3 py-2.5 rounded-xl border border-steel-600/50 bg-steel-800/50 hover:bg-ppBlue-600/10 hover:border-ppBlue-500/30 transition-colors text-sm font-medium text-slate-300 flex items-center justify-between gap-2"
              >
                <span>{opt.label}</span>
                {opt.badge && (
                  <span className="inline-block bg-forge-500/15 text-forge-400 font-bold text-[10px] px-2 py-0.5 rounded-lg shrink-0 border border-forge-500/30">
                    {opt.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Action buttons (confirm / tweak / cancel) */}
        {message.actions && message.actions.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {message.actions.map((act) => {
              const variant = act.variant || "secondary";
              const cls =
                variant === "primary"
                  ? "bg-ppBlue-600 text-white hover:bg-ppBlue-500 border-ppBlue-500/50"
                  : variant === "ghost"
                  ? "bg-transparent text-steel-500 hover:text-slate-200 hover:bg-steel-800 border-transparent"
                  : "bg-steel-800 text-slate-300 hover:bg-steel-700 border-steel-600/50";
              return (
                <button
                  key={act.id}
                  onClick={() => onAction && onAction(act.id)}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors ${cls}`}
                >
                  {act.label}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function BoldText({ text }) {
  if (!text) return null;
  const parts = String(text).split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return <strong key={i} className="font-bold">{part.slice(2, -2)}</strong>;
        }
        return part.split("\n").map((line, li, arr) => (
          <React.Fragment key={`${i}-${li}`}>
            {line}
            {li < arr.length - 1 && <br />}
          </React.Fragment>
        ));
      })}
    </>
  );
}
