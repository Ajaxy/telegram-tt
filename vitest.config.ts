import { configDefaults, defineConfig, mergeConfig } from 'vitest/config';

import viteConfig from './vite.config';

export default defineConfig((configEnv) => mergeConfig(
  viteConfig(configEnv),
  {
    define: {
      APP_REVISION: JSON.stringify('vitest-test'),
      APP_VERSION: JSON.stringify('0.0.1'),
    },
    test: {
      environment: 'jsdom',
      exclude: [
        ...configDefaults.exclude,
        'tests/playwright/**',
      ],
      setupFiles: ['./tests/init.ts'],
    },
  },
));
