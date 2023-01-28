import { addActionHandler, getGlobal } from '../../index';
import { removeGroupCall, updateGroupCall, updateGroupCallParticipant } from '../../reducers/calls';
import { omit } from '../../../util/iteratees';
import { selectChat } from '../../selectors';
import { updateChat } from '../../reducers';
import { ARE_CALLS_SUPPORTED } from '../../../util/environment';
import { notifyAboutCall } from '../../../util/notifications';
import { selectPhoneCallUser } from '../../selectors/calls';
import { checkNavigatorUserMediaPermissions, initializeSoundsForSafari } from '../ui/calls';
import { onTickEnd } from '../../../util/schedulers';
import type { ActionReturnType } from '../../types';
import { updateTabState } from '../../reducers/tabs';
import { getCurrentTabId } from '../../../util/establishMultitabRole';

addActionHandler('apiUpdate', (global, actions, update): ActionReturnType => {
  switch (update['@type']) {
    case 'updateGroupCall': {
      if (update.call.connectionState === 'discarded') {
        if (global.groupCalls.activeGroupCallId) {
          actions.leaveGroupCall({ shouldRemove: true, tabId: getCurrentTabId() });
          return undefined;
        } else {
          return removeGroupCall(global, update.call.id);
        }
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
          global = {
            ...global,
            ...(call.needRating && { ratingPhoneCall: call }),
            phoneCall: undefined,
          };

          return updateTabState(global, {
            isCallPanelVisible: undefined,
          }, getCurrentTabId());
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

        void initializeSoundsForSafari();
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
