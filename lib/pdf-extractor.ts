// PDF text extraction using pdfjs-dist
// This must only run on the client side

export interface PDFInfo {
  totalPages: number;
}

export async function getPDFInfo(file: File): Promise<PDFInfo> {
  if (typeof window === 'undefined') {
    throw new Error('PDF extraction must run in the browser');
  }

  try {
    const pdfjsLib = await import('pdfjs-dist');
    
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
    }
    
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    return {
      totalPages: pdf.numPages
    };
  } catch (error) {
    console.error('PDF info error:', error);
    throw new Error('Failed to read PDF information.');
  }
}

export async function extractTextFromPDF(file: File, pageNumber: number = 1): Promise<string> {
  // Only run in browser environment
  if (typeof window === 'undefined') {
    throw new Error('PDF extraction must run in the browser');
  }

  try {
    // Dynamic import to avoid SSR issues
    const pdfjsLib = await import('pdfjs-dist');
    
    // Set up the worker - use local copy from public folder
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
      // Use local worker file from public folder to avoid CDN fetch issues
      pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
    }
    
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    // Extract from specified page
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();
    
    // Extract text items
    let fullText = '';
    textContent.items.forEach((item) => {
      if ('str' in item && item.str) {
        fullText += item.str + ' ';
      }
    });
    
    // Normalize spacing and Unicode to reduce differences vs document
    const normalized = fullText.replace(/\s+/g, ' ').trim().normalize('NFC');
    // Get only the first line
    const firstLine = normalized.split(/[\r\n]+/)[0].trim();
    
    return firstLine || '';
  } catch (error) {
    console.error('PDF extraction error:', error);
    throw new Error('Failed to extract text from PDF. The PDF may be image-based or corrupted.');
  }
}

