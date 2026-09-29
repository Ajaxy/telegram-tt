import type { ActionReturnType } from '../../types';

import { getCurrentTabId } from '../../../util/establishMultitabRole';
import { hasAiEditorContent } from '../../helpers/aiMessageEditor';
import { addActionHandler } from '../../index';
import { updateTabState } from '../../reducers/tabs';
import { selectTabState } from '../../selectors';
import { selectCurrentMessageList } from '../../selectors/messages';
import { selectTranslationLanguage } from '../../selectors/settings';
import { showToneLimitNotification } from '../api/ai';

addActionHandler('openAiMessageEditorModal', (global, actions, payload): ActionReturnType => {
  const {
    chatId, threadId, content, initialTab = 'style', isFromAttachment, isEditing,
    tabId = getCurrentTabId(),
  } = payload;

  const defaultTranslationLanguage = selectTranslationLanguage(global);
  const hasSource = hasAiEditorContent(content);

  return updateTabState(global, {
    aiMessageEditorModal: {
      chatId,
      threadId,
      content,
      activeTab: hasSource ? initialTab : 'style',
      isFromAttachment,
      isEditing,
      styleTab: {
        selectedTone: !hasSource ? { type: 'singleUse', customPrompt: '' } : undefined,
      },
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
        requestId: undefined,
        isLoading: false,
        result: clearResult ? undefined : translateTab.result,
        error: clearResult ? undefined : translateTab.error,
      },
    },
  }, tabId);
});

addActionHandler('setAiMessageEditorStyleOptions', (global, actions, payload): ActionReturnType => {
  const {
    shouldEmojify, customPrompt, clearResult,
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
        customPrompt: customPrompt !== undefined ? customPrompt : styleTab.customPrompt,
        shouldEmojify: shouldEmojify !== undefined ? shouldEmojify : styleTab.shouldEmojify,
        requestId: undefined,
        isLoading: false,
        result: clearResult ? undefined : styleTab.result,
        error: clearResult && styleTab.error !== 'floodPremium' ? undefined : styleTab.error,
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

  const content = tabState?.result || aiMessageEditorModal.content;
  if (tabState?.isLoading || tabState?.error || !hasAiEditorContent(content)) return undefined;

  return updateTabState(global, {
    aiMessageEditorModal: undefined,
    aiMessageEditorPendingResult: {
      content,
      chatId: aiMessageEditorModal.chatId,
      threadId: aiMessageEditorModal.threadId,
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
  if (activeTab === 'style' && aiMessageEditorModal.styleTab?.selectedTone?.type === 'singleUse'
    && !aiMessageEditorModal.styleTab.result) return undefined;
  const tabState = activeTab === 'translate' ? aiMessageEditorModal.translateTab
    : activeTab === 'style' ? aiMessageEditorModal.styleTab : aiMessageEditorModal.fixTab;

  const content = tabState?.result || aiMessageEditorModal.content;
  if (tabState?.isLoading || tabState?.error || !hasAiEditorContent(content)) return undefined;

  if (aiMessageEditorModal.isEditing) return undefined;

  if (!isFromAttachment) {
    const currentMessageList = selectCurrentMessageList(global, tabId);
    if (!currentMessageList || currentMessageList.chatId !== aiMessageEditorModal.chatId
      || currentMessageList.threadId !== aiMessageEditorModal.threadId) return undefined;
  }

  return updateTabState(global, {
    aiMessageEditorModal: undefined,
    aiMessageEditorPendingResult: {
      content,
      chatId: aiMessageEditorModal.chatId,
      threadId: aiMessageEditorModal.threadId,
      shouldSend: isFromAttachment ? undefined : true,
      shouldSendWithAttachments: isFromAttachment,
      isSilent,
      scheduledAt,
      scheduleRepeatPeriod,
    },
  }, tabId);
});

addActionHandler('clearAiMessageEditorPendingResult', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};

  return updateTabState(global, {
    aiMessageEditorPendingResult: undefined,
  }, tabId);
});

addActionHandler('openAiToneEditorModal', (global, actions, payload): ActionReturnType => {
  const { toneToEdit, tabId = getCurrentTabId() } = payload || {};

  if (!toneToEdit && showToneLimitNotification(global, actions, tabId)) {
    return undefined;
  }

  return updateTabState(global, {
    aiToneEditorModal: { toneToEdit },
  }, tabId);
});

addActionHandler('closeAiToneEditorModal', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};

  return updateTabState(global, {
    aiToneEditorModal: undefined,
  }, tabId);
});
