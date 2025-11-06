import {
  memo, useMemo, useRef,
} from '../../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../../global';

import type {
  ApiBotVerification,
  ApiChat,
  ApiCountryCode,
  ApiUser,
  ApiUserFullInfo,
  ApiUsername,
} from '../../../api/types';
import { MAIN_THREAD_ID } from '../../../api/types';
import { type BotAppPermissions, ManagementScreens } from '../../../types';

import {
  FRAGMENT_PHONE_CODE, FRAGMENT_PHONE_LENGTH, MUTE_INDEFINITE_TIMESTAMP, UNMUTE_TIMESTAMP,
} from '../../../config';
import {
  buildStaticMapHash,
  getChatLink,
  getHasAdminRight,
  isChatAdmin,
  isChatChannel,
  isUserRightBanned,
} from '../../../global/helpers';
import { getIsChatMuted } from '../../../global/helpers/notifications';
import {
  selectBotAppPermissions,
  selectChat,
  selectChatFullInfo,
  selectCurrentMessageList,
  selectIsChatRestricted,
  selectNotifyDefaults,
  selectNotifyException,
  selectTopicLink,
  selectUser,
  selectUserFullInfo,
} from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import { copyTextToClipboard } from '../../../util/clipboard';
import { formatPhoneNumberWithCode } from '../../../util/phoneNumber';
import stopEvent from '../../../util/stopEvent';
import { extractCurrentThemeParams } from '../../../util/themeStyle';
import { ChatAnimationTypes } from '../../left/main/hooks';
import formatUsername from '../helpers/formatUsername';
import renderText from '../helpers/renderText';
import { renderTextWithEntities } from '../helpers/renderTextWithEntities';

import useCollapsibleLines from '../../../hooks/element/useCollapsibleLines';
import useEffectWithPrevDeps from '../../../hooks/useEffectWithPrevDeps';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import useMedia from '../../../hooks/useMedia';
import useOldLang from '../../../hooks/useOldLang';
import useDevicePixelRatio from '../../../hooks/window/useDevicePixelRatio';

import Chat from '../../left/main/Chat';
import Button from '../../ui/Button';
import ListItem from '../../ui/ListItem';
import Skeleton from '../../ui/placeholder/Skeleton';
import Switcher from '../../ui/Switcher';
import CustomEmoji from '../CustomEmoji';
import Icon from '../icons/Icon';
import SafeLink from '../SafeLink';
import BusinessHours from './BusinessHours';
import UserBirthday from './UserBirthday';

import styles from './ChatExtra.module.scss';

type OwnProps = {
  chatOrUserId: string;
  isOwnProfile?: boolean;
  isSavedDialog?: boolean;
  isInSettings?: boolean;
  className?: string;
  style?: string;
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
  hasMainMiniApp?: boolean;
  isBotCanManageEmojiStatus?: boolean;
  botAppPermissions?: BotAppPermissions;
  botVerification?: ApiBotVerification;
  canViewSubscribers?: boolean;
};

const DEFAULT_MAP_CONFIG = {
  width: 64,
  height: 64,
  zoom: 15,
};

const BOT_VERIFICATION_ICON_SIZE = 16;
const MAX_LINES = 3;

