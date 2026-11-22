package com.zdwgen.app;

import android.content.ContentValues;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.Message;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.JsPromptResult;
import android.webkit.JsResult;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.Toast;
import androidx.appcompat.app.AlertDialog;
import androidx.core.content.FileProvider;
import com.getcapacitor.BridgeActivity;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.text.SimpleDateFormat;
import java.util.Date;

public class MainActivity extends BridgeActivity {
    
    private ValueCallback<Uri[]> filePathCallback;
    private Uri cameraImageUri;
    private final static int FILECHOOSER_RESULTCODE = 1001;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        WebView webView = this.bridge.getWebView();
        WebSettings webSettings = webView.getSettings();

        // =========================================================================
        // CONFIG OAUTH GOOGLE LOGIN: FIX "disallowed_useragent" ON ANDROID APK
        // =========================================================================
        webSettings.setJavaScriptEnabled(true);
        webSettings.setDomStorageEnabled(true);
        webSettings.setDatabaseEnabled(true);
        webSettings.setJavaScriptCanOpenWindowsAutomatically(true);
        webSettings.setSupportMultipleWindows(true); 

        // Hapus penanda "wv" dan "Version/X.X" agar Google menganggap ini browser Chrome standar
        String defaultUserAgent = webSettings.getUserAgentString();
        String customUserAgent = defaultUserAgent
                .replace("; wv", "")
                .replaceAll("Version/\\d+\\.\\d+\\s?", "");
        webSettings.setUserAgentString(customUserAgent);
        
