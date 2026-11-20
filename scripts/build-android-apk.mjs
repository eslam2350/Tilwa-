import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const androidSrcDir = path.join(root, 'android-app');
const standaloneHtmlPath = path.join(root, 'public/downloads/index.html');
const icon512Path = path.join(root, 'public/pwa-512x512.png');
const icon192Path = path.join(root, 'public/pwa-192x192.png');
const outApkPublic = path.join(root, 'public/downloads/debug.apk');
const outApkDist = path.join(root, 'dist/downloads/debug.apk');
const keystorePath = path.join(androidSrcDir, 'debug.keystore');

function resolveFirstExisting(candidates, label) {
  for (const c of candidates) {
    if (c && fs.existsSync(c)) return c;
  }
  throw new Error(`Missing required Android build tool (${label}). Checked: ${candidates.join(', ')}`);
}

function runTool(cmd, args, options = {}) {
  execFileSync(cmd, args, { stdio: 'inherit', ...options });
}

function ensureDebugKeystore() {
  if (fs.existsSync(keystorePath)) return;
  fs.mkdirSync(path.dirname(keystorePath), { recursive: true });
  runTool('keytool', [
    '-genkeypair',
    '-v',
    '-keystore',
    keystorePath,
    '-alias',
    'androiddebugkey',
    '-keyalg',
    'RSA',
    '-keysize',
    '2048',
    '-validity',
    '10000',
    '-storepass',
    'android',
    '-keypass',
    'android',
    '-dname',
    'CN=Android Debug,O=Android,C=US',
  ]);
}

