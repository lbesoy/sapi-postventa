package com.eurorep.sapi;

import android.os.Bundle;
import android.graphics.Color;
import android.view.View;
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        try {
            WebView webView = getBridge() != null ? getBridge().getWebView() : null;
            if (webView != null) {
                webView.setBackgroundColor(Color.parseColor("#0F1117"));
                webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
                // Usar renderizado directo del compositor nativo de Chromium sin capa off-screen que provoque desenfoque o ghosting en scroll
                webView.setLayerType(View.LAYER_TYPE_NONE, null);

                WebSettings settings = webView.getSettings();
                if (settings != null) {
                    settings.setTextZoom(100);
                    // Viewport nativo 1:1 respetando el meta viewport estándar
                    settings.setUseWideViewPort(true);
                    settings.setLoadWithOverviewMode(true);
                    settings.setSupportZoom(false);
                    settings.setBuiltInZoomControls(false);
                    settings.setDisplayZoomControls(false);
                    settings.setDomStorageEnabled(true);
                    settings.setDatabaseEnabled(true);
                    settings.setCacheMode(WebSettings.LOAD_DEFAULT);
                }
            }
        } catch (Exception ignored) {}
    }
}

