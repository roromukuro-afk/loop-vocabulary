import { cn } from "@/lib/utils/cn";
import { SelectHTMLAttributes, forwardRef } from "react";

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, ...rest }, ref) {
    return (
      <select
        ref={ref}
        className={cn(
          "w-full bg-white border border-navy-200 rounded-xl px-3 py-3 text-base",
          "focus:outline-none focus:ring-2 focus:ring-navy-400",
          className,
        )}
        {...rest}
      />
    );
  },
);
