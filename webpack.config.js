const path = require('path');
const dotenv = require('dotenv');

const {
  DefinePlugin,
  EnvironmentPlugin,
  ProvidePlugin,
} = require('webpack');
const HtmlPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
const { GitRevisionPlugin } = require('git-revision-webpack-plugin');

const appVersion = require('./package.json').version;

dotenv.config();

module.exports = (env = {}, argv = {}) => {
  return {
    mode: argv.mode,
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
      assetModuleFilename: '[name].[contenthash].[ext]',
      path: path.resolve(__dirname, argv['output-path'] || 'dist'),
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
            'css-loader',
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
      new HtmlPlugin({
        template: 'src/index.html',
      }),
      new MiniCssExtractPlugin({
        filename: '[name].[contenthash].css',
        chunkFilename: '[name].[chunkhash].css',
        ignoreOrder: true,
      }),
      new EnvironmentPlugin({
        APP_ENV: 'production',
        APP_NAME: null,
        APP_VERSION: appVersion,
        TELEGRAM_T_API_ID: undefined,
        TELEGRAM_T_API_HASH: undefined,
        TEST_SESSION: null,
      }),
      new DefinePlugin({
        APP_REVISION: DefinePlugin.runtimeValue(() => {
          const { branch, commit } = getGitMetadata();
          return JSON.stringify((!branch || branch === 'HEAD') ? commit : branch);
        }, argv.mode === 'development' ? true : []),
      }),
      new ProvidePlugin({
        Buffer: ['buffer', 'Buffer'],
      }),
      ...(argv.mode === 'production' ? [
        new BundleAnalyzerPlugin({
          analyzerMode: 'static',
          openAnalyzer: false,
        }),
      ] : []),
    ],

    ...(!env.noSourceMap && {
      devtool: 'source-map',
    }),

    ...(argv['optimize-minimize'] && {
      optimization: {
        minimize: !env.noMinify,
        minimizer: [
          new CssMinimizerPlugin(),
        ],
      },
    }),
  };
};

function getGitMetadata() {
  const gitRevisionPlugin = new GitRevisionPlugin();
  const branch = process.env.HEAD || gitRevisionPlugin.branch();
  const commit = gitRevisionPlugin.commithash().substring(0, 7);
  return { branch, commit };
}
