import { useEffect, useRef, useState } from '../../../../lib/teact/teact';
import { getGlobal } from '../../../../global';

import type { ApiSticker, ApiStickerSet } from '../../../../api/types';

import { selectSharedSettings } from '../../../../global/selectors/sharedState';
import { throttle } from '../../../../util/schedulers';
import searchWords from '../../../../util/searchWords';
import { callApi } from '../../../../api/gramjs';

import useLastCallback from '../../../../hooks/useLastCallback';

type StickerSearchResults = {
  key: string;
  intent: string;
  packSets?: ApiStickerSet[];
  globalStickers?: ApiSticker[];
  globalNextOffset?: number;
};

const SEARCH_THROTTLE = 500;

export default function useStickerSearch({
  query,
  noPacks,
  isDisabled,
}: {
  query?: string;
  noPacks?: boolean;
  isDisabled?: boolean;
}) {
  const [results, setResults] = useState<StickerSearchResults | undefined>();

  const searchIntentRef = useRef<string | undefined>();
  const loadingMoreIntentRef = useRef<string | undefined>();
  const runThrottledSearchRef = useRef<(cb: NoneToVoidFunction) => void>();
  runThrottledSearchRef.current ??= throttle((cb: NoneToVoidFunction) => cb(), SEARCH_THROTTLE, false);

  useEffect(() => {
    if (isDisabled) {
      return;
    }

    if (!query) {
      searchIntentRef.current = undefined;
      setResults(undefined);
      return;
    }

    const intent = `${noPacks ? 'noPacks' : 'all'}:${query}`;
    searchIntentRef.current = intent;

    runThrottledSearchRef.current!(async () => {
      if (searchIntentRef.current !== intent) {
        return;
      }

      const langCode = selectSharedSettings(getGlobal()).language;
      const [setsResult, globalResult] = await Promise.all([
        noPacks ? undefined : callApi('searchStickers', { query }),
        noPacks
          ? callApi('fetchStickersForEmoji', { emoji: query.replaceAll(' ', '') })
            .then((result) => result && { stickers: result.stickers, nextOffset: undefined })
          : callApi('searchStickersGlobal', { query, langCode }),
      ]);

      if (searchIntentRef.current !== intent) {
        return;
      }

      let packSets: ApiStickerSet[] | undefined;
      if (setsResult) {
        packSets = [...setsResult.sets];
        const packIdsSet = new Set(packSets.map(({ id }) => id));
        const { setsById, added } = getGlobal().stickers;
        added.setIds?.forEach((id) => {
          if (packIdsSet.has(id)) {
            return;
          }

          const addedSet = setsById[id];
          if (addedSet?.title && searchWords(addedSet.title, query)) {
            packSets!.unshift(addedSet);
          }
        });
      }

      setResults({
        key: query,
        intent,
        packSets,
        globalStickers: globalResult?.stickers || [],
        globalNextOffset: globalResult?.nextOffset,
      });
    });
  }, [query, noPacks, isDisabled]);

  const searchMore = useLastCallback(() => {
    const currentResults = results;
    if (
      isDisabled || !currentResults || currentResults.intent !== searchIntentRef.current
      || currentResults.globalNextOffset === undefined || loadingMoreIntentRef.current === currentResults.intent
    ) {
      return;
    }

    loadingMoreIntentRef.current = currentResults.intent;

    void (async () => {
      try {
        const langCode = selectSharedSettings(getGlobal()).language;
        const globalResult = await callApi('searchStickersGlobal', {
          query: currentResults.key,
          langCode,
          offset: currentResults.globalNextOffset,
        });
        if (!globalResult) {
          return;
        }

        setResults((prev) => {
          if (!prev || prev.intent !== currentResults.intent) {
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
        if (loadingMoreIntentRef.current === currentResults.intent) {
          loadingMoreIntentRef.current = undefined;
        }
      }
    })();
  });

  return { results, searchMore };
}
