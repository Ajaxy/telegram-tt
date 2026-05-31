import type { ApiInputAiComposeTone } from '../../../api/types';

import { compareAiTones, getToneCacheKey } from '../../../util/aiComposeTones';
import { getCurrentTabId } from '../../../util/establishMultitabRole';
import { callApi } from '../../../api/gramjs';
import { addActionHandler, getGlobal, setGlobal } from '../../index';
import { updateTabState } from '../../reducers/tabs';
import { selectTabState } from '../../selectors';

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
