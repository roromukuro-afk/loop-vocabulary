import { cn } from "@/lib/utils/cn";
import { HTMLAttributes } from "react";

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "bg-white rounded-2xl shadow-card border border-navy-100 p-5",
        className,
      )}
      {...rest}
    />
  );
}

export function CardTitle({ className, ...rest }: HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn("text-lg font-bold text-navy-800 mb-3", className)} {...rest} />;
}

export function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-navy-100 p-4 shadow-card">
      <div className="text-xs text-navy-500">{label}</div>
      <div className="text-2xl font-bold text-navy-800 mt-1">{value}</div>
      {hint && <div className="text-xs text-navy-400 mt-1">{hint}</div>}
    </div>
  );
}
