import { GroupCallParticipant } from '../../lib/secret-sauce';
import { GlobalState } from '../../global/types';
import { ApiGroupCall } from '../../api/types';
import { selectGroupCall } from '../selectors/calls';
import { omit } from '../../util/iteratees';
import { updateChat } from './chats';
import { selectChat } from '../selectors';

export function updateGroupCall(
  global: GlobalState,
  groupCallId: string,
  groupCallUpdate: Partial<ApiGroupCall>,
  addToParticipantCount?: number,
  resetParticipantCount?: number,
): GlobalState {
  const unfiltered = Object.values({
    ...global.groupCalls.byId[groupCallId]?.participants,
    ...groupCallUpdate.participants,
  });
  const filtered = unfiltered.filter((l) => !l.isLeft);
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

export function removeGroupCall(
  global: GlobalState,
  groupCallId: string,
): GlobalState {
  const groupCall = selectGroupCall(global, groupCallId);
  if (groupCall && groupCall.chatId) {
    const chat = selectChat(global, groupCall.chatId);
    if (chat) {
      global = updateChat(global, groupCall.chatId, {
        fullInfo: {
          ...chat.fullInfo,
          groupCallId: undefined,
        },
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

export function updateActiveGroupCall(
  global: GlobalState,
  groupCallUpdate: Partial<ApiGroupCall>,
  resetParticipantCount?: number,
): GlobalState {
  if (!global.groupCalls.activeGroupCallId) {
    return global;
  }

  return updateGroupCall(global,
    global.groupCalls.activeGroupCallId,
    groupCallUpdate,
    undefined,
    resetParticipantCount);
}

export function updateGroupCallParticipant(
  global: GlobalState,
  groupCallId: string,
  userId: string,
  participantUpdate: Partial<GroupCallParticipant>,
  noUpdateCount = false,
) {
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
