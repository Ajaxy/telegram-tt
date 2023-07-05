import * as langProvider from '../util/langProvider';

import useForceUpdate from './useForceUpdate';
import useEffectOnce from './useEffectOnce';

export type LangFn = langProvider.LangFn;

const useLang = (): LangFn => {
  const forceUpdate = useForceUpdate();

  useEffectOnce(() => {
    return langProvider.addCallback(forceUpdate);
  });

  return langProvider.getTranslationFn();
};

export default useLang;
