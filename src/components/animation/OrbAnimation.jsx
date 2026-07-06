import React, { useEffect, useState } from "react";

export default function OrbAnimation({ fromRect, toRect, onComplete }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      onComplete?.();
    }, 650);
    return () => clearTimeout(timer);
  }, [onComplete]);

  if (!visible || !fromRect || !toRect) return null;

  const startX = fromRect.left + fromRect.width / 2;
  const startY = fromRect.top + fromRect.height / 2;
  const endX = toRect.left + toRect.width / 2;
  const endY = toRect.top + toRect.height / 2;

  return (
    <div className="fixed inset-0 z-[200] pointer-events-none">
      <div
        className="absolute w-4 h-4 rounded-full"
        style={{
          left: startX,
          top: startY,
          background: "radial-gradient(circle, #5c8aff, #3668fc)",
          boxShadow: "0 0 24px 8px rgba(54,104,252,0.6), 0 0 48px 16px rgba(54,104,252,0.3)",
          animation: "orbFlyPath 0.6s cubic-bezier(0.4, 0, 0.2, 1) forwards",
          offsetPath: `path("M ${startX} ${startY} Q ${(startX + endX) / 2} ${Math.min(startY, endY) - 60} ${endX} ${endY}")`,
          offsetDistance: "0%",
          animationName: "orbPath",
        }}
      />
      <style>{`
        @keyframes orbPath {
          0% {
            offset-distance: 0%;
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(1.4);
            opacity: 1;
          }
          100% {
            offset-distance: 100%;
            transform: scale(0.5);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