function main() {
  if (!fs.existsSync(standaloneHtmlPath)) {
    throw new Error('public/downloads/index.html not found. Run "npm run build" first.');
  }

  const androidJar = resolveFirstExisting(
    [
      '/usr/lib/android-sdk/platforms/android-23/android.jar',
      '/usr/share/android-sdk/platforms/android-23/android.jar',
    ],
    'android.jar'
  );
  const aaptBin = resolveFirstExisting(
    ['/usr/bin/aapt', '/usr/lib/android-sdk/build-tools/debian/aapt'],
    'aapt'
  );
  const d8Bin = resolveFirstExisting(
    [
      '/usr/lib/android-sdk/build-tools/debian/d8',
      '/usr/lib/android-sdk/build-tools/29.0.3/d8',
      '/usr/bin/d8',
      '/usr/lib/android-sdk/build-tools/debian/dx',
      '/usr/bin/dx',
    ],
    'd8/dx'
  );
  const zipalignBin = resolveFirstExisting(
    ['/usr/bin/zipalign', '/usr/lib/android-sdk/build-tools/debian/zipalign'],
    'zipalign'
  );
  const apksignerBin = resolveFirstExisting(
    ['/usr/bin/apksigner', '/usr/lib/android-sdk/build-tools/debian/apksigner'],
    'apksigner'
  );

  const workDir = '/tmp/tilawa-apk-build';
  fs.rmSync(workDir, { recursive: true, force: true });
  const stageRes = path.join(workDir, 'res');
  const stageAssets = path.join(workDir, 'assets');
  const stageGen = path.join(workDir, 'gen');
  const stageClasses = path.join(workDir, 'classes');
  const stageDex = path.join(workDir, 'dex');

  fs.mkdirSync(path.join(stageRes, 'values'), { recursive: true });
  fs.mkdirSync(path.join(stageRes, 'mipmap-xxxhdpi'), { recursive: true });
  fs.mkdirSync(path.join(stageRes, 'mipmap-xxhdpi'), { recursive: true });
  fs.mkdirSync(stageAssets, { recursive: true });
  fs.mkdirSync(stageGen, { recursive: true });
  fs.mkdirSync(stageClasses, { recursive: true });
  fs.mkdirSync(stageDex, { recursive: true });

  // Copy resources & icons
  fs.copyFileSync(
    path.join(androidSrcDir, 'res/values/strings.xml'),
    path.join(stageRes, 'values/strings.xml')
  );
  fs.copyFileSync(icon512Path, path.join(stageRes, 'mipmap-xxxhdpi/ic_launcher.png'));
  fs.copyFileSync(icon192Path, path.join(stageRes, 'mipmap-xxhdpi/ic_launcher.png'));

  // Bundle complete standalone offline web app inside Android APK assets
  fs.copyFileSync(standaloneHtmlPath, path.join(stageAssets, 'index.html'));

  const manifestPath = path.join(androidSrcDir, 'AndroidManifest.xml');

  // 1. Generate R.java
  runTool(aaptBin, [
    'package',
    '-f',
    '-m',
    '-J',
    stageGen,
    '-M',
    manifestPath,
    '-S',
    stageRes,
    '-I',
    androidJar,
  ]);

  // 2. Compile Java sources targeting Java 8 bytecode compatible with Android Dalvik/ART
  const mainJava = path.join(androidSrcDir, 'src/com/eslammohammad/tilawa/MainActivity.java');
  const rJava = path.join(stageGen, 'com/eslammohammad/tilawa/R.java');
  runTool('javac', [
    '--release',
    '8',
    '-classpath',
    androidJar,
    '-d',
    stageClasses,
    mainJava,
    rJava,
  ]);

  // Collect compiled .class files
  const classFiles = [];
  function walkClasses(dir) {
    for (const entry of fs.readdirSync(dir)) {
      const p = path.join(dir, entry);
      if (fs.statSync(p).isDirectory()) walkClasses(p);
      else if (entry.endsWith('.class')) classFiles.push(p);
    }
  }
  walkClasses(stageClasses);

  // 3. Convert JVM bytecode to Android classes.dex
  if (d8Bin.endsWith('d8')) {
    runTool(d8Bin, ['--lib', androidJar, '--min-api', '23', '--output', stageDex, ...classFiles]);
  } else {
    runTool(d8Bin, ['--dex', `--output=${path.join(stageDex, 'classes.dex')}`, stageClasses]);
  }

  // 4. Package resources + assets into base unsigned APK (with debug mode flag)
  const unsignedApk = path.join(workDir, 'tilawa-unsigned.apk');
  runTool(aaptBin, [
    'package',
    '-f',
    '--debug-mode',
    '-M',
    manifestPath,
    '-S',
    stageRes,
    '-A',
    stageAssets,
    '-I',
    androidJar,
    '-F',
    unsignedApk,
  ]);

  // 5. Add classes.dex to the root of the APK archive
  runTool(aaptBin, ['add', unsignedApk, 'classes.dex'], { cwd: stageDex });

  // 6. Align APK on 4-byte boundaries
  const alignedApk = path.join(workDir, 'tilawa-aligned.apk');
  runTool(zipalignBin, ['-f', '-p', '4', unsignedApk, alignedApk]);

  // 7. Sign APK with standard Android debug keystore (v1 + v2 APK Signature Scheme)
  ensureDebugKeystore();
  const signedApk = path.join(workDir, 'debug.apk');
  runTool(apksignerBin, [
    'sign',
    '--ks',
    keystorePath,
    '--ks-pass',
    'pass:android',
    '--ks-key-alias',
    'androiddebugkey',
    '--key-pass',
    'pass:android',
    '--v1-signing-enabled',
    'true',
    '--v2-signing-enabled',
    'true',
    '--out',
    signedApk,
    alignedApk,
  ]);

  // 8. Verify signature integrity
  runTool(apksignerBin, ['verify', '--verbose', signedApk]);

  // 9. Copy verified debug.apk to public/downloads and dist/downloads
  fs.mkdirSync(path.dirname(outApkPublic), { recursive: true });
  fs.copyFileSync(signedApk, outApkPublic);
  if (fs.existsSync(path.join(root, 'dist'))) {
    fs.mkdirSync(path.dirname(outApkDist), { recursive: true });
    fs.copyFileSync(signedApk, outApkDist);
  }

  // Clean up temp dir
  fs.rmSync(workDir, { recursive: true, force: true });

  const sizeMb = (fs.statSync(outApkPublic).size / 1024 / 1024).toFixed(2);
  console.log(`\nSuccessfully built & verified Android APK (${sizeMb} MB):`);
  console.log(`  - ${outApkPublic}`);
  if (fs.existsSync(outApkDist)) {
    console.log(`  - ${outApkDist}`);
  }
}

main();
