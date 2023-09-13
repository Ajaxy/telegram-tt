import type { ActionReturnType } from '../../types';

import { getCurrentTabId } from '../../../util/establishMultitabRole';
import { omit } from '../../../util/iteratees';
import { notifyAboutCall } from '../../../util/notifications';
import { onTickEnd } from '../../../util/schedulers';
import { ARE_CALLS_SUPPORTED } from '../../../util/windowEnvironment';
import { addActionHandler, getGlobal } from '../../index';
import { updateChat, updateChatFullInfo } from '../../reducers';
import { removeGroupCall, updateGroupCall, updateGroupCallParticipant } from '../../reducers/calls';
import { updateTabState } from '../../reducers/tabs';
import { selectChat } from '../../selectors';
import { selectGroupCall, selectPhoneCallUser } from '../../selectors/calls';
import { checkNavigatorUserMediaPermissions, initializeSounds } from '../ui/calls';

addActionHandler('apiUpdate', (global, actions, update): ActionReturnType => {
  switch (update['@type']) {
    case 'updateGroupCall': {
      if (update.call.connectionState === 'discarded') {
        if (global.groupCalls.activeGroupCallId) {
          if ('leaveGroupCall' in actions) actions.leaveGroupCall({ shouldRemove: true, tabId: getCurrentTabId() });
          return undefined;
        } else {
          return removeGroupCall(global, update.call.id);
        }
      }

      const groupCall = selectGroupCall(global, update.call.id);
      const chatId = groupCall?.chatId;
      if (chatId) {
        global = updateChat(global, chatId, {
          isCallNotEmpty: (groupCall.participantsCount > 0 || Boolean(groupCall.participants?.length)),
        });
      }

      return updateGroupCall(
        global,
        update.call.id,
        omit(update.call, ['connectionState']),
        undefined,
        update.call.participantsCount,
      );
    }
    case 'updateGroupCallChatId': {
      const chat = selectChat(global, update.chatId);
      if (chat) {
        global = updateChatFullInfo(global, update.chatId, {
          groupCallId: update.call.id,
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

      const groupCall = selectGroupCall(global, groupCallId);
      const chatId = groupCall?.chatId;
      if (chatId) {
        global = updateChat(global, chatId, {
          isCallNotEmpty: (groupCall.participantsCount > 0 || Boolean(groupCall.participants?.length)),
        });
      }
      return global;
    }
    case 'updatePhoneCall': {
      if (!ARE_CALLS_SUPPORTED) return undefined;

      const {
        phoneCall,
        currentUserId,
      } = global;

      const { call } = update;

      if (phoneCall) {
        if (call.state === 'discarded') {
          actions.playGroupCallSound({ sound: 'end' });
          if ('hangUp' in actions) actions.hangUp({ tabId: getCurrentTabId() });

          return {
            ...global,
            ...(call.needRating && { ratingPhoneCall: call }),
          };
        }

        return undefined;
      }

      const isOutgoing = call?.adminId === currentUserId;

      if (!isOutgoing && call.state === 'requested') {
        onTickEnd(() => {
          global = getGlobal();
          notifyAboutCall({
            call,
            user: selectPhoneCallUser(global)!,
          });
        });

        initializeSounds();
        void checkNavigatorUserMediaPermissions(global, actions, call.isVideo, getCurrentTabId());
        global = {
          ...global,
          phoneCall: call,
        };

        return updateTabState(global, {
          isCallPanelVisible: false,
        }, getCurrentTabId());
      }
    }
  }

  return undefined;
});
