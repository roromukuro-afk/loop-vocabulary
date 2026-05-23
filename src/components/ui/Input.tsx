import { cn } from "@/lib/utils/cn";
import { InputHTMLAttributes, TextareaHTMLAttributes, forwardRef } from "react";

const BASE =
  "w-full bg-white border border-navy-200 rounded-xl px-4 py-3 text-base " +
  "placeholder:text-navy-300 focus:outline-none focus:ring-2 focus:ring-navy-400 focus:border-transparent";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return <input ref={ref} className={cn(BASE, className)} {...rest} />;
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...rest }, ref) {
    return <textarea ref={ref} className={cn(BASE, "min-h-[88px]", className)} {...rest} />;
  },
);

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="text-sm font-semibold text-navy-700 mb-1.5">{label}</div>
      {children}
      {hint && <div className="text-xs text-navy-400 mt-1">{hint}</div>}
    </label>
  );
}
