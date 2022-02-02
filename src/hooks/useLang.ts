import * as langProvider from '../util/langProvider';
import useForceUpdate from './useForceUpdate';
import useOnChange from './useOnChange';

export type LangFn = typeof langProvider.getTranslation;

const useLang = (): LangFn => {
  const forceUpdate = useForceUpdate();

  useOnChange(() => {
    return langProvider.addCallback(forceUpdate);
  }, [forceUpdate]);

  return langProvider.getTranslation;
};

export default useLang;
