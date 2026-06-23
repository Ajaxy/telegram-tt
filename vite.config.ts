import { readFileSync, statSync } from 'fs';
import { dirname, resolve } from 'path';
import { bundleStats } from 'rollup-plugin-bundle-stats';
import { visualizer } from 'rollup-plugin-visualizer';
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
const BUNDLE_STATS_OUT_DIR = 'bundle-stats';
const DEFAULT_BUNDLE_STATS_BASELINE_FILE = 'baseline.json';
const BUNDLE_STATS_VISUALIZER_FILE = 'visualizer.html';
const WORKER_BUNDLE_COLLECTOR_PLUGIN_NAME = 'telegram:collect-worker-report-bundle';
const BUNDLE_REPORT_PLUGIN_SUFFIX = ':with-workers';
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

type BundleReportPlugin = {
  name: string;
  generateBundle?: unknown;
};

type BundleReportHook = (
  this: unknown,
  outputOptions: unknown,
  bundle: ReportOutputBundle,
  isWrite: boolean,
) => void | Promise<void>;

type ReportOutputBundle = Record<string, unknown>;

export default defineConfig(({ mode }): UserConfig => {
  const env = loadEnv(mode, process.cwd(), '');
  const {
    HEAD = '',
    BUNDLE_STATS: bundleStatsValue = '',
    BUNDLE_STATS_BASELINE_PATH: bundleStatsBaselinePath = '',
    BUNDLE_STATS_VISUALIZER: bundleStatsVisualizerValue = '',
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
  const telegramApiId = env.TELEGRAM_API_ID || '';
  const telegramApiHash = env.TELEGRAM_API_HASH || '';
  const workerReportBundles: ReportOutputBundle[] = [];
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

  if (bundleStatsVisualizerValue === '1') {
    plugins.push(createBundleReportPlugin(visualizer((outputOptions) => ({
      filename: resolve(
        DIR_NAME,
        outputOptions.dir,
        BUNDLE_STATS_OUT_DIR,
        BUNDLE_STATS_VISUALIZER_FILE,
      ),
      open: true,
      template: 'treemap',
    })), workerReportBundles));
  }

  if (bundleStatsValue === '1') {
    plugins.push(createBundleReportPlugin(bundleStats({
      html: true,
      json: true,
      compare: Boolean(bundleStatsBaselinePath),
      baseline: !bundleStatsBaselinePath, // For master branch upload
      baselineFilepath: bundleStatsBaselinePath || DEFAULT_BUNDLE_STATS_BASELINE_FILE,
      outDir: BUNDLE_STATS_OUT_DIR,
    }), workerReportBundles));

    if (bundleStatsBaselinePath) {
      // Write current PR stats for the compact GitHub comment
      plugins.push(createBundleReportPlugin(bundleStats({
        html: false,
        json: false,
        compare: false,
        baseline: true,
        baselineFilepath: DEFAULT_BUNDLE_STATS_BASELINE_FILE,
        outDir: BUNDLE_STATS_OUT_DIR,
        silent: true,
      }), workerReportBundles));
    }
  }

  const shouldCollectWorkerReportBundles = bundleStatsVisualizerValue === '1' || bundleStatsValue === '1';

  if (appEnv !== 'test' && (!telegramApiId || !telegramApiHash)) {
    throw new Error('Missing required Telegram API credentials');
  }

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
    assetsInclude: ['**/*.tgs'],
    optimizeDeps: {
      exclude: ['temml'],
    },
    define: {
      APP_VERSION: JSON.stringify(APP_VERSION),
      CHANGELOG_DATETIME: JSON.stringify(statSync(CHANGELOG_PATH, { throwIfNoEntry: false })?.mtime.getTime()),
    },
    resolve: {
      tsconfigPaths: true,
      alias: [
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
      sourcemap: true,
      assetsInlineLimit: (filePath) => (IMAGE_ASSET_RE.test(filePath) ? false : undefined),
      rolldownOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('/src/components/ui/')) {
              return 'shared-components';
            }
            return undefined;
          },
        },
      },
    },
    worker: {
      plugins: shouldCollectWorkerReportBundles ? () => [
        createWorkerBundleCollectorPlugin(workerReportBundles),
      ] : undefined,
      rolldownOptions: {
        output: {
          entryFileNames: '[name]-[hash].js',
        },
      },
    },
    plugins,
  };
});

function createBundleReportPlugin(plugin: BundleReportPlugin, workerReportBundles: ReportOutputBundle[]): Plugin {
  return {
    name: `${plugin.name}${BUNDLE_REPORT_PLUGIN_SUFFIX}`,
    async generateBundle(outputOptions, bundle, isWrite) {
      const generateBundle = plugin.generateBundle as BundleReportHook | undefined;

      await generateBundle?.call(
        this,
        outputOptions,
        mergeOutputBundles(bundle, workerReportBundles),
        isWrite,
      );
    },
  };
}

function createWorkerBundleCollectorPlugin(workerReportBundles: ReportOutputBundle[]): Plugin {
  return {
    name: WORKER_BUNDLE_COLLECTOR_PLUGIN_NAME,
    generateBundle(_outputOptions, bundle) {
      workerReportBundles.push({ ...bundle });
    },
  };
}

function mergeOutputBundles(bundle: ReportOutputBundle, workerReportBundles: ReportOutputBundle[]): ReportOutputBundle {
  const result: ReportOutputBundle = {};

  Object.assign(result, bundle, ...workerReportBundles);

  return result;
}

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
