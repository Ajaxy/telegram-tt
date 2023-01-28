import type { FC } from '../../lib/teact/teact';
import React, {
  useCallback, useEffect, useMemo, useRef, useState, memo,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type {
  ApiMessage,
  ApiChat,
  ApiChatMember,
  ApiUser,
  ApiUserStatus,
} from '../../api/types';
import { MAIN_THREAD_ID } from '../../api/types';
import type {
  ISettings, ProfileState, ProfileTabType, SharedMediaType,
} from '../../types';
import { NewChatMembersProgress, MediaViewerOrigin, AudioOrigin } from '../../types';

import {
  MEMBERS_SLICE,
  PROFILE_SENSITIVE_AREA,
  SHARED_MEDIA_SLICE,
  SLIDE_TRANSITION_DURATION,
} from '../../config';
import { IS_TOUCH_ENV } from '../../util/environment';
import {
  getHasAdminRight, isChatAdmin, isChatChannel, isChatGroup, isUserBot, isUserId, isUserRightBanned,
} from '../../global/helpers';
import {
  selectChatMessages,
  selectChat,
  selectCurrentMediaSearch,
  selectIsRightColumnShown,
  selectTheme,
  selectActiveDownloadIds,
  selectUser,
  selectListedIds,
} from '../../global/selectors';
import { captureEvents, SwipeDirection } from '../../util/captureEvents';
import { getSenderName } from '../left/search/helpers/getSenderName';
import { pickTruthy } from '../../util/iteratees';
import useCacheBuster from '../../hooks/useCacheBuster';
import useProfileViewportIds from './hooks/useProfileViewportIds';
import useProfileState from './hooks/useProfileState';
import useTransitionFixes from './hooks/useTransitionFixes';
import useAsyncRendering from './hooks/useAsyncRendering';
import useLang from '../../hooks/useLang';
import { useIntersectionObserver } from '../../hooks/useIntersectionObserver';
import useEffectWithPrevDeps from '../../hooks/useEffectWithPrevDeps';

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

type OwnProps = {
  chatId: string;
  topicId?: number;
  profileState: ProfileState;
  isMobile?: boolean;
  onProfileStateChange: (state: ProfileState) => void;
};

type StateProps = {
  theme: ISettings['theme'];
  isChannel?: boolean;
  currentUserId?: string;
  resolvedUserId?: string;
  messagesById?: Record<number, ApiMessage>;
  messageIds?: number[];
  foundIds?: number[];
  mediaSearchType?: SharedMediaType;
  hasCommonChatsTab?: boolean;
  hasMembersTab?: boolean;
  areMembersHidden?: boolean;
  canAddMembers?: boolean;
  canDeleteMembers?: boolean;
  members?: ApiChatMember[];
  adminMembersById?: Record<string, ApiChatMember>;
  commonChatIds?: string[];
  chatsById: Record<string, ApiChat>;
  usersById: Record<string, ApiUser>;
  userStatusesById: Record<string, ApiUserStatus>;
  isRightColumnShown: boolean;
  isRestricted?: boolean;
  lastSyncTime?: number;
  activeDownloadIds: number[];
  isChatProtected?: boolean;
};

const TABS = [
  { type: 'media', title: 'SharedMediaTab2' },
  { type: 'documents', title: 'SharedFilesTab2' },
  { type: 'links', title: 'SharedLinksTab2' },
  { type: 'audio', title: 'SharedMusicTab2' },
];

const HIDDEN_RENDER_DELAY = 1000;
const INTERSECTION_THROTTLE = 500;

const Profile: FC<OwnProps & StateProps> = ({
  chatId,
  topicId,
  profileState,
  onProfileStateChange,
  theme,
  isChannel,
  resolvedUserId,
  currentUserId,
  messagesById,
  foundIds,
  messageIds,
  mediaSearchType,
  hasCommonChatsTab,
  hasMembersTab,
  areMembersHidden,
  canAddMembers,
  canDeleteMembers,
  commonChatIds,
  members,
  adminMembersById,
  usersById,
  userStatusesById,
  chatsById,
  isRightColumnShown,
  isRestricted,
  lastSyncTime,
  activeDownloadIds,
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
    // TODO The filter for voice messages currently does not work
    // in forum topics. Return it when it's fixed on the server side.
    ...(!topicId ? [{ type: 'voice', title: 'SharedVoiceTab2' }] : []),
    ...(hasCommonChatsTab ? [{ type: 'commonChats', title: 'SharedGroupsTab2' }] : []),
  ]), [hasCommonChatsTab, hasMembersTab, isChannel, topicId]);

  const renderingActiveTab = activeTab > tabs.length - 1 ? tabs.length - 1 : activeTab;
  const tabType = tabs[renderingActiveTab].type as ProfileTabType;

  const chatMessages = useMemo(() => {
    return messageIds && messagesById ? pickTruthy(messagesById, messageIds) : {};
  }, [messagesById, messageIds]);

  const [resultType, viewportIds, getMore, noProfileInfo] = useProfileViewportIds(
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
    lastSyncTime,
    topicId,
  );
  const isFirstTab = resultType === 'members' || (!hasMembersTab && resultType === 'media');
  const activeKey = tabs.findIndex(({ type }) => type === resultType);

  const { handleScroll } = useProfileState(containerRef, tabType, profileState, onProfileStateChange, isFirstTab);

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
    setNewChatMembersDialogState({ newChatMembersProgress: NewChatMembersProgress.InProgress });
  }, [setNewChatMembersDialogState]);

  // Update search type when switching tabs or forum topics
  useEffect(() => {
    setLocalMediaSearchType({ mediaType: tabType as SharedMediaType });
  }, [setLocalMediaSearchType, tabType, topicId]);

  const profileId = resolvedUserId || chatId;

  useEffect(() => {
    if (lastSyncTime) {
      loadProfilePhotos({ profileId });
    }
  }, [loadProfilePhotos, profileId, lastSyncTime]);

  const handleSelectMedia = useCallback((mediaId: number) => {
    openMediaViewer({
      chatId: profileId,
      threadId: MAIN_THREAD_ID,
      mediaId,
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

  useEffectWithPrevDeps(([prevHasMemberTabs]) => {
    if (activeTab === 0 || prevHasMemberTabs === hasMembersTab) {
      return;
    }

    const newActiveTab = activeTab + (hasMembersTab ? 1 : -1);

    setActiveTab(Math.min(newActiveTab, tabs.length - 1));
  }, [hasMembersTab, activeTab, tabs]);

  useEffect(() => {
    if (!transitionRef.current || !IS_TOUCH_ENV) {
      return undefined;
    }

    return captureEvents(transitionRef.current, {
      selectorToPreventScroll: '.Profile',
      onSwipe: ((e, direction) => {
        if (direction === SwipeDirection.Left) {
          setActiveTab(Math.min(renderingActiveTab + 1, tabs.length - 1));
          return true;
        } else if (direction === SwipeDirection.Right) {
          setActiveTab(Math.max(0, renderingActiveTab - 1));
          return true;
        }

        return false;
      }),
    });
  }, [renderingActiveTab, tabs.length]);

  let renderingDelay;
  // @optimization Used to unparallelize rendering of message list and profile media
  if (isFirstTab) {
    renderingDelay = !isRightColumnShown ? HIDDEN_RENDER_DELAY : 0;
    // @optimization Used to delay first render of secondary tabs while animating
  } else if (!viewportIds) {
    renderingDelay = SLIDE_TRANSITION_DURATION;
  }
  const canRenderContent = useAsyncRendering([chatId, topicId, resultType, renderingActiveTab], renderingDelay);

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
      const forceRenderHiddenMembers = Boolean(resultType === 'members' && areMembersHidden);

      return (
        <div className="content empty-list">
          {!noSpinner && !forceRenderHiddenMembers && <Spinner />}
          {forceRenderHiddenMembers && <NothingFound text="You have no access to group members list." />}
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
              canDownload={!isChatProtected && !chatMessages[id].isProtected}
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
              canDownload={!isChatProtected && !chatMessages[id].isProtected}
              isDownloading={activeDownloadIds.includes(id)}
            />
          ))
        ) : resultType === 'members' ? (
          (viewportIds as string[])!.map((id, i) => (
            <ListItem
              key={id}
              teactOrderKey={i}
              className="chat-item-clickable scroll-item small-icon"
              // eslint-disable-next-line react/jsx-no-bind
              onClick={() => handleMemberClick(id)}
              contextActions={getMemberContextAction(id)}
            >
              <PrivateChatInfo userId={id} adminMember={adminMembersById?.[id]} forceShowSelf />
            </ListItem>
          ))
        ) : resultType === 'commonChats' ? (
          (viewportIds as string[])!.map((id, i) => (
            <ListItem
              key={id}
              teactOrderKey={i}
              className="chat-item-clickable scroll-item small-icon"
              // eslint-disable-next-line react/jsx-no-bind
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
      {!noProfileInfo && renderProfileInfo(chatId, resolvedUserId, isRightColumnShown && canRenderContent)}
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
          <TabList big activeTab={renderingActiveTab} tabs={tabs} onSwitchTab={setActiveTab} />
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

function renderProfileInfo(chatId: string, resolvedUserId: string | undefined, isReady: boolean) {
  return (
    <div className="profile-info">
      <ProfileInfo userId={resolvedUserId || chatId} canPlayVideo={isReady} />
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
  (global, { chatId, topicId, isMobile }): StateProps => {
    const chat = selectChat(global, chatId);
    const messagesById = selectChatMessages(global, chatId);
    const { currentType: mediaSearchType, resultsByType } = selectCurrentMediaSearch(global) || {};
    const { foundIds } = (resultsByType && mediaSearchType && resultsByType[mediaSearchType]) || {};
    const messageIds = selectListedIds(global, chatId, topicId || MAIN_THREAD_ID);

    const { byId: usersById, statusesById: userStatusesById } = global.users;
    const { byId: chatsById } = global.chats;

    const isGroup = chat && isChatGroup(chat);
    const isChannel = chat && isChatChannel(chat);
    const hasMembersTab = !topicId && (isGroup || (isChannel && isChatAdmin(chat!)));
    const members = chat?.fullInfo?.members;
    const adminMembersById = chat?.fullInfo?.adminMembersById;
    const areMembersHidden = hasMembersTab && chat
      && (chat.isForbidden || (chat.fullInfo && !chat.fullInfo.canViewMembers));
    const canAddMembers = hasMembersTab && chat
      && (getHasAdminRight(chat, 'inviteUsers') || !isUserRightBanned(chat, 'inviteUsers') || chat.isCreator);
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
      messagesById,
      foundIds,
      messageIds,
      mediaSearchType,
      hasCommonChatsTab,
      hasMembersTab,
      areMembersHidden,
      canAddMembers,
      canDeleteMembers,
      currentUserId: global.currentUserId,
      isRightColumnShown: selectIsRightColumnShown(global, isMobile),
      isRestricted: chat?.isRestricted,
      lastSyncTime: global.lastSyncTime,
      activeDownloadIds,
      usersById,
      userStatusesById,
      chatsById,
      isChatProtected: chat?.isProtected,
      ...(hasMembersTab && members && { members, adminMembersById }),
      ...(hasCommonChatsTab && user && { commonChatIds: user.commonChats?.ids }),
    };
  },
)(Profile));
