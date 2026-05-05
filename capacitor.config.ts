import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.creativemark.hub',
  appName: 'CreativeMark Hub',
  webDir: 'dist',
  // Bundle dist/ into the APK so the app works without relying on Vercel
  // being reachable. Any pushed web update still requires a rebuild-sync.
  android: {
    allowMixedContent: true
  }
};

export default config;
