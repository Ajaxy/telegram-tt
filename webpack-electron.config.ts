import path from 'path';
import { EnvironmentPlugin } from 'webpack';

const { APP_ENV = 'production' } = process.env;

export default {
  mode: 'production',

  target: 'node',

  entry: {
    electron: './src/electron/main.ts',
    preload: './src/electron/preload.ts',
  },

  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist'),
  },

  resolve: {
    extensions: ['.ts', '.js'],
  },

  plugins: [
    new EnvironmentPlugin({ APP_ENV }),
  ],

  module: {
    rules: [{
      test: /\.(ts|tsx|js)$/,
      loader: 'babel-loader',
      exclude: /node_modules/,
    }],
  },

  externals: {
    electron: 'require("electron")',
  },
};
