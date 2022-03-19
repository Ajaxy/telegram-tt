import React, {
  FC, useCallback, useEffect, useMemo, useRef, useState, memo,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../modules';

import {
  MAIN_THREAD_ID,
  ApiMessage,
  ApiChat,
  ApiChatMember,
  ApiUser,
  ApiUserStatus,
} from '../../api/types';
import {
  NewChatMembersProgress, ISettings, MediaViewerOrigin, ProfileState, ProfileTabType, SharedMediaType, AudioOrigin,
} from '../../types';

import {
  MEMBERS_SLICE,
  PROFILE_SENSITIVE_AREA,
  SHARED_MEDIA_SLICE,
  SLIDE_TRANSITION_DURATION,
} from '../../config';
import { IS_TOUCH_ENV } from '../../util/environment';
import {
  getHasAdminRight, isChatAdmin, isChatChannel, isChatGroup, isUserBot, isUserId,
} from '../../modules/helpers';
import {
  selectChatMessages,
  selectChat,
  selectCurrentMediaSearch,
  selectIsRightColumnShown,
  selectTheme,
  selectActiveDownloadIds,
  selectUser,
} from '../../modules/selectors';
import { captureEvents, SwipeDirection } from '../../util/captureEvents';
import { getSenderName } from '../left/search/helpers/getSenderName';
import useCacheBuster from '../../hooks/useCacheBuster';
import useProfileViewportIds from './hooks/useProfileViewportIds';
import useProfileState from './hooks/useProfileState';
import useTransitionFixes from './hooks/useTransitionFixes';
import useAsyncRendering from './hooks/useAsyncRendering';
import useLang from '../../hooks/useLang';

import Transition from '../ui/Transition';
import InfiniteScroll from '../ui/InfiniteScroll';
import TabList from '../ui/TabList';
import Spinner from '../ui/Spinner';
import ListItem from '../ui/ListItem';
import PrivateChatInfo from '../common/PrivateChatInfo';
import ProfileInfo from '../common/ProfileInfo';
import Document from '../common/Document';
import Audio from '../common/Audio';
import ChatExtra from '../common/ChatExtra';
import Media from '../common/Media';
import WebLink from '../common/WebLink';
import NothingFound from '../common/NothingFound';
import FloatingActionButton from '../ui/FloatingActionButton';
import DeleteMemberModal from './DeleteMemberModal';
import GroupChatInfo from '../common/GroupChatInfo';

import './Profile.scss';
import { useIntersectionObserver } from '../../hooks/useIntersectionObserver';

type OwnProps = {
  chatId: string;
  profileState: ProfileState;
  onProfileStateChange: (state: ProfileState) => void;
};

type StateProps = {
  theme: ISettings['theme'];
  isChannel?: boolean;
  currentUserId?: string;
  resolvedUserId?: string;
  chatMessages?: Record<number, ApiMessage>;
  foundIds?: number[];
  mediaSearchType?: SharedMediaType;
  hasCommonChatsTab?: boolean;
  hasMembersTab?: boolean;
  areMembersHidden?: boolean;
  canAddMembers?: boolean;
  canDeleteMembers?: boolean;
  members?: ApiChatMember[];
  commonChatIds?: string[];
  chatsById: Record<string, ApiChat>;
  usersById: Record<string, ApiUser>;
  userStatusesById: Record<string, ApiUserStatus>;
  isRightColumnShown: boolean;
  isRestricted?: boolean;
  lastSyncTime?: number;
  serverTimeOffset: number;
  activeDownloadIds: number[];
  isChatProtected?: boolean;
};

const TABS = [
  { type: 'media', title: 'SharedMediaTab2' },
  { type: 'documents', title: 'SharedFilesTab2' },
  { type: 'links', title: 'SharedLinksTab2' },
  { type: 'audio', title: 'SharedMusicTab2' },
  { type: 'voice', title: 'SharedVoiceTab2' },
];

const HIDDEN_RENDER_DELAY = 1000;
const INTERSECTION_THROTTLE = 500;

const Profile: FC<OwnProps & StateProps> = ({
  chatId,
  profileState,
  onProfileStateChange,
  theme,
  isChannel,
  resolvedUserId,
  currentUserId,
  chatMessages,
  foundIds,
  mediaSearchType,
  hasCommonChatsTab,
  hasMembersTab,
  areMembersHidden,
  canAddMembers,
  canDeleteMembers,
  commonChatIds,
  members,
  usersById,
  userStatusesById,
  chatsById,
  isRightColumnShown,
  isRestricted,
  lastSyncTime,
  activeDownloadIds,
  serverTimeOffset,
  isChatProtected,
}) => {
  const {
    setLocalMediaSearchType,
    loadMoreMembers,
    loadCommonChats,
    openChat,
    searchMediaMessagesLocal,
    openMediaViewer,
    openAudioPlayer,
    focusMessage,
    loadProfilePhotos,
    setNewChatMembersDialogState,
  } = getActions();

  // eslint-disable-next-line no-null/no-null
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const transitionRef = useRef<HTMLDivElement>(null);
  const lang = useLang();
  const [activeTab, setActiveTab] = useState(0);
  const [deletingUserId, setDeletingUserId] = useState<string | undefined>();

  const tabs = useMemo(() => ([
    ...(hasMembersTab ? [{
      type: 'members', title: isChannel ? 'ChannelSubscribers' : 'GroupMembers',
    }] : []),
    ...TABS,
    ...(hasCommonChatsTab ? [{
      type: 'commonChats', title: 'SharedGroupsTab2',
    }] : []),
  ]), [hasCommonChatsTab, hasMembersTab, isChannel]);
  const tabType = tabs[activeTab].type as ProfileTabType;

  const [resultType, viewportIds, getMore, noProfileInfo] = useProfileViewportIds(
    isRightColumnShown,
    loadMoreMembers,
    loadCommonChats,
    searchMediaMessagesLocal,
    tabType,
    mediaSearchType,
    members,
    commonChatIds,
    usersById,
    userStatusesById,
    chatsById,
    chatMessages,
    foundIds,
    chatId,
    lastSyncTime,
    serverTimeOffset,
  );
  const activeKey = tabs.findIndex(({ type }) => type === resultType);

  const { handleScroll } = useProfileState(containerRef, tabType, profileState, onProfileStateChange);

  const { applyTransitionFix, releaseTransitionFix } = useTransitionFixes(containerRef);

  const [cacheBuster, resetCacheBuster] = useCacheBuster();

  const { observe: observeIntersectionForMedia } = useIntersectionObserver({
    rootRef: containerRef,
    throttleMs: INTERSECTION_THROTTLE,
  });

  const handleTransitionStop = useCallback(() => {
    releaseTransitionFix();
    resetCacheBuster();
  }, [releaseTransitionFix, resetCacheBuster]);

  const handleNewMemberDialogOpen = useCallback(() => {
    setNewChatMembersDialogState(NewChatMembersProgress.InProgress);
  }, [setNewChatMembersDialogState]);

  // Update search type when switching tabs
  useEffect(() => {
    setLocalMediaSearchType({ mediaType: tabType });
  }, [setLocalMediaSearchType, tabType]);

  const profileId = resolvedUserId || chatId;

  useEffect(() => {
    if (lastSyncTime) {
      loadProfilePhotos({ profileId });
    }
  }, [loadProfilePhotos, profileId, lastSyncTime]);

  const handleSelectMedia = useCallback((messageId: number) => {
    openMediaViewer({
      chatId: profileId,
      threadId: MAIN_THREAD_ID,
      messageId,
      origin: MediaViewerOrigin.SharedMedia,
    });
  }, [profileId, openMediaViewer]);

  const handlePlayAudio = useCallback((messageId: number) => {
    openAudioPlayer({ chatId: profileId, messageId });
  }, [profileId, openAudioPlayer]);

  const handleMemberClick = useCallback((id: string) => {
    openChat({ id });
  }, [openChat]);

  const handleMessageFocus = useCallback((messageId: number) => {
    focusMessage({ chatId: profileId, messageId });
  }, [profileId, focusMessage]);

  const handleDeleteMembersModalClose = useCallback(() => {
    setDeletingUserId(undefined);
  }, []);

  useEffect(() => {
    if (!transitionRef.current || !IS_TOUCH_ENV) {
      return undefined;
    }

    return captureEvents(transitionRef.current, {
      selectorToPreventScroll: '.Profile',
      onSwipe: ((e, direction) => {
        if (direction === SwipeDirection.Left) {
          setActiveTab(Math.min(activeTab + 1, tabs.length - 1));
          return true;
        } else if (direction === SwipeDirection.Right) {
          setActiveTab(Math.max(0, activeTab - 1));
          return true;
        }

        return false;
      }),
    });
  }, [activeTab, tabs.length]);

  let renderingDelay;
  const isFirstTab = resultType === 'members' || (!hasMembersTab && resultType === 'media');
  // @optimization Used to unparallelize rendering of message list and profile media
  if (isFirstTab) {
    renderingDelay = !isRightColumnShown ? HIDDEN_RENDER_DELAY : 0;
    // @optimization Used to delay first render of secondary tabs while animating
  } else if (!viewportIds) {
    renderingDelay = SLIDE_TRANSITION_DURATION;
  }
  const canRenderContent = useAsyncRendering([chatId, resultType], renderingDelay);

  function getMemberContextAction(memberId: string) {
    return memberId === currentUserId || !canDeleteMembers ? undefined : [{
      title: lang('lng_context_remove_from_group'),
      icon: 'stop',
      handler: () => {
        setDeletingUserId(memberId);
      },
    }];
  }

  function renderContent() {
    if (!viewportIds || !canRenderContent || !chatMessages) {
      const noSpinner = isFirstTab && !canRenderContent;

      return (
        <div className="content empty-list">
          {!noSpinner && <Spinner />}
        </div>
      );
    }

    if (!viewportIds.length) {
      let text: string;

      switch (resultType) {
        case 'members':
          text = areMembersHidden ? 'You have no access to group members list.' : 'No members found';
          break;
        case 'commonChats':
          text = lang('NoGroupsInCommon');
          break;
        case 'documents':
          text = lang('lng_media_file_empty');
          break;
        case 'links':
          text = lang('lng_media_link_empty');
          break;
        case 'audio':
          text = lang('lng_media_song_empty');
          break;
        case 'voice':
          text = lang('lng_media_audio_empty');
          break;
        default:
          text = lang('SharedMedia.EmptyTitle');
      }

      return (
        <div className="content empty-list">
          <NothingFound text={text} />
        </div>
      );
    }

    return (
      <div
        className={`content ${resultType}-list`}
        dir={lang.isRtl && resultType === 'media' ? 'rtl' : undefined}
        teactFastList
      >
        {resultType === 'media' ? (
          (viewportIds as number[])!.map((id) => chatMessages[id] && (
            <Media
              key={id}
              message={chatMessages[id]}
              isProtected={isChatProtected || chatMessages[id].isProtected}
              observeIntersection={observeIntersectionForMedia}
              onClick={handleSelectMedia}
            />
          ))
        ) : resultType === 'documents' ? (
          (viewportIds as number[])!.map((id) => chatMessages[id] && (
            <Document
              key={id}
              message={chatMessages[id]}
              withDate
              smaller
              className="scroll-item"
              isDownloading={activeDownloadIds.includes(id)}
              observeIntersection={observeIntersectionForMedia}
              onDateClick={handleMessageFocus}
            />
          ))
        ) : resultType === 'links' ? (
          (viewportIds as number[])!.map((id) => chatMessages[id] && (
            <WebLink
              key={id}
              message={chatMessages[id]}
              isProtected={isChatProtected || chatMessages[id].isProtected}
              observeIntersection={observeIntersectionForMedia}
              onMessageClick={handleMessageFocus}
            />
          ))
        ) : resultType === 'audio' ? (
          (viewportIds as number[])!.map((id) => chatMessages[id] && (
            <Audio
              key={id}
              theme={theme}
              message={chatMessages[id]}
              origin={AudioOrigin.SharedMedia}
              date={chatMessages[id].date}
              lastSyncTime={lastSyncTime}
              className="scroll-item"
              onPlay={handlePlayAudio}
              onDateClick={handleMessageFocus}
              isDownloading={activeDownloadIds.includes(id)}
            />
          ))
        ) : resultType === 'voice' ? (
          (viewportIds as number[])!.map((id) => chatMessages[id] && (
            <Audio
              key={id}
              theme={theme}
              message={chatMessages[id]}
              senderTitle={getSenderName(lang, chatMessages[id], chatsById, usersById)}
              origin={AudioOrigin.SharedMedia}
              date={chatMessages[id].date}
              lastSyncTime={lastSyncTime}
              className="scroll-item"
              onPlay={handlePlayAudio}
              onDateClick={handleMessageFocus}
              isDownloading={activeDownloadIds.includes(id)}
            />
          ))
        ) : resultType === 'members' ? (
          (viewportIds as string[])!.map((id, i) => (
            <ListItem
              key={id}
              teactOrderKey={i}
              className="chat-item-clickable scroll-item small-icon"
              onClick={() => handleMemberClick(id)}
              contextActions={getMemberContextAction(id)}
            >
              <PrivateChatInfo userId={id} forceShowSelf />
            </ListItem>
          ))
        ) : resultType === 'commonChats' ? (
          (viewportIds as string[])!.map((id, i) => (
            <ListItem
              key={id}
              teactOrderKey={i}
              className="chat-item-clickable scroll-item small-icon"
              onClick={() => openChat({ id })}
            >
              <GroupChatInfo chatId={id} />
            </ListItem>
          ))
        ) : undefined}
      </div>
    );
  }

  return (
    <InfiniteScroll
      ref={containerRef}
      className="Profile custom-scroll"
      itemSelector={buildInfiniteScrollItemSelector(resultType)}
      items={canRenderContent ? viewportIds : undefined}
      cacheBuster={cacheBuster}
      sensitiveArea={PROFILE_SENSITIVE_AREA}
      preloadBackwards={canRenderContent ? (resultType === 'members' ? MEMBERS_SLICE : SHARED_MEDIA_SLICE) : 0}
      // To prevent scroll jumps caused by reordering member list
      noScrollRestoreOnTop
      noFastList
      onLoadMore={getMore}
      onScroll={handleScroll}
    >
      {!noProfileInfo && renderProfileInfo(chatId, resolvedUserId)}
      {!isRestricted && (
        <div
          className="shared-media"
        >
          <Transition
            ref={transitionRef}
            name={lang.isRtl ? 'slide-optimized-rtl' : 'slide-optimized'}
            activeKey={activeKey}
            renderCount={tabs.length}
            shouldRestoreHeight
            className="shared-media-transition"
            onStart={applyTransitionFix}
            onStop={handleTransitionStop}
          >
            {renderContent()}
          </Transition>
          <TabList big activeTab={activeTab} tabs={tabs} onSwitchTab={setActiveTab} />
        </div>
      )}

      {canAddMembers && (
        <FloatingActionButton
          isShown={resultType === 'members'}
          onClick={handleNewMemberDialogOpen}
          ariaLabel={lang('lng_channel_add_users')}
        >
          <i className="icon-add-user-filled" />
        </FloatingActionButton>
      )}
      {canDeleteMembers && (
        <DeleteMemberModal
          isOpen={Boolean(deletingUserId)}
          userId={deletingUserId}
          onClose={handleDeleteMembersModalClose}
        />
      )}
    </InfiniteScroll>
  );
};

function renderProfileInfo(chatId: string, resolvedUserId?: string) {
  return (
    <div className="profile-info">
      <ProfileInfo userId={resolvedUserId || chatId} />
      <ChatExtra chatOrUserId={resolvedUserId || chatId} />
    </div>
  );
}

function buildInfiniteScrollItemSelector(resultType: string) {
  return [
    // Used on first render
    `.shared-media-transition > div:only-child > .${resultType}-list > .scroll-item`,
    // Used after transition
    `.shared-media-transition > .Transition__slide--active > .${resultType}-list > .scroll-item`,
  ].join(', ');
}

export default memo(withGlobal<OwnProps>(
  (global, { chatId }): StateProps => {
    const chat = selectChat(global, chatId);
    const chatMessages = selectChatMessages(global, chatId);
    const { currentType: mediaSearchType, resultsByType } = selectCurrentMediaSearch(global) || {};
    const { foundIds } = (resultsByType && mediaSearchType && resultsByType[mediaSearchType]) || {};

    const { byId: usersById, statusesById: userStatusesById } = global.users;
    const { byId: chatsById } = global.chats;

    const isGroup = chat && isChatGroup(chat);
    const isChannel = chat && isChatChannel(chat);
    const hasMembersTab = isGroup || (isChannel && isChatAdmin(chat!));
    const members = chat?.fullInfo?.members;
    const areMembersHidden = hasMembersTab && chat && chat.fullInfo && !chat.fullInfo.canViewMembers;
    const canAddMembers = hasMembersTab && chat && (getHasAdminRight(chat, 'inviteUsers') || chat.isCreator);
    const canDeleteMembers = hasMembersTab && chat && (getHasAdminRight(chat, 'banUsers') || chat.isCreator);
    const activeDownloadIds = selectActiveDownloadIds(global, chatId);

    let hasCommonChatsTab;
    let resolvedUserId;
    let user;
    if (isUserId(chatId)) {
      resolvedUserId = chatId;
      user = selectUser(global, resolvedUserId);
      hasCommonChatsTab = user && !user.isSelf && !isUserBot(user);
    }

    return {
      theme: selectTheme(global),
      isChannel,
      resolvedUserId,
      chatMessages,
      foundIds,
      mediaSearchType,
      hasCommonChatsTab,
      hasMembersTab,
      areMembersHidden,
      canAddMembers,
      canDeleteMembers,
      currentUserId: global.currentUserId,
      isRightColumnShown: selectIsRightColumnShown(global),
      isRestricted: chat?.isRestricted,
      lastSyncTime: global.lastSyncTime,
      serverTimeOffset: global.serverTimeOffset,
      activeDownloadIds,
      usersById,
      userStatusesById,
      chatsById,
      isChatProtected: chat?.isProtected,
      ...(hasMembersTab && members && { members }),
      ...(hasCommonChatsTab && user && { commonChatIds: user.commonChats?.ids }),
    };
  },
)(Profile));
