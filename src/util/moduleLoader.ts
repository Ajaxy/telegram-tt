import { DEBUG } from '../config';

export enum Bundles {
  Auth,
  Main,
  Extra,
}

interface ImportedBundles {
  [Bundles.Auth]: typeof import('../bundles/auth');
  [Bundles.Main]: typeof import('../bundles/main');
  [Bundles.Extra]: typeof import('../bundles/extra');
}

type BundlePromises = {
  [K in keyof ImportedBundles]: Promise<ImportedBundles[K]>
};

export type BundleModules<B extends keyof ImportedBundles> = keyof ImportedBundles[B];

const LOAD_PROMISES: Partial<BundlePromises> = {};
const MEMORY_CACHE: Partial<ImportedBundles> = {};

export async function loadModule<B extends Bundles, M extends BundleModules<B>>(bundleName: B, moduleName: M) {
  if (!LOAD_PROMISES[bundleName]) {
    switch (bundleName) {
      case Bundles.Auth:
        LOAD_PROMISES[Bundles.Auth] = import('../bundles/auth');
        break;
      case Bundles.Main:
        if (DEBUG) {
          // eslint-disable-next-line no-console
          console.log('>>> START LOAD MAIN BUNDLE');
        }

        LOAD_PROMISES[Bundles.Main] = import('../bundles/main');
        break;
      case Bundles.Extra:
        LOAD_PROMISES[Bundles.Extra] = import('../bundles/extra');
        break;
    }

    (LOAD_PROMISES[bundleName] as Promise<ImportedBundles[B]>).then(handleBundleLoad);
  }

  const bundle = (await LOAD_PROMISES[bundleName]) as unknown as ImportedBundles[B];

  if (!MEMORY_CACHE[bundleName]) {
    MEMORY_CACHE[bundleName] = bundle;
  }

  return getModuleFromMemory(bundleName, moduleName);
}

export function getModuleFromMemory<B extends Bundles, M extends BundleModules<B>>(bundleName: B, moduleName: M) {
  const bundle = MEMORY_CACHE[bundleName] as ImportedBundles[B];

  if (!bundle) {
    return undefined;
  }

  return bundle[moduleName];
}

const listeners: NoneToVoidFunction[] = [];

export function addLoadListener(listener: NoneToVoidFunction) {
  if (!listeners.includes(listener)) {
    listeners.push(listener);
  }
}

function handleBundleLoad() {
  listeners.forEach((listener) => {
    listener();
  });
}
