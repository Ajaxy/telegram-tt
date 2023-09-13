import type { ApiGroupCall } from '../../api/types';
import type { GroupCallParticipant } from '../../lib/secret-sauce';
import type { GlobalState } from '../types';

import { omit } from '../../util/iteratees';
import { selectChat } from '../selectors';
import { selectGroupCall } from '../selectors/calls';
import { updateChatFullInfo } from './chats';

export function updateGroupCall<T extends GlobalState>(
  global: T,
  groupCallId: string,
  groupCallUpdate: Partial<ApiGroupCall>,
  addToParticipantCount?: number,
  resetParticipantCount?: number,
): T {
  const unfiltered = Object.values({
    ...global.groupCalls.byId[groupCallId]?.participants,
    ...groupCallUpdate.participants,
  });
  const filtered = unfiltered.filter(({ isLeft }) => !isLeft);
  const participants = filtered.reduce((acc: Record<string, GroupCallParticipant>, el) => {
    acc[el.id] = el;
    return acc;
  }, {});

  return {
    ...global,
    groupCalls: {
      ...global.groupCalls,
      byId: {
        ...global.groupCalls.byId,
        [groupCallId]: {
          ...global.groupCalls.byId[groupCallId],
          ...omit(groupCallUpdate, ['participantsCount']),
          ...(addToParticipantCount && {
            participantsCount: global.groupCalls.byId[groupCallId].participantsCount + addToParticipantCount,
          }),
          ...(resetParticipantCount !== undefined && {
            participantsCount: resetParticipantCount,
          }),
          participants,
        },
      },
    },
  };
}

export function removeGroupCall<T extends GlobalState>(
  global: T,
  groupCallId: string,
): T {
  const groupCall = selectGroupCall(global, groupCallId);
  if (groupCall && groupCall.chatId) {
    const chat = selectChat(global, groupCall.chatId);
    if (chat) {
      global = updateChatFullInfo(global, groupCall.chatId, {
        groupCallId: undefined,
      });
    }
  }

  return {
    ...global,
    groupCalls: {
      ...global.groupCalls,
      byId: {
        ...omit(global.groupCalls.byId, [groupCallId.toString()]),
      },
    },
  };
}

export function updateActiveGroupCall<T extends GlobalState>(
  global: T,
  groupCallUpdate: Partial<ApiGroupCall>,
  resetParticipantCount?: number,
): T {
  if (!global.groupCalls.activeGroupCallId) {
    return global;
  }

  return updateGroupCall(global,
    global.groupCalls.activeGroupCallId,
    groupCallUpdate,
    undefined,
    resetParticipantCount);
}

export function updateGroupCallParticipant<T extends GlobalState>(
  global: T,
  groupCallId: string,
  userId: string,
  participantUpdate: Partial<GroupCallParticipant>,
  noUpdateCount = false,
): T {
  const groupCall = selectGroupCall(global, groupCallId);
  if (!groupCall) {
    return global;
  }

  return updateGroupCall(global, groupCallId, {
    participants: {
      ...groupCall.participants,
      [userId]: {
        ...groupCall.participants[userId],
        ...participantUpdate,
      },
    },
  }, participantUpdate.isLeft
    ? (noUpdateCount ? 0 : -1)
    : (groupCall.participants[userId] || noUpdateCount ? 0 : 1));
}
