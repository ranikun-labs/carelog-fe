import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.carelog.app',
  appName: 'Carelog',
  webDir: 'dist',
  android: {
    loggingBehavior: 'debug',
  },
};

export default config;
