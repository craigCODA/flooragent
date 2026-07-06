export default function SimpleBarChart({ data, title, color = "#3668fc" }) {
  if (!data || data.length === 0) return <div className="text-center text-steel-500 py-8 text-sm">No data</div>;

  const maxVal = Math.max(...data.map((d) => d.value));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="font-semibold text-sm text-steel-300 tracking-wide">{title}</div>
        <div className="text-xs text-steel-500 font-medium">Max: {maxVal}</div>
      </div>
      <div className="flex flex-col gap-3">
        {data.map((item, idx) => {
          const widthPct = maxVal > 0 ? (item.value / maxVal) * 100 : 0;
          const displayValue = typeof item.value === "number" && item.value % 1 !== 0 ? item.value.toFixed(1) : item.value;
          return (
            <div key={idx} className="group cursor-pointer">
              <div className="flex justify-between items-center text-xs mb-2">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full shadow-sm"
                    style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}40` }}
                  ></div>
                  <span className="font-semibold text-slate-300 group-hover:text-slate-100 transition-colors">{item.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-200 tabular-nums">{displayValue}</span>
                  <span className="text-steel-500 text-xs font-medium">{widthPct.toFixed(0)}%</span>
                </div>
              </div>
              <div className="relative w-full bg-steel-800 rounded-full h-6 overflow-hidden">
                <div
                  className="absolute top-0 left-0 h-full rounded-full transition-all duration-700 ease-out"
                  style={{
                    width: `${widthPct}%`,
                    backgroundColor: color,
                    boxShadow: `0 0 20px ${color}30`
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent pointer-events-none"></div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex justify-between items-center pt-2 border-t border-steel-700/40">
        <div className="text-xs text-steel-600 font-medium">Data visualization</div>
        <div className="flex items-center gap-1 text-xs text-steel-500">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }}></div>
          <span>Key metric</span>
        </div>
      </div>
    </div>
  );
}
