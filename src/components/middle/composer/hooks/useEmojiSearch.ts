import {
  useEffect, useMemo, useRef, useState,
} from '../../../../lib/teact/teact';
import { getActions, getGlobal } from '../../../../global';

import type { ApiEmojiGroup, ApiSticker, ApiStickerSet } from '../../../../api/types';

import { selectCustomEmojiForEmojis } from '../../../../global/selectors';
import { selectSharedSettings } from '../../../../global/selectors/sharedState';
import {
  ensureEmojiData, prepareEmojiLibraryMemo, searchEmojiLibraryMemo,
} from '../../../../util/emoji/emojiSearch';
import { buildCollectionByKey, uniqueByField } from '../../../../util/iteratees';
import { throttle } from '../../../../util/schedulers';
import searchWords from '../../../../util/searchWords';
import { callApi } from '../../../../api/gramjs';

import useFlag from '../../../../hooks/useFlag';
import useLastCallback from '../../../../hooks/useLastCallback';

type EmojiQueryResults = {
  key: string;
  intent: string;
  emoticon?: string;
  packSets?: ApiStickerSet[];
  globalStickers?: ApiSticker[];
  globalNextOffset?: number;
};

type GroupResults = {
  groupTitle: string;
  customEmojiIds?: string[];
};

const EMOJI_SEARCH_LIMIT = 40;
const SEARCH_THROTTLE = 500;
const VARIATION_SELECTOR = '\uFE0F';

