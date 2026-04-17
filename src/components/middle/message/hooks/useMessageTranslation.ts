import { useEffect } from '../../../../lib/teact/teact';
import { getActions } from '../../../../global';

import type { ChatTranslatedMessages, TranslationTone } from '../../../../types';

import { getTranslationCacheKey, parseTranslationCacheKey } from '../../../../util/keys/translationKey';
import { throttle } from '../../../../util/schedulers';

const MESSAGE_LIMIT_PER_REQUEST = 20;
const THROTTLE_DELAY = 500;
const PENDING_TRANSLATIONS = new Map<string, Map<string, number[]>>();

export default function useMessageTranslation(
  chatTranslations: ChatTranslatedMessages | undefined,
  chatId?: string,
  messageId?: number,
  requestedLanguageCode?: string,
  tone?: TranslationTone,
) {
  const cacheKey = requestedLanguageCode ? getTranslationCacheKey(requestedLanguageCode, tone) : undefined;
  const messageTranslation = cacheKey && messageId
    ? chatTranslations?.byLangCode[cacheKey]?.[messageId] : undefined;

  const { isPending, text } = messageTranslation || {};

  useEffect(() => {
    if (!chatId || !messageId || !cacheKey || !requestedLanguageCode) return;

    if (!text && isPending === undefined) {
      addPendingTranslation(chatId, messageId, requestedLanguageCode, tone);
    }
  }, [chatId, text, isPending, messageId, cacheKey, requestedLanguageCode, tone]);

  if (!chatId || !messageId) {
    return {
      isPending: false,
      translatedText: undefined,
    };
  }

  return {
    isPending,
    translatedText: text,
  };
}

const throttledProcessPending = throttle(processPending, THROTTLE_DELAY);

function processPending() {
  const { translateMessages } = getActions();
  let hasUnprocessed = false;

  PENDING_TRANSLATIONS.forEach((chats, cacheKey) => {
    const { languageCode, tone } = parseTranslationCacheKey(cacheKey);

    chats.forEach((messageIds, chatId) => {
      const messageIdsToTranslate = messageIds.slice(0, MESSAGE_LIMIT_PER_REQUEST);

      if (messageIdsToTranslate.length < messageIds.length) {
        hasUnprocessed = true;
      }

      translateMessages({ chatId, messageIds: messageIdsToTranslate, toLanguageCode: languageCode, tone });

      removePendingTranslations(chatId, messageIdsToTranslate, cacheKey);
    });
  });

  if (hasUnprocessed) {
    throttledProcessPending();
  }
}

function addPendingTranslation(
  chatId: string,
  messageId: number,
  toLanguageCode: string,
  tone?: TranslationTone,
) {
  const cacheKey = getTranslationCacheKey(toLanguageCode, tone);
  const languageTranslations = PENDING_TRANSLATIONS.get(cacheKey) || new Map<string, number[]>();
  const messageIds = languageTranslations.get(chatId) || [];

  if (messageIds.includes(messageId)) {
    throttledProcessPending();
    return;
  }

  messageIds.push(messageId);
  languageTranslations.set(chatId, messageIds);
  PENDING_TRANSLATIONS.set(cacheKey, languageTranslations);

  getActions().markMessagesTranslationPending({ chatId, messageIds, toLanguageCode, tone });

  throttledProcessPending();
}

function removePendingTranslations(
  chatId: string,
  messageIds: number[],
  cacheKey: string,
) {
  const languageTranslations = PENDING_TRANSLATIONS.get(cacheKey);
  if (!languageTranslations?.size) {
    PENDING_TRANSLATIONS.delete(cacheKey);
    return;
  }

  const oldMessageIds = languageTranslations.get(chatId);
  if (!oldMessageIds?.length) {
    languageTranslations.delete(chatId);
    return;
  }

  const newMessageIds = oldMessageIds.filter((id) => !messageIds.includes(id));

  if (!newMessageIds?.length) {
    languageTranslations.delete(chatId);
    if (!languageTranslations.size) {
      PENDING_TRANSLATIONS.delete(cacheKey);
    }
    return;
  }

  languageTranslations.set(chatId, newMessageIds);
}
