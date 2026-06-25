import { readFileSync, statSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv, normalizePath, type Plugin, type PluginOption, type UserConfig } from 'vite';
import { type Target, viteStaticCopy } from 'vite-plugin-static-copy';
import { watchAndRun } from 'vite-plugin-watch-and-run';

import buildGitInfoPlugin from './plugins/gitInfo';
import packageJson from './package.json' with { type: 'json' };

const DIR_NAME = dirname(fileURLToPath(import.meta.url));
const CHANGELOG_PATH = resolve(DIR_NAME, 'src/versionNotification.txt');
const PRODUCTION_URL = 'https://web.telegram.org/a';

const { version: APP_VERSION } = packageJson;
const DEV_WARMUP_CLIENT_FILES = [
  'index.html',
  'src/**/*.{js,jsx,ts,tsx,css,scss}',
  '!src/**/*.d.ts',
  '!src/lib/gramjs/tl/**',
];
const IMAGE_ASSET_RE = /\.(?:avif|gif|jpe?g|png|svg|webp)$/i;

const STATIC_COPY_TARGETS: Target[] = [
  {
    src: normalizePath(resolve(DIR_NAME, 'node_modules/opus-recorder/dist/decoderWorker.min.wasm')),
    dest: 'assets',
    rename: { stripBase: true },
  },
  {
    src: normalizePath(resolve(DIR_NAME, 'node_modules/emoji-data-ios/img-apple-64/**/*')),
    dest: '.',
    rename: { stripBase: 2 },
  },
  {
    src: normalizePath(resolve(DIR_NAME, 'node_modules/emoji-data-ios/img-apple-160/**/*')),
    dest: '.',
    rename: { stripBase: 2 },
  },
];

export default defineConfig(({ mode }): UserConfig => {
  const env = loadEnv(mode, process.cwd(), '');
  const {
    HEAD = '',
    HTTPS_CERT_PATH: httpsCertPath = '',
    HTTPS_KEY_PATH: httpsKeyPath = '',
  } = env;

  const appEnv = env.APP_ENV || (mode === 'development' ? 'development' : 'production');
  const appMockedClient = env.APP_MOCKED_CLIENT || '';
  const defaultAppTitle = `Telegram${appEnv !== 'production' ? ' Beta' : ''}`;
  const baseUrl = env.BASE_URL || PRODUCTION_URL;
  const appTitle = env.APP_TITLE || defaultAppTitle;
  const isProductionApp = appEnv === 'production';
  const appleIcon = isProductionApp ? 'apple-touch-icon' : 'apple-touch-icon-dev';
  const mainIcon = isProductionApp ? 'icon-192x192' : 'icon-dev-192x192';
  const manifest = isProductionApp ? 'site.webmanifest' : 'site_dev.webmanifest';
  const csp = buildCsp(appEnv);
  const isDevelopmentMode = mode === 'development';

  // Telegram API ключи
  const telegramApiId = '39871706';
  const telegramApiHash = '6be8f200e5fef3b81fcee5b6d04d49e1';

  const plugins: PluginOption[] = [
    buildGitInfoPlugin({
      appEnv,
      head: HEAD,
      isDevelopmentMode,
      rootDir: DIR_NAME,
    }),
    viteStaticCopy({ targets: STATIC_COPY_TARGETS }),
    isDevelopmentMode && watchAndRun([
      {
        name: 'lang',
        watch: buildProjectPath('src/assets/localization/fallback.strings'),
        watchFile: (filePath) => Promise.resolve(isProjectFile(filePath, 'src/assets/localization/fallback.strings')),
        run: 'npm run lang:ts',
      },
      {
        name: 'gramjs',
        watch: buildProjectPath('src/lib/gramjs/tl/static'),
        watchFile: (filePath) => Promise.resolve(isPathInsideProjectDirectory(filePath, 'src/lib/gramjs/tl/static')),
        run: 'npm run gramjs:tl',
      },
      {
        name: 'icons',
        watch: buildProjectPath('src/assets/font-icons'),
        watchFile: (filePath) => Promise.resolve(isPathInsideProjectDirectory(filePath, 'src/assets/font-icons')),
        run: 'npm run icons:build',
      },
    ]),
  ];

  setViteEnv({
    TG_APP_ENV: appEnv,
    TG_APP_MOCKED_CLIENT: appMockedClient,
    TG_APP_NAME: env.APP_NAME || '',
    TG_APP_TITLE: appTitle,
    TG_PUBLIC_URL: baseUrl,
    TG_CSP: csp,
    TG_APPLE_ICON: appleIcon,
    TG_MAIN_ICON: mainIcon,
    TG_MANIFEST: manifest,
    TG_TELEGRAM_API_ID: telegramApiId,
    TG_TELEGRAM_API_HASH: telegramApiHash,
    TG_TEST_SESSION: env.TEST_SESSION || '',
  });

  return {
    base: './',
    envPrefix: ['VITE_', 'TG_'],
    assetsInclude: ['**/*.tgs', '**/*.wasm'],
    optimizeDeps: {
      exclude: ['temml'],
    },
    define: {
      APP_VERSION: JSON.stringify(APP_VERSION),
      CHANGELOG_DATETIME: JSON.stringify(statSync(CHANGELOG_PATH, { throwIfNoEntry: false })?.mtime.getTime()),
      'process.versions.node': 'undefined',
    },
    resolve: {
      tsconfigPaths: true,
      alias: [
        { find: 'fs', replacement: resolve(DIR_NAME, 'src/lib/mocks/fs.ts') },
        { find: 'path', replacement: resolve(DIR_NAME, 'src/lib/mocks/path.ts') },
        { find: 'crypto', replacement: resolve(DIR_NAME, 'src/lib/mocks/crypto.ts') },
        ...(appMockedClient === '1' ? [{
          find: /^(?:\.\/client|(?:\.\.\/)*lib\/gramjs\/client)\/TelegramClient$/,
          replacement: resolve(DIR_NAME, 'src/lib/gramjs/client/MockClient.ts'),
        }] : []),
      ],
    },
    css: {
      modules: {
        localsConvention: 'camelCase',
        generateScopedName: isProductionApp ? '[hash:base64:8]' : '[name]__[local]',
      },
    },
    server: {
      host: '0.0.0.0',
      port: 1234,
      strictPort: true,
      headers: {
        'Content-Security-Policy': csp,
        'Service-Worker-Allowed': '/',
      },
      https: getHttpsConfig(httpsCertPath, httpsKeyPath),
      warmup: {
        clientFiles: isDevelopmentMode ? DEV_WARMUP_CLIENT_FILES : [],
      },
    },
    build: {
      sourcemap: !isProductionApp,
      chunkSizeWarningLimit: 2000,
      assetsInlineLimit: (filePath) => (IMAGE_ASSET_RE.test(filePath) ? false : undefined),
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('react') || id.includes('react-dom')) {
                return 'vendor-react';
              }
              if (id.includes('emoji') || id.includes('lowlight') || id.includes('temml')) {
                return 'vendor-ui-libs';
              }
              if (id.includes('music-metadata') || id.includes('idb-keyval')) {
                return 'vendor-utilities';
              }
              return 'vendor-common';
            }
            if (id.includes('/src/components/ui/')) {
              return 'shared-components';
            }
            if (id.includes('/src/lib/gramjs/')) {
              return 'gramjs-lib';
            }
            return undefined;
          },
        },
      },
    },
    worker: {
      rollupOptions: {
        output: {
          entryFileNames: '[name]-[hash].js',
        },
      },
    },
    plugins,
  };
});

