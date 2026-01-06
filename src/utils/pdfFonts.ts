import { jsPDF } from 'jspdf';

/**
 * Urdu/Arabic font utility for PDF generation
 * Uses Noto Sans Arabic with proper embedding for Urdu text support
 */

let fontCache: { loaded: boolean; promise?: Promise<void> } = { loaded: false };

/**
 * Load and embed Urdu font in jsPDF document
 * Uses Noto Sans Arabic from a reliable CDN source
 */
export async function loadUrduFont(doc: jsPDF): Promise<void> {
  // Return cached promise if already loading
  if (fontCache.promise) {
    return fontCache.promise;
  }

  if (fontCache.loaded) {
    return Promise.resolve();
  }

  fontCache.promise = (async () => {
    try {
      // Use a reliable CDN source for Noto Sans Arabic TTF file
      // jsDelivr is the most reliable for direct TTF access
      const fontUrl = 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/notosansarabic/NotoSansArabic-Regular.ttf';
      
      console.log('Loading Urdu font from:', fontUrl);
      
      let fontData: ArrayBuffer | null = null;
      
      try {
        const response = await fetch(fontUrl, { 
          mode: 'cors',
          cache: 'default',
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        fontData = await response.arrayBuffer();
        
        if (!fontData || fontData.byteLength < 10000) { // TTF files should be at least 10KB
          throw new Error(`Font file too small: ${fontData?.byteLength || 0} bytes`);
        }
        
        console.log(`Successfully loaded font: ${(fontData.byteLength / 1024).toFixed(2)} KB`);
      } catch (error) {
        console.error('Failed to load font from primary source:', error);
        throw error;
      }

      // Convert to base64 using more efficient method
      const bytes = new Uint8Array(fontData);
      const chunks: string[] = [];
      const chunkSize = 8192;
      
      for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.slice(i, i + chunkSize);
        chunks.push(String.fromCharCode.apply(null, Array.from(chunk)));
      }
      
      const fontBase64 = btoa(chunks.join(''));
      
      // Add font to jsPDF's virtual file system
      const fontName = 'NotoSansArabic-normal';
      doc.addFileToVFS(`${fontName}.ttf`, fontBase64);
      doc.addFont(`${fontName}.ttf`, 'NotoSansArabic', 'normal');
      
      // Verify font was added
      const fonts = (doc as any).getFontList();
      if (!fonts || !fonts['NotoSansArabic']) {
        throw new Error('Font was not properly registered');
      }
      
      fontCache.loaded = true;
      console.log('Urdu font loaded and registered successfully');
    } catch (error) {
      console.error('Error loading Urdu font:', error);
      console.warn('PDF will continue without custom Urdu font. Text may not render correctly.');
      // Continue without custom font - jsPDF 3.0+ has better Unicode support
      // but Urdu may not render perfectly without the font
      fontCache.loaded = false;
    }
  })();

  return fontCache.promise;
}

/**
 * Set font for Urdu/Arabic text in PDF
 */
export function setUrduFont(doc: jsPDF): void {
  if (fontCache.loaded) {
    try {
      doc.setFont('NotoSansArabic', 'normal');
    } catch (error) {
      // Fallback to default font
      doc.setFont('helvetica', 'normal');
    }
  } else {
    // Try helvetica first, it has some Arabic support in newer jsPDF
    doc.setFont('helvetica', 'normal');
  }
}

/**
 * Set font for English/numeric text in PDF
 */
export function setEnglishFont(doc: jsPDF): void {
  doc.setFont('helvetica', 'normal');
}

/**
 * Check if a string contains Urdu/Arabic characters
 */
export function containsUrdu(text: string): boolean {
  if (!text) return false;
  // Urdu/Arabic Unicode ranges
  const urduRegex = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
  return urduRegex.test(text);
}

/**
 * Reverse string for RTL display (simple approach)
 * Note: This is a basic implementation. For proper RTL, use Bidi algorithm
 */
export function reverseForRTL(text: string): string {
  if (!containsUrdu(text)) {
    return text;
  }
  // For mixed content, we might need more sophisticated handling
  // But for simple Urdu text, reversing can help
  return text.split('').reverse().join('');
}

