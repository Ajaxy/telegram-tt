import { useEffect, useRef, useState } from '../../../../lib/teact/teact';
import { getGlobal } from '../../../../global';

import type { ApiVideo } from '../../../../api/types';

import { throttle } from '../../../../util/schedulers';
import { callApi } from '../../../../api/gramjs';

import useLastCallback from '../../../../hooks/useLastCallback';

type GifSearchResults = {
  key: string;
  gifs: ApiVideo[];
  nextOffset?: string;
};

const SEARCH_THROTTLE = 500;

export default function useGifSearch({ query }: { query?: string }) {
  const [results, setResults] = useState<GifSearchResults | undefined>();

  const searchIntentRef = useRef<string | undefined>();
  const loadingMoreKeyRef = useRef<string | undefined>();
  const runThrottledSearchRef = useRef<(cb: NoneToVoidFunction) => void>();
  runThrottledSearchRef.current ??= throttle((cb: NoneToVoidFunction) => cb(), SEARCH_THROTTLE, false);

  useEffect(() => {
    if (!query) {
      searchIntentRef.current = undefined;
      setResults(undefined);
      return;
    }

    searchIntentRef.current = query;

    runThrottledSearchRef.current!(async () => {
      if (searchIntentRef.current !== query) {
        return;
      }

      const result = await callApi('searchGifs', {
        query,
        username: getGlobal().config?.gifSearchUsername,
      });

      if (!result || searchIntentRef.current !== query) {
        return;
      }

      setResults({
        key: query,
        gifs: result.gifs,
        nextOffset: result.nextOffset,
      });
    });
  }, [query]);

  const searchMore = useLastCallback(() => {
    const currentResults = results;
    if (
      !currentResults || currentResults.key !== searchIntentRef.current
      || !currentResults.nextOffset || loadingMoreKeyRef.current === currentResults.key
    ) {
      return;
    }

    loadingMoreKeyRef.current = currentResults.key;

    void (async () => {
      try {
        const result = await callApi('searchGifs', {
          query: currentResults.key,
          offset: currentResults.nextOffset,
          username: getGlobal().config?.gifSearchUsername,
        });
        if (!result) {
          return;
        }

        setResults((prev) => {
          if (!prev || prev.key !== currentResults.key) {
            return prev;
          }

          const currentIds = new Set(prev.gifs.map(({ id }) => id));

          return {
            ...prev,
            gifs: [...prev.gifs, ...result.gifs.filter(({ id }) => !currentIds.has(id))],
            nextOffset: result.nextOffset,
          };
        });
      } finally {
        if (loadingMoreKeyRef.current === currentResults.key) {
          loadingMoreKeyRef.current = undefined;
        }
      }
    })();
  });

  return { results, searchMore };
}
