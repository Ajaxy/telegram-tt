import type { ApiInputAiComposeTone } from '../../../api/types';
import type { ActionReturnType, GlobalState } from '../../types';

import { compareAiTones, getToneCacheKey } from '../../../util/aiComposeTones';
import { getCurrentTabId } from '../../../util/establishMultitabRole';
import { callApi } from '../../../api/gramjs';
import { addActionHandler, getGlobal, setGlobal } from '../../index';
import { updateTabState } from '../../reducers/tabs';
import { selectTabState } from '../../selectors';
import { selectCurrentLimit } from '../../selectors/limits';
import { selectIsCurrentUserPremium } from '../../selectors/users';

export function showToneLimitNotification<T extends GlobalState>(
  global: T,
  actions: { showNotification: AnyFunction },
  tabId: number,
): boolean {
  const isPremium = selectIsCurrentUserPremium(global);
  const limit = selectCurrentLimit(global, 'aiComposeToneSaved');

  const customToneCount = (global.aiComposeTones?.tones || []).filter((t) => 'id' in t).length;
  if (customToneCount < limit) return false;

  if (isPremium) {
    actions.showNotification({
      message: { key: 'AiToneLimitReachedPremium', variables: { limit: limit.toString() } },
      tabId,
    });
  } else {
    actions.showNotification({
      message: { key: 'AiToneLimitReached' },
      action: { action: 'openPremiumModal', payload: { tabId } },
      actionText: { key: 'PremiumMore' },
      tabId,
    });
  }

  return true;
}

function buildStyleCacheKey(tone?: ApiInputAiComposeTone, emojify?: boolean) {
  return `${tone ? getToneCacheKey(tone) : ''}_${emojify ? '1' : '0'}`;
}

function buildTranslateCacheKey(
  lang?: string, tone?: ApiInputAiComposeTone, emojify?: boolean,
) {
  return `${lang || ''}_${tone ? getToneCacheKey(tone) : ''}_${emojify ? '1' : '0'}`;
}

addActionHandler('composeWithAiMessageEditor', async (global, actions, payload): Promise<void> => {
  const {
    shouldProofread, isEmojify, translateToLang, tone,
    tabId = getCurrentTabId(),
  } = payload;

  let modal = selectTabState(global, tabId).aiMessageEditorModal;
  if (!modal) return;

  let cachedResult;
  let tabKey: 'translateTab' | 'styleTab' | 'fixTab';

  if (shouldProofread) {
    tabKey = 'fixTab';
    cachedResult = modal.fixTab?.cache;
  } else if (translateToLang) {
    tabKey = 'translateTab';
    const cacheKey = buildTranslateCacheKey(translateToLang, tone, isEmojify);
    cachedResult = modal.translateTab?.cache?.[cacheKey];
  } else {
    tabKey = 'styleTab';
    const cacheKey = buildStyleCacheKey(tone, isEmojify);
    cachedResult = modal.styleTab?.cache?.[cacheKey];
  }

  if (cachedResult) {
    global = getGlobal();
    modal = selectTabState(global, tabId).aiMessageEditorModal;
    if (!modal) return;
    global = updateTabState(global, {
      aiMessageEditorModal: {
        ...modal,
        [tabKey]: { ...modal[tabKey], result: cachedResult, error: undefined, isLoading: false },
      },
    }, tabId);
    setGlobal(global);
    return;
  }

  global = getGlobal();
  modal = selectTabState(global, tabId).aiMessageEditorModal;
  if (!modal) return;
  global = updateTabState(global, {
    aiMessageEditorModal: {
      ...modal,
      [tabKey]: { ...modal[tabKey], isLoading: true },
    },
  }, tabId);
  setGlobal(global);

  const response = await callApi('composeMessageWithAI', {
    text: modal.text,
    shouldProofread,
    isEmojify,
    translateToLang,
    tone,
  });

  global = getGlobal();
  modal = selectTabState(global, tabId).aiMessageEditorModal;
  if (!modal) return;

  if (response?.error) {
    global = updateTabState(global, {
      aiMessageEditorModal: {
        ...modal,
        [tabKey]: { ...modal[tabKey], result: undefined, isLoading: false, error: response.error },
      },
    }, tabId);
    setGlobal(global);
    return;
  }

  const result = response?.result;
  const currentTabState = modal[tabKey] || {};

  let isOutdatedResult = false;
  if (translateToLang) {
    const { selectedLanguage, selectedTone, shouldEmojify } = modal.translateTab || {};
    isOutdatedResult = selectedLanguage !== translateToLang
      || !compareAiTones(selectedTone, tone)
      || Boolean(shouldEmojify) !== Boolean(isEmojify);
  } else if (!shouldProofread) {
    const { selectedTone, shouldEmojify } = modal.styleTab || {};
    isOutdatedResult = !compareAiTones(selectedTone, tone)
      || Boolean(shouldEmojify) !== Boolean(isEmojify);
  }

  let updatedCache;
  if (result) {
    if (shouldProofread) {
      updatedCache = result;
    } else if (translateToLang) {
      const cacheKey = buildTranslateCacheKey(translateToLang, tone, isEmojify);
      updatedCache = { ...currentTabState.cache, [cacheKey]: result };
    } else {
      const cacheKey = buildStyleCacheKey(tone, isEmojify);
      updatedCache = { ...currentTabState.cache, [cacheKey]: result };
    }
  }

  if (isOutdatedResult) {
    global = updateTabState(global, {
      aiMessageEditorModal: {
        ...modal,
        [tabKey]: {
          ...currentTabState,
          isLoading: false,
          cache: updatedCache !== undefined ? updatedCache : currentTabState.cache,
        },
      },
    }, tabId);
    setGlobal(global);
    return;
  }

  global = updateTabState(global, {
    aiMessageEditorModal: {
      ...modal,
      [tabKey]: {
        ...currentTabState,
        isLoading: false,
        result,
        error: undefined,
        cache: updatedCache !== undefined ? updatedCache : currentTabState.cache,
      },
    },
  }, tabId);
  setGlobal(global);
});

