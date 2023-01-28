import * as langProvider from '../util/langProvider';
import useForceUpdate from './useForceUpdate';
import useOnChange from './useOnChange';

export type LangFn = langProvider.LangFn;

const useLang = (): LangFn => {
  const forceUpdate = useForceUpdate();

  useOnChange(() => {
    return langProvider.addCallback(forceUpdate);
  }, [forceUpdate]);

  return langProvider.getTranslationFn();
};

export default useLang;
