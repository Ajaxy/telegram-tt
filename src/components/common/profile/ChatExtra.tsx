import type { FC } from '../../../lib/teact/teact';
import React, {
  memo, useEffect, useMemo, useState,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type {
  ApiChat, ApiCountryCode, ApiUser, ApiUserFullInfo, ApiUsername,
} from '../../../api/types';
import { MAIN_THREAD_ID } from '../../../api/types';

import { FRAGMENT_PHONE_CODE, FRAGMENT_PHONE_LENGTH } from '../../../config';
import {
  buildStaticMapHash,
  getChatLink,
  getHasAdminRight,
  isChatChannel,
  isUserRightBanned,
  selectIsChatMuted,
} from '../../../global/helpers';
import {
  selectChat,
  selectChatFullInfo,
  selectCurrentMessageList,
  selectNotifyExceptions,
  selectNotifySettings,
  selectTopicLink,
  selectUser,
  selectUserFullInfo,
} from '../../../global/selectors';
import { copyTextToClipboard } from '../../../util/clipboard';
import { formatPhoneNumberWithCode } from '../../../util/phoneNumber';
import { debounce } from '../../../util/schedulers';
import stopEvent from '../../../util/stopEvent';
import { getShortWalletAddress } from '../../../util/userWallet';
import { ChatAnimationTypes } from '../../left/main/hooks';
import formatUsername from '../helpers/formatUsername';
import renderText from '../helpers/renderText';

import useEffectWithPrevDeps from '../../../hooks/useEffectWithPrevDeps';
import useLastCallback from '../../../hooks/useLastCallback';
import useMedia from '../../../hooks/useMedia';
import useOldLang from '../../../hooks/useOldLang';
import useDevicePixelRatio from '../../../hooks/window/useDevicePixelRatio';

import Chat from '../../left/main/Chat';
import ListItem from '../../ui/ListItem';
import Skeleton from '../../ui/placeholder/Skeleton';
import Switcher from '../../ui/Switcher';
import BusinessHours from './BusinessHours';
import UserBirthday from './UserBirthday';

import styles from './ChatExtra.module.scss';

type OwnProps = {
  chatOrUserId: string;
  isSavedDialog?: boolean;
  isInSettings?: boolean;
};

type StateProps = {
  user?: ApiUser;
  chat?: ApiChat;
  userFullInfo?: ApiUserFullInfo;
  canInviteUsers?: boolean;
  isMuted?: boolean;
  phoneCodeList: ApiCountryCode[];
  topicId?: number;
  description?: string;
  chatInviteLink?: string;
  topicLink?: string;
  hasSavedMessages?: boolean;
  personalChannel?: ApiChat;
  walletAddress: string;
};

const DEFAULT_MAP_CONFIG = {
  width: 64,
  height: 64,
  zoom: 15,
};

const runDebounced = debounce((cb) => cb(), 500, false);

const ChatExtra: FC<OwnProps & StateProps> = ({
  chatOrUserId,
  user,
  chat,
  userFullInfo,
  isInSettings,
  canInviteUsers,
  isMuted,
  phoneCodeList,
  topicId,
  description,
  chatInviteLink,
  topicLink,
  hasSavedMessages,
  personalChannel,
  walletAddress,
}) => {
  const {
    showNotification,
    updateChatMutedState,
    updateTopicMutedState,
    loadPeerStories,
    openSavedDialog,
    openMapModal,
    requestCollectibleInfo,
  } = getActions();

  const {
    id: userId,
    usernames,
    phoneNumber,
    isSelf,
  } = user || {};
  const { id: chatId, usernames: chatUsernames } = chat || {};
  const peerId = userId || chatId;
  const {
    businessLocation,
    businessWorkHours,
    personalChannelMessageId,
    birthday,
  } = userFullInfo || {};
  const lang = useOldLang();

  const [areNotificationsEnabled, setAreNotificationsEnabled] = useState(!isMuted);

  useEffect(() => {
    setAreNotificationsEnabled(!isMuted);
  }, [isMuted]);

  useEffectWithPrevDeps(([prevPeerId]) => {
    if (!peerId || prevPeerId === peerId) return;
    if (user || (chat && isChatChannel(chat))) {
      loadPeerStories({ peerId });
    }
  }, [peerId, chat, user]);

  const { width, height, zoom } = DEFAULT_MAP_CONFIG;
  const dpr = useDevicePixelRatio();
  const locationMediaHash = businessLocation?.geo
    && buildStaticMapHash(businessLocation.geo, width, height, zoom, dpr);
  const locationBlobUrl = useMedia(locationMediaHash);

  const locationRightComponent = useMemo(() => {
    if (!businessLocation?.geo) return undefined;
    if (locationBlobUrl) {
      return <img src={locationBlobUrl} alt="" className={styles.businessLocation} />;
    }

    return <Skeleton className={styles.businessLocation} />;
  }, [businessLocation, locationBlobUrl]);

  const isTopicInfo = Boolean(topicId && topicId !== MAIN_THREAD_ID);
  const shouldRenderAllLinks = (chat && isChatChannel(chat)) || user?.isPremium;

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

  const handleClickLocation = useLastCallback(() => {
    const { address, geo } = businessLocation!;
    if (!geo) {
      copyTextToClipboard(address);
      showNotification({ message: lang('BusinessLocationCopied') });
      return;
    }

    openMapModal({ geoPoint: geo, zoom });
  });

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

  const handleOpenSavedDialog = useLastCallback(() => {
    openSavedDialog({ chatId: chatOrUserId });
  });

  function copy(text: string, entity: string) {
    copyTextToClipboard(text);
    showNotification({ message: `${entity} was copied` });
  }

  const formattedNumber = phoneNumber && formatPhoneNumberWithCode(phoneCodeList, phoneNumber);

  const shortWalletAddress = walletAddress && getShortWalletAddress(walletAddress);

  const handlePhoneClick = useLastCallback(() => {
    if (phoneNumber?.length === FRAGMENT_PHONE_LENGTH && phoneNumber.startsWith(FRAGMENT_PHONE_CODE)) {
      requestCollectibleInfo({ collectible: phoneNumber, peerId: peerId!, type: 'phone' });
      return;
    }
    copy(formattedNumber!, lang('Phone'));
  });

  const handleWalletClick = useLastCallback(() => {
    requestCollectibleInfo({ collectible: walletAddress, peerId: peerId!, type: 'walletAddress' });
    copy(walletAddress!, lang('Wallet'));
  });

  const handleUsernameClick = useLastCallback((username: ApiUsername, isChat?: boolean) => {
    if (!username.isEditable) {
      requestCollectibleInfo({ collectible: username.username, peerId: peerId!, type: 'username' });
      return;
    }
    copy(formatUsername(username.username, isChat), lang(isChat ? 'Link' : 'Username'));
  });

  if (!chat || chat.isRestricted || (isSelf && !isInSettings)) {
    return undefined;
  }

  function renderUsernames(usernameList: ApiUsername[], isChat?: boolean) {
    const [mainUsername, ...otherUsernames] = usernameList;

    const usernameLinks = otherUsernames.length
      ? (lang('UsernameAlso', '%USERNAMES%') as string)
        .split('%')
        .map((s) => {
          return (s === 'USERNAMES' ? (
            <>
              {otherUsernames.map((username, idx) => {
                return (
                  <>
                    {idx > 0 ? ', ' : ''}
                    <a
                      key={username.username}
                      href={formatUsername(username.username, true)}
                      onMouseDown={stopEvent}
                      onClick={(e) => {
                        stopEvent(e);
                        handleUsernameClick(username, isChat);
                      }}
                      className="text-entity-link username-link"
                    >
                      {formatUsername(username.username)}
                    </a>
                  </>
                );
              })}
            </>
          ) : s);
        })
      : undefined;

    return (
      <ListItem
        icon={isChat ? 'link' : 'mention'}
        multiline
        narrow
        ripple
        // eslint-disable-next-line react/jsx-no-bind
        onClick={() => {
          handleUsernameClick(mainUsername, isChat);
        }}
      >
        <span className="title" dir="auto">{formatUsername(mainUsername.username, isChat)}</span>
        <span className="subtitle">
          {usernameLinks && <span className="other-usernames">{usernameLinks}</span>}
          {lang(isChat ? 'Link' : 'Username')}
        </span>
      </ListItem>
    );
  }

  return (
    <div className="ChatExtra">
      {personalChannel && (
        <div className={styles.personalChannel}>
          <h3 className={styles.personalChannelTitle}>{lang('ProfileChannel')}</h3>
          <span className={styles.personalChannelSubscribers}>
            {lang('Subscribers', personalChannel.membersCount, 'i')}
          </span>
          <Chat
            chatId={personalChannel.id}
            orderDiff={0}
            animationType={ChatAnimationTypes.None}
            isPreview
            previewMessageId={personalChannelMessageId}
            className={styles.personalChannelItem}
          />
        </div>
      )}
      {Boolean(formattedNumber?.length) && (
        // eslint-disable-next-line react/jsx-no-bind
        <ListItem icon="phone" multiline narrow ripple onClick={handlePhoneClick}>
          <span className="title" dir="auto">{formattedNumber}</span>
          <span className="subtitle">{lang('Phone')}</span>
        </ListItem>
      )}
      {activeUsernames && renderUsernames(activeUsernames)}
      <ListItem icon="webapp" multiline narrow ripple onClick={handleWalletClick}>
        <span className="title" dir="auto">{shortWalletAddress}</span>
        <span className="subtitle">{lang('Wallet')}</span>
      </ListItem>
      {description && Boolean(description.length) && (
        <ListItem
          icon="info"
          multiline
          narrow
          isStatic
          allowSelection
        >
          <span className="title word-break allow-selection" dir="auto">
            {
              renderText(description, [
                'br',
                shouldRenderAllLinks ? 'links' : 'tg_links',
                'emoji',
              ])
            }
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
      {birthday && (
        <UserBirthday key={peerId} birthday={birthday} user={user!} isInSettings={isInSettings} />
      )}
      {!isInSettings && (
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
      {businessWorkHours && (
        <BusinessHours businessHours={businessWorkHours} />
      )}
      {businessLocation && (
        <ListItem
          icon="location"
          ripple
          multiline
          narrow
          rightElement={locationRightComponent}
          onClick={handleClickLocation}
        >
          <div className="title">{businessLocation.address}</div>
          <span className="subtitle">{lang('BusinessProfileLocation')}</span>
        </ListItem>
      )}
      {hasSavedMessages && !isInSettings && (
        <ListItem icon="saved-messages" ripple onClick={handleOpenSavedDialog}>
          <span>{lang('SavedMessagesTab')}</span>
        </ListItem>
      )}
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { chatOrUserId, isSavedDialog }): StateProps => {
    const { countryList: { phoneCodes: phoneCodeList }, userWallet: { walletAddress } } = global;

    const chat = chatOrUserId ? selectChat(global, chatOrUserId) : undefined;
    const user = chatOrUserId ? selectUser(global, chatOrUserId) : undefined;
    const isForum = chat?.isForum;
    const isMuted = chat && selectIsChatMuted(chat, selectNotifySettings(global), selectNotifyExceptions(global));
    const { threadId } = selectCurrentMessageList(global) || {};
    const topicId = isForum ? Number(threadId) : undefined;

    const chatFullInfo = chat && selectChatFullInfo(global, chat.id);
    const userFullInfo = user && selectUserFullInfo(global, user.id);

    const chatInviteLink = chatFullInfo?.inviteLink;

    const description = userFullInfo?.bio || chatFullInfo?.about;

    const canInviteUsers = chat && !user && (
      (!isChatChannel(chat) && !isUserRightBanned(chat, 'inviteUsers'))
      || getHasAdminRight(chat, 'inviteUsers')
    );

    const topicLink = topicId ? selectTopicLink(global, chatOrUserId, topicId) : undefined;

    const hasSavedMessages = !isSavedDialog && global.chats.listIds.saved?.includes(chatOrUserId);

    const personalChannel = userFullInfo?.personalChannelId
      ? selectChat(global, userFullInfo.personalChannelId)
      : undefined;

    return {
      phoneCodeList,
      chat,
      user,
      userFullInfo,
      canInviteUsers,
      isMuted,
      topicId,
      chatInviteLink,
      description,
      topicLink,
      hasSavedMessages,
      personalChannel,
      walletAddress,
    };
  },
)(ChatExtra));
