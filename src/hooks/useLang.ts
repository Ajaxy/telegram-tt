import {
  addLocalizationCallback,
  getTranslationFn,
  type LangFn,
} from '../util/localization';
import useEffectOnce from './useEffectOnce';
import useForceUpdate from './useForceUpdate';

const useLang = (): LangFn => {
  const forceUpdate = useForceUpdate();

  useEffectOnce(() => {
    return addLocalizationCallback(forceUpdate);
  });

  return getTranslationFn();
};

export default useLang;
