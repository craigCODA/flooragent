import * as React from "react";
import { cn } from "@/lib/utils";

type InputVariant = "default" | "paper";

const inputClasses: Record<InputVariant, string> = {
  default: "flex h-10 w-full rounded-xl border border-steel-600/60 bg-steel-900/80 px-3 py-2 text-sm text-slate-200 outline-none transition placeholder:text-steel-500 focus:border-ppBlue-500 focus:ring-2 focus:ring-ppBlue-500/30",
  paper: "flex h-11 w-full rounded-2xl border border-steel-600/50 bg-steel-800/60 px-4 py-3 text-sm text-slate-200 outline-none transition placeholder:text-steel-500 focus:border-ppBlue-500 focus:ring-2 focus:ring-ppBlue-500/30"
};

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  variant?: InputVariant;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, variant = "default", ...props }, ref) => (
    <input
      ref={ref}
      className={cn(inputClasses[variant], className)}
      {...props}
    />
  )
);
Input.displayName = "Input";
