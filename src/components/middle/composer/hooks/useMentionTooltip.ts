import { useEffect, useState } from '../../../../lib/teact/teact';
import { getGlobal } from '../../../../global';

import type { ApiChatMember, ApiPeer, ApiUser } from '../../../../api/types';
import type { LangFn } from '../../../../util/localization';
import type { RichEditor, RichEditorInsertContent } from '../richEditorTypes';

import { getMainUsername } from '../../../../global/helpers';
import { filterPeersByQuery, getPeerTitle, isApiPeerUser } from '../../../../global/helpers/peers';
import { pickTruthy, unique } from '../../../../util/iteratees';

import useFlag from '../../../../hooks/useFlag';
import useLang from '../../../../hooks/useLang';
import useLastCallback from '../../../../hooks/useLastCallback';

export default function useMentionTooltip(
  isEnabled: boolean,
  richText: string,
  richEditor: RichEditor | undefined,
  groupChatMembers?: ApiChatMember[],
  topInlineBotIds?: string[],
  topGuestBotIds?: string[],
  currentUserId?: string,
) {
  const lang = useLang();
  const [filteredUsers, setFilteredUsers] = useState<ApiUser[] | undefined>();
  const [isManuallyClosed, markManuallyClosed, unmarkManuallyClosed] = useFlag(false);
  const usernameTag = isEnabled ? richEditor?.mentionSuggestion?.text : undefined;
  const isWithInlineBots = isEnabled && richText.startsWith('@');

  useEffect(() => {
    if (!usernameTag || !(groupChatMembers || topInlineBotIds || topGuestBotIds)) {
      setFilteredUsers(undefined);
      return;
    }

    // No need for expensive global updates on users, so we avoid them
    const usersById = getGlobal().users.byId;
    if (!usersById) {
      setFilteredUsers(undefined);
      return;
    }

    const memberIds = groupChatMembers?.reduce((acc: string[], member) => {
      if (member.userId !== currentUserId) {
        acc.push(member.userId);
      }

      return acc;
    }, []);

    const filter = usernameTag.substring(1);
    const userIds = getMentionUserIds(isWithInlineBots, topInlineBotIds, memberIds, topGuestBotIds);
    const filteredIds = filterPeersByQuery({
      ids: unique(userIds),
      query: filter,
      type: 'user',
    });

    setFilteredUsers(Object.values(pickTruthy(usersById, filteredIds)));
  }, [currentUserId, groupChatMembers, topInlineBotIds, topGuestBotIds, usernameTag, isWithInlineBots]);

  const insertMention = useLastCallback((
    peer: ApiPeer,
    forceFocus = false,
    insertAtEnd = false,
  ) => {
    if (!peer.hasUsername && !getPeerTitle(lang, peer)) {
      return;
    }

    const content = buildMentionInsertContent(lang, peer);
    if (!content) {
      return;
    }

    if (!insertAtEnd && richEditor?.mentionSuggestion) {
      if (forceFocus) {
        richEditor.focus();
      }

      richEditor.replaceRange(richEditor.mentionSuggestion.range, content);
      setFilteredUsers(undefined);
      return;
    }

    if (forceFocus) {
      richEditor?.focus();
    }

    richEditor?.insertContent(content);
    setFilteredUsers(undefined);
  });

  useEffect(unmarkManuallyClosed, [unmarkManuallyClosed, richText]);

  return {
    isMentionTooltipOpen: Boolean(filteredUsers?.length && !isManuallyClosed),
    mentionAnchorRect: richEditor?.mentionSuggestion?.clientRect,
    closeMentionTooltip: markManuallyClosed,
    insertMention,
    mentionFilteredUsers: filteredUsers,
  };
}

function getMentionUserIds(
  isWithInlineBots: boolean,
  topInlineBotIds?: string[],
  memberIds?: string[],
  topGuestBotIds?: string[],
) {
  const userIds: string[] = [];

  if (isWithInlineBots && topInlineBotIds) {
    userIds.push(...topInlineBotIds);
  }

  if (memberIds) {
    userIds.push(...memberIds);
  }

  if (topGuestBotIds) {
    userIds.push(...topGuestBotIds);
  }

  return userIds;
}

function buildMentionInsertContent(lang: LangFn, peer: ApiPeer): RichEditorInsertContent[] | undefined {
  const mainUsername = getMainUsername(peer);
  const userFirstOrLastName = (isApiPeerUser(peer) && peer.firstName) || getPeerTitle(lang, peer) || '';
  const text = mainUsername ? `@${mainUsername}` : userFirstOrLastName;

  if (!text) {
    return undefined;
  }

  const mention: RichEditorInsertContent = {
    type: 'mention',
    userId: peer.id,
    username: mainUsername,
    text,
  };

  return [mention, { type: 'text', text: ' ' }];
}
