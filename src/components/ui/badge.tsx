import * as React from "react";
import { cn } from "@/lib/utils";

type BadgeVariant = "default" | "outline" | "secondary" | "console" | "success" | "warning";

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-ppBlue-600 text-white",
  outline: "border border-steel-600/50 bg-steel-800/60 text-slate-300",
  secondary: "bg-steel-700 text-slate-300",
  console: "border border-ppBlue-500/30 bg-ppBlue-900/40 text-ppBlue-300",
  success: "border border-success-500/30 bg-success-500/15 text-success-400",
  warning: "border border-forge-500/30 bg-forge-500/15 text-forge-400"
};

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: BadgeVariant;
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors",
        variantClasses[variant],
        className
      )}
      {...props}
    />
  );
}
