export default {
  expo: {
    name: 'DriveMitra',
    slug: 'drivemitra-mobile',
    scheme: 'drivemitra',
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
      'expo-router',
      'expo-sqlite',
      [
        'expo-location',
        {
          locationWhenInUsePermission:
            'DriveMitra uses your location to log corridor GPS checkpoints during active fleet dispatches.',
        },
      ],
      [
        'expo-image-picker',
        {
          cameraPermission:
            'DriveMitra uses your camera to photograph fuel pump meters and receipts.',
        },
      ],
    ],
  },
}
