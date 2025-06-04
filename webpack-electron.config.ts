import CopyWebpackPlugin from 'copy-webpack-plugin';
import path from 'path';
import { EnvironmentPlugin } from 'webpack';

import { PRODUCTION_URL } from './src/config.ts';

// GitHub workflow uses an empty string as the default value if it's not in repository variables, so we cannot define a default value here
process.env.BASE_URL = process.env.BASE_URL || PRODUCTION_URL;

const {
  APP_ENV = 'production',
  BASE_URL,
} = process.env;

export default {
  mode: 'production',

  target: 'node',

  entry: {
    electron: './src/electron/main.ts',
    preload: './src/electron/preload.ts',
  },

  output: {
    filename: '[name].cjs',
    path: path.resolve(__dirname, 'dist'),
  },

  resolve: {
    extensions: ['.js', '.cjs', '.mjs', '.ts', '.tsx'],
  },

  plugins: [
    new EnvironmentPlugin({
      APP_ENV,
      BASE_URL,
      IS_PREVIEW: false,
    }),
    new CopyWebpackPlugin({
      patterns: [
        {
          from: path.resolve(__dirname, 'node_modules/electron-drag-click/build/Release/electron_drag_click.node'),
          to: path.resolve(__dirname, 'build/Release/electron_drag_click.node'),
        },
      ],
    }),
  ],

  module: {
    rules: [{
      test: /\.(ts|tsx|js|mjs|cjs)$/,
      loader: 'babel-loader',
      exclude: /node_modules/,
    }],
  },
  externals: {
    electron: 'require("electron")',
  },
};