export default function useEmojiSearch({
  allEmojis,
  baseEmojiKeywords,
  emojiKeywords,
  localStickers,
  isLocalOnly,
  noNativeResults,
  noQueryCustomResults,
}: {
  allEmojis?: Record<string, Emoji>;
  baseEmojiKeywords?: Record<string, string[]>;
  emojiKeywords?: Record<string, string[]>;
  localStickers?: ApiSticker[];
  isLocalOnly?: boolean;
  noNativeResults?: boolean;
  noQueryCustomResults?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [activeGroup, setActiveGroup] = useState<ApiEmojiGroup | undefined>();
  const [isFocused, markFocused, unmarkFocused] = useFlag();
  const [loadedEmojis, setLoadedEmojis] = useState<Record<string, Emoji> | undefined>();
  const [queryResults, setQueryResults] = useState<EmojiQueryResults | undefined>();
  const [groupResults, setGroupResults] = useState<GroupResults | undefined>();

  const searchIntentRef = useRef<string | undefined>();
  const activeGroupTitleRef = useRef<string | undefined>();
  const loadingMoreIntentRef = useRef<string | undefined>();
  const runThrottledSearchRef = useRef<(cb: NoneToVoidFunction) => void>();
  runThrottledSearchRef.current ??= throttle((cb: NoneToVoidFunction) => cb(), SEARCH_THROTTLE, false);

  const effectiveEmojis = allEmojis || loadedEmojis;

  const preparedQuery = query.trim().toLowerCase();
  const hasQuery = Boolean(preparedQuery);
  const isSearchActive = isFocused || hasQuery || Boolean(activeGroup);

  useEffect(() => {
    if (!isSearchActive || effectiveEmojis) {
      return;
    }

    ensureEmojiData()
      .then((data) => setLoadedEmojis(data.emojis))
      .catch(() => undefined);
  }, [isSearchActive, effectiveEmojis]);

  const isGroupLoading = Boolean(activeGroup) && !isLocalOnly
    && groupResults?.groupTitle !== activeGroup.title;
  const displayResultsRef = useRef<{ group: ApiEmojiGroup; customIds?: string[] } | undefined>();
  if (!activeGroup) {
    displayResultsRef.current = undefined;
  } else if (!isGroupLoading) {
    displayResultsRef.current = {
      group: activeGroup,
      customIds: !isLocalOnly ? groupResults?.customEmojiIds : undefined,
    };
  }
  const displayGroup = displayResultsRef.current?.group;

  const isShowingResults = hasQuery || Boolean(displayGroup);

  const emojisByNative = useMemo(() => {
    return effectiveEmojis && buildCollectionByKey(Object.values(effectiveEmojis), 'native');
  }, [effectiveEmojis]);

  const matchedNatives = useMemo(() => {
    if (!effectiveEmojis) {
      return undefined;
    }

    if (preparedQuery) {
      const library = prepareEmojiLibraryMemo(effectiveEmojis, baseEmojiKeywords, emojiKeywords);
      return searchEmojiLibraryMemo(library, preparedQuery, EMOJI_SEARCH_LIMIT);
    }

    if (displayGroup && emojisByNative) {
      return displayGroup.emoticons
        .map((emoticon) => emojisByNative[emoticon] || emojisByNative[emoticon.replace(VARIATION_SELECTOR, '')])
        .filter(Boolean);
    }

    return undefined;
  }, [displayGroup, effectiveEmojis, baseEmojiKeywords, emojiKeywords, emojisByNative, preparedQuery]);

  const emoticon = useMemo(() => (
    hasQuery ? matchedNatives?.map((emoji) => emoji.native).join('') : undefined
  ), [hasQuery, matchedNatives]);

  useEffect(() => {
    if (isLocalOnly) {
      return;
    }

    if (!preparedQuery) {
      searchIntentRef.current = undefined;
      setQueryResults(undefined);
      return;
    }

    const intent = `${preparedQuery}\u0000${emoticon || ''}`;
    searchIntentRef.current = intent;

    runThrottledSearchRef.current!(async () => {
      if (searchIntentRef.current !== intent) {
        return;
      }

      const langCode = selectSharedSettings(getGlobal()).language;
      const [setsResult, globalResult] = await Promise.all([
        callApi('searchEmojiStickerSets', { query: preparedQuery }),
        callApi('searchStickersGlobal', {
          query: preparedQuery, emoticon, langCode, isEmoji: true,
        }),
      ]);

      if (searchIntentRef.current !== intent) {
        return;
      }

      const packSets = setsResult ? [...setsResult.sets] : [];
      const packIdsSet = new Set(packSets.map(({ id }) => id));
      const global = getGlobal();
      global.customEmojis.added.setIds?.forEach((id) => {
        if (packIdsSet.has(id)) {
          return;
        }

        const addedSet = global.stickers.setsById[id];
        if (addedSet?.title && searchWords(addedSet.title, preparedQuery)) {
          packSets.unshift(addedSet);
        }
      });

      setQueryResults({
        key: preparedQuery,
        intent,
        emoticon,
        packSets,
        globalStickers: globalResult?.stickers || [],
        globalNextOffset: globalResult?.nextOffset,
      });
    });
  }, [isLocalOnly, preparedQuery, emoticon]);

  const searchMore = useLastCallback(() => {
    const results = queryResults;
    if (
      isLocalOnly || !results || results.intent !== searchIntentRef.current
      || results.globalNextOffset === undefined || loadingMoreIntentRef.current === results.intent
    ) {
      return;
    }

    loadingMoreIntentRef.current = results.intent;

    void (async () => {
      try {
        const langCode = selectSharedSettings(getGlobal()).language;
        const globalResult = await callApi('searchStickersGlobal', {
          query: results.key,
          emoticon: results.emoticon,
          langCode,
          offset: results.globalNextOffset,
          isEmoji: true,
        });
        if (!globalResult) {
          return;
        }

        setQueryResults((prev) => {
          if (!prev || prev.intent !== results.intent) {
            return prev;
          }

          const currentIds = new Set((prev.globalStickers || []).map(({ id }) => id));

          return {
            ...prev,
            globalStickers: [
              ...(prev.globalStickers || []),
              ...globalResult.stickers.filter(({ id }) => !currentIds.has(id)),
            ],
            globalNextOffset: globalResult.nextOffset,
          };
        });
      } finally {
        if (loadingMoreIntentRef.current === results.intent) {
          loadingMoreIntentRef.current = undefined;
        }
      }
    })();
  });

  const customResults = useMemo(() => {
    const searchedNatives = preparedQuery
      ? matchedNatives?.map((emoji) => emoji.native)
      : displayGroup?.emoticons;
    if (!searchedNatives?.length) {
      return undefined;
    }

    if (isLocalOnly) {
      const nativesSet = new Set(searchedNatives.map((native) => native.replace(VARIATION_SELECTOR, '')));
      return uniqueByField(
        (localStickers || []).filter(
          ({ emoji }) => emoji && nativesSet.has(emoji.replace(VARIATION_SELECTOR, '')),
        ),
        'id',
      );
    }

    if (preparedQuery && noQueryCustomResults) {
      return undefined;
    }

    return uniqueByField(selectCustomEmojiForEmojis(getGlobal(), searchedNatives), 'id');
  }, [displayGroup, isLocalOnly, localStickers, matchedNatives, noQueryCustomResults, preparedQuery]);

  const customResultIds = !hasQuery && !isLocalOnly ? displayResultsRef.current?.customIds : undefined;

  const nativeResults = noNativeResults ? undefined : matchedNatives;

  const selectGroup = useLastCallback((group?: ApiEmojiGroup) => {
    setActiveGroup(group);
    activeGroupTitleRef.current = group?.title;

    if (isLocalOnly || !group) {
      return;
    }

    void (async () => {
      const result = await callApi('searchCustomEmojiByEmoticons', { emoticons: group.emoticons });
      if (activeGroupTitleRef.current !== group.title) {
        return;
      }

      const customEmojiIds = result?.documentIds || [];
      setGroupResults({ groupTitle: group.title, customEmojiIds });

      if (customEmojiIds.length) {
        getActions().loadCustomEmojis({ ids: customEmojiIds });
      }
    })();
  });

  const handleQueryChange = useLastCallback((value: string) => {
    setQuery(value);

    if (value.trim() && activeGroup) {
      selectGroup(undefined);
    }
  });

  return {
    query,
    hasQuery,
    activeGroup,
    displayGroup,
    isSearchActive,
    isShowingResults,
    nativeResults,
    customResults,
    customResultIds,
    queryResults,
    setQuery: handleQueryChange,
    selectGroup,
    searchMore,
    markSearchFocused: markFocused,
    unmarkSearchFocused: unmarkFocused,
  };
}
