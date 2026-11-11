import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, type BuildOptions } from 'esbuild';
import type { Plugin } from 'vite';

import { sandboxBuildOptions } from './scripts/sandbox-build.ts';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const SOURCE_PATH = '/src/lib/widget-sandbox/src/';

// `workerPlugin` goes in `worker.plugins`: the worker imports the sandbox bundle (local patch, NOTICE.md).
export async function createWidgetSandbox(): Promise<{ plugin: Plugin; workerPlugin: Plugin }> {
  const bundles: Record<string, string> = {
    'virtual:sandbox-bundle': await buildBundle(sandboxBuildOptions(ROOT)),
  };
  const workerPlugin: Plugin = {
    name: 'widget-sandbox-bundle',
    resolveId(id) {
      return Object.hasOwn(bundles, id) ? `\0${id}` : undefined;
    },
    load(id) {
      const bundle = id.startsWith('\0') ? bundles[id.slice(1)] : undefined;
      return bundle === undefined ? undefined : `export default ${JSON.stringify(bundle)};`;
    },
  };
  const plugin: Plugin = {
    name: 'widget-sandbox',
    // The dev server runs the worker through the main pipeline.
    resolveId: workerPlugin.resolveId,
    load: workerPlugin.load,
    generateBundle() {
      const licenseFiles = [
        'NOTICE.md',
        'quickjs/LICENSE.quickjs',
        'quickjs/LICENSE.quickjs-emscripten',
        ...readdirSync(path.join(ROOT, 'licenses')).map((file) => `licenses/${file}`),
      ];
      this.emitFile({
        type: 'asset',
        fileName: 'widget-sandbox-notices.txt',
        source: licenseFiles.map((file) => `\n--- ${file} ---\n\n${readFileSync(path.join(ROOT, file), 'utf8')}`).join('\n'),
      });
    },
    async handleHotUpdate({ file, server }) {
      if (!file.replace(/\\/g, '/').includes(SOURCE_PATH)) return undefined;
      // The sandbox bundle is built once, when the plugin is created.
      await server.restart();
      return [];
    },
  };
  return { plugin, workerPlugin };
}

async function buildBundle(options: BuildOptions): Promise<string> {
  const result = await build(options);
  return result.outputFiles![0].text;
}
