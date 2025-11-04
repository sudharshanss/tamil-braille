// PDF OCR using API route - client-side wrapper
export async function extractTextFromPDFWithOCR(file: File, pageNumber: number = 1): Promise<string> {
  // Only run in browser environment
  if (typeof window === 'undefined') {
    throw new Error('This function must run in the browser');
  }

  try {
    // For image-based PDFs, we need to:
    // 1. Convert PDF page to image (client-side)
    // 2. Send to OCR API (server-side) or use client-side OCR
    
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
    
    // Try server-side OCR first
    try {
      const formData = new FormData();
      formData.append('file', blob, 'page.png');
      
      const response = await fetch('/api/ocr', {
        method: 'POST',
        body: formData
      });
      
      if (response.ok) {
        const data = await response.json();
        const full: string = (data.fullText || data.text || '').toString();
        const text: string = full.replace(/\s+/g, ' ').trim().normalize('NFC');
        return text;
      }

      // Check if it's a "not available" error
      const error = await response.json().catch(() => ({}));
      if (error.error && (error.error.includes('not available') || error.error.includes('Tesseract'))) {
        console.warn('Server-side OCR not available, using client-side OCR...');
        return await extractTextFromImageWithClientOCR(blob);
      }

      throw new Error(error.error || 'OCR failed');
    } catch (fetchError) {
      // Fallback to client-side OCR
      console.warn('Server-side OCR failed, using client-side OCR...', fetchError);
      return await extractTextFromImageWithClientOCR(blob);
    }
  } catch (error) {
    console.error('PDF OCR error:', error);
    throw error;
  }
}

// Client-side OCR for images using Tesseract.js
async function extractTextFromImageWithClientOCR(blob: Blob): Promise<string> {
  try {
    const Tesseract = (await import('tesseract.js')).default;
    
    const { data: { text } } = await Tesseract.recognize(blob, 'tam+eng', {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
        }
      }
    });

    const normalized = text.replace(/\s+/g, ' ').trim().normalize('NFC');
    return normalized;
  } catch (error) {
    throw new Error(`Client-side OCR failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

