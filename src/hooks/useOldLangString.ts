import * as langProvider from '../util/oldLangProvider';
import useAsync from './useAsync';

const useOldLangString = (
  langCode: string | undefined,
  key: string,
  shouldIgnoreSameValue = false,
): string | undefined => {
  const defaultValue = shouldIgnoreSameValue ? undefined : key;
  const { result } = useAsync(() => {
    if (langCode) {
      return langProvider.getTranslationForLangString(langCode, key);
    }

    return Promise.resolve();
  }, [langCode, key], defaultValue);

  return result || defaultValue;
};

export default useOldLangString;
