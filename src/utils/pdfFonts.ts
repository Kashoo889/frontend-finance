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
      // Use Noto Sans Arabic from jsDelivr CDN (reliable and fast)
      // This is a subset that supports Arabic/Urdu characters
      const fontUrl = 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/notosansarabic/NotoSansArabic%5Bwdth%2Cwght%5D.ttf';
      
      // Try alternative CDN if first fails
      const altFontUrl = 'https://fonts.gstatic.com/s/notosansarabic/v18/nwpxtLGrOAZMl5nJ_wfgRg3DrWFZWsnVBJ_sS6tlqHHFlhQ5l3sQWIHPqzCfyGy2XMc2Rg5qM.woff2';
      
      let fontData: ArrayBuffer | null = null;
      
      try {
        const response = await fetch(fontUrl, { 
          mode: 'cors',
          cache: 'force-cache' 
        });
        if (response.ok) {
          fontData = await response.arrayBuffer();
        }
      } catch (e) {
        console.warn('Primary font CDN failed, trying alternative...');
        try {
          const response = await fetch(altFontUrl, { mode: 'cors' });
          if (response.ok) {
            fontData = await response.arrayBuffer();
          }
        } catch (e2) {
          throw new Error('Both font CDNs failed');
        }
      }

      if (!fontData) {
        throw new Error('Failed to fetch font data');
      }

      // Convert to base64
      const bytes = new Uint8Array(fontData);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const fontBase64 = btoa(binary);
      
      // Add font to jsPDF's virtual file system
      doc.addFileToVFS('NotoSansArabic-normal.ttf', fontBase64);
      doc.addFont('NotoSansArabic-normal.ttf', 'NotoSansArabic', 'normal');
      
      fontCache.loaded = true;
      console.log('Urdu font loaded successfully');
    } catch (error) {
      console.error('Error loading Urdu font:', error);
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