        // Aktifkan Cookie Global agar sesi login Google tersimpan
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);
        // =========================================================================

        // 1. JEMBATAN DOWNLOAD LANGSUNG KE JAVASCRIPT (SUB-FOLDER WGen Note)
        webView.addJavascriptInterface(new Object() {
            @JavascriptInterface
            public void saveFile(String base64Data, String filename, String mimeType) {
                try {
                    String cleanBase64 = base64Data.contains(",") ? base64Data.substring(base64Data.indexOf(",") + 1) : base64Data;
                    byte[] fileData = Base64.decode(cleanBase64, Base64.DEFAULT);

                    String finalMimeType = (mimeType != null && !mimeType.isEmpty()) ? mimeType : "application/octet-stream";
                    if (finalMimeType.equals("application/octet-stream")) {
                        if (filename.endsWith(".xlsx")) finalMimeType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
                        else if (filename.endsWith(".doc") || filename.endsWith(".docx")) finalMimeType = "application/msword";
                        else if (filename.endsWith(".html")) finalMimeType = "text/html";
                        else if (filename.endsWith(".pdf")) finalMimeType = "application/pdf";
                    }

                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                        ContentValues values = new ContentValues();
                        values.put(MediaStore.MediaColumns.DISPLAY_NAME, filename);
                        values.put(MediaStore.MediaColumns.MIME_TYPE, finalMimeType);
                        values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/WGen Note");

                        Uri uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                        if (uri != null) {
                            OutputStream os = getContentResolver().openOutputStream(uri);
                            if (os != null) {
                                os.write(fileData);
                                os.flush();
                                os.close();
                            }
                        } else {
                            throw new Exception("Gagal membuat URI MediaStore");
                        }
                    } else {
                        File downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                        File wgenDir = new File(downloadsDir, "WGen Note");
                        if (!wgenDir.exists()) wgenDir.mkdirs();

                        File file = new File(wgenDir, filename);
                        FileOutputStream fos = new FileOutputStream(file);
                        fos.write(fileData);
                        fos.flush();
                        fos.close();
                    }

                    runOnUiThread(() -> Toast.makeText(MainActivity.this, "Berhasil disimpan di: Downloads/WGen Note/" + filename, Toast.LENGTH_LONG).show());
                } catch (Exception e) {
                    runOnUiThread(() -> Toast.makeText(MainActivity.this, "Gagal mengunduh: " + e.getMessage(), Toast.LENGTH_LONG).show());
                }
            }
        }, "AndroidDownloader");

        // 2. WEBCHROMECLIENT: DIALOG JAVASCRIPT CUSTOM + HANDLER POPUP OAUTH GOOGLE
        webView.setWebChromeClient(new WebChromeClient() {

            // Handling Window Popup (Google OAuth Login)
            @Override
            public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture, Message resultMsg) {
                WebView popupWebView = new WebView(MainActivity.this);
                WebSettings popupSettings = popupWebView.getSettings();
                popupSettings.setJavaScriptEnabled(true);
                popupSettings.setDomStorageEnabled(true);
                popupSettings.setUserAgentString(customUserAgent);

                // Izinkan Cookie di popup agar login tidak berulang kali
                CookieManager.getInstance().setAcceptThirdPartyCookies(popupWebView, true);

                // Fokus WebView
                popupWebView.setFocusable(true);
                popupWebView.setFocusableInTouchMode(true);

                // TEMPEL LANGSUNG KE LAYAR (OVERLAY) TANPA ALERTDIALOG
                FrameLayout decorView = (FrameLayout) getWindow().getDecorView();
                decorView.addView(popupWebView, new FrameLayout.LayoutParams(
                        android.view.ViewGroup.LayoutParams.MATCH_PARENT,
                        android.view.ViewGroup.LayoutParams.MATCH_PARENT));

                popupWebView.setWebChromeClient(new WebChromeClient() {
                    @Override
                    public void onCloseWindow(WebView window) {
                        decorView.removeView(popupWebView);
                    }
                });

                popupWebView.setWebViewClient(new WebViewClient() {
                    @Override
                    public boolean shouldOverrideUrlLoading(WebView view, String url) {
                        // Cegat jika Firebase mencoba me-redirect ke localhost
                        if (url.startsWith("http://localhost") || url.startsWith("https://localhost")) {
                            decorView.removeView(popupWebView); 
                            return true; 
                        }
                        return false;
                    }
                });

                popupWebView.requestFocus();

                WebView.WebViewTransport transport = (WebView.WebViewTransport) resultMsg.obj;
                transport.setWebView(popupWebView);
                resultMsg.sendToTarget();
                return true;
            }

            // Custom Dialog Alert
            @Override
            public boolean onJsAlert(WebView view, String url, String message, final JsResult result) {
                new AlertDialog.Builder(MainActivity.this)
                    .setTitle("WGen Note")
                    .setMessage(message)
                    .setPositiveButton(android.R.string.ok, (dialog, which) -> result.confirm())
                    .setOnCancelListener(dialog -> result.confirm())
                    .setCancelable(false)
                    .create()
                    .show();
                return true;
            }

            // Custom Dialog Confirm
            @Override
            public boolean onJsConfirm(WebView view, String url, String message, final JsResult result) {
                new AlertDialog.Builder(MainActivity.this)
                    .setTitle("WGen Note")
                    .setMessage(message)
                    .setPositiveButton(android.R.string.ok, (dialog, which) -> result.confirm())
                    .setNegativeButton(android.R.string.cancel, (dialog, which) -> result.cancel())
                    .setOnCancelListener(dialog -> result.cancel())
                    .setCancelable(false)
                    .create()
                    .show();
                return true;
            }

            // Custom Dialog Prompt
            @Override
            public boolean onJsPrompt(WebView view, String url, String message, String defaultValue, final JsPromptResult result) {
                final EditText input = new EditText(MainActivity.this);
                input.setText(defaultValue);

                new AlertDialog.Builder(MainActivity.this)
                    .setTitle("WGen Note")
                    .setMessage(message)
                    .setView(input)
                    .setPositiveButton(android.R.string.ok, (dialog, which) -> result.confirm(input.getText().toString()))
                    .setNegativeButton(android.R.string.cancel, (dialog, which) -> result.cancel())
                    .setOnCancelListener(dialog -> result.cancel())
                    .setCancelable(false)
                    .create()
                    .show();
                return true;
            }

            // Ambil Gambar dari Kamera dan Galeri
            @Override
            public boolean onShowFileChooser(WebView webView, ValueCallback<Uri[]> filePathCallback, FileChooserParams fileChooserParams) {
                if (MainActivity.this.filePathCallback != null) {
                    MainActivity.this.filePathCallback.onReceiveValue(null);
                }
                MainActivity.this.filePathCallback = filePathCallback;

                Intent takePictureIntent = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
                File photoFile = null;
                try {
                    String timeStamp = new SimpleDateFormat("yyyyMMdd_HHmmss").format(new Date());
                    File storageDir = getExternalFilesDir(Environment.DIRECTORY_PICTURES);
                    photoFile = File.createTempFile("JPEG_" + timeStamp + "_", ".jpg", storageDir);
                } catch (Exception ex) {
                    ex.printStackTrace();
                }

                if (photoFile != null) {
                    cameraImageUri = FileProvider.getUriForFile(MainActivity.this, getApplicationContext().getPackageName() + ".fileprovider", photoFile);
                    takePictureIntent.putExtra(MediaStore.EXTRA_OUTPUT, cameraImageUri);
                }

                Intent contentSelectionIntent = new Intent(Intent.ACTION_GET_CONTENT);
                contentSelectionIntent.addCategory(Intent.CATEGORY_OPENABLE);
                contentSelectionIntent.setType("image/*");

                Intent[] intentArray = (photoFile != null) ? new Intent[]{takePictureIntent} : new Intent[0];

                Intent chooserIntent = new Intent(Intent.ACTION_CHOOSER);
                chooserIntent.putExtra(Intent.EXTRA_INTENT, contentSelectionIntent);
                chooserIntent.putExtra(Intent.EXTRA_TITLE, "Pilih Gambar Struk");
                chooserIntent.putExtra(Intent.EXTRA_INITIAL_INTENTS, intentArray);

                startActivityForResult(chooserIntent, FILECHOOSER_RESULTCODE);
                return true;
            }
        });
    }

    // 3. HANDLER PREVIEW KAMERA & GALERI
    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == FILECHOOSER_RESULTCODE) {
            if (filePathCallback == null) return;
            Uri[] results = null;
            if (resultCode == RESULT_OK) {
                if (data == null || data.getData() == null) {
                    if (cameraImageUri != null) {
                        results = new Uri[]{cameraImageUri};
                    }
                } else {
                    String dataString = data.getDataString();
                    if (dataString != null) {
                        results = new Uri[]{Uri.parse(dataString)};
                    }
                }
            }
            filePathCallback.onReceiveValue(results);
            filePathCallback = null;
        } else {
            super.onActivityResult(requestCode, resultCode, data);
        }
    }
}