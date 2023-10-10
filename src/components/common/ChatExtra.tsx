import type { FC } from '../../lib/teact/teact';
import React, {
  memo, useEffect, useMemo, useState,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type {
  ApiChat, ApiCountryCode, ApiUser, ApiUsername,
} from '../../api/types';
import { MAIN_THREAD_ID } from '../../api/types';

import { TME_LINK_PREFIX } from '../../config';
import {
  getChatLink,
  getHasAdminRight,
  isChatChannel,
  isUserId,
  isUserRightBanned,
  selectIsChatMuted,
} from '../../global/helpers';
import {
  selectChat,
  selectChatFullInfo,
  selectCurrentMessageList,
  selectNotifyExceptions,
  selectNotifySettings,
  selectTopicLink,
  selectUser,
  selectUserFullInfo,
} from '../../global/selectors';
import { copyTextToClipboard } from '../../util/clipboard';
import { formatPhoneNumberWithCode } from '../../util/phoneNumber';
import { debounce } from '../../util/schedulers';
import stopEvent from '../../util/stopEvent';
import renderText from './helpers/renderText';

import useEffectWithPrevDeps from '../../hooks/useEffectWithPrevDeps';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';

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
    topicId?: number;
    description?: string;
    chatInviteLink?: string;
    topicLink?: string;
  };

const runDebounced = debounce((cb) => cb(), 500, false);

const ChatExtra: FC<OwnProps & StateProps> = ({
  user,
  chat,
  forceShowSelf,
  canInviteUsers,
  isMuted,
  phoneCodeList,
  topicId,
  description,
  chatInviteLink,
  topicLink,
}) => {
  const {
    loadFullUser,
    showNotification,
    updateChatMutedState,
    updateTopicMutedState,
    loadPeerStories,
  } = getActions();

  const {
    id: userId,
    usernames,
    phoneNumber,
    isSelf,
  } = user || {};
  const { id: chatId, usernames: chatUsernames } = chat || {};
  const peerId = userId || chatId;
  const lang = useLang();

  const [areNotificationsEnabled, setAreNotificationsEnabled] = useState(!isMuted);

  useEffect(() => {
    setAreNotificationsEnabled(!isMuted);
  }, [isMuted]);

  useEffect(() => {
    if (!userId) return;
    loadFullUser({ userId });
  }, [userId]);

  useEffectWithPrevDeps(([prevPeerId]) => {
    if (!peerId || prevPeerId === peerId) return;
    if (user || (chat && isChatChannel(chat))) {
      loadPeerStories({ peerId });
    }
  }, [peerId, chat, user]);

  const isTopicInfo = Boolean(topicId && topicId !== MAIN_THREAD_ID);

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

    return isTopicInfo ? topicLink! : getChatLink(chat) || chatInviteLink;
  }, [chat, isTopicInfo, topicLink, chatInviteLink]);

  const handleNotificationChange = useLastCallback(() => {
    setAreNotificationsEnabled((current) => {
      const newAreNotificationsEnabled = !current;

      runDebounced(() => {
        if (isTopicInfo) {
          updateTopicMutedState({
            chatId: chatId!,
            topicId: topicId!,
            isMuted: !newAreNotificationsEnabled,
          });
        } else {
          updateChatMutedState({ chatId: chatId!, isMuted: !newAreNotificationsEnabled });
        }
      });

      return newAreNotificationsEnabled;
    });
  });

  if (!chat || chat.isRestricted || (isSelf && !forceShowSelf)) {
    return undefined;
  }

  function copy(text: string, entity: string) {
    copyTextToClipboard(text);
    showNotification({ message: `${entity} was copied` });
  }

  const formattedNumber = phoneNumber && formatPhoneNumberWithCode(phoneCodeList, phoneNumber);

  function renderUsernames(usernameList: ApiUsername[], isChat?: boolean) {
    const [mainUsername, ...otherUsernames] = usernameList;

    const usernameLinks = otherUsernames.length
      ? (lang('UsernameAlso', '%USERNAMES%') as string)
        .split('%')
        .map((s) => {
          return (s === 'USERNAMES' ? (
            <>
              {otherUsernames.map(({ username: nick }, idx) => {
                const textToCopy = isChat ? `${TME_LINK_PREFIX}${nick}` : `@${nick}`;
                return (
                  <>
                    {idx > 0 ? ', ' : ''}
                    <a
                      key={nick}
                      href={`${TME_LINK_PREFIX}${nick}`}
                      onClick={(e) => {
                        stopEvent(e);
                        copy(textToCopy, lang(isChat ? 'Link' : 'Username'));
                      }}
                      className="text-entity-link username-link"
                    >
                      {`@${nick}`}
                    </a>
                  </>
                );
              })}
            </>
          ) : s);
        })
      : undefined;

    const username = isChat ? `t.me/${mainUsername.username}` : mainUsername.username;
    const textToCopy = isChat ? `${TME_LINK_PREFIX}${mainUsername.username}` : `@${mainUsername.username}`;

    return (
      <ListItem
        icon={isChat ? 'link' : 'mention'}
        multiline
        narrow
        ripple
        // eslint-disable-next-line react/jsx-no-bind
        onClick={() => copy(textToCopy, lang(isChat ? 'Link' : 'Username'))}
      >
        <span className="title" dir="auto">{username}</span>
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
          <span className="title word-break allow-selection" dir="auto">
            {renderText(description, ['br', 'links', 'emoji'])}
          </span>
          <span className="subtitle">{lang(userId ? 'UserBio' : 'Info')}</span>
        </ListItem>
      )}
      {activeChatUsernames && !isTopicInfo && renderUsernames(activeChatUsernames, true)}
      {((!activeChatUsernames && canInviteUsers) || isTopicInfo) && link && (
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
    const { countryList: { phoneCodes: phoneCodeList } } = global;

    const chat = chatOrUserId ? selectChat(global, chatOrUserId) : undefined;
    const user = isUserId(chatOrUserId) ? selectUser(global, chatOrUserId) : undefined;
    const isForum = chat?.isForum;
    const isMuted = chat && selectIsChatMuted(chat, selectNotifySettings(global), selectNotifyExceptions(global));
    const { threadId } = selectCurrentMessageList(global) || {};
    const topicId = isForum ? threadId : undefined;
    const chatInviteLink = chat ? selectChatFullInfo(global, chat.id)?.inviteLink : undefined;
    let description = user ? selectUserFullInfo(global, user.id)?.bio : undefined;
    if (!description && chat) {
      description = selectChatFullInfo(global, chat.id)?.about;
    }

    const canInviteUsers = chat && !user && (
      (!isChatChannel(chat) && !isUserRightBanned(chat, 'inviteUsers'))
      || getHasAdminRight(chat, 'inviteUsers')
    );

    const topicLink = topicId ? selectTopicLink(global, chatOrUserId, topicId) : undefined;

    return {
      phoneCodeList,
      chat,
      user,
      canInviteUsers,
      isMuted,
      topicId,
      chatInviteLink,
      description,
      topicLink,
    };
  },
)(ChatExtra));
