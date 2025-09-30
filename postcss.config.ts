import autoprefixer from 'autoprefixer';
import type { Config } from 'postcss-load-config';

import removeGlobalPlugin from './dev/postcss-remove-global.ts';

const config: Config = {
  plugins: [
    removeGlobalPlugin(),
    autoprefixer(),
  ],
};

export default config;
