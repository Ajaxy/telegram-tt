import autoprefixer from 'autoprefixer';
import type { Config } from 'postcss-load-config';
import smoothCorners from 'postcss-smooth-corners';

import removeGlobalPlugin from './dev/postcss-remove-global.ts';

const config: Config = {
  plugins: [
    removeGlobalPlugin(),
    smoothCorners({ props: /^--border-radius-(modal|island|menu|list-item|forum-avatar)$/ }),
    autoprefixer(),
  ],
};

export default config;
