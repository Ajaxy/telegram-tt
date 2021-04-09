import { useEffect } from '../lib/teact/teact';

import {
  BundleModules, Bundles, getModuleFromMemory, loadModule, addLoadListener,
} from '../util/moduleLoader';

import useForceUpdate from './useForceUpdate';

export default <B extends Bundles, M extends BundleModules<B>>(
  bundleName: B, moduleName: M, noLoad = false, autoUpdate = false,
) => {
  const module = getModuleFromMemory(bundleName, moduleName);
  const forceUpdate = useForceUpdate();

  if (autoUpdate) {
    // Use effect and cleanup for listener removal
    addLoadListener(forceUpdate);
  }

  useEffect(() => {
    if (!noLoad && !module) {
      loadModule(bundleName, moduleName).then(forceUpdate);
    }
  }, [bundleName, forceUpdate, module, moduleName, noLoad]);

  return module;
};
