import { useEffect } from '../../../../lib/teact/teact';
import { getActions } from '../../../../global';

import type { ChatTranslatedMessages } from '../../../../types';

import { throttle } from '../../../../util/schedulers';

const MESSAGE_LIMIT_PER_REQUEST = 20;
const THROTTLE_DELAY = 500;
const PENDING_TRANSLATIONS = new Map<string, Map<string, number[]>>();

export default function useMessageTranslation(
  chatTranslations: ChatTranslatedMessages | undefined,
  chatId?: string,
  messageId?: number,
  requestedLanguageCode?: string,
) {
  const messageTranslation = requestedLanguageCode && messageId
    ? chatTranslations?.byLangCode[requestedLanguageCode]?.[messageId] : undefined;

  const { isPending, text } = messageTranslation || {};

  useEffect(() => {
    if (!chatId || !messageId) return;

    if (!text && isPending === undefined && requestedLanguageCode) {
      addPendingTranslation(chatId, messageId, requestedLanguageCode);
    }
  }, [chatId, text, isPending, messageId, requestedLanguageCode]);

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
  PENDING_TRANSLATIONS.forEach((chats, toLanguageCode) => {
    chats.forEach((messageIds, chatId) => {
      const messageIdsToTranslate = messageIds.slice(0, MESSAGE_LIMIT_PER_REQUEST);

      if (messageIdsToTranslate.length < messageIds.length) {
        hasUnprocessed = true;
      }

      translateMessages({ chatId, messageIds: messageIdsToTranslate, toLanguageCode });

      removePendingTranslations(chatId, messageIdsToTranslate, toLanguageCode);
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
) {
  const languageTranslations = PENDING_TRANSLATIONS.get(toLanguageCode) || new Map<string, number[]>();
  const messageIds = languageTranslations.get(chatId) || [];

  if (messageIds.includes(messageId)) {
    throttledProcessPending();
    return;
  }

  messageIds.push(messageId);
  languageTranslations.set(chatId, messageIds);
  PENDING_TRANSLATIONS.set(toLanguageCode, languageTranslations);

  getActions().markMessagesTranslationPending({ chatId, messageIds, toLanguageCode });

  throttledProcessPending();
}

function removePendingTranslations(
  chatId: string,
  messageIds: number[],
  toLanguageCode: string,
) {
  const languageTranslations = PENDING_TRANSLATIONS.get(toLanguageCode);
  if (!languageTranslations?.size) {
    PENDING_TRANSLATIONS.delete(toLanguageCode);
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
      PENDING_TRANSLATIONS.delete(toLanguageCode);
    }
    return;
  }

  languageTranslations.set(chatId, newMessageIds);
}
