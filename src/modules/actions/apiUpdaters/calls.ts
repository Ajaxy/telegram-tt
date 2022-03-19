import { addActionHandler, getGlobal } from '../..';
import { removeGroupCall, updateGroupCall, updateGroupCallParticipant } from '../../reducers/calls';
import { omit } from '../../../util/iteratees';
import { selectChat } from '../../selectors';
import { updateChat } from '../../reducers';

addActionHandler('apiUpdate', (global, actions, update) => {
  switch (update['@type']) {
    case 'updateGroupCall': {
      if (update.call.connectionState === 'discarded') {
        if (global.groupCalls.activeGroupCallId) {
          actions.leaveGroupCall({ shouldRemove: true });
          return undefined;
        } else {
          return removeGroupCall(global, update.call.id);
        }
      }

      return updateGroupCall(global,
        update.call.id,
        omit(update.call, ['connectionState']),
        undefined,
        update.call.participantsCount);
    }
    case 'updateGroupCallChatId': {
      const chat = selectChat(global, update.chatId);
      if (chat) {
        global = updateChat(global, update.chatId, {
          fullInfo: {
            ...chat.fullInfo,
            groupCallId: update.call.id,
          },
        });
      }
      return global;
    }
    case 'updateGroupCallParticipants': {
      const { groupCallId, participants, nextOffset } = update;
      const { currentUserId } = global;

      // `secret-sauce` should disconnect if the participant is us but from another device
      global = getGlobal();
      participants.forEach((participant) => {
        if (participant.id) {
          global = updateGroupCallParticipant(
            global, groupCallId, participant.id, participant, Boolean(nextOffset) || currentUserId === participant.id,
          );
        }
      });
      if (nextOffset) {
        global = updateGroupCall(global, groupCallId, {
          nextOffset,
        });
      }
      return global;
    }
  }

  return undefined;
});
