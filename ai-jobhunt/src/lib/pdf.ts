// ═══════════════════════════════════════════════════════════
// PDF Text Extractor — Server-side only
// ═══════════════════════════════════════════════════════════
// Extracts text from PDF buffers using pdfjs-dist.
// This avoids the pdf-parse v2 compatibility issues.
// ═══════════════════════════════════════════════════════════

export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  // Dynamic import to avoid bundling issues
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  
  const uint8 = new Uint8Array(buffer);
  const doc = await pdfjsLib.getDocument({ data: uint8 }).promise;
  
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .map((item: any) => item.str)
      .join(' ');
    pages.push(text);
  }
  
  return pages.join('\n');
}
