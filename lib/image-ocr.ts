// Image OCR using the existing /api/ocr endpoint
export async function extractTextFromImageWithOCR(file: File): Promise<string> {
  if (typeof window === 'undefined') {
    throw new Error('This function must run in the browser');
  }

  try {
    // Try server-side OCR first
    const formData = new FormData();
    formData.append('file', file, file.name || 'image');

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

    // If server-side fails, try client-side OCR as fallback
    const error = await response.json().catch(() => ({}));
    if (error.error && (error.error.includes('not available') || error.error.includes('Tesseract'))) {
      console.warn('Server-side OCR not available, falling back to client-side OCR...');
      return await extractTextWithClientOCR(file);
    }

    throw new Error(error.error || 'OCR failed');
  } catch (error) {
    // If fetch fails or other error, try client-side OCR
    console.warn('Server-side OCR failed, trying client-side OCR...', error);
    try {
      return await extractTextWithClientOCR(file);
    } catch {
      throw new Error(`OCR failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// Client-side OCR using Tesseract.js
async function extractTextWithClientOCR(file: File): Promise<string> {
  try {
    // Dynamically import Tesseract.js to reduce initial bundle size
    const Tesseract = (await import('tesseract.js')).default;
    
    const { data: { text } } = await Tesseract.recognize(file, 'tam+eng', {
      logger: (m) => {
        // Optional: log progress
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


