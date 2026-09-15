module.exports = {
  expo: {
    name: 'AgroPulse',
    slug: 'agro-sos',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    scheme: 'agrosos',
    ios: {
      supportsTablet: true,
    },
    android: {
      package: 'com.a1.agrosos',
      versionCode: 1,
      softwareKeyboardLayoutMode: 'resize',
      adaptiveIcon: {
        backgroundColor: '#DFF3EA',
        foregroundImage: './assets/android-icon-foreground.png',
        backgroundImage: './assets/android-icon-background.png',
        monochromeImage: './assets/android-icon-monochrome.png',
      },
      predictiveBackGestureEnabled: false,
    },
    web: {
      favicon: './assets/favicon.png',
    },
    plugins: [
      [
        'expo-image-picker',
        {
          photosPermission: 'Нужен доступ к фото, чтобы прикрепить их к посту.',
          cameraPermission: 'Нужен доступ к камере, чтобы сделать фото для поста.',
        },
      ],
    ],
    extra: {
      eas: {
        projectId: '7a757b90-93f5-45a7-a785-b4d6a518ba06',
      },
    },
  },
};
