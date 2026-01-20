import type { ApiFormattedText } from '../../api/types';
import type { TextSummary, TranslatedMessage } from '../../types';
import type { GlobalState, TabArgs } from '../types';

import { getCurrentTabId } from '../../util/establishMultitabRole';
import { omit } from '../../util/iteratees';
import { selectMessageTranslations, selectTabState } from '../selectors';
import { updateTabState } from './tabs';

export function updateMessageTranslation<T extends GlobalState>(
  global: T, chatId: string, messageId: number, toLanguageCode: string, translation: Partial<TranslatedMessage>,
) {
  const translatedMessages = selectMessageTranslations(global, chatId, toLanguageCode);

  return {
    ...global,
    translations: {
      ...global.translations,
      byChatId: {
        ...global.translations.byChatId,
        [chatId]: {
          ...global.translations.byChatId[chatId],
          byLangCode: {
            ...global.translations.byChatId[chatId]?.byLangCode,
            [toLanguageCode]: {
              ...translatedMessages,
              [messageId]: {
                ...translatedMessages[messageId],
                ...translation,
              },
            },
          },
        },
      },
    },
  };
}

export function clearMessageTranslation<T extends GlobalState>(
  global: T, chatId: string, messageId: number,
) {
  const chatTranslations = global.translations.byChatId[chatId];
  if (!chatTranslations) return global;

  const { byLangCode } = chatTranslations;
  const newByLangCode = Object.keys(byLangCode).reduce((acc, langCode) => {
    const newTranslatedMessages = omit(byLangCode[langCode], [messageId]);
    if (Object.keys(newTranslatedMessages).length) {
      acc[langCode] = newTranslatedMessages;
    }

    return acc;
  }, {} as Record<string, Record<number, TranslatedMessage>>);

  return {
    ...global,
    translations: {
      ...global.translations,
      byChatId: {
        ...global.translations.byChatId,
        [chatId]: {
          ...chatTranslations,
          byLangCode: newByLangCode,
        },
      },
    },
  };
}

export function updateMessageTranslations<T extends GlobalState>(
  global: T, chatId: string, messageIds: number[], toLanguageCode: string, translations: ApiFormattedText[],
) {
  messageIds.forEach((messageId, index) => {
    global = updateMessageTranslation(global, chatId, messageId, toLanguageCode, {
      text: translations[index],
      isPending: false,
    });
  });

  return global;
}

export function updateRequestedChatTranslation<T extends GlobalState>(
  global: T, chatId: string, toLanguageCode?: string, ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  const tabState = selectTabState(global, tabId);
  global = updateTabState(global, {
    requestedTranslations: {
      ...tabState.requestedTranslations,
      byChatId: {
        ...tabState.requestedTranslations.byChatId,
        [chatId]: {
          toLanguage: toLanguageCode,
        },
      },
    },
  }, tabId);

  return global;
}

export function removeRequestedChatTranslation<T extends GlobalState>(
  global: T, chatId: string, ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  const tabState = selectTabState(global, tabId);

  global = updateTabState(global, {
    requestedTranslations: {
      ...tabState.requestedTranslations,
      byChatId: omit(tabState.requestedTranslations.byChatId, [chatId]),
    },
  }, tabId);

  return global;
}

export function updateRequestedMessageTranslation<T extends GlobalState>(
  global: T, chatId: string, messageId: number, toLanguageCode: string, ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  const tabState = selectTabState(global, tabId);
  global = updateTabState(global, {
    requestedTranslations: {
      ...tabState.requestedTranslations,
      byChatId: {
        ...tabState.requestedTranslations.byChatId,
        [chatId]: {
          ...tabState.requestedTranslations.byChatId[chatId],
          manualMessages: {
            ...tabState.requestedTranslations.byChatId[chatId]?.manualMessages,
            [messageId]: toLanguageCode,
          },
        },
      },
    },
  }, tabId);

  return global;
}

export function removeRequestedMessageTranslation<T extends GlobalState>(
  global: T, chatId: string, messageId: number, ...[tabId = getCurrentTabId()]: TabArgs<T>
) {
  const tabState = selectTabState(global, tabId);

  const manualMessages = tabState.requestedTranslations.byChatId[chatId]?.manualMessages;
  if (!manualMessages) return global;

  const newManualMessages = omit(manualMessages, [messageId]);

  global = updateTabState(global, {
    requestedTranslations: {
      ...tabState.requestedTranslations,
      byChatId: {
        ...tabState.requestedTranslations.byChatId,
        [chatId]: {
          ...tabState.requestedTranslations.byChatId[chatId],
          manualMessages: newManualMessages,
        },
      },
    },
  }, tabId);

  return global;
}

export function updateMessageSummary<T extends GlobalState>(
  global: T, chatId: string, messageId: number, summary: TextSummary, toLanguageCode?: string,
) {
  if (toLanguageCode) {
    return updateMessageTranslation(global, chatId, messageId, toLanguageCode, { summary });
  }

  const chatSummaries = global.messages.byChatId[chatId]?.summaryById;
  return replaceGeneralSummaryStore(global, chatId, { ...chatSummaries, [messageId]: summary });
}

export function clearMessageSummary<T extends GlobalState>(
  global: T, chatId: string, messageId: number,
) {
  const chatSummaries = global.messages.byChatId[chatId]?.summaryById;
  if (!chatSummaries) return global;

  const newSummaryById = omit(chatSummaries, [messageId]);
  return replaceGeneralSummaryStore(global, chatId, newSummaryById);
}

function replaceGeneralSummaryStore<T extends GlobalState>(
  global: T, chatId: string, update: Record<number, TextSummary>,
): T {
  if (!global.messages.byChatId[chatId]) return global; // Unloaded chats should not have summaries

  return {
    ...global,
    messages: {
      ...global.messages,
      byChatId: {
        ...global.messages.byChatId,
        [chatId]: {
          ...global.messages.byChatId[chatId],
          summaryById: update,
        },
      },
    },
  };
}
