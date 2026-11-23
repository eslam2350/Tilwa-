import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildLandscapeA4PdfFromJpegBytes,
  decodeBase64DataUrlToBytes,
} from './pdfExport';

test('decodeBase64DataUrlToBytes decodes standard data URL payload', () => {
  const bytes = decodeBase64DataUrlToBytes('data:image/jpeg;base64,/9j/4AAQSkZJRg==');
  assert.equal(bytes[0], 0xff);
  assert.equal(bytes[1], 0xd8);
  assert.equal(bytes[2], 0xff);
});

test('buildLandscapeA4PdfFromJpegBytes emits valid PDF-1.4 structure with xref and A4 Landscape box', () => {
  const fakeJpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0xff, 0xd9]);
  const pdf = buildLandscapeA4PdfFromJpegBytes(fakeJpeg, 1800, 1260);
  const text = Buffer.from(pdf).toString('latin1');

  assert.equal(text.startsWith('%PDF-1.4\n'), true);
  assert.equal(text.includes('/MediaBox [0 0 842 595]'), true);
  assert.equal(text.includes('/Width 1800 /Height 1260'), true);
  assert.equal(text.includes('/Filter /DCTDecode /Length 8'), true);
  assert.equal(text.includes('\nxref\n0 6\n'), true);
  assert.equal(text.includes('trailer\n<< /Size 6 /Root 1 0 R >>'), true);
  assert.equal(text.trimEnd().endsWith('%%EOF'), true);

  // Verify xref byte offset for object 1 points directly to "1 0 obj"
  const xrefLine1 = text.match(/0000000000 65535 f \n(\d{10}) 00000 n /);
  assert.ok(xrefLine1);
  const obj1Offset = Number(xrefLine1[1]);
  assert.equal(text.slice(obj1Offset, obj1Offset + 7), '1 0 obj');
});
