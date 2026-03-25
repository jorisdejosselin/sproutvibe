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
}

export default config
