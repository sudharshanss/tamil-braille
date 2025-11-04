// PDF OCR using API route - client-side wrapper
export async function extractTextFromPDFWithOCR(file: File, pageNumber: number = 1): Promise<string> {
  // Only run in browser environment
  if (typeof window === 'undefined') {
    throw new Error('This function must run in the browser');
  }

  try {
    // For image-based PDFs, we need to:
    // 1. Convert PDF page to image (client-side)
    // 2. Send to OCR API (server-side)
    
    // Dynamic import to avoid SSR issues
    const pdfjsLib = await import('pdfjs-dist');
    
    // Set up the worker - use local copy from public folder
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
      // Use local worker file from public folder to avoid CDN fetch issues
      pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
    }
    
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    // Get specified page
    const page = await pdf.getPage(pageNumber);
    
    // Render page to canvas
    // Use a higher scale to improve OCR accuracy for small text
    const viewport = page.getViewport({ scale: 2.6 });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    if (!context) {
      throw new Error('Could not create canvas context');
    }
    
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    
    // @ts-expect-error - pdfjs-dist types are incomplete
    await page.render({
      canvasContext: context,
      viewport: viewport
    }).promise;
    
    // Convert canvas to blob
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to create blob from canvas'));
        }
      }, 'image/png');
    });
    
    // Send to OCR API
    const formData = new FormData();
    formData.append('file', blob, 'page.png');
    
    const response = await fetch('/api/ocr', {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'OCR failed');
    }
    
    const data = await response.json();
    // Prefer full text from OCR for full-page extraction
    const full: string = (data.fullText || data.text || '').toString();
    const text: string = full.replace(/\s+/g, ' ').trim().normalize('NFC');
    return text;
      } catch (error) {
      console.error('PDF OCR error:', error);
      throw error;
  }
}

