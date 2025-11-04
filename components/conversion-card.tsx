"use client";

import { useState, useRef, useEffect } from "react";
import { Card, CardContent } from "./ui/card";
import { BrailleCell } from "./braille-cell";
import { BrailleCell as BrailleCellType } from "@/lib/tamil-braille";
import { Copy, Download, Heart } from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";
import { unicodeToBrf, downloadTextFile } from "@/lib/unicode-to-brf";

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
  const [isLiked, setIsLiked] = useState(liked);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const downloadMenuRef = useRef<HTMLDivElement | null>(null);

  // Close download menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (downloadMenuRef.current && !downloadMenuRef.current.contains(event.target as Node)) {
        setShowDownloadMenu(false);
      }
    };

    if (showDownloadMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showDownloadMenu]);

  // Group cells by mappings to identify word boundaries
  const flatCells = brailleCells.flat();
  const cellGroups: Array<{ cells: BrailleCellType[]; wordIndex?: number }> = [];
  
  if (mappings && wordBoundaries) {
    const processedMappings = new Set<string>();
    mappings.forEach(mapping => {
      if (mapping.mappingId && !processedMappings.has(mapping.mappingId)) {
        const mappingCells = flatCells.filter(c => c.mappingId === mapping.mappingId);
        if (mappingCells.length > 0) {
          const wordIndex = wordBoundaries.findIndex(wb => 
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

  const handleDownload = async (format: 'txt' | 'brf') => {
    const brailleText = generateBrailleText();
    // Preserve original Tamil text with spaces
    const formattedTamilText = tamilText; // Already has spaces preserved
    const baseFilename = `braille-${tamilText.slice(0, 10).replace(/\s/g, '_')}`;
    
    if (format === 'brf') {
      // Download as BRF file (ASCII Braille encoding) - only Braille content
      // Uses Python API with TypeScript fallback
      const brfContent = await unicodeToBrf(brailleText);
      downloadTextFile(brfContent, `${baseFilename}.brf`, 'text/plain');
    } else {
      // Download as TXT file (Unicode Braille) - includes Tamil text and Braille
      const txtContent = `Tamil Text:\n${formattedTamilText}\n\nBraille Output:\n${brailleText}`;
      downloadTextFile(txtContent, `${baseFilename}.txt`, 'text/plain');
    }
    onDownload?.();
  };

  return (
    <Card className="relative transition-all duration-300 hover:shadow-xl hover:scale-105 border-2 hover:border-[#6699FF]/50 hover:shadow-[#6699FF]/20">
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

        {/* Action Buttons */}
        <div className="absolute bottom-2 right-2 flex gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleCopy}
            title="Copy"
          >
            <Copy className="h-4 w-4" />
          </Button>
          <div className="relative" ref={downloadMenuRef}>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setShowDownloadMenu(!showDownloadMenu)}
              title="Download"
            >
              <Download className="h-4 w-4" />
            </Button>
            {showDownloadMenu && (
              <div className="absolute bottom-full right-0 mb-2 w-40 bg-black/90 backdrop-blur-xl border border-white/10 rounded-lg shadow-xl z-50 overflow-hidden">
                <button
                  onClick={() => {
                    handleDownload('txt');
                    setShowDownloadMenu(false);
                  }}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-[#6699FF]/20 transition-colors flex items-center gap-2"
                >
                  <Download className="h-3 w-3" />
                  Download as TXT
                </button>
                <button
                  onClick={() => {
                    handleDownload('brf');
                    setShowDownloadMenu(false);
                  }}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-[#6699FF]/20 transition-colors flex items-center gap-2 border-t border-white/10"
                >
                  <Download className="h-3 w-3" />
                  Download as BRF
                </button>
              </div>
            )}
          </div>
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

