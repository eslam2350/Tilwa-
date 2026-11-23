/**
 * Pure deterministic PDF 1.4 builder wrapping a high-resolution JPEG image
 * on an A4 Landscape page (842 x 595 pt). Zero external dependencies.
 */

function asciiBytes(text: string): Uint8Array {
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i += 1) {
    bytes[i] = text.charCodeAt(i) & 0xff;
  }
  return bytes;
}

export function decodeBase64DataUrlToBytes(dataUrl: string): Uint8Array {
  const commaIdx = dataUrl.indexOf(',');
  const b64 = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;
  if (typeof atob === 'function') {
    const binary = atob(b64);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      out[i] = binary.charCodeAt(i) & 0xff;
    }
    return out;
  }
  // Node.js fallback for tests
  return new Uint8Array(Buffer.from(b64, 'base64'));
}

export function buildLandscapeA4PdfFromJpegBytes(
  jpegBytes: Uint8Array,
  pixelWidth: number,
  pixelHeight: number
): Uint8Array<ArrayBuffer> {
  const pageWidthPt = 842;
  const pageHeightPt = 595;

  const chunks: Uint8Array[] = [];
  const offsets: number[] = [0]; // obj 0 free entry
  let cursor = 0;

  const push = (chunk: Uint8Array) => {
    chunks.push(chunk);
    cursor += chunk.length;
  };
  const pushText = (txt: string) => push(asciiBytes(txt));

  // Header + binary comment
  pushText('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');

  // Object 1: Catalog
  offsets.push(cursor);
  pushText('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

  // Object 2: Pages
  offsets.push(cursor);
  pushText('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');

  // Object 3: Page (A4 Landscape 842x595)
  offsets.push(cursor);
  pushText(
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidthPt} ${pageHeightPt}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`
  );

  // Object 4: JPEG Image XObject
  offsets.push(cursor);
  pushText(
    `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${pixelWidth} /Height ${pixelHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`
  );
  push(jpegBytes);
  pushText('\nendstream\nendobj\n');

  // Object 5: Content stream drawing image full-bleed
  const contentCmd = `q\n${pageWidthPt} 0 0 ${pageHeightPt} 0 0 cm\n/Im0 Do\nQ\n`;
  offsets.push(cursor);
  pushText(`5 0 obj\n<< /Length ${contentCmd.length} >>\nstream\n${contentCmd}endstream\nendobj\n`);

  // Cross-reference table
  const xrefStart = cursor;
  pushText(`xref\n0 ${offsets.length}\n`);
  pushText('0000000000 65535 f \n');
  for (let i = 1; i < offsets.length; i += 1) {
    pushText(`${String(offsets[i]).padStart(10, '0')} 00000 n \n`);
  }

  // Trailer
  pushText(
    `trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`
  );

  const totalLen = chunks.reduce((sum, c) => sum + c.length, 0);
  const merged = new Uint8Array(new ArrayBuffer(totalLen));
  let pos = 0;
  for (const c of chunks) {
    merged.set(c, pos);
    pos += c.length;
  }
  return merged;
}
