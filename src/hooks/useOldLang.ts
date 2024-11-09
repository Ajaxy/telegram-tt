import * as langProvider from '../util/oldLangProvider';
import useEffectOnce from './useEffectOnce';
import useForceUpdate from './useForceUpdate';

export type OldLangFn = langProvider.LangFn;
/**
 * @deprecated
 */
const useOldLang = (): OldLangFn => {
  const forceUpdate = useForceUpdate();

  useEffectOnce(() => {
    return langProvider.addCallback(forceUpdate);
  });

  return langProvider.getTranslationFn();
};

export default useOldLang;
