import { useState } from '../lib/teact/teact';
import { getGlobal } from '../global';

import type { ApiChat } from '../api/types';

import { isChatBasicGroup, isChatSuperGroup } from '../global/helpers';
import { filterPeersByQuery } from '../global/helpers/peers';
import { selectChatFullInfo } from '../global/selectors';
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
    const trimmedQuery = query.trim();

    // For basic groups, filter from cached members in fullInfo
    if (isChatBasicGroup(chat)) {
      const global = getGlobal();
      const fullInfo = selectChatFullInfo(global, chat.id);
      const memberIds = fullInfo?.members?.map((m) => m.userId) || [];

      if (!trimmedQuery) {
        return memberIds;
      }

      return filterPeersByQuery({ ids: memberIds, query: trimmedQuery, type: 'user' });
    }

    // For supergroups/channels, use API
    const searchResult = await callApi('fetchMembers', {
      chat,
      memberFilter: trimmedQuery ? 'search' : 'recent',
      query: trimmedQuery,
    });

    const memberIds = searchResult?.members?.map((member) => member.userId) || [];

    if (!isChatSuperGroup(chat)) {
      return memberIds;
    }

    if (!trimmedQuery) {
      return [...memberIds, chat.id];
    }

    const chatMatches = filterPeersByQuery({ ids: [chat.id], query: trimmedQuery, type: 'chat' });
    return [...memberIds, ...chatMatches];
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
