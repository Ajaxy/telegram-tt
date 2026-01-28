import type { ElementRef } from '../../../../../lib/teact/teact';
import { useEffect, useState } from '../../../../../lib/teact/teact';
import { getGlobal } from '../../../../../global';

import type { ApiUser } from '../../../../../api/types';

import { getMainUsername, getUserFullName } from '../../../../../global/helpers';
import { filterPeersByQuery } from '../../../../../global/helpers/peers';
import { pickTruthy, unique } from '../../../../../util/iteratees';

import useFlag from '../../../../../hooks/useFlag';
import useLastCallback from '../../../../../hooks/useLastCallback';

// Support Unicode letters, marks, and numbers for international names
let RE_MENTION_SEARCH: RegExp;
try {
  RE_MENTION_SEARCH = /(^|\s)@([-_\p{L}\p{M}\p{N}]*)$/ui;
} catch (e) {
  // Fallback for older browsers
  RE_MENTION_SEARCH = /(^|\s)@([-_\d\wа-яёґєії]*)$/i;
}

export default function useAgentMentionTooltip(
  isEnabled: boolean,
  inputValue: string,
  inputRef: ElementRef<HTMLTextAreaElement>,
  onInsertMention: (beforeMention: string, username: string, afterMention: string) => void,
) {
  const [filteredUsers, setFilteredUsers] = useState<ApiUser[] | undefined>();
  const [isManuallyClosed, markManuallyClosed, unmarkManuallyClosed] = useFlag(false);

  // Extract the @mention query from input value using cursor position
  const getMentionQuery = useLastCallback(() => {
    if (!isEnabled || !inputValue.includes('@')) return undefined;

    const textarea = inputRef.current;
    if (!textarea) return undefined;

    const cursorPosition = textarea.selectionStart;
    const textBeforeCursor = inputValue.substring(0, cursorPosition);

    const match = textBeforeCursor.match(RE_MENTION_SEARCH);
    if (!match) return undefined;

    return {
      query: match[2] || '', // The text after @
      startIndex: textBeforeCursor.lastIndexOf('@'),
    };
  });

  useEffect(() => {
    const mentionData = getMentionQuery();

    if (!mentionData) {
      setFilteredUsers(undefined);
      return;
    }

    const global = getGlobal();
    const usersById = global.users.byId;
    if (!usersById) {
      setFilteredUsers(undefined);
      return;
    }

    // Get user IDs from multiple sources: contacts, top peers, recent chats, and all cached users
    const contactIds = global.contactList?.userIds || [];
    const topPeerIds = global.topPeers?.userIds || [];
    const allUserIds = Object.keys(usersById);

    // Combine all sources, prioritizing contacts and top peers
    const userIds = unique([
      ...contactIds,
      ...topPeerIds,
      ...allUserIds,
    ]);

    const filteredIds = filterPeersByQuery({
      ids: userIds,
      query: mentionData.query,
      type: 'user',
    });

    const users = Object.values(pickTruthy(usersById, filteredIds)).slice(0, 10);
    setFilteredUsers(users.length > 0 ? users : undefined);
  }, [inputValue, getMentionQuery]);

  const insertMention = useLastCallback((user: ApiUser) => {
    const mentionData = getMentionQuery();
    if (!mentionData) return;

    const mainUsername = getMainUsername(user);
    const fullName = getUserFullName(user);

    // Use @username if available, otherwise use the full name
    const mentionText = mainUsername ? `@${mainUsername} ` : `${fullName} `;
    if (!mentionText.trim()) return;

    const { startIndex } = mentionData;
    const beforeMention = inputValue.substring(0, startIndex);

    // Find the end of the current mention query
    const textarea = inputRef.current;
    if (!textarea) return;

    const cursorPosition = textarea.selectionStart;
    const afterMention = inputValue.substring(cursorPosition);

    onInsertMention(beforeMention, mentionText, afterMention);
    setFilteredUsers(undefined);
  });

  // Reset manually closed state when input changes
  useEffect(() => {
    unmarkManuallyClosed();
  }, [inputValue, unmarkManuallyClosed]);

  return {
    isMentionTooltipOpen: Boolean(filteredUsers?.length && !isManuallyClosed),
    closeMentionTooltip: markManuallyClosed,
    insertMention,
    mentionFilteredUsers: filteredUsers,
  };
}
