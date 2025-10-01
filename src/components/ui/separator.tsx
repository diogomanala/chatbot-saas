"use client"

import * as React from "react"

interface SeparatorProps {
  className?: string;
  orientation?: "horizontal" | "vertical";
}

const Separator = React.forwardRef<HTMLDivElement, SeparatorProps>(
  ({ className = "", orientation = "horizontal", ...props }, ref) => {
    const baseClasses = "shrink-0 bg-gray-200 dark:bg-gray-700";
    const orientationClasses = orientation === "horizontal" 
      ? "h-[1px] w-full" 
      : "h-full w-[1px]";
    
    return (
      <div
        ref={ref}
        className={`${baseClasses} ${orientationClasses} ${className}`}
        {...props}
      />
    );
  }
);

Separator.displayName = "Separator";

export { Separator };