"use client";

import { useState, useEffect } from "react";
import { BrailleCell } from "./braille-cell";
import { BrailleCell as BrailleCellType } from "@/lib/tamil-braille";
import { cn } from "@/lib/utils";

interface MappedBrailleDisplayProps {
  cells: BrailleCellType[][];
  tamilText: string;
  mappings: Array<{ tamilChar: string; brailleCells: BrailleCellType[]; startIndex: number; endIndex: number; mappingId?: string }>;
  wordBoundaries?: Array<{ startIndex: number; endIndex: number }>;
  className?: string;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function MappedBrailleDisplay({ cells, tamilText: _tamilText, mappings, wordBoundaries, className }: MappedBrailleDisplayProps) {
  const [hoveredMappingId, setHoveredMappingId] = useState<string | null>(null);
  const [animatedIndices, setAnimatedIndices] = useState<Set<number>>(new Set());

  // Flatten cells and group by mapping
  const cellGroups: Array<{ cells: BrailleCellType[]; mapping: typeof mappings[0]; wordIndex?: number }> = [];
  
  const flatCells: BrailleCellType[] = [];
  cells.forEach(row => {
    row.forEach(cell => {
      flatCells.push(cell);
    });
  });

  // Group cells by their mapping
  const processedMappings = new Set<string>();
  mappings.forEach(mapping => {
    if (mapping.mappingId && !processedMappings.has(mapping.mappingId)) {
      const mappingCells = flatCells.filter(c => c.mappingId === mapping.mappingId);
      if (mappingCells.length > 0) {
        // Determine which word this mapping belongs to
        let wordIndex = -1;
        if (wordBoundaries) {
          wordIndex = wordBoundaries.findIndex(wb => 
            mapping.startIndex >= wb.startIndex && mapping.startIndex <= wb.endIndex
          );
        }
        
        cellGroups.push({
          cells: mappingCells,
          mapping,
          wordIndex: wordIndex >= 0 ? wordIndex : undefined
        });
        processedMappings.add(mapping.mappingId);
      }
    }
  });

  // Animate cells appearing - faster animation
  useEffect(() => {
    const timeouts: NodeJS.Timeout[] = [];
    cellGroups.forEach((group, idx) => {
      const timeout = setTimeout(() => {
        setAnimatedIndices(prev => new Set([...prev, idx]));
      }, idx * 20); // Faster - 20ms instead of 50ms
      timeouts.push(timeout);
    });
    return () => timeouts.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cellGroups.length]);

  const handleCellHover = (mappingId: string | undefined) => {
    setHoveredMappingId(mappingId || null);
  };

  const handleTamilHover = (mappingId: string) => {
    setHoveredMappingId(mappingId);
  };

  const highlightedMapping = hoveredMappingId 
    ? mappings.find(m => m.mappingId === hoveredMappingId)
    : null;

  // Build word groups so a whole word stays on one line
  const wordGroups: Array<{ groups: typeof cellGroups; wordIndex?: number }> = [];
  if (cellGroups.length > 0) {
    let currentWordIndex: number | undefined = cellGroups[0].wordIndex;
    let currentGroups: typeof cellGroups = [];
    cellGroups.forEach((g) => {
      if (currentGroups.length === 0) {
        currentWordIndex = g.wordIndex;
        currentGroups.push(g);
        return;
      }
      if (g.wordIndex === currentWordIndex) {
        currentGroups.push(g);
      } else {
        wordGroups.push({ groups: currentGroups, wordIndex: currentWordIndex });
        currentGroups = [g];
        currentWordIndex = g.wordIndex;
      }
    });
    if (currentGroups.length) {
      wordGroups.push({ groups: currentGroups, wordIndex: currentWordIndex });
    }
  }

  return (
    <div className={cn("w-full overflow-x-auto", className)}>
      {/* Braille and Tamil Mapped Display */}
      <div className="w-full">
        <div
          className="min-h-[400px] p-6"
          onMouseLeave={() => setHoveredMappingId(null)}
        >
          {cellGroups.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <p className="animate-pulse">No Braille output yet</p>
            </div>
          ) : (
            <div className="flex flex-wrap items-end gap-x-12 gap-y-6 justify-start">
              {wordGroups.map((word, wIdx) => (
                <div key={`word-${wIdx}`} className="inline-flex flex-nowrap items-end gap-4 whitespace-nowrap">
                  {word.groups.map((group, groupIdx) => {
                const isHighlighted = highlightedMapping?.mappingId === group.mapping.mappingId;
                const isAnimated = animatedIndices.has(groupIdx);
                
                    return (
                      <div 
                        key={group.mapping.mappingId || `${wIdx}-${groupIdx}`}
                        className={cn(
                          "flex flex-col items-center"
                        )}
                      >
                        <div
                          className={cn(
                            "flex flex-col items-center gap-2 transition-all duration-500 ease-out",
                            isAnimated 
                              ? "opacity-100 translate-y-0" 
                              : "opacity-0 translate-y-4"
                          )}
                          style={{
                            transitionDelay: `${groupIdx * 50}ms`,
                          }}
                        >
                          {/* Braille Cells for this Tamil character */}
                          <div
                            className={cn(
                              "flex gap-1 transition-all duration-300",
                              isHighlighted && "scale-110 transform z-10"
                            )}
                            onMouseEnter={() => handleCellHover(group.mapping.mappingId)}
                          >
                            {group.cells.map((cell, cellIdx) => (
                              <BrailleCell 
                                key={cellIdx}
                                cell={cell} 
                                highlighted={isHighlighted}
                              />
                            ))}
                          </div>
                          
                          {/* Tamil Character below */}
                          <div
                            className={cn(
                              "text-lg font-medium transition-all duration-300 px-2 py-1 rounded cursor-pointer",
                              isHighlighted 
                                ? "bg-[#6699FF]/20 text-[#6699FF] scale-110 shadow-md border border-[#6699FF]/50 shadow-[#6699FF]/30" 
                                : "text-white hover:text-[#B366FF] hover:bg-[#B366FF]/10"
                            )}
                            onMouseEnter={() => group.mapping.mappingId && handleTamilHover(group.mapping.mappingId)}
                          >
                            {group.mapping.tamilChar}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

