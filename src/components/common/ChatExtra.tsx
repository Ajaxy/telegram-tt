import type { FC } from '../../lib/teact/teact';
import React, {
  memo, useCallback, useEffect, useMemo, useState,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { GlobalState } from '../../global/types';
import type {
  ApiChat, ApiCountryCode, ApiUser, ApiUsername,
} from '../../api/types';

import { TME_LINK_PREFIX } from '../../config';
import {
  selectChat, selectNotifyExceptions, selectNotifySettings, selectUser,
} from '../../global/selectors';
import {
  getChatDescription, getChatLink, getHasAdminRight, isChatChannel, isUserId, isUserRightBanned, selectIsChatMuted,
} from '../../global/helpers';
import renderText from './helpers/renderText';
import { copyTextToClipboard } from '../../util/clipboard';
import { formatPhoneNumberWithCode } from '../../util/phoneNumber';
import { debounce } from '../../util/schedulers';
import stopEvent from '../../util/stopEvent';
import useLang from '../../hooks/useLang';

import ListItem from '../ui/ListItem';
import Switcher from '../ui/Switcher';

type OwnProps = {
  chatOrUserId: string;
  forceShowSelf?: boolean;
};

type StateProps =
  {
    user?: ApiUser;
    chat?: ApiChat;
    canInviteUsers?: boolean;
    isMuted?: boolean;
    phoneCodeList: ApiCountryCode[];
  }
  & Pick<GlobalState, 'lastSyncTime'>;

const runDebounced = debounce((cb) => cb(), 500, false);

const ChatExtra: FC<OwnProps & StateProps> = ({
  lastSyncTime,
  user,
  chat,
  forceShowSelf,
  canInviteUsers,
  isMuted,
  phoneCodeList,
}) => {
  const {
    loadFullUser,
    showNotification,
    updateChatMutedState,
  } = getActions();

  const {
    id: userId,
    fullInfo,
    usernames,
    phoneNumber,
    isSelf,
  } = user || {};
  const { id: chatId, usernames: chatUsernames } = chat || {};
  const lang = useLang();

  const [areNotificationsEnabled, setAreNotificationsEnabled] = useState(!isMuted);
  useEffect(() => {
    if (lastSyncTime && userId) {
      loadFullUser({ userId });
    }
  }, [loadFullUser, userId, lastSyncTime]);
  const activeUsernames = useMemo(() => {
    const result = usernames?.filter((u) => u.isActive);

    return result?.length ? result : undefined;
  }, [usernames]);
  const activeChatUsernames = useMemo(() => {
    const result = chatUsernames?.filter((u) => u.isActive);

    return result?.length ? result : undefined;
  }, [chatUsernames]);
  const link = useMemo(() => (chat ? getChatLink(chat) : undefined), [chat]);

  const handleNotificationChange = useCallback(() => {
    setAreNotificationsEnabled((current) => {
      const newAreNotificationsEnabled = !current;

      runDebounced(() => {
        updateChatMutedState({ chatId, isMuted: !newAreNotificationsEnabled });
      });

      return newAreNotificationsEnabled;
    });
  }, [chatId, updateChatMutedState]);

  if (!chat || chat.isRestricted || (isSelf && !forceShowSelf)) {
    return undefined;
  }

  function copy(text: string, entity: string) {
    copyTextToClipboard(text);
    showNotification({ message: `${entity} was copied` });
  }

  const formattedNumber = phoneNumber && formatPhoneNumberWithCode(phoneCodeList, phoneNumber);
  const description = (fullInfo?.bio) || getChatDescription(chat);

  function renderUsernames(usernameList: ApiUsername[], isChat?: boolean) {
    const [mainUsername, ...otherUsernames] = usernameList;
    const usernameLinks = otherUsernames.length
      ? (lang('UsernameAlso', '%USERNAMES%') as string)
        .split('%')
        .map((s) => {
          return (s === 'USERNAMES' ? (
            <>
              {otherUsernames.map(({ username: nick }, idx) => (
                <>
                  {idx > 0 ? ', ' : ''}
                  <a
                    key={nick}
                    href={`${TME_LINK_PREFIX}${nick}`}
                    onClick={(e) => {
                      stopEvent(e);
                      copy(`@${nick}`, lang(isChat ? 'Link' : 'Username'));
                    }}
                    className="username-link"
                  >
                    {`@${nick}`}
                  </a>
                </>
              ))}
            </>
          ) : s);
        })
      : undefined;

    return (
      <ListItem
        icon="mention"
        multiline
        narrow
        ripple
        // eslint-disable-next-line react/jsx-no-bind
        onClick={() => copy(`@${mainUsername.username}`, lang(isChat ? 'Link' : 'Username'))}
      >
        <span className="title" dir="auto">{renderText(mainUsername.username)}</span>
        <span className="subtitle">
          {usernameLinks && <span className="other-usernames">{usernameLinks}</span>}
          {lang(isChat ? 'Link' : 'Username')}
        </span>
      </ListItem>
    );
  }

  return (
    <div className="ChatExtra">
      {formattedNumber && Boolean(formattedNumber.length) && (
        // eslint-disable-next-line react/jsx-no-bind
        <ListItem icon="phone" multiline narrow ripple onClick={() => copy(formattedNumber, lang('Phone'))}>
          <span className="title" dir="auto">{formattedNumber}</span>
          <span className="subtitle">{lang('Phone')}</span>
        </ListItem>
      )}
      {activeUsernames && renderUsernames(activeUsernames)}
      {description && Boolean(description.length) && (
        <ListItem
          icon="info"
          multiline
          narrow
          isStatic
        >
          <span className="title word-break" dir="auto">
            {renderText(description, ['br', 'links', 'emoji'])}
          </span>
          <span className="subtitle">{lang(userId ? 'UserBio' : 'Info')}</span>
        </ListItem>
      )}
      {activeChatUsernames && renderUsernames(activeChatUsernames, true)}
      {!activeChatUsernames && canInviteUsers && link && (
        <ListItem
          icon="link"
          multiline
          narrow
          ripple
          // eslint-disable-next-line react/jsx-no-bind
          onClick={() => copy(link, lang('SetUrlPlaceholder'))}
        >
          <div className="title">{link}</div>
          <span className="subtitle">{lang('SetUrlPlaceholder')}</span>
        </ListItem>
      )}
      {!forceShowSelf && (
        <ListItem icon="unmute" ripple onClick={handleNotificationChange}>
          <span>{lang('Notifications')}</span>
          <Switcher
            id="group-notifications"
            label={userId ? 'Toggle User Notifications' : 'Toggle Chat Notifications'}
            checked={areNotificationsEnabled}
            inactive
          />
        </ListItem>
      )}
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { chatOrUserId }): StateProps => {
    const { lastSyncTime, countryList: { phoneCodes: phoneCodeList } } = global;

    const chat = chatOrUserId ? selectChat(global, chatOrUserId) : undefined;
    const user = isUserId(chatOrUserId) ? selectUser(global, chatOrUserId) : undefined;
    const isMuted = chat && selectIsChatMuted(chat, selectNotifySettings(global), selectNotifyExceptions(global));

    const canInviteUsers = chat && !user && (
      (!isChatChannel(chat) && !isUserRightBanned(chat, 'inviteUsers'))
      || getHasAdminRight(chat, 'inviteUsers')
    );

    return {
      lastSyncTime, phoneCodeList, chat, user, canInviteUsers, isMuted,
    };
  },
)(ChatExtra));
