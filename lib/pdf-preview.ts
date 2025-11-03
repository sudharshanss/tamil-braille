// PDF page preview using pdfjs-dist
// This must only run on the client side

export async function renderPDFPageToImage(file: File, pageNumber: number): Promise<string> {
  // Only run in browser environment
  if (typeof window === 'undefined') {
    throw new Error('PDF preview must run in the browser');
  }

  try {
    // Dynamic import to avoid SSR issues
    const pdfjsLib = await import('pdfjs-dist');
    
    // Set up the worker - use local copy from public folder
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
    }
    
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    // Get specified page
    const page = await pdf.getPage(pageNumber);
    
    // Render page to canvas with appropriate scale for preview
    const viewport = page.getViewport({ scale: 1.5 });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    if (!context) {
      throw new Error('Could not create canvas context');
    }
    
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    
    await page.render({
      canvasContext: context,
      viewport: viewport
    }).promise;
    
    // Convert canvas to data URL
    return canvas.toDataURL('image/png');
  } catch (error) {
    console.error('PDF preview error:', error);
    throw new Error('Failed to render PDF page');
  }
}



