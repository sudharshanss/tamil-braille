"use client";

import { useState } from "react";
import { BrailleCell } from "./braille-cell";
import { BrailleCell as BrailleCellType } from "@/lib/tamil-braille";
import { cn } from "@/lib/utils";

interface BrailleDisplayProps {
  cells: BrailleCellType[][];
  tamilText: string;
  mappings: Array<{ tamilChar: string; brailleCells: BrailleCellType[]; startIndex: number; endIndex: number; mappingId?: string }>;
  className?: string;
}

export function BrailleDisplay({ cells, tamilText, mappings, className }: BrailleDisplayProps) {
  const [hoveredCharIndex, setHoveredCharIndex] = useState<number | null>(null);

  // Flatten cells for display
  const flatCells: BrailleCellType[] = [];
  cells.forEach(row => {
    row.forEach(cell => {
      flatCells.push(cell);
    });
  });

  const handleBrailleHover = (cellIndex: number) => {
    const cell = flatCells[cellIndex];
    if (cell.mappingId) {
      const mapping = mappings.find(m => m.mappingId === cell.mappingId);
      if (mapping) {
        setHoveredCharIndex(mapping.startIndex);
      }
    }
  };

  const handleTamilHover = (charIndex: number) => {
    setHoveredCharIndex(charIndex);
  };

  const getHighlightedMapping = () => {
    if (hoveredCharIndex === null) return null;
    return mappings.find(m => 
      hoveredCharIndex >= m.startIndex && hoveredCharIndex <= m.endIndex
    );
  };

  const highlightedMapping = getHighlightedMapping();
  
  // Check if a cell should be highlighted
  const isCellHighlighted = (cell: BrailleCellType) => {
    if (!highlightedMapping || !cell.mappingId) return false;
    return highlightedMapping.mappingId === cell.mappingId;
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Braille Output */}
      <div className="space-y-2">
        <h2 className="text-xl font-semibold text-foreground">Braille Output</h2>
        <div
          className="min-h-[200px] p-6 border border-border rounded-lg bg-card"
          onMouseLeave={() => setHoveredCharIndex(null)}
        >
          {cells.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <p>No Braille output yet</p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {flatCells.map((cell, idx) => {
                const isHighlighted = isCellHighlighted(cell);
                return (
                  <div
                    key={idx}
                    onMouseEnter={() => handleBrailleHover(idx)}
                  >
                    <BrailleCell cell={cell} highlighted={isHighlighted} />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      
      {/* Tamil Text display for reference (shows highlighted characters on hover) */}
      {tamilText && (
        <div className="space-y-2 opacity-60">
          <div className="p-3 border border-border rounded-lg bg-card">
            <div className="flex flex-wrap gap-1 text-sm">
              {Array.from(tamilText).map((char, idx) => {
                const isHighlighted = highlightedMapping && 
                  idx >= highlightedMapping.startIndex && 
                  idx <= highlightedMapping.endIndex;
                
                return (
                  <span
                    key={idx}
                    className={cn(
                      "transition-colors",
                      isHighlighted && "bg-blue-100 dark:bg-blue-900/30 rounded px-1 font-semibold"
                    )}
                    onMouseEnter={() => handleTamilHover(idx)}
                  >
                    {char === ' ' ? '\u00A0' : char}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

