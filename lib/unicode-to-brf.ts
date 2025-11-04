// Mapping: Unicode Braille glyph → ASCII Braille glyph
const UNICODE_TO_BRF: Record<string, string> = {
  '⠀': ' ',   // Braille blank (U+2800)
  ' ': ' ',    // Normal space
  '\u00A0': ' ',  // Non-breaking space (NBSP)
  '⠮': '!', '⠐': '"', '⠼': '#', '⠫': '$', '⠩': '%',
  '⠯': '&', '⠄': "'", '⠷': '(', '⠾': ')', '⠡': '*', '⠬': '+',
  '⠠': ',', '⠤': '-', '⠨': '.', '⠌': '/', '⠴': '0', '⠂': '1',
  '⠆': '2', '⠒': '3', '⠲': '4', '⠢': '5', '⠖': '6', '⠶': '7',
  '⠦': '8', '⠔': '9', '⠱': ':', '⠰': ';', '⠣': '<', '⠿': '=',
  '⠜': '>', '⠹': '?', '⠈': '@', '⠁': 'A', '⠃': 'B', '⠉': 'C',
  '⠙': 'D', '⠑': 'E', '⠋': 'F', '⠛': 'G', '⠓': 'H', '⠊': 'I',
  '⠚': 'J', '⠅': 'K', '⠇': 'L', '⠍': 'M', '⠝': 'N', '⠕': 'O',
  '⠏': 'P', '⠟': 'Q', '⠗': 'R', '⠎': 'S', '⠞': 'T', '⠥': 'U',
  '⠧': 'V', '⠺': 'W', '⠭': 'X', '⠽': 'Y', '⠵': 'Z', '⠪': '[',
  '⠳': '\\', '⠻': ']', '⠘': '^', '⠸': '_'
};

/**
 * Convert Unicode Braille text to BRF ASCII encoding (TypeScript fallback implementation).
 * Handles space normalization (normal space, NBSP, Braille blank) and removes unintended consecutive symbols.
 */
function unicodeToBrfFallback(unicodeText: string): string {
  // Normalize all types of spaces
  let text = unicodeText.replace(/\u00A0/g, ' ').replace(/⠀/g, ' ');
  
  // Remove unintended consecutive Braille symbols like ⠹⠹
  text = text.replace(/(⠹)\1+/g, '$1');
  
  // Convert each character
  const brfChars: string[] = [];
  for (const ch of text) {
    if (ch in UNICODE_TO_BRF) {
      brfChars.push(UNICODE_TO_BRF[ch]);
    } else {
      // Check if it's a Braille character (U+2800 to U+28FF)
      const codePoint = ch.codePointAt(0);
      if (codePoint !== undefined && codePoint >= 0x2800 && codePoint <= 0x28FF) {
        // It's a Braille character but not in our mapping - try to map it
        // For unmapped Braille characters, we'll use '?' as fallback
        console.warn(`⚠ Warning: Unmapped Braille symbol '${ch}' (U+${codePoint.toString(16).toUpperCase().padStart(4, '0')})`);
        brfChars.push('?');
      } else {
        // Non-Braille character - keep as is (for Tamil text headers, etc.)
        brfChars.push(ch);
      }
    }
  }
  
  return brfChars.join('');
}

/**
 * Convert Unicode Braille text to BRF ASCII encoding using Python API.
 * Falls back to TypeScript implementation if API is unavailable.
 */
export async function unicodeToBrf(unicodeText: string): Promise<string> {
  // Try to use Python API first
  try {
    const response = await fetch('/api/brf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ unicodeText }),
    });

    if (response.ok) {
      const data = await response.json();
      return data.brfText;
    } else {
      // API failed (500 or 503) - use TypeScript fallback
      // 503 indicates service unavailable (e.g., Python not available on Vercel)
      const status = response.status;
      if (status === 503 || status === 500) {
        // Silently use fallback - this is expected on Vercel
        return unicodeToBrfFallback(unicodeText);
      }
      // For other errors, log but still use fallback
      console.warn(`Python BRF conversion API failed with status ${status}, using TypeScript fallback`);
      return unicodeToBrfFallback(unicodeText);
    }
  } catch (error) {
    // Network error or API not available (e.g., on Vercel without Python), use fallback
    // Don't log errors in production as this is expected behavior
    if (process.env.NODE_ENV === 'development') {
      console.warn('Python BRF conversion API unavailable, using TypeScript fallback:', error);
    }
    return unicodeToBrfFallback(unicodeText);
  }
}

/**
 * Download text content as a file
 */
export function downloadTextFile(content: string, filename: string, mimeType: string = 'text/plain') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
