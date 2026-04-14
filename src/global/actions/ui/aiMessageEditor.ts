import type { ActionReturnType } from '../../types';

import { getCurrentTabId } from '../../../util/establishMultitabRole';
import { addActionHandler, getActions } from '../../index';
import { updateTabState } from '../../reducers/tabs';
import { selectTabState } from '../../selectors';
import { selectCurrentMessageList } from '../../selectors/messages';
import { selectTranslationLanguage } from '../../selectors/settings';

addActionHandler('openAiMessageEditorModal', (global, actions, payload): ActionReturnType => {
  const {
    chatId, text, initialTab = 'style', isFromAttachment,
    tabId = getCurrentTabId(),
  } = payload;

  const defaultTranslationLanguage = selectTranslationLanguage(global);

  return updateTabState(global, {
    aiMessageEditorModal: {
      chatId,
      text,
      activeTab: initialTab,
      isFromAttachment,
      translateTab: {
        selectedLanguage: defaultTranslationLanguage,
      },
    },
  }, tabId);
});

addActionHandler('closeAiMessageEditorModal', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};

  return updateTabState(global, {
    aiMessageEditorModal: undefined,
  }, tabId);
});

addActionHandler('setAiMessageEditorTab', (global, actions, payload): ActionReturnType => {
  const { tab, tabId = getCurrentTabId() } = payload;

  const aiMessageEditorModal = selectTabState(global, tabId).aiMessageEditorModal;
  if (!aiMessageEditorModal) return undefined;

  return updateTabState(global, {
    aiMessageEditorModal: {
      ...aiMessageEditorModal,
      activeTab: tab,
    },
  }, tabId);
});

addActionHandler('setAiMessageEditorTranslateOptions', (global, actions, payload): ActionReturnType => {
  const {
    selectedLanguage, shouldEmojify, clearResult,
    tabId = getCurrentTabId(),
  } = payload;
  const hasSelectedTone = 'selectedTone' in payload;

  const aiMessageEditorModal = selectTabState(global, tabId).aiMessageEditorModal;
  if (!aiMessageEditorModal) return undefined;

  const translateTab = aiMessageEditorModal.translateTab || {};

  return updateTabState(global, {
    aiMessageEditorModal: {
      ...aiMessageEditorModal,
      translateTab: {
        ...translateTab,
        selectedLanguage: selectedLanguage !== undefined ? selectedLanguage : translateTab.selectedLanguage,
        selectedTone: hasSelectedTone ? payload.selectedTone : translateTab.selectedTone,
        shouldEmojify: shouldEmojify !== undefined ? shouldEmojify : translateTab.shouldEmojify,
        result: clearResult ? undefined : translateTab.result,
        error: clearResult ? undefined : translateTab.error,
      },
    },
  }, tabId);
});

addActionHandler('setAiMessageEditorStyleOptions', (global, actions, payload): ActionReturnType => {
  const {
    shouldEmojify, clearResult,
    tabId = getCurrentTabId(),
  } = payload;
  const hasSelectedTone = 'selectedTone' in payload;

  const aiMessageEditorModal = selectTabState(global, tabId).aiMessageEditorModal;
  if (!aiMessageEditorModal) return undefined;

  const styleTab = aiMessageEditorModal.styleTab || {};

  return updateTabState(global, {
    aiMessageEditorModal: {
      ...aiMessageEditorModal,
      styleTab: {
        ...styleTab,
        selectedTone: hasSelectedTone ? payload.selectedTone : styleTab.selectedTone,
        shouldEmojify: shouldEmojify !== undefined ? shouldEmojify : styleTab.shouldEmojify,
        result: clearResult ? undefined : styleTab.result,
        error: clearResult ? undefined : styleTab.error,
      },
    },
  }, tabId);
});

addActionHandler('applyAiMessageEditorResult', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};

  const aiMessageEditorModal = selectTabState(global, tabId).aiMessageEditorModal;
  if (!aiMessageEditorModal) return undefined;

  const { activeTab } = aiMessageEditorModal;
  const tabState = activeTab === 'translate' ? aiMessageEditorModal.translateTab
    : activeTab === 'style' ? aiMessageEditorModal.styleTab : aiMessageEditorModal.fixTab;

  const textToApply = tabState?.result?.resultText || aiMessageEditorModal.text;

  return updateTabState(global, {
    aiMessageEditorModal: undefined,
    aiMessageEditorPendingResult: {
      text: textToApply,
    },
  }, tabId);
});

addActionHandler('sendAiMessageEditorResult', (global, actions, payload): ActionReturnType => {
  const {
    isSilent, scheduledAt, scheduleRepeatPeriod,
    tabId = getCurrentTabId(),
  } = payload || {};

  const aiMessageEditorModal = selectTabState(global, tabId).aiMessageEditorModal;
  if (!aiMessageEditorModal) return undefined;

  const { activeTab, isFromAttachment } = aiMessageEditorModal;
  const tabState = activeTab === 'translate' ? aiMessageEditorModal.translateTab
    : activeTab === 'style' ? aiMessageEditorModal.styleTab : aiMessageEditorModal.fixTab;

  const textToSend = tabState?.result?.resultText || aiMessageEditorModal.text;

  if (isFromAttachment) {
    return updateTabState(global, {
      aiMessageEditorModal: undefined,
      aiMessageEditorPendingResult: {
        text: textToSend,
        shouldSendWithAttachments: true,
        isSilent,
        scheduledAt,
        scheduleRepeatPeriod,
      },
    }, tabId);
  }

  const currentMessageList = selectCurrentMessageList(global, tabId);
  if (!currentMessageList) return undefined;

  const { chatId, threadId } = currentMessageList;

  const messageList = scheduledAt
    ? { ...currentMessageList, type: 'scheduled' as const }
    : currentMessageList;

  getActions().sendMessage({
    messageList,
    text: textToSend.text,
    entities: textToSend.entities,
    isSilent,
    scheduledAt,
    scheduleRepeatPeriod,
    tabId,
  });

  getActions().clearDraft({ chatId, threadId, isLocalOnly: true });

  return updateTabState(global, {
    aiMessageEditorModal: undefined,
    aiMessageEditorPendingResult: {
      shouldClear: true,
    },
  }, tabId);
});

addActionHandler('clearAiMessageEditorPendingResult', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};

  return updateTabState(global, {
    aiMessageEditorPendingResult: undefined,
  }, tabId);
});