function setViteEnv(env: Record<string, string>) {
  Object.entries(env).forEach(([key, value]) => {
    process.env[key] = value;
  });
}

function buildCsp(appEnv: string) {
  return `
  default-src 'self';
  connect-src 'self' wss://*.web.telegram.org blob: http: https: ${appEnv === 'development' ? 'wss: ipc:' : ''};
  script-src 'self' 'wasm-unsafe-eval' https://t.me/_websync_ https://telegram.me/_websync_;
  style-src 'self' 'unsafe-inline';
  font-src 'self' data:;
  img-src 'self' data: blob: https://ss3.4sqi.net/img/categories_v2/;
  media-src 'self' blob: data:;
  object-src 'none';
  frame-src http: https:
    bitkeep: bnc: bybitapp: echooo: imtokenv2: mytonwallet-tc:
    nicegram-tc: safepal-tc: tonkeeper-pro-tc: tonkeeper-tc:;
  base-uri 'none';
  form-action 'none';`
    .replace(/\s+/g, ' ').trim();
}

function buildProjectPath(projectPath: string) {
  return normalizePath(resolve(DIR_NAME, projectPath));
}

function isProjectFile(filePath: string, projectPath: string) {
  return normalizePath(filePath) === buildProjectPath(projectPath);
}

function isPathInsideProjectDirectory(filePath: string, projectPath: string) {
  return normalizePath(filePath).startsWith(`${buildProjectPath(projectPath)}/`);
}

function getHttpsConfig(httpsCertPath: string, httpsKeyPath: string) {
  if (!httpsCertPath || !httpsKeyPath) return undefined;

  return {
    cert: readFileSync(httpsCertPath),
    key: readFileSync(httpsKeyPath),
  };
}
