import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { transform } from 'esbuild';

const root = process.cwd();
const distDir = path.join(root, 'dist');
const publicDir = path.join(root, 'public');

const PROD_BASE_URL =
  process.env.TILAWA_PUBLIC_URL ||
  'https://ais-pre-yohyjyrr4bd6elu2ixq7e7-1009876701033.europe-west2.run.app';
const DEV_BASE_URL =
  process.env.TILAWA_DEV_URL ||
  'https://ais-dev-yohyjyrr4bd6elu2ixq7e7-1009876701033.europe-west2.run.app';

function mimeForExt(ext) {
  switch (ext.toLowerCase()) {
    case '.png':
      return 'image/png';
    case '.svg':
      return 'image/svg+xml';
    case '.webp':
      return 'image/webp';
    case '.woff2':
      return 'font/woff2';
    default:
      return 'image/jpeg';
  }
}

function toDataUri(filePath) {
  const buf = fs.readFileSync(filePath);
  const mime = mimeForExt(path.extname(filePath));
  return `data:${mime};base64,${buf.toString('base64')}`;
}

function safeInlineScript(code) {
  return code.replace(/<\/script/gi, '<\\/script');
}

async function run() {
  const distIndexPath = path.join(distDir, 'index.html');
  if (!fs.existsSync(distIndexPath)) {
    throw new Error('dist/index.html not found. Run npm run build first.');
  }

  let html = fs.readFileSync(distIndexPath, 'utf8');

  // Collect compiled CSS files
  const cssHrefs = [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"[^>]*>/gi)].map(
    (m) => m[1]
  );
  let inlinedCss = '';
  for (const href of cssHrefs) {
    const cssPath = path.join(distDir, href.replace(/^\//, ''));
    if (fs.existsSync(cssPath)) {
      let css = fs.readFileSync(cssPath, 'utf8');
      const fontPath = path.join(publicDir, 'fonts/UthmanicHafs.woff2');
      if (fs.existsSync(fontPath)) {
        css = css.replace(/\/fonts\/UthmanicHafs\.woff2/g, toDataUri(fontPath));
      }
      inlinedCss += `\n${css}`;
    }
  }

  // Collect compiled JS entry scripts
  const jsSrcs = [
    ...html.matchAll(/<script[^>]+src="([^"]+)"[^>]*><\/script>/gi),
  ]
    .map((m) => m[1])
    .filter((src) => !src.includes('registerSW'));

  let combinedJs = '';
  for (const src of jsSrcs) {
    const jsPath = path.join(distDir, src.replace(/^\//, ''));
    if (fs.existsSync(jsPath)) {
      combinedJs += `\n${fs.readFileSync(jsPath, 'utf8')}`;
    }
  }

  // Inline reciter portraits, basira covers & hero image into JS bundle so standalone index.html works 100% offline via file://
  const recitersImgDir = path.join(publicDir, 'images/reciters');
  if (fs.existsSync(recitersImgDir)) {
    for (const file of fs.readdirSync(recitersImgDir)) {
      const fullPath = path.join(recitersImgDir, file);
      if (fs.statSync(fullPath).isFile()) {
        const webPath = `/images/reciters/${file}`;
        combinedJs = combinedJs.split(webPath).join(toDataUri(fullPath));
      }
    }
  }

  const basiraImgDir = path.join(publicDir, 'images/basira');
  if (fs.existsSync(basiraImgDir)) {
    for (const file of fs.readdirSync(basiraImgDir)) {
      const fullPath = path.join(basiraImgDir, file);
      if (fs.statSync(fullPath).isFile()) {
        const webPath = `/images/basira/${file}`;
        combinedJs = combinedJs.split(webPath).join(toDataUri(fullPath));
      }
    }
  }

  const publicRootImagesDir = path.join(publicDir, 'images');
  if (fs.existsSync(publicRootImagesDir)) {
    for (const file of fs.readdirSync(publicRootImagesDir)) {
      const fullPath = path.join(publicRootImagesDir, file);
      if (fs.statSync(fullPath).isFile()) {
        const webPath = `/images/${file}`;
        combinedJs = combinedJs.split(webPath).join(toDataUri(fullPath));
      }
    }
  }

  const assetsImgDir = path.join(root, 'src/assets/images');
  if (fs.existsSync(assetsImgDir)) {
    for (const file of fs.readdirSync(assetsImgDir)) {
      const fullPath = path.join(assetsImgDir, file);
      if (fs.statSync(fullPath).isFile()) {
        combinedJs = combinedJs
          .split(`/src/assets/images/${file}`)
          .join(toDataUri(fullPath));
      }
    }
  }

  // Convert ESM module bundle to classic IIFE so double-clicking file:///index.html works without CORS issues
  const iifeResult = await transform(combinedJs, {
    format: 'iife',
    loader: 'js',
    minify: true,
    legalComments: 'none',
  });

  // Read complete 114-surah Uthmani Quran dataset
  const quranJsonPath = path.join(publicDir, 'data/quran-uthmani.json');
  const quranJsonRaw = fs.existsSync(quranJsonPath)
    ? fs.readFileSync(quranJsonPath, 'utf8')
    : '[]';

  // Inline SVG icon as data URI
  const iconSvgPath = path.join(publicDir, 'icon.svg');
  const iconDataUri = fs.existsSync(iconSvgPath) ? toDataUri(iconSvgPath) : '';

  // Clean head/body tags that depend on external network or HTTP server paths
  html = html
    .replace(/<link[^>]+rel="stylesheet"[^>]*>/gi, '')
    .replace(/<link[^>]+rel="manifest"[^>]*>/gi, '')
    .replace(/<link[^>]+rel="preload"[^>]*>/gi, '')
    .replace(/<link[^>]+rel="preconnect"[^>]*>/gi, '')
    .replace(/<link[^>]+fonts\.googleapis\.com[^>]*>/gi, '')
    .replace(/<link[^>]+rel="apple-touch-icon"[^>]*>/gi, '')
    .replace(/<script\b[^>]*\bsrc="[^"]+"[^>]*><\/script>/gi, '');

  if (iconDataUri) {
    html = html.replace(/href="\/icon\.svg"/g, () => `href="${iconDataUri}"`);
  }

  // Inject CSS cleanly before </head> using a function replacer (avoids $' / $$ corruption!)
  html = html.replace('</head>', () => `<style>${inlinedCss}</style>\n</head>`);

  // Inject embedded full Quran dataset + standalone app script before </body>
  const offlineBundleScripts = [
    `<script>window.__TILAWA_OFFLINE_QURAN__=${safeInlineScript(quranJsonRaw)};</script>`,
    `<script>${safeInlineScript(iifeResult.code)}</script>`,
  ].join('\n');

  html = html.replace('</body>', () => `${offlineBundleScripts}\n</body>`);

  const publicOutDir = path.join(publicDir, 'downloads');
  const distOutDir = path.join(distDir, 'downloads');
  fs.mkdirSync(publicOutDir, { recursive: true });
  fs.mkdirSync(distOutDir, { recursive: true });

  const outPublicFile = path.join(publicOutDir, 'index.html');
  const outDistFile = path.join(distOutDir, 'index.html');

  fs.writeFileSync(outPublicFile, html, 'utf8');
  fs.writeFileSync(outDistFile, html, 'utf8');

  const htmlBuf = Buffer.from(html, 'utf8');
  const sha256 = crypto.createHash('sha256').update(htmlBuf).digest('hex');
  const builtAt = new Date().toISOString();
  const otaManifest = {
    version: `1.0.${sha256.slice(0, 8)}`,
    builtAt,
    sha256,
    sizeBytes: htmlBuf.byteLength,
    bundleUrl: `${PROD_BASE_URL.replace(/\/$/, '')}/downloads/index.html`,
    devBundleUrl: `${DEV_BASE_URL.replace(/\/$/, '')}/downloads/index.html`,
  };
  const manifestJson = JSON.stringify(otaManifest, null, 2);
  fs.writeFileSync(path.join(publicOutDir, 'ota-manifest.json'), manifestJson, 'utf8');
  fs.writeFileSync(path.join(distOutDir, 'ota-manifest.json'), manifestJson, 'utf8');

  const sizeMb = (htmlBuf.byteLength / 1024 / 1024).toFixed(2);
  console.log(
    `Generated standalone offline index.html (${sizeMb} MB, sha256:${sha256.slice(0, 12)}) & ota-manifest.json`
  );
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

