import type { ApiMessage } from '../../../../api/types';
import { SERVICE_NOTIFICATIONS_USER_ID } from '../../../../config';
import { getActions } from '../../../../global';
import useTextLanguage from '../../../../hooks/useTextLanguage';
import LimitedMap from '../../../../util/primitives/LimitedMap';
import { throttle } from '../../../../util/schedulers';

// https://github.com/DrKLO/Telegram/blob/dfd74f809e97d1ecad9672fc7388cb0223a95dfc/TMessagesProj/src/main/java/org/telegram/messenger/TranslateController.java#L35
const MIN_MESSAGES_CHECKED = 8;
const MIN_TRANSLATABLE_RATIO = 0.3;
const MIN_DETECTABLE_RATIO = 0.6;

const THROTTLE_DELAY = 1000;
const MESSAGES_LIMIT = 150;

type MessageMetadata = {
  id: number;
  isTranslatable: boolean;
  detectedLanguage: string | undefined;
};

const CHAT_STATS = new Map<string, LimitedMap<number, MessageMetadata>>();

export default function useDetectChatLanguage(message: ApiMessage, isDisabled?: boolean) {
  const canProcess = !isDisabled && message.chatId !== SERVICE_NOTIFICATIONS_USER_ID;

  const isTranslatable = Boolean(message.content.text?.text.length);
  const detectedLanguage = useTextLanguage(message.content.text?.text, !canProcess);

  if (!canProcess) return;

  processMessageMetadata(message.chatId, message.id, isTranslatable, detectedLanguage);
}

const throttledMakeChatDecision = throttle(makeChatDecision, THROTTLE_DELAY);

function processMessageMetadata(chatId: string, id: number, isTranslatable: boolean, detectedLanguage?: string) {
  const chatStats = CHAT_STATS.get(chatId) || new LimitedMap<number, MessageMetadata>(MESSAGES_LIMIT);

  const previousMetadata = chatStats.get(id);
  if (previousMetadata && previousMetadata.detectedLanguage === detectedLanguage
    && previousMetadata.isTranslatable === isTranslatable
  ) {
    return;
  }

  chatStats.set(id, {
    id,
    isTranslatable,
    detectedLanguage,
  });

  CHAT_STATS.set(chatId, chatStats);

  throttledMakeChatDecision(chatId);
}

function makeChatDecision(chatId: string) {
  const { updateChatDetectedLanguage } = getActions();
  const chatStats = CHAT_STATS.get(chatId);
  if (!chatStats) {
    return;
  }

  const messagesChecked = chatStats.size;
  if (messagesChecked < MIN_MESSAGES_CHECKED) {
    return;
  }

  let translatableCount = 0;
  let detectableCount = 0;
  const languageOccurrences = new Map<string, number>();

  for (const metadata of chatStats.values()) {
    if (metadata.isTranslatable) {
      translatableCount++;
    }

    if (metadata.detectedLanguage) {
      detectableCount++;
    }

    const language = metadata.detectedLanguage;
    if (language) {
      const occurrences = languageOccurrences.get(language) || 0;
      languageOccurrences.set(language, occurrences + 1);
    }
  }

  const translatableRatio = translatableCount / messagesChecked;
  const detectableRatio = detectableCount / messagesChecked;

  if (translatableRatio < MIN_TRANSLATABLE_RATIO || detectableRatio < MIN_DETECTABLE_RATIO) {
    return;
  }

  const mostFrequentLanguage = Array.from(languageOccurrences.entries())
    .sort(([, a], [, b]) => b - a)[0][0];

  updateChatDetectedLanguage({
    chatId,
    detectedLanguage: mostFrequentLanguage,
  });
}
