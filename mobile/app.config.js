export default {
  expo: {
    name: 'DriveMitra',
    slug: 'drivemitra-mobile',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    splash: {
      image: './assets/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#EEE8F7',
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'in.drivemitra.mobile',
    },
    android: {
      package: 'in.drivemitra.mobile',
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#EEE8F7',
      },
    },
    web: {
      bundler: 'metro',
    },
    plugins: [
      ['expo-location', { locationAlwaysPermission: 'DriveMitra requires location access for real-time commercial fleet GPS tracking during active dispatches.' }],
      ['expo-camera', { cameraPermission: 'DriveMitra requires camera access to capture fuel pump displays, receipts, and vehicle inspection defects.' }],
      ['expo-notifications', {}],
    ],
  },
}
