import { useEffect } from '../../../../lib/teact/teact';
import { getActions } from '../../../../global';
import type { ChatTranslatedMessages } from '../../../../global/types';

export default function useMessageTranslation(
  chatTranslations: ChatTranslatedMessages | undefined,
  chatId: string,
  messageId: number,
  requestedLanguageCode?: string,
) {
  const { translateMessages } = getActions();
  const messageTranslation = requestedLanguageCode
    ? chatTranslations?.byLangCode[requestedLanguageCode]?.[messageId] : undefined;

  const { isPending, text } = messageTranslation || {};

  useEffect(() => {
    if (!text && !isPending && requestedLanguageCode) {
      translateMessages({ chatId, messageIds: [messageId], toLanguageCode: requestedLanguageCode });
    }
  }, [chatId, text, isPending, messageId, requestedLanguageCode, translateMessages]);

  return {
    isPending,
    translatedText: text,
  };
}
