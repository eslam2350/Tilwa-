package com.eslammohammad.tilawa;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ApplicationInfo;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import org.json.JSONObject;
import java.io.BufferedInputStream;
import java.io.BufferedReader;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;

public class MainActivity extends Activity {
    private static final String PREFS_NAME = "tilawa_ota_prefs";
    private static final String KEY_CACHED_VERSION = "cached_version";
    private static final String KEY_CACHED_SHA = "cached_sha256";
    private static final String KEY_PENDING_VERSION = "pending_version";
    private static final String KEY_SERVER_ORIGIN = "server_origin";
    private static final String APP_VERSION_NAME = "2.0.0";
    private static final String[] MANIFEST_URLS = new String[] {
            "https://ais-pre-yohyjyrr4bd6elu2ixq7e7-1009876701033.europe-west2.run.app/downloads/ota-manifest.json",
            "https://ais-dev-yohyjyrr4bd6elu2ixq7e7-1009876701033.europe-west2.run.app/downloads/ota-manifest.json",
            "https://phat-invention-llcf1.web.app/downloads/ota-manifest.json"
    };

    private WebView webView;
    private volatile boolean isCheckingOta = false;
    private volatile boolean otaUpdateReady = false;
    private volatile long lastCheckTimestampMs = 0L;
    private boolean autoCheckTriggered = false;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        if ((getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0) {
            WebView.setWebContentsDebuggingEnabled(true);
        }

        applySystemBarColors(0xFF0A0D0C);

        webView = new WebView(this);
        webView.setBackgroundColor(0xFF0A0D0C);
        webView.setLayoutDirection(View.LAYOUT_DIRECTION_RTL);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setAllowFileAccessFromFileURLs(true);
        settings.setAllowUniversalAccessFromFileURLs(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);
        settings.setSupportZoom(false);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            settings.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
        }

