import { execFileSync } from 'child_process';
import { resolve } from 'path';
import type { Plugin } from 'vite';

type Options = {
  appEnv: string;
  head: string;
  isDevelopmentMode: boolean;
  rootDir: string;
};

const GIT_INFO_MODULE_ID = 'virtual:git-info';
const RESOLVED_GIT_INFO_MODULE_ID = `\0${GIT_INFO_MODULE_ID}`;

export default function buildGitInfoPlugin({
  appEnv,
  head,
  isDevelopmentMode,
  rootDir,
}: Options): Plugin {
  return {
    name: 'git-info',
    resolveId(id) {
      return id === GIT_INFO_MODULE_ID ? RESOLVED_GIT_INFO_MODULE_ID : undefined;
    },
    load(id) {
      if (id !== RESOLVED_GIT_INFO_MODULE_ID) return undefined;

      const branch = head || getGitValue(rootDir, ['rev-parse', '--abbrev-ref', 'HEAD']);
      const commit = getGitValue(rootDir, ['rev-parse', '--short=7', 'HEAD']);
      const shouldDisplayOnlyCommit = appEnv === 'staging' || !branch || branch === 'HEAD';
      const appRevision = shouldDisplayOnlyCommit ? commit : `${branch}#${commit}`;

      return `export const APP_REVISION = ${JSON.stringify(appRevision)};`;
    },
    configureServer(server) {
      if (!isDevelopmentMode || head) return;

      let watchPaths = buildWatchPaths(rootDir);
      if (!watchPaths.length) return;

      server.watcher.add(watchPaths);
      server.watcher.on('change', (changedPath) => {
        if (!watchPaths.includes(changedPath)) return;

        const module = server.moduleGraph.getModuleById(RESOLVED_GIT_INFO_MODULE_ID);
        if (module) server.moduleGraph.invalidateModule(module);
        watchPaths = buildWatchPaths(rootDir);
        server.watcher.add(watchPaths);
        server.ws.send({ type: 'full-reload' });
      });
    },
  };
}

function buildWatchPaths(rootDir: string) {
  const headPath = getGitValue(rootDir, ['rev-parse', '--git-path', 'HEAD']);
  const packedRefsPath = getGitValue(rootDir, ['rev-parse', '--git-path', 'packed-refs']);
  const branch = getGitValue(rootDir, ['symbolic-ref', '--quiet', 'HEAD']);
  const branchPath = branch ? getGitValue(rootDir, ['rev-parse', '--git-path', branch]) : '';

  return Array.from(new Set([
    headPath ? resolve(rootDir, headPath) : '',
    packedRefsPath ? resolve(rootDir, packedRefsPath) : '',
    branchPath ? resolve(rootDir, branchPath) : '',
  ].filter(Boolean)));
}

function getGitValue(rootDir: string, args: string[]) {
  try {
    return execFileSync('git', args, { cwd: rootDir, encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}
