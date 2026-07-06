import * as React from "react";
import { cn } from "@/lib/utils";

type CardVariant = "default" | "paper" | "console" | "muted";

const cardClasses: Record<CardVariant, string> = {
  default: "rounded-2xl border border-steel-700/50 bg-steel-900 text-slate-200 shadow-industrial",
  paper: "rounded-[24px] border border-steel-700/40 bg-steel-900/80 text-slate-200 shadow-[0_14px_34px_rgba(0,0,0,0.3)]",
  console: "rounded-[24px] border border-ppBlue-800/50 bg-[#0a1628] text-slate-100 shadow-[0_18px_40px_rgba(0,0,0,0.4)]",
  muted: "rounded-[24px] border border-steel-700/30 bg-steel-800/50 text-slate-200 shadow-[0_10px_24px_rgba(0,0,0,0.2)]"
};

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = "default", ...props }, ref) => (
    <div ref={ref} className={cn(cardClasses[variant], className)} {...props} />
  )
);
Card.displayName = "Card";

export const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn("flex flex-col space-y-1.5 p-5", className)} {...props} />
);
CardHeader.displayName = "CardHeader";

export const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => <h3 ref={ref} className={cn("font-semibold leading-none tracking-tight", className)} {...props} />
);
CardTitle.displayName = "CardTitle";

export const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn("p-5 pt-0", className)} {...props} />
);
CardContent.displayName = "CardContent";