        webView.addJavascriptInterface(new TilawaJsBridge(), "TilawaAndroid");
        webView.setWebChromeClient(new WebChromeClient());
        webView.setDownloadListener(new android.webkit.DownloadListener() {
            @Override
            public void onDownloadStart(
                    String url,
                    String userAgent,
                    String contentDisposition,
                    String mimetype,
                    long contentLength
            ) {
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
                } catch (Exception ignored) {
                }
            }
        });
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                if (url == null) return false;
                Uri uri = Uri.parse(url);
                String scheme = uri.getScheme();
                if ("file".equalsIgnoreCase(scheme)) {
                    return false;
                }
                if ("http".equalsIgnoreCase(scheme) || "https".equalsIgnoreCase(scheme)) {
                    try {
                        startActivity(new Intent(Intent.ACTION_VIEW, uri));
                    } catch (Exception ignored) {
                    }
                    return true;
                }
                return false;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                if (!autoCheckTriggered) {
                    autoCheckTriggered = true;
                    view.postDelayed(new Runnable() {
                        @Override
                        public void run() {
                            startBackgroundOtaCheck(null);
                        }
                    }, 900);
                }
            }
        });

        setContentView(webView);
        loadActiveBundle();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (autoCheckTriggered && (System.currentTimeMillis() - lastCheckTimestampMs) > 15000L) {
            startBackgroundOtaCheck(null);
        }
    }

    private File getOtaCacheDir() {
        File dir = new File(getFilesDir(), "ota_cache");
        if (!dir.exists()) {
            dir.mkdirs();
        }
        return dir;
    }

    private File getCachedBundleFile() {
        return new File(getOtaCacheDir(), "index.html");
    }

    private void loadActiveBundle() {
        File cached = getCachedBundleFile();
        if (cached.exists() && cached.length() > 500000L) {
            webView.loadUrl("file://" + cached.getAbsolutePath());
        } else {
            webView.loadUrl("file:///android_asset/index.html");
        }
    }

    private void applySystemBarColors(int colorInt) {
        Window window = getWindow();
        window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
        window.setStatusBarColor(colorInt);
        window.setNavigationBarColor(colorInt);
    }

    private void dispatchJsEvent(final String eventName, final String detailJson) {
        if (webView == null) return;
        webView.post(new Runnable() {
            @Override
            public void run() {
                String script = "window.dispatchEvent(new CustomEvent('" + eventName + "', { detail: " + detailJson + " }));";
                webView.evaluateJavascript(script, null);
            }
        });
    }

    private void startBackgroundOtaCheck(final String customManifestUrl) {
        if (isCheckingOta) return;
        isCheckingOta = true;
        lastCheckTimestampMs = System.currentTimeMillis();

        new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    String manifestRaw = null;
                    String activeManifestOrigin = null;

                    if (customManifestUrl != null && customManifestUrl.startsWith("http")) {
                        manifestRaw = fetchUrlString(appendCacheBust(customManifestUrl));
                        if (manifestRaw != null && !manifestRaw.isEmpty()) {
                            activeManifestOrigin = customManifestUrl;
                        }
                    }

                    if (manifestRaw == null || manifestRaw.isEmpty()) {
                        for (String candidateUrl : MANIFEST_URLS) {
                            String fetched = fetchUrlString(appendCacheBust(candidateUrl));
                            if (fetched != null && !fetched.isEmpty()) {
                                manifestRaw = fetched;
                                activeManifestOrigin = candidateUrl;
                                break;
                            }
                        }
                    }

                    if (manifestRaw == null || manifestRaw.isEmpty()) {
                        notifyOtaStatus();
                        return;
                    }

                    if (activeManifestOrigin != null) {
                        try {
                            Uri parsedOrigin = Uri.parse(activeManifestOrigin);
                            String originStr = parsedOrigin.getScheme() + "://" + parsedOrigin.getAuthority();
                            getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
                                    .edit()
                                    .putString(KEY_SERVER_ORIGIN, originStr)
                                    .apply();
                        } catch (Exception ignored) {
                        }
                    }

                    JSONObject manifest = new JSONObject(manifestRaw);
                    String remoteVersion = manifest.optString("version", "");
                    String remoteSha = manifest.optString("sha256", "");
                    String bundleUrl = manifest.optString("bundleUrl", "");
                    if (bundleUrl.isEmpty() && activeManifestOrigin != null) {
                        bundleUrl = activeManifestOrigin.replace("ota-manifest.json", "index.html");
                    }
                    if (bundleUrl.isEmpty() || remoteSha.isEmpty()) {
                        notifyOtaStatus();
                        return;
                    }

                    SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
                    String currentSha = prefs.getString(KEY_CACHED_SHA, "");
                    File cachedFile = getCachedBundleFile();

                    // Already running latest verified cached bundle
                    if (cachedFile.exists() && remoteSha.equalsIgnoreCase(currentSha)) {
                        notifyOtaStatus();
                        return;
                    }

                    // Download new bundle to temp file & verify SHA-256 + HTML markers
                    File tmpFile = new File(getOtaCacheDir(), "index.html.tmp");
                    String downloadedSha = downloadFileWithSha256(appendCacheBust(bundleUrl), tmpFile);
                    if ((downloadedSha == null || !downloadedSha.equalsIgnoreCase(remoteSha)) && activeManifestOrigin != null) {
                        // Retry directly against the active manifest's origin in case bundleUrl points elsewhere
                        String originFallbackBundle = activeManifestOrigin.replace("ota-manifest.json", "index.html");
                        if (!originFallbackBundle.equals(bundleUrl)) {
                            downloadedSha = downloadFileWithSha256(appendCacheBust(originFallbackBundle), tmpFile);
                        }
                    }
                    if (downloadedSha == null || !downloadedSha.equalsIgnoreCase(remoteSha)) {
                        if (tmpFile.exists()) tmpFile.delete();
                        notifyOtaStatus();
                        return;
                    }

                    if (!containsValidTilawaMarker(tmpFile)) {
                        tmpFile.delete();
                        notifyOtaStatus();
                        return;
                    }

                    if (cachedFile.exists()) {
                        cachedFile.delete();
                    }
                    if (!tmpFile.renameTo(cachedFile)) {
                        notifyOtaStatus();
                        return;
                    }

                    prefs.edit()
                            .putString(KEY_CACHED_VERSION, remoteVersion)
                            .putString(KEY_CACHED_SHA, remoteSha)
                            .putString(KEY_PENDING_VERSION, remoteVersion)
                            .apply();

                    otaUpdateReady = true;
                    JSONObject detail = new JSONObject();
                    detail.put("version", remoteVersion);
                    dispatchJsEvent("tilawa:ota-ready", detail.toString());
                } catch (Exception ignored) {
                    notifyOtaStatus();
                } finally {
                    isCheckingOta = false;
                }
            }
        }).start();
    }

    private void notifyOtaStatus() {
        dispatchJsEvent("tilawa:ota-status", buildOtaInfoJson());
    }

    private String buildOtaInfoJson() {
        try {
            SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
            File cached = getCachedBundleFile();
            JSONObject obj = new JSONObject();
            obj.put("isAndroidApk", true);
            obj.put("usingCachedBundle", cached.exists() && cached.length() > 500000L);
            obj.put("cachedVersion", prefs.getString(KEY_CACHED_VERSION, "embedded"));
            obj.put("pendingVersion", prefs.getString(KEY_PENDING_VERSION, ""));
            obj.put("otaUpdateReady", otaUpdateReady);
            return obj.toString();
        } catch (Exception e) {
            return "{\"isAndroidApk\":true}";
        }
    }

    private String appendCacheBust(String urlStr) {
        String sep = urlStr.contains("?") ? "&" : "?";
        return urlStr + sep + "t=" + System.currentTimeMillis();
    }

    private String fetchUrlString(String urlStr) {
        HttpURLConnection conn = null;
        try {
            URL url = new URL(urlStr);
            conn = (HttpURLConnection) url.openConnection();
            conn.setUseCaches(false);
            conn.setRequestProperty("Cache-Control", "no-cache, no-store, must-revalidate");
            conn.setRequestProperty("Pragma", "no-cache");
            conn.setConnectTimeout(6000);
            conn.setReadTimeout(8000);
            conn.setRequestMethod("GET");
            if (conn.getResponseCode() != 200) return null;

            BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream(), "UTF-8"));
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                sb.append(line).append('\n');
            }
            reader.close();
            return sb.toString();
        } catch (Exception e) {
            return null;
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    private String downloadFileWithSha256(String urlStr, File destFile) {
        HttpURLConnection conn = null;
        try {
            URL url = new URL(urlStr);
            conn = (HttpURLConnection) url.openConnection();
            conn.setUseCaches(false);
            conn.setRequestProperty("Cache-Control", "no-cache, no-store, must-revalidate");
            conn.setRequestProperty("Pragma", "no-cache");
            conn.setConnectTimeout(8000);
            conn.setReadTimeout(20000);
            conn.setRequestMethod("GET");
            if (conn.getResponseCode() != 200) return null;

            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            InputStream in = new BufferedInputStream(conn.getInputStream());
            FileOutputStream out = new FileOutputStream(destFile);
            byte[] buffer = new byte[16384];
            int read;
            while ((read = in.read(buffer)) != -1) {
                digest.update(buffer, 0, read);
                out.write(buffer, 0, read);
            }
            out.flush();
            out.close();
            in.close();

            byte[] hash = digest.digest();
            StringBuilder hex = new StringBuilder();
            for (byte b : hash) {
                hex.append(String.format("%02x", b));
            }
            return hex.toString();
        } catch (Exception e) {
            return null;
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    private boolean containsValidTilawaMarker(File file) {
        if (!file.exists() || file.length() < 500000L) return false;
        try {
            FileInputStream fis = new FileInputStream(file);
            byte[] head = new byte[2048];
            int n = fis.read(head);
            fis.close();
            if (n <= 0) return false;
            String start = new String(head, 0, n, "UTF-8");
            return start.contains("<!doctype html") || start.contains("<!DOCTYPE html");
        } catch (Exception e) {
            return false;
        }
    }

    public class TilawaJsBridge {
        @JavascriptInterface
        public void setThemeColors(final String bgHex, final String accentHex) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        int bg = Color.parseColor(bgHex);
                        applySystemBarColors(bg);
                        if (webView != null) {
                            webView.setBackgroundColor(bg);
                        }
                    } catch (Exception ignored) {
                    }
                }
            });
        }

        @JavascriptInterface
        public String getOtaInfo() {
            return buildOtaInfoJson();
        }

        @JavascriptInterface
        public String getServerOrigin() {
            SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
            String saved = prefs.getString(KEY_SERVER_ORIGIN, "");
            if (saved != null && !saved.isEmpty()) {
                return saved;
            }
            return "https://ais-pre-yohyjyrr4bd6elu2ixq7e7-1009876701033.europe-west2.run.app";
        }

        @JavascriptInterface
        public String getAppVersion() {
            return APP_VERSION_NAME;
        }

        @JavascriptInterface
        public void checkForUpdates(final String manifestUrl) {
            startBackgroundOtaCheck(manifestUrl);
        }

        @JavascriptInterface
        public void applyUpdate() {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    otaUpdateReady = false;
                    loadActiveBundle();
                }
            });
        }

        @JavascriptInterface
        public void resetToEmbedded() {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    File cached = getCachedBundleFile();
                    if (cached.exists()) cached.delete();
                    getSharedPreferences(PREFS_NAME, MODE_PRIVATE).edit().clear().apply();
                    otaUpdateReady = false;
                    if (webView != null) {
                        webView.loadUrl("file:///android_asset/index.html");
                    }
                }
            });
        }
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.destroy();
        }
        super.onDestroy();
    }
}
