import React, {
  FC, memo, useCallback, useEffect,
} from '../../lib/teact/teact';
import { withGlobal } from '../../lib/teact/teactn';

import { GlobalActions, GlobalState } from '../../global/types';
import { ApiChat, ApiUser } from '../../api/types';

import {
  selectChat, selectNotifyExceptions, selectNotifySettings, selectUser,
} from '../../modules/selectors';
import {
  getChatDescription, getChatLink, getHasAdminRight, isChatChannel, isChatPrivate, isUserRightBanned, selectIsChatMuted,
} from '../../modules/helpers';
import renderText from '../common/helpers/renderText';
import { pick } from '../../util/iteratees';
import { copyTextToClipboard } from '../../util/clipboard';
import { formatPhoneNumberWithCode } from '../../util/phoneNumber';
import useLang from '../../hooks/useLang';

import SafeLink from '../common/SafeLink';
import ListItem from '../ui/ListItem';
import Switcher from '../ui/Switcher';

type OwnProps = {
  chatOrUserId: number;
  forceShowSelf?: boolean;
};

type StateProps = {
  user?: ApiUser;
  chat?: ApiChat;
  canInviteUsers?: boolean;
  isMuted?: boolean;
} & Pick<GlobalState, 'lastSyncTime'>;

type DispatchProps = Pick<GlobalActions, 'loadFullUser' | 'updateChatMutedState' | 'showNotification'>;

const ChatExtra: FC<OwnProps & StateProps & DispatchProps> = ({
  lastSyncTime,
  user,
  chat,
  forceShowSelf,
  canInviteUsers,
  isMuted,
  loadFullUser,
  showNotification,
  updateChatMutedState,
}) => {
  const {
    id: userId,
    fullInfo,
    username,
    phoneNumber,
    isSelf,
  } = user || {};
  const {
    id: chatId,
    username: chatUsername,
  } = chat || {};
  const lang = useLang();

  useEffect(() => {
    if (lastSyncTime && userId) {
      loadFullUser({ userId });
    }
  }, [loadFullUser, userId, lastSyncTime]);

  const handleNotificationChange = useCallback(() => {
    updateChatMutedState({ chatId, isMuted: !isMuted });
  }, [chatId, isMuted, updateChatMutedState]);

  if (!chat || chat.isRestricted || (isSelf && !forceShowSelf)) {
    return undefined;
  }

  function copy(text: string, entity: string) {
    copyTextToClipboard(text);
    showNotification({ message: `${entity} was copied` });
  }

  const formattedNumber = phoneNumber && formatPhoneNumberWithCode(phoneNumber);
  const link = getChatLink(chat);
  const url = link.indexOf('http') === 0 ? link : `http://${link}`;
  const printedUsername = username || chatUsername;
  const description = (fullInfo && fullInfo.bio) || getChatDescription(chat);

  return (
    <div className="ChatExtra">
      {formattedNumber && !!formattedNumber.length && (
        <ListItem icon="phone" multiline narrow ripple onClick={() => copy(formattedNumber, lang('Phone'))}>
          <span className="title" dir="auto">{formattedNumber}</span>
          <span className="subtitle">{lang('Phone')}</span>
        </ListItem>
      )}
      {printedUsername && (
        <ListItem
          icon="mention"
          multiline
          narrow
          ripple
          onClick={() => copy(`@${printedUsername}`, lang('Username'))}
        >
          <span className="title" dir="auto">{renderText(printedUsername)}</span>
          <span className="subtitle">{lang('Username')}</span>
        </ListItem>
      )}
      {description && !!description.length && (
        <ListItem
          icon="info"
          multiline
          narrow
          isStatic
        >
          <span className="title" dir="auto">
            {renderText(description, ['br', 'links', 'emoji'])}
          </span>
          <span className="subtitle">{lang(userId ? 'UserBio' : 'Info')}</span>
        </ListItem>
      )}
      {canInviteUsers && !printedUsername && !!link.length && (
        <ListItem icon="mention" multiline narrow ripple onClick={() => copy(link, lang('SetUrlPlaceholder'))}>
          <div className="title">
            <SafeLink url={url} className="title" text={link} />
          </div>
          <span className="subtitle">{lang('SetUrlPlaceholder')}</span>
        </ListItem>
      )}
      <ListItem icon="unmute" ripple onClick={handleNotificationChange}>
        <span>{lang('Notifications')}</span>
        <Switcher
          id="group-notifications"
          label={userId ? 'Toggle User Notifications' : 'Toggle Chat Notifications'}
          checked={!isMuted}
          inactive
        />
      </ListItem>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { chatOrUserId }): StateProps => {
    const { lastSyncTime } = global;

    const chat = chatOrUserId ? selectChat(global, chatOrUserId) : undefined;
    const user = isChatPrivate(chatOrUserId) ? selectUser(global, chatOrUserId) : undefined;
    const isMuted = chat && selectIsChatMuted(chat, selectNotifySettings(global), selectNotifyExceptions(global));

    const canInviteUsers = chat && (
      (!isChatChannel(chat) && !isUserRightBanned(chat, 'inviteUsers'))
      || getHasAdminRight(chat, 'inviteUsers')
    );

    return {
      lastSyncTime, chat, user, canInviteUsers, isMuted,
    };
  },
  (setGlobal, actions): DispatchProps => pick(actions, [
    'loadFullUser', 'updateChatMutedState', 'showNotification',
  ]),
)(ChatExtra));
