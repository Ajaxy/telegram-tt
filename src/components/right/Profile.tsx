import type { FC } from '../../lib/teact/teact';
import React, {
  memo, useCallback,
  useEffect, useMemo, useRef, useState,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type {
  ApiChat,
  ApiChatMember,
  ApiMessage,
  ApiTypeStory,
  ApiUser,
  ApiUserStatus,
} from '../../api/types';
import type {
  ISettings, ProfileState, ProfileTabType, SharedMediaType,
} from '../../types';
import { MAIN_THREAD_ID } from '../../api/types';
import { AudioOrigin, MediaViewerOrigin, NewChatMembersProgress } from '../../types';

import {
  IS_STORIES_ENABLED,
  MEMBERS_SLICE,
  PROFILE_SENSITIVE_AREA,
  SHARED_MEDIA_SLICE,
  SLIDE_TRANSITION_DURATION,
} from '../../config';
import {
  getHasAdminRight, isChatAdmin, isChatChannel, isChatGroup, isUserBot, isUserId, isUserRightBanned,
} from '../../global/helpers';
import {
  selectActiveDownloads,
  selectChat,
  selectChatFullInfo,
  selectChatMessages,
  selectCurrentMediaSearch,
  selectIsRightColumnShown,
  selectPeerFullInfo,
  selectPeerStories,
  selectTabState,
  selectTheme,
  selectUser,
} from '../../global/selectors';
import { captureEvents, SwipeDirection } from '../../util/captureEvents';
import { IS_TOUCH_ENV } from '../../util/windowEnvironment';
import { getSenderName } from '../left/search/helpers/getSenderName';

import usePeerStoriesPolling from '../../hooks/polling/usePeerStoriesPolling';
import useCacheBuster from '../../hooks/useCacheBuster';
import useEffectWithPrevDeps from '../../hooks/useEffectWithPrevDeps';
import { useIntersectionObserver } from '../../hooks/useIntersectionObserver';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import useAsyncRendering from './hooks/useAsyncRendering';
import useProfileState from './hooks/useProfileState';
import useProfileViewportIds from './hooks/useProfileViewportIds';
import useTransitionFixes from './hooks/useTransitionFixes';

import Audio from '../common/Audio';
import ChatExtra from '../common/ChatExtra';
import Document from '../common/Document';
import GroupChatInfo from '../common/GroupChatInfo';
import Media from '../common/Media';
import NothingFound from '../common/NothingFound';
import PrivateChatInfo from '../common/PrivateChatInfo';
import ProfileInfo from '../common/ProfileInfo';
import WebLink from '../common/WebLink';
import MediaStory from '../story/MediaStory';
import FloatingActionButton from '../ui/FloatingActionButton';
import InfiniteScroll from '../ui/InfiniteScroll';
import ListItem, { type MenuItemContextAction } from '../ui/ListItem';
import Spinner from '../ui/Spinner';
import TabList from '../ui/TabList';
import Transition from '../ui/Transition';
import DeleteMemberModal from './DeleteMemberModal';

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
  foundIds?: number[];
  mediaSearchType?: SharedMediaType;
  hasCommonChatsTab?: boolean;
  hasStoriesTab?: boolean;
  hasMembersTab?: boolean;
  areMembersHidden?: boolean;
  canAddMembers?: boolean;
  canDeleteMembers?: boolean;
  members?: ApiChatMember[];
  adminMembersById?: Record<string, ApiChatMember>;
  commonChatIds?: string[];
  storyIds?: number[];
  archiveStoryIds?: number[];
  storyByIds?: Record<number, ApiTypeStory>;
  chatsById: Record<string, ApiChat>;
  usersById: Record<string, ApiUser>;
  userStatusesById: Record<string, ApiUserStatus>;
  isRightColumnShown: boolean;
  isRestricted?: boolean;
  activeDownloadIds?: number[];
  isChatProtected?: boolean;
  nextProfileTab?: ProfileTabType;
  shouldWarnAboutSvg?: boolean;
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
  storyIds,
  archiveStoryIds,
  storyByIds,
  mediaSearchType,
  hasCommonChatsTab,
  hasStoriesTab,
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
  activeDownloadIds,
  isChatProtected,
  nextProfileTab,
  shouldWarnAboutSvg,
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
    loadPeerPinnedStories,
    loadStoriesArchive,
  } = getActions();

  // eslint-disable-next-line no-null/no-null
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const transitionRef = useRef<HTMLDivElement>(null);
  const lang = useLang();
  const [deletingUserId, setDeletingUserId] = useState<string | undefined>();

  const tabs = useMemo(() => ([
    ...(hasStoriesTab ? [{ type: 'stories', title: 'ProfileStories' }] : []),
    ...(hasStoriesTab && currentUserId === chatId ? [{ type: 'storiesArchive', title: 'ProfileStoriesArchive' }] : []),
    ...(hasMembersTab ? [{
      type: 'members', title: isChannel ? 'ChannelSubscribers' : 'GroupMembers',
    }] : []),
    ...TABS,
    // TODO The filter for voice messages currently does not work
    // in forum topics. Return it when it's fixed on the server side.
    ...(!topicId ? [{ type: 'voice', title: 'SharedVoiceTab2' }] : []),
    ...(hasCommonChatsTab ? [{ type: 'commonChats', title: 'SharedGroupsTab2' }] : []),
  ]), [chatId, currentUserId, hasCommonChatsTab, hasMembersTab, hasStoriesTab, isChannel, topicId]);

  const initialTab = useMemo(() => {
    if (!nextProfileTab) {
      return 0;
    }

    const index = tabs.findIndex(({ type }) => type === nextProfileTab);
    return index === -1 ? 0 : index;
  }, [nextProfileTab, tabs]);

  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    if (!nextProfileTab) return;
    const index = tabs.findIndex(({ type }) => type === nextProfileTab);

    if (index === -1) return;
    setActiveTab(index);
  }, [nextProfileTab, tabs]);

  const renderingActiveTab = activeTab > tabs.length - 1 ? tabs.length - 1 : activeTab;
  const tabType = tabs[renderingActiveTab].type as ProfileTabType;
  const handleLoadPeerStories = useCallback(({ offsetId }: { offsetId: number }) => {
    loadPeerPinnedStories({ peerId: chatId, offsetId });
  }, [chatId]);
  const handleLoadStoriesArchive = useCallback(({ offsetId }: { offsetId: number }) => {
    loadStoriesArchive({ peerId: currentUserId!, offsetId });
  }, [currentUserId]);

  const [resultType, viewportIds, getMore, noProfileInfo] = useProfileViewportIds(
    loadMoreMembers,
    loadCommonChats,
    searchMediaMessagesLocal,
    handleLoadPeerStories,
    handleLoadStoriesArchive,
    tabType,
    mediaSearchType,
    members,
    commonChatIds,
    usersById,
    userStatusesById,
    chatsById,
    messagesById,
    foundIds,
    topicId,
    storyIds,
    archiveStoryIds,
  );
  const isFirstTab = (hasStoriesTab && resultType === 'stories')
    || resultType === 'members'
    || (!hasMembersTab && resultType === 'media');
  const activeKey = tabs.findIndex(({ type }) => type === resultType);

  usePeerStoriesPolling(resultType === 'members' ? viewportIds as string[] : undefined);

  const { handleScroll } = useProfileState(containerRef, resultType, profileState, onProfileStateChange);

  const { applyTransitionFix, releaseTransitionFix } = useTransitionFixes(containerRef);

  const [cacheBuster, resetCacheBuster] = useCacheBuster();

  const { observe: observeIntersectionForMedia } = useIntersectionObserver({
    rootRef: containerRef,
    throttleMs: INTERSECTION_THROTTLE,
  });

  const handleTransitionStop = useLastCallback(() => {
    releaseTransitionFix();
    resetCacheBuster();
  });

  const handleNewMemberDialogOpen = useLastCallback(() => {
    setNewChatMembersDialogState({ newChatMembersProgress: NewChatMembersProgress.InProgress });
  });

  // Update search type when switching tabs or forum topics
  useEffect(() => {
    setLocalMediaSearchType({ mediaType: tabType as SharedMediaType });
  }, [setLocalMediaSearchType, tabType, topicId]);

  const profileId = resolvedUserId || chatId;

  useEffect(() => {
    loadProfilePhotos({ profileId });
  }, [profileId]);

  const handleSelectMedia = useLastCallback((mediaId: number) => {
    openMediaViewer({
      chatId: profileId,
      threadId: MAIN_THREAD_ID,
      mediaId,
      origin: MediaViewerOrigin.SharedMedia,
    });
  });

  const handlePlayAudio = useLastCallback((messageId: number) => {
    openAudioPlayer({ chatId: profileId, messageId });
  });

  const handleMemberClick = useLastCallback((id: string) => {
    openChat({ id });
  });

  const handleMessageFocus = useLastCallback((messageId: number) => {
    focusMessage({ chatId: profileId, messageId });
  });

  const handleDeleteMembersModalClose = useLastCallback(() => {
    setDeletingUserId(undefined);
  });

  useEffectWithPrevDeps(([prevHasMemberTabs]) => {
    if (prevHasMemberTabs === undefined || activeTab === 0 || prevHasMemberTabs === hasMembersTab) {
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

  function getMemberContextAction(memberId: string): MenuItemContextAction[] | undefined {
    return memberId === currentUserId || !canDeleteMembers ? undefined : [{
      title: lang('lng_context_remove_from_group'),
      icon: 'stop',
      handler: () => {
        setDeletingUserId(memberId);
      },
    }];
  }

  function renderContent() {
    if (!viewportIds || !canRenderContent || !messagesById) {
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
        case 'stories':
          text = lang('StoryList.SavedEmptyState.Title');
          break;
        case 'storiesArchive':
          text = lang('StoryList.ArchivedEmptyState.Title');
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
          (viewportIds as number[])!.map((id) => messagesById[id] && (
            <Media
              key={id}
              message={messagesById[id]}
              isProtected={isChatProtected || messagesById[id].isProtected}
              observeIntersection={observeIntersectionForMedia}
              onClick={handleSelectMedia}
            />
          ))
        ) : (resultType === 'stories' || resultType === 'storiesArchive') ? (
          (viewportIds as number[])!.map((id) => storyByIds?.[id] && (
            <MediaStory
              key={`${resultType}_${id}`}
              story={storyByIds[id]}
              isProtected={isChatProtected}
              isArchive={resultType === 'storiesArchive'}
            />
          ))
        ) : resultType === 'documents' ? (
          (viewportIds as number[])!.map((id) => messagesById[id] && (
            <Document
              key={id}
              message={messagesById[id]}
              withDate
              smaller
              className="scroll-item"
              isDownloading={activeDownloadIds?.includes(id)}
              observeIntersection={observeIntersectionForMedia}
              onDateClick={handleMessageFocus}
              shouldWarnAboutSvg={shouldWarnAboutSvg}
            />
          ))
        ) : resultType === 'links' ? (
          (viewportIds as number[])!.map((id) => messagesById[id] && (
            <WebLink
              key={id}
              message={messagesById[id]}
              isProtected={isChatProtected || messagesById[id].isProtected}
              observeIntersection={observeIntersectionForMedia}
              onMessageClick={handleMessageFocus}
            />
          ))
        ) : resultType === 'audio' ? (
          (viewportIds as number[])!.map((id) => messagesById[id] && (
            <Audio
              key={id}
              theme={theme}
              message={messagesById[id]}
              origin={AudioOrigin.SharedMedia}
              date={messagesById[id].date}
              className="scroll-item"
              onPlay={handlePlayAudio}
              onDateClick={handleMessageFocus}
              canDownload={!isChatProtected && !messagesById[id].isProtected}
              isDownloading={activeDownloadIds?.includes(id)}
            />
          ))
        ) : resultType === 'voice' ? (
          (viewportIds as number[])!.map((id) => messagesById[id] && (
            <Audio
              key={id}
              theme={theme}
              message={messagesById[id]}
              senderTitle={getSenderName(lang, messagesById[id], chatsById, usersById)}
              origin={AudioOrigin.SharedMedia}
              date={messagesById[id].date}
              className="scroll-item"
              onPlay={handlePlayAudio}
              onDateClick={handleMessageFocus}
              canDownload={!isChatProtected && !messagesById[id].isProtected}
              isDownloading={activeDownloadIds?.includes(id)}
            />
          ))
        ) : resultType === 'members' ? (
          (viewportIds as string[])!.map((id, i) => (
            <ListItem
              key={id}
              teactOrderKey={i}
              className="chat-item-clickable contact-list-item scroll-item small-icon"
              // eslint-disable-next-line react/jsx-no-bind
              onClick={() => handleMemberClick(id)}
              contextActions={getMemberContextAction(id)}
            >
              <PrivateChatInfo userId={id} adminMember={adminMembersById?.[id]} forceShowSelf withStory />
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
      itemSelector={`.shared-media-transition > .Transition_slide-active.${resultType}-list > .scroll-item`}
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
            name={lang.isRtl ? 'slideOptimizedRtl' : 'slideOptimized'}
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
          <i className="icon icon-add-user-filled" />
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

export default memo(withGlobal<OwnProps>(
  (global, { chatId, topicId, isMobile }): StateProps => {
    const chat = selectChat(global, chatId);
    const chatFullInfo = selectChatFullInfo(global, chatId);
    const messagesById = selectChatMessages(global, chatId);
    const { currentType: mediaSearchType, resultsByType } = selectCurrentMediaSearch(global) || {};
    const { foundIds } = (resultsByType && mediaSearchType && resultsByType[mediaSearchType]) || {};

    const { byId: usersById, statusesById: userStatusesById } = global.users;
    const { byId: chatsById } = global.chats;

    const isGroup = chat && isChatGroup(chat);
    const isChannel = chat && isChatChannel(chat);
    const hasMembersTab = !topicId && (isGroup || (isChannel && isChatAdmin(chat!)));
    const members = chatFullInfo?.members;
    const adminMembersById = chatFullInfo?.adminMembersById;
    const areMembersHidden = hasMembersTab && chat
      && (chat.isForbidden || (chatFullInfo && !chatFullInfo.canViewMembers));
    const canAddMembers = hasMembersTab && chat
      && (getHasAdminRight(chat, 'inviteUsers') || !isUserRightBanned(chat, 'inviteUsers') || chat.isCreator);
    const canDeleteMembers = hasMembersTab && chat && (getHasAdminRight(chat, 'banUsers') || chat.isCreator);
    const activeDownloads = selectActiveDownloads(global, chatId);

    let hasCommonChatsTab;
    let resolvedUserId;
    let user;
    if (isUserId(chatId)) {
      resolvedUserId = chatId;
      user = selectUser(global, resolvedUserId);
      hasCommonChatsTab = user && !user.isSelf && !isUserBot(user);
    }

    const peer = user || chat;
    const peerFullInfo = selectPeerFullInfo(global, chatId);
    const hasStoriesTab = IS_STORIES_ENABLED
      && peer && (user?.isSelf || (!peer.areStoriesHidden && peerFullInfo?.hasPinnedStories));
    const peerStories = hasStoriesTab ? selectPeerStories(global, peer.id) : undefined;
    const storyIds = peerStories?.pinnedIds;
    const storyByIds = peerStories?.byId;
    const archiveStoryIds = peerStories?.archiveIds;

    return {
      theme: selectTheme(global),
      isChannel,
      resolvedUserId,
      messagesById,
      foundIds,
      mediaSearchType,
      hasCommonChatsTab,
      hasStoriesTab,
      hasMembersTab,
      areMembersHidden,
      canAddMembers,
      canDeleteMembers,
      currentUserId: global.currentUserId,
      isRightColumnShown: selectIsRightColumnShown(global, isMobile),
      isRestricted: chat?.isRestricted,
      activeDownloadIds: activeDownloads?.ids,
      usersById,
      userStatusesById,
      chatsById,
      storyIds,
      archiveStoryIds,
      storyByIds,
      isChatProtected: chat?.isProtected,
      nextProfileTab: selectTabState(global).nextProfileTab,
      shouldWarnAboutSvg: global.settings.byKey.shouldWarnAboutSvg,
      ...(hasMembersTab && members && { members, adminMembersById }),
      ...(hasCommonChatsTab && user && { commonChatIds: user.commonChats?.ids }),
    };
  },
)(Profile));
