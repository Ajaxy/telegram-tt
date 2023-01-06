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
  selectChat, selectCurrentMessageList, selectNotifyExceptions, selectNotifySettings, selectUser,
} from '../../global/selectors';
import {
  getChatDescription,
  getChatLink,
  getTopicLink,
  getHasAdminRight,
  isChatChannel,
  isUserId,
  isUserRightBanned,
  selectIsChatMuted,
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
    isForum?: boolean;
    topicId?: number;
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
  isForum,
  topicId,
}) => {
  const {
    loadFullUser,
    showNotification,
    updateChatMutedState,
    updateTopicMutedState,
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
    const result = !user ? chatUsernames?.filter((u) => u.isActive) : undefined;

    return result?.length ? result : undefined;
  }, [chatUsernames, user]);
  const link = useMemo(() => {
    if (!chat) {
      return undefined;
    }

    return isForum
      ? getTopicLink(chat.id, activeChatUsernames?.[0].username, topicId)
      : getChatLink(chat);
  }, [chat, isForum, activeChatUsernames, topicId]);

  const handleNotificationChange = useCallback(() => {
    setAreNotificationsEnabled((current) => {
      const newAreNotificationsEnabled = !current;

      runDebounced(() => {
        if (topicId) {
          updateTopicMutedState({
            chatId: chatId!,
            topicId,
            isMuted: !newAreNotificationsEnabled,
          });
        } else {
          updateChatMutedState({ chatId, isMuted: !newAreNotificationsEnabled });
        }
      });

      return newAreNotificationsEnabled;
    });
  }, [chatId, topicId, updateChatMutedState, updateTopicMutedState]);

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
                    className="text-entity-link username-link"
                  >
                    {`@${nick}`}
                  </a>
                </>
              ))}
            </>
          ) : s);
        })
      : undefined;

    const publicLink = isForum
      ? getTopicLink('', mainUsername.username, topicId)
      : `@${mainUsername.username}`;

    return (
      <ListItem
        icon="mention"
        multiline
        narrow
        ripple
        // eslint-disable-next-line react/jsx-no-bind
        onClick={() => copy(publicLink, lang(isChat ? 'Link' : 'Username'))}
      >
        <span className="title" dir="auto">{publicLink}</span>
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
    const isForum = chat?.isForum;
    const isMuted = chat && selectIsChatMuted(chat, selectNotifySettings(global), selectNotifyExceptions(global));
    const { threadId } = selectCurrentMessageList(global) || {};
    const topicId = isForum ? threadId : undefined;

    const canInviteUsers = chat && !user && (
      (!isChatChannel(chat) && !isUserRightBanned(chat, 'inviteUsers'))
      || getHasAdminRight(chat, 'inviteUsers')
    );

    return {
      lastSyncTime,
      phoneCodeList,
      chat,
      user,
      canInviteUsers,
      isMuted,
      isForum,
      topicId,
    };
  },
)(ChatExtra));
