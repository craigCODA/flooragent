import React, { useEffect, useState } from "react";
import { MessageSquare, X, Bug, Star, CheckCircle, Loader2, Send } from "lucide-react";

const FORMSPREE_ENDPOINT = "https://formspree.io/f/mnjbjvjg";

export default function FeedbackSystem({ isOpen, onClose, appContext = {} }) {
  const [type, setType] = useState("BUG");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("IDLE");

  useEffect(() => {
    if (!isOpen) return;
    setStatus("IDLE");
    setType("BUG");
    setMessage("");
  }, [isOpen]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!message.trim()) return;
    setStatus("SUBMITTING");
    const payload = {
      feedback_type: type,
      message: message.trim(),
      warehouse_scope: appContext.warehouse ?? "N/A",
      exclude_r: appContext.excludeRbins ? "YES" : "NO",
      threshold_mode: appContext.thresholdMode ?? "absolute",
      global_threshold: appContext.globalThreshold ?? "N/A",
      allow_src_110: appContext.allowSrc110 ? "YES" : "NO",
      allow_tgt_110: appContext.allowTgt110 ? "YES" : "NO",
      allow_tgt_111: appContext.allowTgt111 ? "YES" : "NO",
      moves_count: appContext.movesCount ?? 0,
      app_version: appContext.appVersion ?? "N/A",
      submitted_at: new Date().toISOString(),
    };

    try {
      const res = await fetch(FORMSPREE_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setStatus("SUCCEEDED");
        setMessage("");
      } else {
        setStatus("ERROR");
      }
    } catch {
      setStatus("ERROR");
    }
  }

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/70 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-steel-900 rounded-xl w-full max-w-lg overflow-hidden border border-steel-700/50 shadow-2xl">
        <div className="p-5 border-b border-steel-700/40 flex justify-between items-center bg-[#0c1320]">
          <div className="flex items-center gap-3 text-left">
            <div className="h-9 w-9 rounded-lg bg-ppBlue-600 flex items-center justify-center text-white">
              <MessageSquare size={18} />
            </div>
            <div>
              <div className="font-bold text-base tracking-tight text-slate-100">Software Support</div>
              <div className="text-[10px] text-steel-400 font-medium uppercase tracking-wider">
                Sends a report to the developer
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-steel-800 rounded-lg transition-colors text-steel-500 hover:text-slate-200"
            aria-label="Close"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-5 space-y-4">
          {status === "SUCCEEDED" ? (
            <div className="py-8 text-center space-y-3">
              <div className="h-14 w-14 bg-emerald-500/15 text-emerald-400 rounded-full flex items-center justify-center mx-auto border border-emerald-500/30">
                <CheckCircle size={28} />
              </div>
              <div className="font-bold text-emerald-400 text-lg">Message sent</div>
              <p className="text-sm text-emerald-500 font-medium">Thanks — I'll review this.</p>
              <button
                onClick={onClose}
                className="mt-2 px-5 py-2 bg-emerald-600 text-white rounded-lg font-semibold text-sm shadow-sm hover:bg-emerald-500 transition-colors"
              >
                Back to Optimizer
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 text-left">
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setType("BUG")}
                  className={`py-2.5 rounded-lg font-semibold text-[10px] border transition-colors flex items-center justify-center gap-2 ${
                    type === "BUG"
                      ? "bg-danger-500/10 border-danger-500/30 text-danger-400"
                      : "bg-steel-800 border-steel-700/40 text-steel-500"
                  }`}
                >
                  <Bug size={13} /> REPORT A BUG
                </button>
                <button
                  type="button"
                  onClick={() => setType("FEATURE")}
                  className={`py-2.5 rounded-lg font-semibold text-[10px] border transition-colors flex items-center justify-center gap-2 ${
                    type === "FEATURE"
                      ? "bg-ppBlue-500/10 border-ppBlue-500/30 text-ppBlue-400"
                      : "bg-steel-800 border-steel-700/40 text-steel-500"
                  }`}
                >
                  <Star size={13} /> SUGGEST FEATURE
                </button>
              </div>
              <div>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  required
                  placeholder={type === "BUG" ? "What went wrong?" : "What should be added or improved?"}
                  className="w-full h-36 p-4 rounded-lg border border-steel-600/50 bg-steel-800 font-medium text-sm outline-none focus:ring-2 focus:ring-ppBlue-500/30 transition resize-none text-slate-200 placeholder:text-steel-500"
                />
              </div>
              {status === "ERROR" && (
                <p className="text-xs text-danger-400 font-medium bg-danger-500/10 p-2 rounded-lg border border-danger-500/30">
                  There was an error sending your message. Please try again.
                </p>
              )}
              <button
                type="submit"
                disabled={status === "SUBMITTING" || !message.trim()}
                className="w-full py-3 rounded-lg bg-ppBlue-600 text-white font-semibold hover:bg-ppBlue-500 disabled:opacity-30 transition-colors shadow-[0_4px_20px_rgba(54,104,252,0.25)] flex items-center justify-center gap-2"
              >
                {status === "SUBMITTING" ? (
                  <>
                    <Loader2 className="animate-spin" size={16} /> Sending...
                  </>
                ) : (
                  <>
                    <Send size={16} /> Send to Developer
                  </>
                )}
              </button>
              <p className="text-[10px] text-center text-steel-500 font-medium uppercase tracking-wider leading-relaxed">
                Included: WH {appContext.warehouse ?? "WH1"} · Moves{" "}
                {appContext.movesCount ?? 0}
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
