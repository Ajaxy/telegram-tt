import { useCallback, useMemo } from '../../../../lib/teact/teact';

import type { ApiChat, ApiCommunityLinkedPeer, ApiMessage } from '../../../../api/types';
import type { GlobalState } from '../../../../global/types';

import { getCommunityPeerDate, getIsCommunityPeerJoined } from '../../../../global/helpers';
import { selectChat, selectChatLastMessage, selectIsChatUnread } from '../../../../global/selectors';

import { useShallowSelector } from '../../../../hooks/data/useSelector';

export type CommunityMember = {
  id: string;
  title: string;
  peer: ApiChat;
  isUnread?: boolean;
};

// The previewed chat comes first in the subtitle; the badge counts all unread joined chats
export default function useCommunityMembers(linkedPeers?: ApiCommunityLinkedPeer[]) {
  const peersSelector = useCallback((global: GlobalState) => (
    linkedPeers?.map(({ peerId }) => selectChat(global, peerId))
  ), [linkedPeers]);
  const peers = useShallowSelector(peersSelector);

  const lastMessagesSelector = useCallback((global: GlobalState) => (
    linkedPeers?.map(({ peerId }) => selectChatLastMessage(global, peerId))
  ), [linkedPeers]);
  const lastMessages = useShallowSelector(lastMessagesSelector);

  const unreadFlagsSelector = useCallback((global: GlobalState) => (
    linkedPeers?.map(({ peerId }) => selectIsChatUnread(global, peerId))
  ), [linkedPeers]);
  const unreadFlags = useShallowSelector(unreadFlagsSelector);

  return useMemo(() => {
    if (!linkedPeers) return undefined;

    let latestMessage: ApiMessage | undefined;
    const datedMembers: (CommunityMember & { date: number })[] = [];
    linkedPeers.forEach(({ peerId }, i) => {
      const peer = peers?.[i];
      const lastMessage = lastMessages?.[i];
      if (!peer || !getIsCommunityPeerJoined(peer, lastMessage)) return;

      if (lastMessage && (!latestMessage || lastMessage.date > latestMessage.date)) {
        latestMessage = lastMessage;
      }

      datedMembers.push({
        id: peerId,
        title: peer.title,
        peer,
        isUnread: unreadFlags?.[i],
        date: getCommunityPeerDate(peer, lastMessage),
      });
    });

    const lastMessageChatId = latestMessage?.chatId;
    const members: CommunityMember[] = datedMembers.sort((firstMember, secondMember) => (
      Number(secondMember.id === lastMessageChatId) - Number(firstMember.id === lastMessageChatId)
      || secondMember.date - firstMember.date
    ))
      .map(({ id, title, peer, isUnread }) => ({ id, title, peer, isUnread }));

    return {
      members,
      // Fall back to the freshest joined chat when none has a loaded message
      lastMessageChatId: lastMessageChatId ?? members[0]?.id,
      unreadCount: members.filter(({ isUnread }) => isUnread).length,
    };
  }, [linkedPeers, peers, lastMessages, unreadFlags]);
}
