const path = require('path');
const dotenv = require('dotenv');

const {
  DefinePlugin,
  EnvironmentPlugin,
  ProvidePlugin,
  ContextReplacementPlugin,
  NormalModuleReplacementPlugin,
} = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const { GitRevisionPlugin } = require('git-revision-webpack-plugin');
const StatoscopeWebpackPlugin = require('@statoscope/webpack-plugin').default;
const WebpackContextExtension = require('./dev/webpackContextExtension');
const appVersion = require('./package.json').version;

const {
  HEAD,
  APP_ENV = 'production',
  APP_MOCKED_CLIENT = '',
} = process.env;

dotenv.config();

module.exports = (_env, { mode = 'production' }) => {
  return {
    mode,
    entry: './src/index.tsx',
    target: 'web',

    devServer: {
      port: 1234,
      host: '0.0.0.0',
      allowedHosts: "all",
      hot: false,
      static: [
        {
          directory: path.resolve(__dirname, 'public'),
        },
        {
          directory: path.resolve(__dirname, 'node_modules/emoji-data-ios'),
        },
        {
          directory: path.resolve(__dirname, 'node_modules/opus-recorder/dist'),
        },
        {
          directory: path.resolve(__dirname, 'src/lib/webp'),
        },
        {
          directory: path.resolve(__dirname, 'src/lib/rlottie'),
        },
        {
          directory: path.resolve(__dirname, 'src/lib/secret-sauce'),
        },
      ],
      devMiddleware: {
        stats: 'minimal',
      },
    },

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
          test: /\.(ts|tsx|js)$/,
          loader: 'babel-loader',
          exclude: /node_modules/,
        },
        {
          test: /\.css$/,
          use: [
            MiniCssExtractPlugin.loader,
            {
              loader: 'css-loader',
              options: {
                importLoaders: 1,
              },
            },
            'postcss-loader',
          ],
        },
        {
          test: /\.scss$/,
          use: [
            MiniCssExtractPlugin.loader,
            {
              loader: 'css-loader',
              options: {
                modules: {
                  exportLocalsConvention: 'camelCase',
                  auto: true,
                  localIdentName: mode === 'production' ? '[hash:base64]' : '[name]__[local]'
                }
              }
            },
            'postcss-loader',
            'sass-loader',
          ],
        },
        {
          test: /\.(woff(2)?|ttf|eot|svg|png|jpg|tgs)(\?v=\d+\.\d+\.\d+)?$/,
          type: 'asset/resource',
        },
        {
          test: /\.wasm$/,
          type: 'asset/resource',
        },
        {
          test: /\.(txt|tl)$/i,
          type: 'asset/source',
        },
      ],
    },

    resolve: {
      extensions: ['.js', '.ts', '.tsx'],
      fallback: {
        path: require.resolve('path-browserify'),
        os: require.resolve('os-browserify/browser'),
        buffer: require.resolve('buffer/'),
        fs: false,
      },
    },

    plugins: [
      // Clearing of the unused files for code highlight for smaller chunk count
      new ContextReplacementPlugin(
        /highlight\.js\/lib\/languages/,
        /^((?!\.js\.js).)*$/
      ),
      ...(APP_MOCKED_CLIENT === '1' ? [new NormalModuleReplacementPlugin(
        /src\/lib\/gramjs\/client\/TelegramClient\.js/,
        './MockClient.ts'
      )] : []),
      new HtmlWebpackPlugin({
        appName: APP_ENV === 'production' ? 'Telegram Web' : 'Telegram Web Beta',
        appleIcon: APP_ENV === 'production' ? 'apple-touch-icon' : 'apple-touch-icon-dev',
        mainIcon: APP_ENV === 'production' ? 'icon-192x192' : 'icon-dev-192x192',
        template: 'src/index.html',
      }),
      new MiniCssExtractPlugin({
        filename: '[name].[contenthash].css',
        chunkFilename: '[name].[chunkhash].css',
        ignoreOrder: true,
      }),
      new EnvironmentPlugin({
        APP_ENV,
        APP_MOCKED_CLIENT,
        APP_NAME: null,
        APP_VERSION: appVersion,
        TELEGRAM_T_API_ID: undefined,
        TELEGRAM_T_API_HASH: undefined,
        TEST_SESSION: null,
      }),
      new DefinePlugin({
        APP_REVISION: DefinePlugin.runtimeValue(() => {
          const { branch, commit } = getGitMetadata();
          const shouldDisplayCommit = APP_ENV === 'staging' || !branch || branch === 'HEAD';
          return JSON.stringify(shouldDisplayCommit ? commit : branch);
        }, mode === 'development' ? true : []),
      }),
      new ProvidePlugin({
        Buffer: ['buffer', 'Buffer'],
      }),
      new StatoscopeWebpackPlugin({
        statsOptions: {
          context: __dirname,
        },
        saveReportTo: path.resolve('./public/statoscope-report.html'),
        saveStatsTo: path.resolve('./public/build-stats.json'),
        normalizeStats: true,
        open: 'file',
        extensions: [new WebpackContextExtension()],
      }),
    ],

    devtool: 'source-map',

    ...(APP_ENV !== 'production' && {
      optimization: {
        chunkIds: 'named',
      }
    }),
  };
};

function getGitMetadata() {
  const gitRevisionPlugin = new GitRevisionPlugin();
  const branch = HEAD || gitRevisionPlugin.branch();
  const commit = gitRevisionPlugin.commithash().substring(0, 7);
  return { branch, commit };
}
