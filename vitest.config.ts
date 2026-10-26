import { configDefaults, defineConfig, mergeConfig } from 'vitest/config';

import viteConfig from './vite.config.ts';

export default defineConfig((configEnv) => mergeConfig(
  viteConfig(configEnv),
  {
    define: {
      APP_REVISION: JSON.stringify('vitest-test'),
      APP_VERSION: JSON.stringify('0.0.1'),
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./tests/init.ts'],
      // Agent worktrees under `.claude/` hold stale copies of the tests
      exclude: [...configDefaults.exclude, '.claude/**'],
    },
  },
));
