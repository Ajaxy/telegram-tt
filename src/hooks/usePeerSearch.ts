import { useState } from '../lib/teact/teact';

import type { ApiChat } from '../api/types';

import { callApi } from '../api/gramjs';
import useAsync from './useAsync';
import useDebouncedMemo from './useDebouncedMemo';
import useLastCallback from './useLastCallback';

const DEBOUNCE_TIMEOUT = 300;

export async function peerGlobalSearch(query: string) {
  const searchResult = await callApi('searchChats', { query });
  if (!searchResult) return undefined;

  const ids = [...searchResult.accountResultIds, ...searchResult.globalResultIds];

  return ids;
}

export function prepareChatMemberSearch(chat: ApiChat) {
  return async (query: string) => {
    const searchResult = await callApi('fetchMembers', {
      chat,
      memberFilter: 'search',
      query,
    });

    return searchResult?.members?.map((member) => member.userId) || [];
  };
}

export default function usePeerSearch({
  query,
  queryFn = peerGlobalSearch,
  defaultValue,
  debounceTimeout = DEBOUNCE_TIMEOUT,
  isDisabled,
}: {
  query: string;
  queryFn?: (query: string) => Promise<string[] | undefined>;
  defaultValue?: string[];
  debounceTimeout?: number;
  isDisabled?: boolean;
}) {
  const debouncedQuery = useDebouncedMemo(() => query, debounceTimeout, [query]);
  const [currentResultsQuery, setCurrentResultsQuery] = useState<string>('');
  const searchQuery = !query ? query : debouncedQuery; // Ignore debounce if query is empty
  const queryCallback = useLastCallback(queryFn);

  const result = useAsync(async () => {
    if (!searchQuery || isDisabled) {
      setCurrentResultsQuery('');
      return Promise.resolve(defaultValue);
    }

    const answer = await queryCallback(searchQuery);
    setCurrentResultsQuery(searchQuery);
    return answer;
  }, [searchQuery, defaultValue, queryCallback, isDisabled], defaultValue);

  return {
    ...result,
    currentResultsQuery,
  };
}
