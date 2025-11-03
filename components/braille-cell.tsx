"use client";

import { cn } from "@/lib/utils";
import { BrailleCell as BrailleCellType } from "@/lib/tamil-braille";

interface BrailleCellProps {
  cell: BrailleCellType;
  highlighted?: boolean;
  className?: string;
}

export function BrailleCell({ cell, highlighted = false, className }: BrailleCellProps) {
  const cellArr = [false, false, false, false, false, false];
  cell.dots.forEach(pos => {
    if (pos >= 1 && pos <= 6) cellArr[pos - 1] = true;
  });

  // Braille positions: 
  // 1(top-left), 2(middle-left), 3(bottom-left)
  // 4(top-right), 5(middle-right), 6(bottom-right)

  return (
    <div
      className={cn(
        "inline-flex items-center justify-center mx-0.5 relative transition-all duration-300 ease-in-out cursor-pointer group",
        highlighted && "bg-blue-100 dark:bg-blue-900/30 rounded-lg p-1 scale-110 shadow-lg z-10",
        !highlighted && "hover:bg-muted/50 hover:scale-105",
        className
      )}
      aria-label={`Braille cell for ${cell.tamilChar}`}
    >
      <div className={cn(
        "grid grid-cols-2 grid-rows-3 gap-0.5 w-8 h-11 p-1.5 border-2 rounded-md transition-all duration-300",
        highlighted 
          ? "border-blue-500 shadow-md gap-1" 
          : "border-border group-hover:border-primary/50"
      )}>
        {/* Top row */}
        <div className="flex items-center justify-center">
          <div className={cn(
            "w-1.5 h-1.5 rounded-full transition-all duration-300 ease-in-out",
            cellArr[0] 
              ? "bg-foreground scale-110 shadow-sm" 
              : "bg-border/20 scale-90"
          )} />
        </div>
        <div className="flex items-center justify-center">
          <div className={cn(
            "w-1.5 h-1.5 rounded-full transition-all duration-300 ease-in-out",
            cellArr[3] 
              ? "bg-foreground scale-110 shadow-sm" 
              : "bg-border/20 scale-90"
          )} />
        </div>
        {/* Middle row */}
        <div className="flex items-center justify-center">
          <div className={cn(
            "w-1.5 h-1.5 rounded-full transition-all duration-300 ease-in-out",
            cellArr[1] 
              ? "bg-foreground scale-110 shadow-sm" 
              : "bg-border/20 scale-90"
          )} />
        </div>
        <div className="flex items-center justify-center">
          <div className={cn(
            "w-1.5 h-1.5 rounded-full transition-all duration-300 ease-in-out",
            cellArr[4] 
              ? "bg-foreground scale-110 shadow-sm" 
              : "bg-border/20 scale-90"
          )} />
        </div>
        {/* Bottom row */}
        <div className="flex items-center justify-center">
          <div className={cn(
            "w-1.5 h-1.5 rounded-full transition-all duration-300 ease-in-out",
            cellArr[2] 
              ? "bg-foreground scale-110 shadow-sm" 
              : "bg-border/20 scale-90"
          )} />
        </div>
        <div className="flex items-center justify-center">
          <div className={cn(
            "w-1.5 h-1.5 rounded-full transition-all duration-300 ease-in-out",
            cellArr[5] 
              ? "bg-foreground scale-110 shadow-sm" 
              : "bg-border/20 scale-90"
          )} />
        </div>
      </div>
    </div>
  );
}

