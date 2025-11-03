// Image OCR using the existing /api/ocr endpoint
export async function extractTextFromImageWithOCR(file: File): Promise<string> {
  if (typeof window === 'undefined') {
    throw new Error('This function must run in the browser');
  }

  const formData = new FormData();
  formData.append('file', file, file.name || 'image');

  const response = await fetch('/api/ocr', {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'OCR failed');
  }

  const data = await response.json();
  const full: string = (data.fullText || data.text || '').toString();
  const text: string = full.replace(/\s+/g, ' ').trim().normalize('NFC');
  return text;
}


