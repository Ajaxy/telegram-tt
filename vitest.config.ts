import { configDefaults, defineConfig, mergeConfig } from 'vitest/config';

import viteConfig from './vite.config.ts';

// The app config is async (the widget sandbox bundle is built first), so it is awaited before the merge
export default defineConfig(async (configEnv) => mergeConfig(
  await viteConfig(configEnv),
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
