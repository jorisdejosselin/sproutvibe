import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.sprout.app',
  appName: 'SproutVibe',
  webDir: 'dist',
  server: {
    // Leave blank — user sets their server URL via the in-app setup screen
    url: undefined,
    cleartext: true,
  },
  android: {
    // Capacitor serves the app from https://localhost, so every request to a
    // plain http:// self-hosted server is https -> http, i.e. mixed content.
    // The WebView drops those before they reach the network and reports
    // nothing useful to JS, which is what issue #32 was: the phone's browser
    // could reach http://192.168.100.67:5055 but the APK could not.
    //
    // server.cleartext above does NOT cover this. That controls Android's
    // network-security policy for cleartext sockets; mixed content is a
    // separate WebView gate read from android.allowMixedContent, which
    // defaults to false (see CapConfig.java in @capacitor/android).
    //
    // Self-hosting over plain http on a LAN or VPN is a first-class use case
    // here, and the user types that address in themselves, so allow it.
    // This also covers <img src="http://…/uploads/…"> for plant photos, which
    // routing requests through the native HTTP plugin would not have fixed —
    // image loading is not patched by it.
    allowMixedContent: true,
  },
}

export default config
