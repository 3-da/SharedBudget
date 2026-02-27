import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.sharedbudget.app',
  appName: 'SharedBudget',
  webDir: 'www/browser',
  server: {
    androidScheme: 'https',
    // Allow cleartext traffic to local backend during development
    cleartext: true,
  },
  plugins: {
    CapacitorHttp: {
      // Route HTTP requests through native layer instead of WebView XHR.
      // This bypasses CORS restrictions and handles cookies natively,
      // fixing the secure-cookie-over-HTTP issue with 10.0.2.2.
      enabled: true,
    },
    CapacitorCookies: {
      // Enable native cookie handling so refresh_token HttpOnly cookies
      // are stored and sent correctly by the native HTTP engine.
      enabled: true,
    },
  },
};

export default config;
