import * as langProvider from '../util/langProvider';
import useEffectOnce from './useEffectOnce';
import useForceUpdate from './useForceUpdate';

export type LangFn = langProvider.LangFn;

const useLang = (): LangFn => {
  const forceUpdate = useForceUpdate();

  useEffectOnce(() => {
    return langProvider.addCallback(forceUpdate);
  });

  return langProvider.getTranslationFn();
};

export default useLang;
