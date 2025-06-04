const config = {
  productName: 'Telegram A',
  artifactName: '${productName}-${arch}.${ext}',
  appId: 'org.telegram.TelegramA',
  extraMetadata: {
    main: './dist/electron.cjs',
    productName: 'Telegram A',
  },
  asarUnpack: [
    'build/Release/electron_drag_click.node',
  ],
  files: [
    'dist',
    'package.json',
    'public/icon-electron-windows.ico',
    'build/Release/electron_drag_click.node',
    '!dist/**/build-stats.json',
    '!dist/**/statoscope-report.html',
    '!dist/**/reference.json',
    '!dist/img-apple-*',
    '!dist/get',
    '!node_modules',
  ],
  directories: {
    buildResources: './public',
    output: './dist-electron',
  },
  protocols: [
    {
      name: 'Tg',
      schemes: ['tg'],
    },
  ],
  publish: {
    provider: 'github',
    owner: 'Ajaxy',
    repo: 'telegram-tt',
    releaseType: 'draft',
  },
  win: {
    target: {
      target: 'nsis',
      arch: ['x64'],
    },
    icon: 'public/icon-electron-windows.ico',
  },
  nsis: {
    oneClick: false,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
  },
  mac: {
    target: {
      target: 'default',
      arch: ['x64', 'arm64'],
    },
    entitlements: 'public/electron-entitlements.mac.plist',
    icon: 'public/icon-electron-macos.icns',
  },
  dmg: {
    background: 'public/background-electron-dmg.tiff',
    iconSize: 100,
    contents: [
      {
        x: 138,
        y: 225,
        type: 'file',
      },
      {
        x: 402,
        y: 225,
        type: 'link',
        path: '/Applications',
      },
    ],
  },
  linux: {
    category: 'Chat;Network;InstantMessaging;',
    target: {
      target: 'AppImage',
      arch: ['x64'],
    },
  },
};

export default config;