const ChatExtra = ({
  chatOrUserId,
  user,
  chat,
  userFullInfo,
  isOwnProfile,
  canInviteUsers,
  isMuted,
  phoneCodeList,
  topicId,
  description,
  chatInviteLink,
  topicLink,
  hasSavedMessages,
  personalChannel,
  hasMainMiniApp,
  isBotCanManageEmojiStatus,
  botAppPermissions,
  botVerification,
  className,
  style,
  isInSettings,
  canViewSubscribers,
}: OwnProps & StateProps) => {
  const {
    showNotification,
    updateChatMutedState,
    updateTopicMutedState,
    loadPeerStories,
    openSavedDialog,
    openMapModal,
    requestCollectibleInfo,
    requestMainWebView,
    toggleUserEmojiStatusPermission,
    toggleUserLocationPermission,
    requestNextManagementScreen,
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
    note,
  } = userFullInfo || {};
  const oldLang = useOldLang();
  const lang = useLang();

  const noteTextRef = useRef<HTMLDivElement>();

  const shouldRenderNote = Boolean(note);

  const {
    isCollapsed: isNoteCollapsed,
    isCollapsible: isNoteCollapsible,
    setIsCollapsed: setIsNoteCollapsed,
  } = useCollapsibleLines(
    noteTextRef,
    MAX_LINES,
    undefined,
    !shouldRenderNote,
  );

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
      showNotification({ message: oldLang('BusinessLocationCopied') });
      return;
    }

    openMapModal({ geoPoint: geo, zoom });
  });

  const handleToggleNotifications = useLastCallback(() => {
    const mutedUntil = isMuted ? UNMUTE_TIMESTAMP : MUTE_INDEFINITE_TIMESTAMP;
    if (isTopicInfo) {
      updateTopicMutedState({
        chatId: chatId!,
        topicId: topicId!,
        mutedUntil,
      });
    } else {
      updateChatMutedState({ chatId: chatId!, mutedUntil });
    }
  });

  const manageEmojiStatusChange = useLastCallback(() => {
    if (!user) return;
    toggleUserEmojiStatusPermission({ botId: user.id, isEnabled: !isBotCanManageEmojiStatus });
  });

  const handleLocationPermissionChange = useLastCallback(() => {
    if (!user) return;
    toggleUserLocationPermission({ botId: user.id, isAccessGranted: !botAppPermissions?.geolocation });
  });

  const handleOpenSavedDialog = useLastCallback(() => {
    openSavedDialog({ chatId: chatOrUserId });
  });

  const canExpandNote = isNoteCollapsible && isNoteCollapsed;

  const handleExpandNote = useLastCallback(() => {
    setIsNoteCollapsed(false);
  });

  const handleToggleNote = useLastCallback(() => {
    setIsNoteCollapsed((prev) => !prev);
  });

  function copy(text: string, entity: string) {
    copyTextToClipboard(text);
    showNotification({ message: `${entity} was copied` });
  }

  const formattedNumber = phoneNumber && formatPhoneNumberWithCode(phoneCodeList, phoneNumber);

  const handlePhoneClick = useLastCallback(() => {
    if (phoneNumber?.length === FRAGMENT_PHONE_LENGTH && phoneNumber.startsWith(FRAGMENT_PHONE_CODE)) {
      requestCollectibleInfo({ collectible: phoneNumber, peerId: peerId!, type: 'phone' });
      return;
    }
    copy(formattedNumber!, oldLang('Phone'));
  });

  const handleUsernameClick = useLastCallback((username: ApiUsername, isChat?: boolean) => {
    if (!username.isEditable) {
      requestCollectibleInfo({ collectible: username.username, peerId: peerId!, type: 'username' });
      return;
    }
    copy(formatUsername(username.username, isChat), oldLang(isChat ? 'Link' : 'Username'));
  });

  const handleOpenSubscribers = useLastCallback(() => {
    requestNextManagementScreen({ screen: ManagementScreens.ChannelSubscribers });
  });

  const handleOpenApp = useLastCallback(() => {
    const botId = user?.id;
    if (!botId) {
      return;
    }
    const theme = extractCurrentThemeParams();
    requestMainWebView({
      botId,
      peerId: botId,
      theme,
      shouldMarkBotTrusted: true,
    });
  });

  const appTermsInfo = lang('ProfileOpenAppAbout', {
    terms: (
      <SafeLink
        text={lang('ProfileOpenAppTerms')}
        url={lang('ProfileBotOpenAppInfoLink')}
      />
    ),
  }, { withNodes: true });

  const isRestricted = chatId ? selectIsChatRestricted(getGlobal(), chatId) : false;
  if (isRestricted || (isSelf && !isOwnProfile && !isInSettings)) {
    return undefined;
  }

  function renderUsernames(usernameList: ApiUsername[], isChat?: boolean) {
    const [mainUsername, ...otherUsernames] = usernameList;

    const usernameLinks = otherUsernames.length
      ? (oldLang('UsernameAlso', '%USERNAMES%'))
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

        onClick={() => {
          handleUsernameClick(mainUsername, isChat);
        }}
      >
        <span className="title" dir={lang.isRtl ? 'rtl' : undefined}>
          {formatUsername(mainUsername.username, isChat)}
        </span>
        <span className="subtitle">
          {usernameLinks && <span className="other-usernames">{usernameLinks}</span>}
          {oldLang(isChat ? 'Link' : 'Username')}
        </span>
      </ListItem>
    );
  }

  return (
    <div className={buildClassName('ChatExtra', className)} style={style}>
      {personalChannel && (
        <div className={styles.personalChannel}>
          <h3 className={styles.personalChannelTitle}>{oldLang('ProfileChannel')}</h3>
          <span className={styles.personalChannelSubscribers}>
            {oldLang('Subscribers', personalChannel.membersCount, 'i')}
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

        <ListItem icon="phone" multiline narrow ripple onClick={handlePhoneClick}>
          <span className="title" dir={lang.isRtl ? 'rtl' : undefined}>{formattedNumber}</span>
          <span className="subtitle">{oldLang('Phone')}</span>
        </ListItem>
      )}
      {activeUsernames && renderUsernames(activeUsernames)}
      {description && Boolean(description.length) && (
        <ListItem
          icon="info"
          multiline
          narrow
          isStatic
          allowSelection
        >
          <span className="title word-break allow-selection" dir={lang.isRtl ? 'rtl' : undefined}>
            {
              renderText(description, [
                'br',
                shouldRenderAllLinks ? 'links' : 'tg_links',
                'emoji',
              ])
            }
          </span>
          <span className="subtitle">{oldLang(userId ? 'UserBio' : 'Info')}</span>
        </ListItem>
      )}
      {activeChatUsernames && !isTopicInfo && renderUsernames(activeChatUsernames, true)}
      {((!activeChatUsernames && canInviteUsers) || isTopicInfo) && link && (
        <ListItem
          icon="link"
          multiline
          narrow
          ripple

          onClick={() => copy(link, oldLang('SetUrlPlaceholder'))}
        >
          <div className="title">{link}</div>
          <span className="subtitle">{oldLang('SetUrlPlaceholder')}</span>
        </ListItem>
      )}
      {birthday && (
        <UserBirthday key={peerId} birthday={birthday} user={user!} isInSettings={isInSettings} />
      )}
      {hasMainMiniApp && (
        <ListItem
          multiline
          isStatic
          narrow
        >
          <Button
            className={styles.openAppButton}
            onClick={handleOpenApp}
          >
            {oldLang('ProfileBotOpenApp')}
          </Button>
          <div className={styles.sectionInfo}>
            {appTermsInfo}
          </div>
        </ListItem>
      )}
      {!isOwnProfile && !isInSettings && (
        <ListItem icon={isMuted ? 'mute' : 'unmute'} narrow ripple onClick={handleToggleNotifications}>
          <span>{lang('Notifications')}</span>
          <Switcher
            id="group-notifications"
            label={lang(userId ? 'AriaToggleUserNotifications' : 'AriaToggleChatNotifications')}
            checked={!isMuted}
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
          <span className="subtitle">{oldLang('BusinessProfileLocation')}</span>
        </ListItem>
      )}
      {shouldRenderNote && (
        <ListItem
          icon="note"
          iconClassName={styles.noteListItemIcon}
          multiline
          narrow
          isStatic
          allowSelection
        >
          <div
            ref={noteTextRef}
            className={buildClassName(
              'title',
              'word-break',
              'allow-selection',
              styles.noteText,
              isNoteCollapsed && styles.noteTextCollapsed,
            )}
            dir={lang.isRtl ? 'rtl' : undefined}
            onClick={canExpandNote ? handleExpandNote : undefined}
          >
            {renderTextWithEntities({
              text: note.text,
              entities: note.entities,
            })}
          </div>
          <div className={buildClassName('subtitle', styles.noteSubtitle)}>
            <span>{lang('UserNoteTitle')}</span>

            <span className={styles.noteHint}>{lang('UserNoteHint')}</span>
            {isNoteCollapsible && (
              <Icon
                className={buildClassName(
                  styles.noteCollapseIcon,
                  styles.clickable,
                  !isNoteCollapsed && styles.expandedIcon,
                )}
                onClick={handleToggleNote}
                name="down"
              />
            )}
          </div>
        </ListItem>
      )}
      {hasSavedMessages && !isOwnProfile && !isInSettings && (
        <ListItem icon="saved-messages" narrow ripple onClick={handleOpenSavedDialog}>
          <span>{oldLang('SavedMessagesTab')}</span>
        </ListItem>
      )}
      {userFullInfo && 'isBotAccessEmojiGranted' in userFullInfo && (
        <ListItem icon="user" narrow ripple onClick={manageEmojiStatusChange}>
          <span>{oldLang('BotProfilePermissionEmojiStatus')}</span>
          <Switcher
            label={oldLang('BotProfilePermissionEmojiStatus')}
            checked={isBotCanManageEmojiStatus}
            inactive
          />
        </ListItem>
      )}
      {botAppPermissions?.geolocation !== undefined && (
        <ListItem icon="location" narrow ripple onClick={handleLocationPermissionChange}>
          <span>{oldLang('BotProfilePermissionLocation')}</span>
          <Switcher
            label={oldLang('BotProfilePermissionLocation')}
            checked={botAppPermissions?.geolocation}
            inactive
          />
        </ListItem>
      )}
      {canViewSubscribers && (
        <ListItem icon="group" narrow multiline ripple onClick={handleOpenSubscribers}>
          <div className="title">{lang('ProfileItemSubscribers')}</div>
          <span className="subtitle">{lang.number(chat?.membersCount || 0)}</span>
        </ListItem>
      )}
      {botVerification && (
        <div className={styles.botVerificationSection}>
          <CustomEmoji
            className={styles.botVerificationIcon}
            documentId={botVerification.iconId}
            size={BOT_VERIFICATION_ICON_SIZE}
          />
          {botVerification.description}
        </div>
      )}
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { chatOrUserId, isSavedDialog }): Complete<StateProps> => {
    const { countryList: { phoneCodes: phoneCodeList } } = global;

    const chat = chatOrUserId ? selectChat(global, chatOrUserId) : undefined;
    const user = chatOrUserId ? selectUser(global, chatOrUserId) : undefined;
    const botAppPermissions = chatOrUserId ? selectBotAppPermissions(global, chatOrUserId) : undefined;
    const isForum = chat?.isForum;
    const isMuted = chat && getIsChatMuted(chat, selectNotifyDefaults(global), selectNotifyException(global, chat.id));
    const { threadId } = selectCurrentMessageList(global) || {};
    const topicId = isForum && threadId ? Number(threadId) : undefined;

    const chatFullInfo = chat && selectChatFullInfo(global, chat.id);
    const userFullInfo = user && selectUserFullInfo(global, user.id);

    const botVerification = userFullInfo?.botVerification || chatFullInfo?.botVerification;

    const chatInviteLink = chatFullInfo?.inviteLink;
    const description = userFullInfo?.bio || chatFullInfo?.about;

    const canViewSubscribers = chat && isChatChannel(chat) && isChatAdmin(chat);
    const canInviteUsers = chat && !user && (
      (!isChatChannel(chat) && !isUserRightBanned(chat, 'inviteUsers'))
      || getHasAdminRight(chat, 'inviteUsers')
    );

    const topicLink = topicId ? selectTopicLink(global, chatOrUserId, topicId) : undefined;

    const hasSavedMessages = !isSavedDialog && global.chats.listIds.saved?.includes(chatOrUserId);

    const personalChannel = userFullInfo?.personalChannelId
      ? selectChat(global, userFullInfo.personalChannelId)
      : undefined;

    const hasMainMiniApp = user?.hasMainMiniApp;

    return {
      phoneCodeList,
      chat,
      user,
      userFullInfo,
      canInviteUsers,
      botAppPermissions,
      isMuted,
      topicId,
      chatInviteLink,
      description,
      topicLink,
      hasSavedMessages,
      personalChannel,
      hasMainMiniApp,
      isBotCanManageEmojiStatus: userFullInfo?.isBotCanManageEmojiStatus,
      botVerification,
      canViewSubscribers,
    };
  },
)(ChatExtra));