addActionHandler('createAiTone', async (global, actions, payload): Promise<void> => {
  const {
    title, emojiId, prompt, shouldDisplayAuthor,
    tabId = getCurrentTabId(),
  } = payload;

  if (showToneLimitNotification(global, actions, tabId)) return;

  const result = await callApi('createAiTone', {
    title, emojiId, prompt, shouldDisplayAuthor,
  });

  if (!result) return;

  actions.closeAiToneEditorModal({ tabId });
  actions.loadAiComposeTones();
  actions.showNotification({
    title: { key: 'AiToneCreated', variables: { title } },
    message: { key: 'AiToneCreatedHint' },
    customEmojiIconId: emojiId,
    tabId,
  });
});

addActionHandler('deleteAiTone', async (global, actions, payload): Promise<void> => {
  const { tone, tabId = getCurrentTabId() } = payload;

  const result = await callApi('deleteAiTone', { tone });

  if (!result) {
    actions.showNotification({ message: { key: 'ErrorUnspecified' }, tabId });
    return;
  }

  actions.loadAiComposeTones();
});

addActionHandler('updateAiTone', async (global, actions, payload): Promise<void> => {
  const {
    tone, title, emojiId, prompt, shouldDisplayAuthor,
    tabId = getCurrentTabId(),
  } = payload;

  const updatedTone = await callApi('updateAiTone', {
    tone, title, emojiId, prompt, shouldDisplayAuthor,
  });

  if (!updatedTone) return;

  global = getGlobal();
  const currentTones = global.aiComposeTones?.tones || [];
  const updatedTones = 'id' in updatedTone
    ? currentTones.map((t) => ('id' in t && t.id === updatedTone.id ? updatedTone : t))
    : currentTones;

  global = {
    ...global,
    aiComposeTones: {
      ...global.aiComposeTones,
      tones: updatedTones,
      hash: global.aiComposeTones?.hash || '',
    },
  };
  setGlobal(global);

  actions.closeAiToneEditorModal({ tabId });
  actions.loadAiComposeTones();
});

addActionHandler('openAiTonePreview', async (global, actions, payload): Promise<void> => {
  const { slug, tabId = getCurrentTabId() } = payload;

  const result = await callApi('fetchAiTone', {
    tone: { type: 'slug', slug },
  });

  if (!result?.tones.length) {
    actions.showNotification({ message: { key: 'ErrorUnspecified' }, tabId });
    return;
  }

  const tone = result.tones[0];
  if (!('id' in tone)) return;

  const example = await callApi('fetchAiToneExample', {
    tone: { type: 'slug', slug },
    num: 0,
  });

  global = getGlobal();
  const currentTones = global.aiComposeTones?.tones || [];
  const isAlreadyAdded = tone.isCreator || currentTones.some((t) => 'id' in t && t.id === tone.id);
  global = updateTabState(global, {
    aiTonePreviewModal: {
      slug,
      tone,
      isAlreadyAdded,
      example,
    },
  }, tabId);
  setGlobal(global);
});

addActionHandler('closeAiTonePreview', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};
  return updateTabState(global, {
    aiTonePreviewModal: undefined,
  }, tabId);
});

addActionHandler('saveAiTone', async (global, actions, payload): Promise<void> => {
  const { tone, unsave, tabId = getCurrentTabId() } = payload;

  if (!unsave && showToneLimitNotification(global, actions, tabId)) return;

  const result = await callApi('saveAiTone', { tone, unsave });
  if (!result) return;

  actions.loadAiComposeTones();
  actions.closeAiTonePreview({ tabId });

  if (!unsave) {
    actions.showNotification({
      message: { key: 'AiTonePreviewStyleAdded' },
      tabId,
    });
  }
});

addActionHandler('loadAiTonePreviewExample', async (global, actions, payload): Promise<void> => {
  const { tone, num, tabId = getCurrentTabId() } = payload;

  // Clear current example to trigger loading state
  const currentModal = selectTabState(global, tabId).aiTonePreviewModal;
  if (currentModal) {
    global = updateTabState(global, {
      aiTonePreviewModal: { ...currentModal, example: undefined, hasExampleError: undefined },
    }, tabId);
    setGlobal(global);
  }

  const example = await callApi('fetchAiToneExample', { tone, num });

  global = getGlobal();
  const previewModal = selectTabState(global, tabId).aiTonePreviewModal;
  if (!previewModal) return;

  const openModalTone: ApiInputAiComposeTone = { type: 'slug', slug: previewModal.slug };
  if (!compareAiTones(openModalTone, tone)) return;

  global = updateTabState(global, {
    aiTonePreviewModal: {
      ...previewModal,
      example,
      hasExampleError: !example,
    },
  }, tabId);
  setGlobal(global);
});

addActionHandler('loadAiComposeTones', async (global): Promise<void> => {
  const hash = global.aiComposeTones?.hash;
  const result = await callApi('fetchAiComposeTones', { hash });
  if (!result) return;

  global = getGlobal();
  global = {
    ...global,
    aiComposeTones: {
      tones: result.tones,
      hash: result.hash,
    },
  };
  setGlobal(global);
});
