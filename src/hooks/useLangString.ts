import * as langProvider from '../util/langProvider';
import { useState } from '../lib/teact/teact';

const useLangString = (langCode: string | undefined, key: string): string | undefined => {
  const [translation, setTranslation] = useState<string>();

  if (langCode) {
    langProvider
      .getTranslationForLangString(langCode, key)
      .then((value) => {
        // The string is not translated, maybe the language pack was not loaded due to network or a timeout errors
        if (value === key) {
          return;
        }

        setTranslation(value);
      });
  }

  return translation;
};

export default useLangString;
