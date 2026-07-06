import * as React from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "default" | "outline" | "secondary" | "console" | "accent" | "ghost-light" | "danger-soft";
type ButtonSize = "default" | "sm" | "lg";

const variantClasses: Record<ButtonVariant, string> = {
  default: "bg-ppBlue-600 text-white hover:bg-ppBlue-500 border border-ppBlue-500/50 shadow-[0_4px_20px_rgba(54,104,252,0.25)]",
  outline: "border border-steel-600 bg-steel-800/60 text-slate-200 hover:bg-steel-700 hover:border-steel-500",
  secondary: "bg-steel-800 text-slate-200 border border-steel-600/50 hover:bg-steel-700",
  console: "border border-steel-600/50 bg-steel-900 text-slate-200 hover:bg-steel-800 shadow-[0_8px_24px_rgba(0,0,0,0.3)]",
  accent: "border border-forge-500/50 bg-gradient-to-r from-forge-500 to-forge-600 text-steel-950 font-bold hover:from-forge-400 hover:to-forge-500 shadow-[0_8px_24px_rgba(234,179,8,0.25)]",
  "ghost-light": "border border-steel-600/30 bg-transparent text-steel-300 hover:bg-steel-800/50 hover:text-slate-200",
  "danger-soft": "border border-danger-500/30 bg-danger-500/10 text-danger-400 hover:bg-danger-500/20"
};

const sizeClasses: Record<ButtonSize, string> = {
  default: "h-10 px-4 py-2",
  sm: "h-9 rounded-xl px-3",
  lg: "h-11 px-5 py-2.5"
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-2xl text-sm font-semibold transition-all duration-200 disabled:pointer-events-none disabled:opacity-50",
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      {...props}
    />
  )
);
Button.displayName = "Button";
