"use client";

import { useState } from "react";
import { Card, CardContent } from "./ui/card";
import { BrailleCell } from "./braille-cell";
import { BrailleCell as BrailleCellType } from "@/lib/tamil-braille";
import { Copy, Download, Heart } from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";

interface ConversionCardProps {
  tamilText: string;
  brailleCells: BrailleCellType[][];
  mappings?: Array<{ tamilChar: string; brailleCells: BrailleCellType[]; startIndex: number; endIndex: number; mappingId?: string }>;
  wordBoundaries?: Array<{ startIndex: number; endIndex: number }>;
  onCopy?: () => void;
  onDownload?: () => void;
  onLike?: () => void;
  liked?: boolean;
}

export function ConversionCard({ 
  tamilText, 
  brailleCells, 
  mappings,
  wordBoundaries,
  onCopy, 
  onDownload, 
  onLike,
  liked = false 
}: ConversionCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isLiked, setIsLiked] = useState(liked);

  // Group cells by mappings to identify word boundaries
  const flatCells = brailleCells.flat();
  const cellGroups: Array<{ cells: BrailleCellType[]; wordIndex?: number }> = [];
  
  if (mappings && wordBoundaries) {
    const processedMappings = new Set<string>();
    mappings.forEach(mapping => {
      if (mapping.mappingId && !processedMappings.has(mapping.mappingId)) {
        const mappingCells = flatCells.filter(c => c.mappingId === mapping.mappingId);
        if (mappingCells.length > 0) {
          let wordIndex = wordBoundaries.findIndex(wb => 
            mapping.startIndex >= wb.startIndex && mapping.startIndex <= wb.endIndex
          );
          cellGroups.push({
            cells: mappingCells,
            wordIndex: wordIndex >= 0 ? wordIndex : undefined
          });
          processedMappings.add(mapping.mappingId);
        }
      }
    });
  } else {
    // Fallback: just group all cells
    cellGroups.push({ cells: flatCells });
  }

  const handleLike = () => {
    setIsLiked(!isLiked);
    onLike?.();
  };

  // Convert cell to Unicode Braille character
  const cellToBraille = (cell: BrailleCellType): string => {
    const cellArr = [false, false, false, false, false, false];
    cell.dots.forEach(pos => {
      if (pos >= 1 && pos <= 6) cellArr[pos - 1] = true;
    });
    const brailleCode = 
      (cellArr[0] ? 1 : 0) << 0 |
      (cellArr[1] ? 1 : 0) << 1 |
      (cellArr[2] ? 1 : 0) << 2 |
      (cellArr[3] ? 1 : 0) << 3 |
      (cellArr[4] ? 1 : 0) << 4 |
      (cellArr[5] ? 1 : 0) << 5;
    return String.fromCharCode(0x2800 + brailleCode);
  };

  // Generate Braille text with word spacing
  const generateBrailleText = (): string => {
    if (!mappings || !wordBoundaries || mappings.length === 0) {
      // Fallback: no word spacing
      return brailleCells.map(row => 
        row.map(cell => cellToBraille(cell)).join('')
      ).join('\n');
    }

    // Create a map of mappingId to word index
    const mappingToWordIndex = new Map<string, number>();
    mappings.forEach(mapping => {
      if (mapping.mappingId) {
        const wordIndex = wordBoundaries.findIndex(wb => 
          mapping.startIndex >= wb.startIndex && mapping.startIndex <= wb.endIndex
        );
        if (wordIndex >= 0) {
          mappingToWordIndex.set(mapping.mappingId, wordIndex);
        }
      }
    });

    // Group cells by word using their mappingId
    const words: BrailleCellType[][] = [];
    let currentWord: BrailleCellType[] = [];
    let currentWordIndex: number | null = null;

    flatCells.forEach((cell) => {
      if (cell.mappingId) {
        const wordIndex = mappingToWordIndex.get(cell.mappingId);
        
        if (wordIndex !== undefined) {
          // Check if this is a new word
          if (currentWordIndex !== null && currentWordIndex !== wordIndex && currentWord.length > 0) {
            words.push([...currentWord]);
            currentWord = [];
          }
          currentWordIndex = wordIndex;
        }
      }
      
      currentWord.push(cell);
    });

    // Add the last word
    if (currentWord.length > 0) {
      words.push(currentWord);
    }

    // Convert each word to Braille and join with spaces
    if (words.length === 0) {
      // Fallback if no words found
      return flatCells.map(cell => cellToBraille(cell)).join('');
    }
    
    return words.map(word => 
      word.map(cell => cellToBraille(cell)).join('')
    ).join('  ');
  };

  const handleCopy = () => {
    const brailleText = generateBrailleText();
    navigator.clipboard.writeText(brailleText);
    onCopy?.();
  };

  const handleDownload = () => {
    const brailleText = generateBrailleText();
    // Preserve original Tamil text with spaces
    const formattedTamilText = tamilText; // Already has spaces preserved
    
    const blob = new Blob([`Tamil Text:\n${formattedTamilText}\n\nBraille Output:\n${brailleText}`], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `braille-${tamilText.slice(0, 10).replace(/\s/g, '_')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    onDownload?.();
  };

  return (
    <Card
      className="relative transition-all duration-300 hover:shadow-xl hover:scale-105 border-2 hover:border-[#6699FF]/50 hover:shadow-[#6699FF]/20"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Tamil Text */}
          <div className="text-lg font-medium text-foreground">
            {tamilText}
          </div>
          
          {/* Braille Display */}
          <div className="flex flex-wrap gap-1 min-h-[60px] items-center">
            {cellGroups.map((group, groupIdx) => {
              const previousGroup = groupIdx > 0 ? cellGroups[groupIdx - 1] : null;
              const isNewWord = previousGroup && previousGroup.wordIndex !== undefined && 
                group.wordIndex !== undefined && 
                previousGroup.wordIndex !== group.wordIndex;

              return (
                <div key={groupIdx} className={cn("flex items-center gap-1", isNewWord && "ml-4")}>
                  {group.cells.map((cell, cellIdx) => (
                    <BrailleCell key={`${groupIdx}-${cellIdx}`} cell={cell} />
                  ))}
                </div>
              );
            })}
          </div>
        </div>

        {/* Action Buttons - Show on Hover */}
        <div
          className={cn(
            "absolute bottom-2 right-2 flex gap-2 transition-opacity duration-200",
            isHovered ? "opacity-100" : "opacity-0"
          )}
        >
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleCopy}
            title="Copy"
          >
            <Copy className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleDownload}
            title="Download"
          >
            <Download className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-8 w-8",
              isLiked && "text-red-500 hover:text-red-600"
            )}
            onClick={handleLike}
            title="Like"
          >
            <Heart className={cn("h-4 w-4", isLiked && "fill-current")} />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

