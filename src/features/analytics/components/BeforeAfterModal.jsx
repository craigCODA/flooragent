import { X } from "lucide-react";

export default function BeforeAfterModal({ isOpen, onClose, initialBinState, finalBinState, freedBins, parseBin }) {
  if (!isOpen) return null;

  const allBins = Array.from(
    new Set([...(Object.keys(initialBinState || {})), ...(Object.keys(finalBinState || {}))])
  ).sort();

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-steel-900 rounded-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-steel-700/50">
        <div className="p-5 border-b border-steel-700/40 flex items-center justify-between">
          <div>
            <div className="font-bold text-lg text-slate-100">Warehouse State Comparison</div>
            <div className="text-sm text-steel-400 mt-0.5">Before vs After Consolidation</div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-steel-800 rounded-lg transition-colors text-steel-500 hover:text-slate-200" aria-label="Close">
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-auto p-5">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#111b2b] sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-[10px] uppercase text-steel-400 tracking-wider">Bin</th>
                  <th className="px-4 py-3 text-left font-semibold text-[10px] uppercase text-steel-400 tracking-wider">Row</th>
                  <th className="px-4 py-3 text-right font-semibold text-[10px] uppercase text-steel-400 tracking-wider border-l-2 border-steel-700/40">Before Qty</th>
                  <th className="px-4 py-3 text-right font-semibold text-[10px] uppercase text-steel-400 tracking-wider">Before Mats</th>
                  <th className="px-4 py-3 text-right font-semibold text-[10px] uppercase text-steel-400 tracking-wider border-l-2 border-steel-700/40">After Qty</th>
                  <th className="px-4 py-3 text-right font-semibold text-[10px] uppercase text-steel-400 tracking-wider">After Mats</th>
                  <th className="px-4 py-3 text-center font-semibold text-[10px] uppercase text-steel-400 tracking-wider border-l-2 border-steel-700/40">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-steel-800/40">
                {allBins.map((binId) => {
                  const before = initialBinState?.[binId];
                  const after = finalBinState?.[binId];
                  const wasFreed = (freedBins || []).includes(binId);
                  if (!before && !after) return null;

                  const beforeQty = before?.totalQty || 0;
                  const afterQty = after?.totalQty || 0;
                  const beforeMats = before?.materials?.size || 0;
                  const afterMats = after?.materials?.size || 0;

                  let status = "UNCHANGED";
                  let statusColor = "bg-steel-800 text-steel-500";
                  if (wasFreed) { status = "FREED"; statusColor = "bg-emerald-500/15 text-emerald-400"; }
                  else if (afterQty > beforeQty) { status = "RECEIVED"; statusColor = "bg-ppBlue-500/15 text-ppBlue-400"; }
                  else if (afterQty < beforeQty) { status = "EMPTIED"; statusColor = "bg-forge-500/15 text-forge-400"; }
                  else if (afterQty === 0 && beforeQty === 0) { status = "EMPTY"; statusColor = "bg-steel-800/50 text-steel-600"; }

                  return (
                    <tr key={binId} className={wasFreed ? "bg-emerald-500/5" : ""}>
                      <td className="px-4 py-2 font-mono font-medium text-xs text-slate-200">{binId}</td>
                      <td className="px-4 py-2 text-steel-400">{parseBin(binId).rowKey}</td>
                      <td className="px-4 py-2 text-right tabular-nums border-l-2 border-steel-800/40 font-medium text-slate-300">{beforeQty > 0 ? beforeQty.toFixed(1) : "\u2014"}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-steel-500">{beforeMats || "\u2014"}</td>
                      <td className="px-4 py-2 text-right tabular-nums border-l-2 border-steel-800/40 font-medium text-slate-300">{afterQty > 0 ? afterQty.toFixed(1) : "\u2014"}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-steel-500">{afterMats || "\u2014"}</td>
                      <td className="px-4 py-2 text-center border-l-2 border-steel-800/40">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${statusColor}`}>{status}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        <div className="p-4 border-t border-steel-700/40 bg-[#0c1320] flex justify-end">
          <button onClick={onClose} className="px-5 py-2 rounded-lg border border-steel-600/50 font-semibold text-sm text-slate-300 hover:bg-steel-800 transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
