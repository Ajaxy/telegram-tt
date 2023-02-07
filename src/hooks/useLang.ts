import * as langProvider from '../util/langProvider';
import useForceUpdate from './useForceUpdate';
import useSyncEffect from './useSyncEffect';

export type LangFn = langProvider.LangFn;

const useLang = (): LangFn => {
  const forceUpdate = useForceUpdate();

  useSyncEffect(() => {
    return langProvider.addCallback(forceUpdate);
  }, [forceUpdate]);

  return langProvider.getTranslationFn();
};

export default useLang;
