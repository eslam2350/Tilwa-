import type { CertificateTemplateId, DynamicCertificatesConfig } from '../types/tilawa';
import type { CertificateEvaluation } from './certificateHelpers';
import {
  DEFAULT_CERTIFICATES,
  getCertificateTemplateTheme,
} from './dynamicConfigHelpers';
import {
  buildLandscapeA4PdfFromJpegBytes,
  decodeBase64DataUrlToBytes,
} from './pdfExport';
import { toArabicDigits } from './quranHelpers';

function formatArabicCertificateDate(date = new Date()): {
  gregorian: string;
  hijri: string;
} {
  const gregorian = date.toLocaleDateString('ar-EG', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  let hijri = '';
  try {
    hijri = new Intl.DateTimeFormat('ar-SA-u-ca-islamic', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date);
  } catch {
    hijri = '';
  }
  return { gregorian, hijri };
}

function wrapArabicText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawEightPointMandala(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  strokeStyle: string
) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = strokeStyle;
  ctx.lineWidth = 1.6;

  for (let i = 0; i < 4; i += 1) {
    ctx.save();
    ctx.rotate((i * Math.PI) / 4);
    const side = radius * 1.41;
    ctx.strokeRect(-side / 2, -side / 2, side, side);
    ctx.restore();
  }

  for (const r of [radius * 0.62, radius * 0.88, radius * 1.06]) {
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawCornerOrnament(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  flipX: number,
  flipY: number,
  accentColor: string,
  emeraldColor: string
) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(flipX, flipY);

  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 3.2;
  ctx.beginPath();
  ctx.moveTo(0, 88);
  ctx.lineTo(0, 0);
  ctx.lineTo(88, 0);
  ctx.stroke();

  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(16, 66);
  ctx.lineTo(16, 16);
  ctx.lineTo(66, 16);
  ctx.stroke();

  // Corner 8-point miniature rosette
  ctx.strokeStyle = emeraldColor;
  ctx.lineWidth = 1.4;
  ctx.save();
  ctx.translate(16, 16);
  ctx.strokeRect(-8, -8, 16, 16);
  ctx.rotate(Math.PI / 4);
  ctx.strokeRect(-8, -8, 16, 16);
  ctx.restore();

  ctx.fillStyle = accentColor;
  ctx.beginPath();
  ctx.arc(16, 16, 4.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawCalligraphicSignatureStroke(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  accentColor: string
) {
  ctx.save();
  ctx.translate(cx - 115, cy - 18);
  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 3.2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.beginPath();
  ctx.moveTo(10, 26);
  ctx.bezierCurveTo(38, -8, 66, 34, 92, 12);
  ctx.bezierCurveTo(116, -6, 138, 28, 168, 8);
  ctx.bezierCurveTo(188, -4, 206, 22, 222, 14);
  ctx.stroke();

  ctx.globalAlpha = 0.72;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(24, 35);
  ctx.quadraticCurveTo(115, 45, 210, 29);
  ctx.stroke();
  ctx.restore();
}

async function renderCertificateCanvas(
  certificate: CertificateEvaluation,
  recipientNameInput: string,
  certConfig: DynamicCertificatesConfig = DEFAULT_CERTIFICATES,
  templateOverride?: CertificateTemplateId
): Promise<HTMLCanvasElement | null> {
  if (typeof document === 'undefined') return null;

  try {
    if (document.fonts && document.fonts.ready) {
      await Promise.race([
        document.fonts.ready,
        new Promise((resolve) => setTimeout(resolve, 1200)),
      ]);
    }
  } catch {
    // proceed with system Arabic fallback fonts
  }

  const theme = getCertificateTemplateTheme(templateOverride || certConfig.defaultTemplate);
  const width = 1800;
  const height = 1260;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.direction = 'rtl';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Background Gradient
  const bgGrad = ctx.createRadialGradient(
    width * 0.5,
    height * 0.45,
    120,
    width * 0.5,
    height * 0.5,
    width * 0.75
  );
  bgGrad.addColorStop(0, theme.bgInnerStop);
  bgGrad.addColorStop(0.55, theme.bgMidStop);
  bgGrad.addColorStop(1, theme.bgOuterStop);
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Subtle geometric diamond trellis
  ctx.save();
  ctx.strokeStyle = theme.isLightPaper
    ? 'rgba(158, 115, 36, 0.065)'
    : 'rgba(214, 177, 92, 0.042)';
  ctx.lineWidth = 1.4;
  for (let x = -height; x < width + height; x += 96) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + height, height);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x, height);
    ctx.lineTo(x + height, 0);
    ctx.stroke();
  }
  ctx.restore();

  // Centered Khatam 8-point Mandala Watermark
  drawEightPointMandala(
    ctx,
    width / 2,
    height * 0.52,
    275,
    theme.isLightPaper ? 'rgba(158, 115, 36, 0.085)' : 'rgba(214, 177, 92, 0.065)'
  );

  // Triple Archival Illuminated Frame
  ctx.strokeStyle = theme.accentColor;
  ctx.lineWidth = 6;
  drawRoundedRect(ctx, 38, 38, width - 76, height - 76, 36);
  ctx.stroke();

  ctx.save();
  ctx.setLineDash([8, 6]);
  ctx.strokeStyle = theme.accentSoftColor;
  ctx.lineWidth = 2;
  drawRoundedRect(ctx, 56, 56, width - 112, height - 112, 28);
  ctx.stroke();
  ctx.restore();

  ctx.strokeStyle = theme.isLightPaper ? 'rgba(14, 107, 77, 0.42)' : theme.accentSoftColor;
  ctx.lineWidth = 2.2;
  drawRoundedRect(ctx, 74, 74, width - 148, height - 148, 22);
  ctx.stroke();

  // Four Ornate Arabesque Corners
  drawCornerOrnament(ctx, 102, 102, 1, 1, theme.accentColor, theme.emeraldColor);
  drawCornerOrnament(ctx, width - 102, 102, -1, 1, theme.accentColor, theme.emeraldColor);
  drawCornerOrnament(ctx, 102, height - 102, 1, -1, theme.accentColor, theme.emeraldColor);
  drawCornerOrnament(
    ctx,
    width - 102,
    height - 102,
    -1,
    -1,
    theme.accentColor,
    theme.emeraldColor
  );

  // Top Header Medallion Pill
  ctx.fillStyle = theme.isLightPaper ? 'rgba(14, 107, 77, 0.12)' : 'rgba(14, 107, 77, 0.28)';
  ctx.strokeStyle = theme.accentColor;
  ctx.lineWidth = 2;
  drawRoundedRect(ctx, width / 2 - 280, 110, 560, 50, 25);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = theme.isLightPaper ? theme.badgeBg : theme.accentColor;
  ctx.font = '700 22px "IBM Plex Sans Arabic", Arial, sans-serif';
  ctx.fillText(certConfig.platformTitleAr || DEFAULT_CERTIFICATES.platformTitleAr, width / 2, 135);

  // Basmalah
  ctx.fillStyle = theme.accentColor;
  ctx.font = '700 32px "Amiri Quran", "Amiri", Georgia, serif';
  ctx.fillText('بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ', width / 2, 204);

  // Main Certificate Heading
  ctx.fillStyle = theme.primaryTextColor;
  ctx.font = '700 72px "Amiri", Georgia, serif';
  ctx.fillText('شَهَادَةُ شُكْرٍ وَتَقْدِير', width / 2, 304);

  // Ornamental Diamond Divider
  const lineGrad = ctx.createLinearGradient(width * 0.2, 0, width * 0.8, 0);
  lineGrad.addColorStop(0, 'rgba(200, 162, 83, 0)');
  lineGrad.addColorStop(0.5, theme.accentColor);
  lineGrad.addColorStop(1, 'rgba(200, 162, 83, 0)');
  ctx.strokeStyle = lineGrad;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(width * 0.2, 366);
  ctx.lineTo(width * 0.8, 366);
  ctx.stroke();

  ctx.save();
  ctx.translate(width / 2, 366);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = theme.accentColor;
  ctx.fillRect(-8, -8, 16, 16);
  ctx.restore();

  // Category Title
  ctx.fillStyle = theme.emeraldColor;
  ctx.font = '700 30px "IBM Plex Sans Arabic", Arial, sans-serif';
  ctx.fillText(certificate.titleAr, width / 2, 418);

  // Recipient Preamble
  ctx.fillStyle = theme.secondaryTextColor;
  ctx.font = '500 25px "IBM Plex Sans Arabic", Arial, sans-serif';
  ctx.fillText('تتشرف إدارة منصة تلاوة بمنح هذه الشهادة التقديرية الموثقة إلى:', width / 2, 478);

  // Recipient Name Plate with Gold Trim
  const displayName = recipientNameInput.trim() || 'قارئ وحافظ كتاب الله العزيز';
  ctx.fillStyle = theme.namePlateBg;
  ctx.strokeStyle = theme.accentColor;
  ctx.lineWidth = 2.4;
  drawRoundedRect(ctx, width / 2 - 460, 520, 920, 112, 24);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = theme.isLightPaper ? theme.primaryTextColor : '#F8DC94';
  ctx.font = '700 54px "Amiri", Georgia, serif';
  ctx.fillText(displayName, width / 2, 576);

  // Achievement Seal Badge
  ctx.fillStyle = theme.badgeBg;
  drawRoundedRect(ctx, width / 2 - 235, 658, 470, 44, 22);
  ctx.fill();
  ctx.fillStyle = theme.badgeText;
  ctx.font = '700 22px "IBM Plex Sans Arabic", Arial, sans-serif';
  ctx.fillText(certificate.badgeLabelAr, width / 2, 680);

  // Citation Paragraph
  ctx.fillStyle = theme.bodyTextColor;
  ctx.font = '500 27px "IBM Plex Sans Arabic", Arial, sans-serif';
  const citationLines = wrapArabicText(ctx, certificate.citationAr, 1340);
  let yCursor = 758;
  for (const line of citationLines.slice(0, 3)) {
    ctx.fillText(line, width / 2, yCursor);
    yCursor += 46;
  }

  // Blessing Hadith / Verse
  ctx.fillStyle = theme.accentColor;
  ctx.font = '700 29px "Amiri", Georgia, serif';
  ctx.fillText(
    certConfig.blessingVerseAr || DEFAULT_CERTIFICATES.blessingVerseAr,
    width / 2,
    928
  );

  // Footer Row Divider
  ctx.strokeStyle = theme.accentSoftColor;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(150, 976);
  ctx.lineTo(width - 150, 976);
  ctx.stroke();

  // Footer Date Block (Right)
  const { gregorian, hijri } = formatArabicCertificateDate();
  ctx.textAlign = 'center';
  ctx.fillStyle = theme.secondaryTextColor;
  ctx.font = '500 20px "IBM Plex Sans Arabic", Arial, sans-serif';
  ctx.fillText('تاريخ الإصدار والاعتماد', width - 340, 1024);
  ctx.fillStyle = theme.primaryTextColor;
  ctx.font = '700 22px "IBM Plex Sans Arabic", Arial, sans-serif';
  ctx.fillText(hijri ? `${hijri}` : gregorian, width - 340, 1064);
  if (hijri) {
    ctx.fillStyle = theme.secondaryTextColor;
    ctx.font = '500 18px "IBM Plex Sans Arabic", Arial, sans-serif';
    ctx.fillText(gregorian, width - 340, 1102);
  }

  // Center Official Dual-Circle Embossed Medallion Seal
  ctx.save();
  ctx.translate(width / 2, 1068);
  ctx.fillStyle = theme.isLightPaper ? 'rgba(158, 115, 36, 0.10)' : 'rgba(214, 177, 92, 0.14)';
  ctx.strokeStyle = theme.accentColor;
  ctx.lineWidth = 3.2;
  ctx.beginPath();
  ctx.arc(0, 0, 88, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = theme.emeraldColor;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 74, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = theme.isLightPaper ? theme.primaryTextColor : theme.accentColor;
  ctx.font = '700 15px "IBM Plex Sans Arabic", Arial, sans-serif';
  ctx.fillText(certConfig.stampLabelAr || 'ختم تلاوة', 0, -24);
  ctx.fillStyle = theme.primaryTextColor;
  ctx.font = '700 14px "JetBrains Mono", monospace';
  ctx.fillText(certificate.sealNumber, 0, 6);
  ctx.fillStyle = theme.emeraldColor;
  ctx.font = '700 13px "IBM Plex Sans Arabic", Arial, sans-serif';
  ctx.fillText(`معتمدة ${toArabicDigits(new Date().getFullYear())}`, 0, 34);
  ctx.restore();

  // Left Block: Platform Official Endorsement Signature (Platform name only)
  const rawSignerTitle = (certConfig.signerTitleAr || '').trim();
  const safeSignerTitle =
    !rawSignerTitle || /(مؤسس|المطور)/.test(rawSignerTitle)
      ? DEFAULT_CERTIFICATES.signerTitleAr
      : rawSignerTitle;
  const rawSignerName = (certConfig.signerName || '').trim();
  const safeSignerName =
    !rawSignerName ||
    /^(eslam(\s+(mohammad|mohamed|khalifa))?|إسلام\s+محمد)$/i.test(rawSignerName)
      ? DEFAULT_CERTIFICATES.signerName
      : rawSignerName;

  ctx.fillStyle = theme.secondaryTextColor;
  ctx.font = '500 19px "IBM Plex Sans Arabic", Arial, sans-serif';
  ctx.fillText(safeSignerTitle, 350, 1002);

  if (certConfig.signatureStyle !== 'modern_minimal') {
    drawCalligraphicSignatureStroke(
      ctx,
      350,
      1034,
      theme.isLightPaper ? theme.accentColor : '#F5D88E'
    );
  }
  ctx.fillStyle = theme.isLightPaper ? theme.primaryTextColor : '#F8DC94';
  ctx.font = '700 28px "Amiri", "IBM Plex Sans Arabic", Georgia, serif';
  ctx.fillText(safeSignerName, 350, 1084);
  ctx.fillStyle = theme.emeraldColor;
  ctx.font = '600 17px "IBM Plex Sans Arabic", Arial, sans-serif';
  ctx.fillText('الاعتماد الرسمي لمنصة تلاوة', 350, 1122);

  return canvas;
}

export async function renderCertificateToDataUrl(
  certificate: CertificateEvaluation,
  recipientNameInput: string,
  certConfig: DynamicCertificatesConfig = DEFAULT_CERTIFICATES,
  templateOverride?: CertificateTemplateId
): Promise<string> {
  const canvas = await renderCertificateCanvas(
    certificate,
    recipientNameInput,
    certConfig,
    templateOverride
  );
  return canvas ? canvas.toDataURL('image/png', 1.0) : '';
}

export async function downloadCertificatePng(
  certificate: CertificateEvaluation,
  recipientNameInput: string,
  certConfig?: DynamicCertificatesConfig,
  templateOverride?: CertificateTemplateId
): Promise<string> {
  const dataUrl = await renderCertificateToDataUrl(
    certificate,
    recipientNameInput,
    certConfig,
    templateOverride
  );
  if (!dataUrl || typeof document === 'undefined') return '';

  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = `tilawa-certificate-${certificate.sealNumber.toLowerCase()}.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  return dataUrl;
}

export async function downloadCertificatePdf(
  certificate: CertificateEvaluation,
  recipientNameInput: string,
  certConfig: DynamicCertificatesConfig = DEFAULT_CERTIFICATES,
  templateOverride?: CertificateTemplateId
): Promise<boolean> {
  const canvas = await renderCertificateCanvas(
    certificate,
    recipientNameInput,
    certConfig,
    templateOverride
  );
  if (!canvas || typeof document === 'undefined') return false;

  const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.96);
  const jpegBytes = decodeBase64DataUrlToBytes(jpegDataUrl);
  const pdfBytes = buildLandscapeA4PdfFromJpegBytes(jpegBytes, canvas.width, canvas.height);

  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = `tilawa-certificate-${certificate.sealNumber.toLowerCase()}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
  return true;
}
