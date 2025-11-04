"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { MappedBrailleDisplay } from "@/components/mapped-braille-display";
import { ConversionCard } from "@/components/conversion-card";
import { BrailleCell } from "@/components/braille-cell";
import { TamilKeyboard } from "@/components/tamil-keyboard";
import { convertTamilToBraille, ConversionResult } from "@/lib/tamil-braille";
import { Loader2, Upload, ChevronRight, ChevronLeft, Download, FileUp, X, Volume2, Book, Zap, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

interface ConversionHistory {
  id: string;
  tamilText: string;
  result: ConversionResult;
  timestamp: Date;
}

export default function Home() {
  const [inputText, setInputText] = useState("");
  const [currentResult, setCurrentResult] = useState<ConversionResult | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const [conversionHistory, setConversionHistory] = useState<ConversionHistory[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // PDF state
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [currentPdfPage, setCurrentPdfPage] = useState(1);
  const [totalPdfPages, setTotalPdfPages] = useState(0);
  const [showNextPageButton, setShowNextPageButton] = useState(false);
  const [pdfPreview, setPdfPreview] = useState<string | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  
  // Typing animation state
  const [typingText, setTypingText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Typing animation effect
  useEffect(() => {
    if (inputText && !isConverting) {
      setIsTyping(true);
      let currentIndex = 0;
      const textToType = inputText;
      setTypingText("");
      
      const typingInterval = setInterval(() => {
        if (currentIndex < textToType.length) {
          setTypingText(textToType.slice(0, currentIndex + 1));
          currentIndex++;
        } else {
          clearInterval(typingInterval);
          setIsTyping(false);
        }
      }, 50); // Faster typing animation
      
      return () => clearInterval(typingInterval);
    } else {
      setTypingText(inputText);
      setIsTyping(false);
    }
  }, [inputText, isConverting]);

  // Cleanup TTS on unmount
  useEffect(() => {
    return () => {
      try {
        audioRef.current?.pause();
        audioRef.current = null;
      } catch {}
    };
  }, []);

  const handleSpeak = useCallback(() => {
    if (!inputText.trim()) return;
    try {
      if (isSpeaking && audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current = null;
        setIsSpeaking(false);
        return;
      }
      setIsSpeaking(true);
      const url = `/api/tts?text=${encodeURIComponent(inputText)}&lang=ta`;
      fetch(url)
        .then(async (res) => {
          if (!res.ok) throw new Error('TTS request failed');
          const blob = await res.blob();
          const audioUrl = URL.createObjectURL(blob);
          const audio = new Audio(audioUrl);
          audioRef.current = audio;
          audio.onended = () => {
            setIsSpeaking(false);
            URL.revokeObjectURL(audioUrl);
            audioRef.current = null;
          };
          audio.onerror = () => {
            setIsSpeaking(false);
            URL.revokeObjectURL(audioUrl);
            audioRef.current = null;
          };
          audio.play();
        })
        .catch(() => setIsSpeaking(false));
    } catch {
      setIsSpeaking(false);
    }
  }, [inputText, isSpeaking]);

  // Keep only Tamil characters and basic spacing
  const filterTamilText = useCallback((text: string) => {
    const onlyTamil = text
      .normalize('NFC')
      .replace(/[^\u0B80-\u0BFF\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return onlyTamil;
  }, []);

  // Generate Braille text for download
  const generateBrailleText = useCallback((result: ConversionResult): string => {
    if (!result.mappings || !result.wordBoundaries || result.mappings.length === 0) {
      return result.brailleCells.map(row => 
        row.map(cell => {
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
        }).join('')
      ).join('\n');
    }

    const mappingToWordIndex = new Map<string, number>();
    result.mappings.forEach(mapping => {
      if (mapping.mappingId) {
        const wordIndex = result.wordBoundaries!.findIndex(wb => 
          mapping.startIndex >= wb.startIndex && mapping.startIndex <= wb.endIndex
        );
        if (wordIndex >= 0) {
          mappingToWordIndex.set(mapping.mappingId, wordIndex);
        }
      }
    });

    const flatCells = result.brailleCells.flat();
    const words: typeof flatCells[] = [];
    let currentWord: typeof flatCells = [];
    let currentWordIndex: number | null = null;

    flatCells.forEach((cell) => {
      if (cell.mappingId) {
        const wordIndex = mappingToWordIndex.get(cell.mappingId);
        
        if (wordIndex !== undefined) {
          if (currentWordIndex !== null && currentWordIndex !== wordIndex && currentWord.length > 0) {
            words.push([...currentWord]);
            currentWord = [];
          }
          currentWordIndex = wordIndex;
        }
      }
      
      currentWord.push(cell);
    });

    if (currentWord.length > 0) {
      words.push(currentWord);
    }

    return words.map(word => 
      word.map(cell => {
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
      }).join('')
    ).join('  ');
  }, []);

  const handleDownload = useCallback(() => {
    if (!currentResult) return;
    
    const brailleText = generateBrailleText(currentResult);
    const formattedTamilText = currentResult.tamilText;
    
    const blob = new Blob([`Tamil Text:\n${formattedTamilText}\n\nBraille Output:\n${brailleText}`], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `braille-${formattedTamilText.slice(0, 10).replace(/\s/g, '_')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [currentResult, generateBrailleText]);

  // Load PDF preview
  const loadPDFPreview = useCallback(async (file: File, pageNumber: number) => {
    setIsLoadingPreview(true);
    try {
      const { renderPDFPageToImage } = await import('@/lib/pdf-preview');
      const preview = await renderPDFPageToImage(file, pageNumber);
      setPdfPreview(preview);
    } catch (error) {
      console.error('Failed to load PDF preview:', error);
      setPdfPreview(null);
    } finally {
      setIsLoadingPreview(false);
    }
  }, []);

  

  const handleConvert = async () => {
    if (!inputText.trim()) return;

    setIsConverting(true);
    
    // Faster processing delay for animation
    await new Promise(resolve => setTimeout(resolve, 200));
    
    const result = convertTamilToBraille(inputText.trim());
    setCurrentResult(result);
    
    // Add to history (limit to 3 most recent)
    const newConversion: ConversionHistory = {
      id: Date.now().toString(),
      tamilText: inputText.trim(),
      result,
      timestamp: new Date()
    };
    setConversionHistory(prev => [newConversion, ...prev.slice(0, 2)]);
    
    setIsConverting(false);
  };

  const processPDFPage = useCallback(async (file: File, pageNumber: number) => {
    setIsConverting(true);
    
    try {
      // Always do OCR by rendering page to image first for higher fidelity
      try {
        const { extractTextFromPDFWithOCR } = await import('@/lib/pdf-ocr');
        const ocrText = await extractTextFromPDFWithOCR(file, pageNumber);
        const tamilOnly = filterTamilText(ocrText);
        if (tamilOnly.trim()) {
          setInputText(tamilOnly);
          await new Promise(resolve => setTimeout(resolve, 300));
          const result = convertTamilToBraille(tamilOnly.trim());
          setCurrentResult(result);
          const newConversion: ConversionHistory = {
            id: Date.now().toString(),
            tamilText: tamilOnly.trim(),
            result,
            timestamp: new Date()
          };
          setConversionHistory(prev => [newConversion, ...prev.slice(0, 2)]);
          setIsConverting(false);
          return true;
        }
      } catch (ocrError) {
        console.error('OCR failed:', ocrError);
        setIsConverting(false);
        let errorMessage = "Could not extract text from this PDF using OCR.";
        if (ocrError instanceof Error) {
          if (ocrError.message.includes('Tesseract')) {
            errorMessage = `OCR Error: ${ocrError.message}\n\nPlease ensure Tesseract OCR is installed in the requirements/Tesseract-OCR/ folder.`;
          } else {
            errorMessage = `OCR Error: ${ocrError.message}`;
          }
        }
        alert(errorMessage);
        return false;
      }
      setIsConverting(false);
      alert("Could not extract text from this page. Please try another page.");
      return false;
      
    } catch (error) {
      setIsConverting(false);
      alert(`Error processing PDF: ${error instanceof Error ? error.message : "Please ensure it's a valid PDF or use a .txt file instead."}`);
      return false;
    }
  }, []);

  const processFile = useCallback(async (file: File) => {
    // Handle .txt files
    if (file.type === "text/plain" || file.name.endsWith(".txt")) {
      // Reset PDF state
      setPdfFile(null);
      setCurrentPdfPage(1);
      setTotalPdfPages(0);
      setShowNextPageButton(false);
      setImagePreview(null);
      
      const text = await file.text();
      setInputText(text);
      
      // Auto-convert after file upload
      setIsConverting(true);
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const result = convertTamilToBraille(text.trim());
      setCurrentResult(result);
      
      const newConversion: ConversionHistory = {
        id: Date.now().toString(),
        tamilText: text.trim(),
        result,
        timestamp: new Date()
      };
      setConversionHistory(prev => [newConversion, ...prev.slice(0, 2)]);
      
      setIsConverting(false);
    } 
    // Handle PDF files
    else if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
      try {
        setIsConverting(true);
        
        // Get PDF info
        const { getPDFInfo } = await import('@/lib/pdf-extractor');
        const pdfInfo = await getPDFInfo(file);
        
        setPdfFile(file);
        setCurrentPdfPage(1);
        setTotalPdfPages(pdfInfo.totalPages);
        setImagePreview(null);
        
        // Load preview and process first page
        await loadPDFPreview(file, 1);
        const success = await processPDFPage(file, 1);
        
        if (success && pdfInfo.totalPages > 1) {
          setShowNextPageButton(true);
        } else {
          setShowNextPageButton(false);
        }
        
      } catch (error) {
        setIsConverting(false);
        setPdfFile(null);
        setCurrentPdfPage(1);
        setTotalPdfPages(0);
        setShowNextPageButton(false);
        alert(`Error processing PDF: ${error instanceof Error ? error.message : "Please ensure it's a valid PDF or use a .txt file instead."}`);
      }
    }
    // Handle image files
    else if (file.type.startsWith("image/") || /(\.png|\.jpg|\.jpeg|\.webp|\.bmp)$/i.test(file.name)) {
      try {
        // Reset PDF state
        setPdfFile(null);
        setCurrentPdfPage(1);
        setTotalPdfPages(0);
        setShowNextPageButton(false);
        setPdfPreview(null);
        // Set image preview
        try { setImagePreview(URL.createObjectURL(file)); } catch {}

        setIsConverting(true);
        const { extractTextFromImageWithOCR } = await import('@/lib/image-ocr');
        const text = await extractTextFromImageWithOCR(file);
        const tamilOnly = filterTamilText(text);

        if (tamilOnly) {
          setInputText(tamilOnly);
          await new Promise(resolve => setTimeout(resolve, 200));
          const result = convertTamilToBraille(tamilOnly.trim());
          setCurrentResult(result);
          const newConversion: ConversionHistory = {
            id: Date.now().toString(),
            tamilText: tamilOnly.trim(),
            result,
            timestamp: new Date()
          };
          setConversionHistory(prev => [newConversion, ...prev.slice(0, 2)]);
        } else {
          alert('No text detected in the image.');
        }
      } catch (error) {
        alert(`Error processing image: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } finally {
        setIsConverting(false);
      }
    }
  }, [processPDFPage]);


  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await processFile(file);
  };

  const handlePreviousPage = useCallback(async () => {
    if (!pdfFile || currentPdfPage <= 1) return;
    
    const prevPage = currentPdfPage - 1;
    setCurrentPdfPage(prevPage);
    await loadPDFPreview(pdfFile, prevPage);
    await processPDFPage(pdfFile, prevPage);
  }, [pdfFile, currentPdfPage, loadPDFPreview, processPDFPage]);

  const handleNextPage = useCallback(async () => {
    if (!pdfFile || currentPdfPage >= totalPdfPages) return;
    
    const nextPage = currentPdfPage + 1;
    setCurrentPdfPage(nextPage);
    await loadPDFPreview(pdfFile, nextPage);
    
    const success = await processPDFPage(pdfFile, nextPage);
    
    if (success && nextPage < totalPdfPages) {
      setShowNextPageButton(true);
    } else {
      setShowNextPageButton(false);
    }
  }, [pdfFile, currentPdfPage, totalPdfPages, processPDFPage, loadPDFPreview]);

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleConvert();
    }
  };

  return (
    <div className="min-h-screen bg-black relative overflow-hidden">
      {/* Animated gradient background */}
      <div className="absolute inset-0 bg-gradient-to-r from-blue-950 via-purple-950 via-pink-950 to-red-950 opacity-50"></div>
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
      
      {/* Header */}
      <header className="relative border-b border-white/10 bg-black/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-8 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                <Book className="h-5 w-5 text-foreground" />
              </div>
              <h1 className="text-xl font-semibold text-foreground">Braille Converter</h1>
            </div>
            <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground">
              <Zap className="h-4 w-4" />
              <span>Tamil ↔ Braille</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-8 py-12">
        {/* Title Section */}
        <div className="text-center mb-12 space-y-4 relative z-10">
          <h2 className="text-6xl md:text-7xl font-bold text-white tracking-tight">Tamil to Braille</h2>
          <p className="text-xl text-white/70 max-w-2xl mx-auto">Convert Tamil text, images, and PDFs to Braille instantly. Upload documents, navigate pages, and explore character-by-character mappings.</p>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 relative z-10">
          {/* Left Panel - Input */}
          <Card className="p-6 bg-black/60 backdrop-blur-xl border border-white/10 shadow-2xl">
            <h3 className="text-2xl font-bold text-foreground mb-6">Input</h3>
            
            <div className="space-y-6">
              {/* Text Input - Single Line */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-white transition-colors hover:text-[#6699FF]">
                  Enter Tamil Text
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Input
                      placeholder="Type or paste Tamil text here..."
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      onKeyDown={handleKeyPress}
                      onFocus={() => {
                        // Close any active PDF preview when user focuses input
                        if (pdfFile) {
                          setPdfFile(null);
                          setCurrentPdfPage(1);
                          setTotalPdfPages(0);
                          setShowNextPageButton(false);
                          setPdfPreview(null);
                        }
                        if (imagePreview) {
                          setImagePreview(null);
                        }
                      }}
                      className="h-10 pr-20 text-sm bg-white/5 border-white/20 text-white placeholder:text-white/40 transition-all duration-200 hover:border-[#B366FF]/50 focus:border-[#6699FF] focus:ring-2 focus:ring-[#6699FF]/30"
                      disabled={isConverting}
                    />
                    {inputText && (
                      <div className="absolute inset-y-0 right-2 my-auto flex items-center">
                        <button
                          type="button"
                          onClick={() => {
                            setInputText("");
                            setTypingText("");
                            setCurrentResult(null);
                            setPdfFile(null);
                            setCurrentPdfPage(1);
                            setTotalPdfPages(0);
                            setShowNextPageButton(false);
                            setPdfPreview(null);
                            setImagePreview(null);
                          }}
                          className="h-7 w-7 inline-flex items-center justify-center rounded hover:bg-muted/70 active:scale-95 transition-all"
                          aria-label="Clear input"
                          title="Clear"
                        >
                          <X className="h-4 w-4 text-muted-foreground" />
                        </button>
                      </div>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".txt,.pdf,image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </div>
                  <Button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="h-10 px-4 text-sm font-medium inline-flex items-center gap-2 bg-white/10 border border-white/20 text-white hover:bg-[#6699FF]/20 hover:border-[#6699FF]/50 hover:text-[#6699FF] active:scale-[0.98] transition-all duration-200"
                    title="Upload TXT, PDF, or Image"
                  >
                    <FileUp className="h-4 w-4" />
                    Upload
                  </Button>
                  <Button
                    type="button"
                    onClick={handleSpeak}
                    disabled={!inputText.trim()}
                    variant="outline"
                    className="h-10 px-3 text-sm font-medium inline-flex items-center gap-2 bg-white/10 border-white/20 text-white hover:bg-[#B366FF]/20 hover:border-[#B366FF]/50 hover:text-[#B366FF] active:scale-[0.98] transition-all duration-200"
                    title="Read Tamil input"
                  >
                    <Volume2 className="h-4 w-4" />
                    {isSpeaking ? 'Stop' : 'Speak'}
                  </Button>
                </div>
                {isTyping && (
                  <p className="text-xs text-muted-foreground animate-pulse">
                    Typing...
                  </p>
                )}
              </div>

              {/* Convert Button */}
              <Button
                onClick={handleConvert}
                disabled={!inputText.trim() || isConverting}
                className="w-full h-12 text-base font-semibold bg-white text-black hover:bg-white/90 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] hover:shadow-lg disabled:opacity-50"
              >
                {isConverting ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Converting...
                  </>
                ) : (
                  "Convert to Braille"
                )}
              </Button>

              {/* PDF Preview and Navigation */}
              {pdfFile && totalPdfPages > 0 && (
                <div className="space-y-3 p-4 border border-white/10 rounded-lg bg-white/5 backdrop-blur-sm">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-foreground">
                      Document Preview
                    </label>
                    <span className="text-xs text-muted-foreground">
                      Page {currentPdfPage} of {totalPdfPages}
                    </span>
                  </div>
                  
                  {/* PDF Preview Image */}
                  <div className="relative min-h-[200px] flex items-center justify-center border border-border rounded bg-muted/30 overflow-hidden">
                    {isLoadingPreview ? (
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    ) : pdfPreview ? (
                      <img 
                        src={pdfPreview} 
                        alt={`PDF Page ${currentPdfPage}`}
                        className="max-w-full max-h-[300px] object-contain transition-opacity duration-200"
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground">No preview available</p>
                    )}
                  </div>
                  
                  {/* Navigation Buttons */}
                  <div className="flex gap-2">
                    <Button
                      onClick={handlePreviousPage}
                      disabled={currentPdfPage <= 1 || isConverting || isLoadingPreview}
                      variant="outline"
                      className="flex-1 h-10 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] hover:bg-[#B366FF]/10 hover:border-[#B366FF]/50 border-white/20"
                    >
                      <ChevronLeft className="mr-2 h-4 w-4" />
                      Previous
                    </Button>
                    <Button
                      onClick={handleNextPage}
                      disabled={currentPdfPage >= totalPdfPages || isConverting || isLoadingPreview}
                      variant="outline"
                      className="flex-1 h-10 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] hover:bg-[#B366FF]/10 hover:border-[#B366FF]/50 border-white/20"
                    >
                      Next
                      <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Image Preview (for image uploads) */}
              {imagePreview && (
                <div className="space-y-3 p-4 border border-white/10 rounded-lg bg-white/5 backdrop-blur-sm">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-foreground">
                      Image Preview
                    </label>
                  </div>
                  <div className="relative min-h-[200px] flex items-center justify-center border border-border rounded bg-muted/30 overflow-hidden">
                    <img 
                      src={imagePreview} 
                      alt="Uploaded image preview"
                      className="max-w-full max-h-[300px] object-contain transition-opacity duration-200"
                    />
                  </div>
                </div>
              )}

              {/* Removed OR separator */}

              {/* Tamil Virtual Keyboard */}
              <TamilKeyboard
                onCharClick={(char) => {
                  setInputText((prev) => prev + char);
                }}
              />
            </div>
          </Card>

          {/* Right Panel - Output */}
          <Card className="p-6 bg-black/60 backdrop-blur-xl border border-white/10 shadow-2xl">
            <div className="space-y-6">
              {/* Tamil Input Display */}
              {currentResult && (
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
                    TAMIL INPUT
                  </label>
                  <div className="p-4 border border-white/10 rounded-lg bg-white/5 backdrop-blur-sm min-h-[60px]">
                    <p className="text-base text-foreground">{currentResult.tamilText}</p>
                  </div>
                </div>
              )}
              
              {/* Converted Braille Display */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
                    CONVERTED
                  </label>
                  {currentResult && (
                    <Button
                      onClick={handleDownload}
                      variant="ghost"
                      size="sm"
                      className="h-8 transition-all duration-200 hover:scale-110 hover:bg-[#6699FF]/20 hover:text-[#6699FF]"
                      title="Download result"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <div className="min-h-[400px] flex items-center justify-center">
                  {isConverting ? (
                    <div className="flex flex-col items-center gap-4">
                      <Loader2 className="h-12 w-12 animate-spin text-primary" />
                      <p className="text-muted-foreground animate-pulse text-lg">Generating Braille...</p>
                    </div>
                  ) : currentResult ? (
                    <div className="w-full p-4 border border-white/10 rounded-lg bg-white/5 backdrop-blur-sm min-h-[400px] transition-all duration-200 hover:border-[#B366FF]/30 hover:shadow-[#B366FF]/20">
                      <MappedBrailleDisplay
                        cells={currentResult.brailleCells}
                        tamilText={currentResult.tamilText}
                        mappings={currentResult.mappings}
                        wordBoundaries={currentResult.wordBoundaries}
                      />
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-6 text-center w-full">
                      <div className="w-32 h-32 rounded-full bg-muted/70 flex items-center justify-center transition-all duration-300 hover:scale-110 hover:bg-muted/90">
                        <span className="text-5xl font-bold text-muted-foreground">T</span>
                      </div>
                      <div className="space-y-2">
                        <p className="text-2xl font-semibold text-foreground">No conversion yet</p>
                        <p className="text-sm text-muted-foreground">Enter text or upload a file to begin</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Character Mapping moved under Input */}
            </div>
          </Card>
        </div>

        {/* Conversion History */}
        {conversionHistory.length > 0 && (
          <div className="mt-12 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-3xl font-bold text-foreground">Conversion History</h2>
              <span className="text-sm text-muted-foreground">{conversionHistory.length} items</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {conversionHistory.slice(0, 6).map((conversion) => {
                const brailleText = generateBrailleText(conversion.result);
                return (
                  <Card key={conversion.id} className="relative p-5 bg-black/60 backdrop-blur-xl border border-white/10 shadow-xl group">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="text-lg font-semibold text-foreground flex-1">{conversion.tamilText}</div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-[#6699FF]/20 hover:text-[#6699FF]"
                          onClick={async () => {
                            setInputText(conversion.tamilText);
                            // Wait for state to update, then trigger conversion
                            await new Promise(resolve => setTimeout(resolve, 100));
                            if (conversion.tamilText.trim()) {
                              setIsConverting(true);
                              await new Promise(resolve => setTimeout(resolve, 200));
                              const result = convertTamilToBraille(conversion.tamilText.trim());
                              setCurrentResult(result);
                              setIsConverting(false);
                            }
                          }}
                          title="Retry conversion"
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {new Date(conversion.timestamp).toLocaleString()}
                      </div>
                      <div className="rounded-md border border-white/10 bg-white/5 backdrop-blur-sm text-base px-3 py-2 overflow-x-auto whitespace-pre-wrap">
                        {brailleText}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
