const path = require('path');
const dotenv = require('dotenv');

const {
  EnvironmentPlugin,
  ProvidePlugin,
} = require('webpack');
const HtmlPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
const TerserJSPlugin = require('terser-webpack-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');

dotenv.config();

module.exports = (env = {}, argv = {}) => {
  return {
    mode: argv.mode,
    entry: './src/index.tsx',
    target: 'web',
    devServer: {
      contentBase: [
        path.resolve(__dirname, 'public'),
        path.resolve(__dirname, 'node_modules/emoji-data-ios'),
        path.resolve(__dirname, 'node_modules/opus-recorder/dist'),
        path.resolve(__dirname, 'src/lib/webp'),
        path.resolve(__dirname, 'src/lib/rlottie'),
        path.resolve(__dirname, 'src/lib/secret-sauce'),
      ],
      port: 1234,
      host: '0.0.0.0',
      disableHostCheck: true,
      stats: 'minimal'
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
          test: /-extra\.json$/,
          loader: 'file-loader',
          type: 'javascript/auto',
          options: {
            name: '[name].[contenthash].[ext]',
          },
        },
        {
          test: /\.wasm$/,
          loader: 'file-loader',
          type: 'javascript/auto',
          options: {
            name: '[name].[contenthash].[ext]',
          },
        },
        {
          test: /\.(txt|tl)$/i,
          loader: 'raw-loader',
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
        APP_NAME: 'Telegram WebZ',
        APP_VERSION: 'dev',
        APP_ENV: 'production',
        TELEGRAM_T_API_ID: '',
        TELEGRAM_T_API_HASH: '',
        TEST_SESSION: '',
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
          new TerserJSPlugin({ sourceMap: true }),
          new CssMinimizerPlugin(),
        ],
      },
    }),
  };
};
