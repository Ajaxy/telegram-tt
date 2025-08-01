import { defineConfig, rspack } from '@rsbuild/core';
import { pluginSass } from '@rsbuild/plugin-sass';
import dotenv from 'dotenv';
import path from 'path';


import { version as appVersion } from './package.json';
import { PRODUCTION_URL } from './src/config';

const {
  HEAD,
  APP_ENV = 'production',
  APP_MOCKED_CLIENT = '',
  IS_PACKAGED_ELECTRON,
} = process.env;

dotenv.config();

const DEFAULT_APP_TITLE = `Telegram${APP_ENV !== 'production' ? ' Beta' : ''}`;

// GitHub workflow uses an empty string as the default value if it's not in repository variables, so we cannot define a default value here
process.env.BASE_URL = process.env.BASE_URL || PRODUCTION_URL;

const {
  BASE_URL,
  ELECTRON_HOST_URL = 'https://telegram-a-host',
  APP_TITLE = DEFAULT_APP_TITLE,
} = process.env;


dotenv.config();

const CSP = `
  default-src 'self';
  connect-src 'self' wss://*.web.telegram.org ws://localhost:3000 blob: http: https: ${APP_ENV === 'development' ? 'wss:' : ''};
  script-src 'self' 'wasm-unsafe-eval' https://t.me/_websync_ https://telegram.me/_websync_;
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob: https://ss3.4sqi.net/img/categories_v2/
  ${IS_PACKAGED_ELECTRON ? `${BASE_URL}/` : ''};
  media-src 'self' blob: data: ${IS_PACKAGED_ELECTRON ? [`${BASE_URL}/`, ELECTRON_HOST_URL].join(' ') : ''};
  object-src 'none';
  frame-src http: https:;
  base-uri 'none';
  form-action 'none';`
  .replace(/\s+/g, ' ').trim();


export default defineConfig({
  plugins: [
    pluginSass(),
  ],

  source: {
    define: {
      'process.env': JSON.stringify(process.env),
    },
  },

  dev: {
    assetPrefix: '/'
  },

  tools: {
    postcss: {
      postcssOptions: {
        plugins: ['autoprefixer']
      }
    },

    htmlPlugin: {
      appTitle: APP_TITLE,
      appleIcon: APP_ENV === 'production' ? 'apple-touch-icon' : 'apple-touch-icon-dev',
      mainIcon: APP_ENV === 'production' ? 'icon-192x192' : 'icon-dev-192x192',
      manifest: APP_ENV === 'production' ? 'site.webmanifest' : 'site_dev.webmanifest',
      baseUrl: BASE_URL,
      csp: CSP,
      template: 'src/index.html',
    },

    rspack: {
      target: 'web',

      output: {
        filename: '[name].[contenthash].js',
        chunkFilename: '[id].[chunkhash].js',
        assetModuleFilename: '[name].[contenthash][ext]',
        path: path.resolve(__dirname, 'dist'),
        clean: true,
      },

      module: {
        rules: [
          {
            test: /\.(woff(2)?|ttf|eot|svg|png|jpg|tgs)(\?v=\d+\.\d+\.\d+)?$/,
            type: 'asset/resource',
          },
          {
            test: /\.wasm$/,
            type: 'asset/source',
          },
          {
            test: /\.(txt|tl|strings)$/i,
            type: 'asset/source',
          },
        ]
      },

      ignoreWarnings: [
        /sass/
      ],

      plugins: [
        new rspack.ContextReplacementPlugin(
          /highlight\.js[\\/]lib[\\/]languages/,
          /^((?!\.js\.js).)*$/,
        ),
        ...(APP_MOCKED_CLIENT === '1' ? [new rspack.NormalModuleReplacementPlugin(
          /src[\\/]lib[\\/]gramjs[\\/]client[\\/]TelegramClient\.js/,
          './MockClient.ts',
        )] : []),
        new rspack.EnvironmentPlugin({
          APP_ENV,
          APP_MOCKED_CLIENT,
          // eslint-disable-next-line no-null/no-null
          APP_NAME: null,
          APP_TITLE,
          // RELEASE_DATETIME: Date.now(),
          TELEGRAM_API_ID: undefined,
          TELEGRAM_API_HASH: undefined,
          // eslint-disable-next-line no-null/no-null
          TEST_SESSION: null,
          // IS_PACKAGED_ELECTRON: false,
          ELECTRON_HOST_URL,
          BASE_URL,
        }),
        new rspack.DefinePlugin({
          APP_VERSION: JSON.stringify(appVersion),
          // APP_REVISION: rspack.DefinePlugin.runtimeValue(() => {
          //   const { branch, commit } = getGitMetadata();
          //   const shouldDisplayCommit = APP_ENV === 'staging' || !branch || branch === 'HEAD';
          //   return JSON.stringify(shouldDisplayCommit ? commit : branch);
          // }, mode === 'development' ? true : []),
        }),
        new rspack.ProvidePlugin({
          Buffer: ['buffer', 'Buffer'],
        }),
      ],

      devtool: APP_ENV === 'production' && IS_PACKAGED_ELECTRON ? undefined : 'source-map',

      optimization: {
        splitChunks: {
          cacheGroups: {
            sharedComponents: {
              name: 'shared-components',
              test: /[\\/]src[\\/]components[\\/]ui[\\/]/,
            },
          },
        },
        ...(APP_ENV === 'staging' && {
          chunkIds: 'named',
        }),
      },
    }
  },

  resolve: {
    alias: {
      path: require.resolve('path-browserify'),
      os: require.resolve('os-browserify/browser'),
      buffer: require.resolve('buffer/'),
      fs: false,
      crypto: false,
    }
  },

  server: {
    port: 1234,
    host: '0.0.0.0',
    publicDir: [
      {
        name: path.resolve(import.meta.dirname, 'public'),
      },
      {
        name: path.resolve(import.meta.dirname, 'node_modules/emoji-data-ios'),
      },
      {
        name: path.resolve(import.meta.dirname, 'node_modules/opus-recorder/dist'),
      },
      {
        name: path.resolve(import.meta.dirname, 'src/lib/webp'),
      },
      {
        name: path.resolve(import.meta.dirname, 'src/lib/rlottie'),
      },
      {
        name: path.resolve(import.meta.dirname, 'src/lib/video-preview'),
      },
      {
        name: path.resolve(import.meta.dirname, 'src/lib/secret-sauce'),
      },
    ],
  },
});

