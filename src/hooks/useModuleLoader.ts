import { useEffect } from '../lib/teact/teact';

import type { BundleModules, Bundles } from '../util/moduleLoader';

import { addLoadListener, getModuleFromMemory, loadModule } from '../util/moduleLoader';
import useForceUpdate from './useForceUpdate';

const useModuleLoader = <B extends Bundles, M extends BundleModules<B>>(
  bundleName: B, moduleName: M, noLoad = false, autoUpdate = false,
) => {
  const module = getModuleFromMemory(bundleName, moduleName);
  const forceUpdate = useForceUpdate();

  useEffect(() => {
    if (!autoUpdate) {
      return undefined;
    }

    return addLoadListener(forceUpdate);
  }, [autoUpdate, forceUpdate]);

  useEffect(() => {
    if (!noLoad && !module) {
      loadModule(bundleName).then(forceUpdate);
    }
  }, [bundleName, forceUpdate, module, moduleName, noLoad]);

  return module;
};

export default useModuleLoader;
