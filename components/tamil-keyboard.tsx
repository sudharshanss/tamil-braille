"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface TamilKeyboardProps {
  onCharClick: (char: string) => void;
  className?: string;
}

export function TamilKeyboard({ onCharClick, className }: TamilKeyboardProps) {
  const [selectedConsonant, setSelectedConsonant] = useState<string | null>(null);

  // Tamil vowels
  const vowels = ["அ", "ஆ", "இ", "ஈ", "உ", "ஊ", "எ", "ஏ", "ஐ", "ஒ", "ஓ", "ஔ"];
  
  // Tamil consonants
  const consonants = [
    "க", "ங", "ச", "ஞ", "ட", "ண", "த", "ந", "ப", "ம",
    "ய", "ர", "ல", "வ", "ழ", "ற", "ன"
  ];

  // Vowel diacritics for combining with consonants
  const vowelDiacritics = [
    { char: "ா", display: "ா", label: "ஆ" }, // ஆ diacritic
    { char: "ி", display: "ி", label: "இ" }, // இ diacritic
    { char: "ீ", display: "ீ", label: "ஈ" }, // ஈ diacritic
    { char: "ு", display: "ு", label: "உ" }, // உ diacritic
    { char: "ூ", display: "ூ", label: "ஊ" }, // ஊ diacritic
    { char: "ெ", display: "ெ", label: "எ" }, // எ diacritic
    { char: "ே", display: "ே", label: "ஏ" }, // ஏ diacritic
    { char: "ை", display: "ை", label: "ஐ" }, // ஐ diacritic
    { char: "ொ", display: "ொ", label: "ஒ" }, // ஒ diacritic
    { char: "ோ", display: "ோ", label: "ஓ" }, // ஓ diacritic
    { char: "ௌ", display: "ௌ", label: "ஔ" }, // ஔ diacritic
  ];

  const handleKeyClick = (char: string) => {
    onCharClick(char);
    // Reset selected consonant after clicking
    if (selectedConsonant) {
      setSelectedConsonant(null);
    }
  };

  const handleConsonantClick = (consonant: string) => {
    // Select consonant to show vowel options
    setSelectedConsonant(consonant);
  };

  const handleVowelDiacriticClick = (diacritic: typeof vowelDiacritics[0]) => {
    if (selectedConsonant) {
      // Combine consonant with vowel diacritic
      const combined = selectedConsonant + diacritic.char;
      onCharClick(combined);
      setSelectedConsonant(null);
    } else {
      // Just add the standalone vowel
      onCharClick(diacritic.label);
    }
  };

  return (
    <div className={cn("w-full space-y-3", className)}>
      <div className="space-y-2">
        <label className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
          TAMIL VIRTUAL KEYBOARD
        </label>
        
        {/* Vowels Row */}
        <div className="grid grid-cols-6 gap-2">
          {vowels.map((char, idx) => (
            <Button
              key={`vowel-${idx}`}
              type="button"
              onClick={() => handleKeyClick(char)}
              variant="outline"
              className="h-10 text-lg font-medium bg-white/5 border-white/20 text-white hover:bg-[#6699FF]/20 hover:border-[#6699FF]/50 hover:text-[#6699FF] hover:scale-105 active:scale-95 transition-all duration-200"
            >
              {char}
            </Button>
          ))}
        </div>

        {/* Consonants Rows */}
        <div className="grid grid-cols-5 gap-2">
          {consonants.slice(0, 10).map((char, idx) => (
            <Button
              key={`consonant-1-${idx}`}
              type="button"
              onClick={() => handleConsonantClick(char)}
              variant={selectedConsonant === char ? "default" : "outline"}
              className={cn(
                "h-10 text-lg font-medium transition-all duration-200",
                selectedConsonant === char
                  ? "bg-[#6699FF] text-white hover:bg-[#6699FF]/90 shadow-[#6699FF]/40"
                  : "bg-white/5 border-white/20 text-white hover:bg-[#B366FF]/20 hover:border-[#B366FF]/50 hover:text-[#B366FF] hover:scale-105 active:scale-95"
              )}
            >
              {char}
            </Button>
          ))}
        </div>

        <div className="grid grid-cols-5 gap-2">
          {consonants.slice(10).map((char, idx) => (
            <Button
              key={`consonant-2-${idx}`}
              type="button"
              onClick={() => handleConsonantClick(char)}
              variant={selectedConsonant === char ? "default" : "outline"}
              className={cn(
                "h-10 text-lg font-medium transition-all duration-200",
                selectedConsonant === char
                  ? "bg-[#6699FF] text-white hover:bg-[#6699FF]/90 shadow-[#6699FF]/40"
                  : "bg-white/5 border-white/20 text-white hover:bg-[#B366FF]/20 hover:border-[#B366FF]/50 hover:text-[#B366FF] hover:scale-105 active:scale-95"
              )}
            >
              {char}
            </Button>
          ))}
        </div>

        {/* Vowel Diacritics (shown when consonant is selected) */}
        {selectedConsonant && (
          <div className="p-3 rounded-lg bg-[#6699FF]/10 border border-[#6699FF]/30 backdrop-blur-sm">
            <div className="text-xs text-white/70 mb-2 px-1">
              Select vowel for {selectedConsonant}
            </div>
            <div className="grid grid-cols-6 gap-2">
              {/* அ button - consonant with inherent அ sound */}
              <Button
                type="button"
                onClick={() => {
                  // Insert consonant with inherent அ sound (just the consonant)
                  onCharClick(selectedConsonant);
                  setSelectedConsonant(null);
                }}
                variant="outline"
                className="h-10 text-base font-medium bg-white/5 border-white/20 text-white hover:bg-[#B366FF]/20 hover:border-[#B366FF]/50 hover:text-[#B366FF] hover:scale-105 active:scale-95 transition-all duration-200"
              >
                அ
              </Button>
              {vowelDiacritics.map((diacritic, idx) => (
                <Button
                  key={`diacritic-${idx}`}
                  type="button"
                  onClick={() => handleVowelDiacriticClick(diacritic)}
                  variant="outline"
                  className="h-10 text-base font-medium bg-white/5 border-white/20 text-white hover:bg-[#B366FF]/20 hover:border-[#B366FF]/50 hover:text-[#B366FF] hover:scale-105 active:scale-95 transition-all duration-200"
                >
                  {diacritic.label}
                </Button>
              ))}
              <Button
                type="button"
                onClick={() => {
                  // Combine with pulli
                  onCharClick(selectedConsonant + "்");
                  setSelectedConsonant(null);
                }}
                variant="outline"
                className="h-10 text-base font-medium bg-white/5 border-white/20 text-white hover:bg-[#B366FF]/20 hover:border-[#B366FF]/50 hover:text-[#B366FF] hover:scale-105 active:scale-95 transition-all duration-200"
              >
                ் (Pulli)
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
