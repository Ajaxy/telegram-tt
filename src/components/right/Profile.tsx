import type { FC } from '../../lib/teact/teact';
import React, {
  memo, useCallback,
  useEffect, useMemo, useRef, useState,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type {
  ApiBotPreviewMedia,
  ApiChat,
  ApiChatMember,
  ApiMessage,
  ApiSavedStarGift,
  ApiTypeStory,
  ApiUser,
  ApiUserStatus,
} from '../../api/types';
import type { TabState } from '../../global/types';
import type {
  ISettings, ProfileState, ProfileTabType, SharedMediaType, ThreadId,
} from '../../types';
import type { RegularLangKey } from '../../types/language';
import { MAIN_THREAD_ID } from '../../api/types';
import { AudioOrigin, MediaViewerOrigin, NewChatMembersProgress } from '../../types';

import {
  MEMBERS_SLICE,
  PROFILE_SENSITIVE_AREA,
  SHARED_MEDIA_SLICE,
  SLIDE_TRANSITION_DURATION,
} from '../../config';
import {
  getHasAdminRight,
  getIsDownloading,
  getIsSavedDialog,
  getMessageDocument,
  getMessageDownloadableMedia,
  isChatAdmin,
  isChatChannel,
  isChatGroup,
  isUserBot,
  isUserId,
  isUserRightBanned,
} from '../../global/helpers';
import {
  selectActiveDownloads,
  selectChat,
  selectChatFullInfo,
  selectChatMessages,
  selectCurrentSharedMediaSearch,
  selectIsCurrentUserPremium,
  selectIsGiftProfileFilterDefault,
  selectIsRightColumnShown,
  selectPeerStories,
  selectSimilarBotsIds,
  selectSimilarChannelIds,
  selectTabState,
  selectTheme,
  selectUser,
  selectUserCommonChats,
  selectUserFullInfo,
} from '../../global/selectors';
import { selectPremiumLimit } from '../../global/selectors/limits';
import buildClassName from '../../util/buildClassName';
import { captureEvents, SwipeDirection } from '../../util/captureEvents';
import { IS_TOUCH_ENV } from '../../util/windowEnvironment';
import { LOCAL_TGS_URLS } from '../common/helpers/animatedAssets';
import renderText from '../common/helpers/renderText';
import { getSenderName } from '../left/search/helpers/getSenderName';

import usePeerStoriesPolling from '../../hooks/polling/usePeerStoriesPolling';
import useCacheBuster from '../../hooks/useCacheBuster';
import useEffectWithPrevDeps from '../../hooks/useEffectWithPrevDeps';
import useFlag from '../../hooks/useFlag';
import { useIntersectionObserver } from '../../hooks/useIntersectionObserver';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';
import useOldLang from '../../hooks/useOldLang';
import useAsyncRendering from './hooks/useAsyncRendering';
import useProfileState from './hooks/useProfileState';
import useProfileViewportIds from './hooks/useProfileViewportIds';
import useTransitionFixes from './hooks/useTransitionFixes';

import AnimatedIconWithPreview from '../common/AnimatedIconWithPreview';
import Audio from '../common/Audio';
import Document from '../common/Document';
import SavedGift from '../common/gift/SavedGift';
import GroupChatInfo from '../common/GroupChatInfo';
import Icon from '../common/icons/Icon';
import Media from '../common/Media';
import NothingFound from '../common/NothingFound';
import PreviewMedia from '../common/PreviewMedia';
import PrivateChatInfo from '../common/PrivateChatInfo';
import ChatExtra from '../common/profile/ChatExtra';
import ProfileInfo from '../common/ProfileInfo';
import WebLink from '../common/WebLink';
import ChatList from '../left/main/ChatList';
import MediaStory from '../story/MediaStory';
import Button from '../ui/Button';
import FloatingActionButton from '../ui/FloatingActionButton';
import InfiniteScroll from '../ui/InfiniteScroll';
import Link from '../ui/Link';
import ListItem, { type MenuItemContextAction } from '../ui/ListItem';
import Spinner from '../ui/Spinner';
import TabList from '../ui/TabList';
import Transition from '../ui/Transition';
import DeleteMemberModal from './DeleteMemberModal';

import './Profile.scss';

type OwnProps = {
  chatId: string;
  threadId?: ThreadId;
  profileState: ProfileState;
  isMobile?: boolean;
  onProfileStateChange: (state: ProfileState) => void;
  isActive: boolean;
};

type StateProps = {
  theme: ISettings['theme'];
  isChannel?: boolean;
  isBot?: boolean;
  currentUserId?: string;
  messagesById?: Record<number, ApiMessage>;
  foundIds?: number[];
  mediaSearchType?: SharedMediaType;
  hasCommonChatsTab?: boolean;
  hasStoriesTab?: boolean;
  hasMembersTab?: boolean;
  hasPreviewMediaTab?: boolean;
  hasGiftsTab?: boolean;
  gifts?: ApiSavedStarGift[];
  giftsTransitionKey: number;
  areMembersHidden?: boolean;
  canAddMembers?: boolean;
  canDeleteMembers?: boolean;
  members?: ApiChatMember[];
  adminMembersById?: Record<string, ApiChatMember>;
  commonChatIds?: string[];
  storyIds?: number[];
  pinnedStoryIds?: number[];
  archiveStoryIds?: number[];
  storyByIds?: Record<number, ApiTypeStory>;
  chatsById: Record<string, ApiChat>;
  usersById: Record<string, ApiUser>;
  userStatusesById: Record<string, ApiUserStatus>;
  isRightColumnShown: boolean;
  isRestricted?: boolean;
  activeDownloads: TabState['activeDownloads'];
  isChatProtected?: boolean;
  nextProfileTab?: ProfileTabType;
  shouldWarnAboutSvg?: boolean;
  similarChannels?: string[];
  similarBots?: string[];
  botPreviewMedia? : ApiBotPreviewMedia[];
  isCurrentUserPremium?: boolean;
  limitSimilarPeers: number;
  isTopicInfo?: boolean;
  isSavedDialog?: boolean;
  forceScrollProfileTab?: boolean;
  isSynced?: boolean;
  isNotDefaultGiftFilter?: boolean;
};

type TabProps = {
  type: ProfileTabType;
  key: RegularLangKey;
};

const TABS: TabProps[] = [
  { type: 'media', key: 'ProfileTabMedia' },
  { type: 'documents', key: 'ProfileTabFiles' },
  { type: 'links', key: 'ProfileTabLinks' },
  { type: 'audio', key: 'ProfileTabMusic' },
];

const HIDDEN_RENDER_DELAY = 1000;
const INTERSECTION_THROTTLE = 500;

const Profile: FC<OwnProps & StateProps> = ({
  chatId,
  isActive,
  threadId,
  profileState,
  theme,
  isChannel,
  isBot,
  currentUserId,
  messagesById,
  foundIds,
  storyIds,
  pinnedStoryIds,
  archiveStoryIds,
  storyByIds,
  mediaSearchType,
  hasCommonChatsTab,
  hasStoriesTab,
  hasMembersTab,
  hasPreviewMediaTab,
  hasGiftsTab,
  gifts,
  giftsTransitionKey,
  botPreviewMedia,
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
  activeDownloads,
  isChatProtected,
  nextProfileTab,
  shouldWarnAboutSvg,
  similarChannels,
  similarBots,
  isCurrentUserPremium,
  limitSimilarPeers,
  isTopicInfo,
  isSavedDialog,
  forceScrollProfileTab,
  isSynced,
  onProfileStateChange,
  isNotDefaultGiftFilter,
}) => {
  const {
    setSharedMediaSearchType,
    loadMoreMembers,
    loadCommonChats,
    openChat,
    searchSharedMediaMessages,
    openMediaViewer,
    openAudioPlayer,
    focusMessage,
    setNewChatMembersDialogState,
    loadPeerProfileStories,
    loadStoriesArchive,
    openPremiumModal,
    loadChannelRecommendations,
    loadBotRecommendations,
    loadPreviewMedias,
    loadPeerSavedGifts,
    resetGiftProfileFilter,
  } = getActions();

  // eslint-disable-next-line no-null/no-null
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const transitionRef = useRef<HTMLDivElement>(null);

  const oldLang = useOldLang();
  const lang = useLang();

  const [deletingUserId, setDeletingUserId] = useState<string | undefined>();

  const profileId = isSavedDialog ? String(threadId) : chatId;
  const isSavedMessages = profileId === currentUserId && !isSavedDialog;

  const tabs = useMemo(() => {
    const arr: TabProps[] = [];
    if (isSavedMessages && !isSavedDialog) {
      arr.push({ type: 'dialogs', key: 'ProfileTabSavedDialogs' });
    }

    if (hasStoriesTab) {
      arr.push({ type: 'stories', key: 'ProfileTabStories' });
    }

    if (hasStoriesTab && isSavedMessages) {
      arr.push({ type: 'storiesArchive', key: 'ProfileTabStoriesArchive' });
    }

    if (hasGiftsTab) {
      arr.push({ type: 'gifts', key: 'ProfileTabGifts' });
    }

    if (hasMembersTab) {
      arr.push({ type: 'members', key: isChannel ? 'ProfileTabSubscribers' : 'ProfileTabMembers' });
    }

    if (hasPreviewMediaTab) {
      arr.push({ type: 'previewMedia', key: 'ProfileTabBotPreview' });
    }

    arr.push(...TABS);

    // Voice messages filter currently does not work in forum topics. Return it when it's fixed on the server side.
    if (!isTopicInfo) {
      arr.push({ type: 'voice', key: 'ProfileTabVoice' });
    }

    if (hasCommonChatsTab) {
      arr.push({ type: 'commonChats', key: 'ProfileTabSharedGroups' });
    }

    if (isChannel && similarChannels?.length) {
      arr.push({ type: 'similarChannels', key: 'ProfileTabSimilarChannels' });
    }

    if (isBot && similarBots?.length) {
      arr.push({ type: 'similarBots', key: 'ProfileTabSimilarBots' });
    }

    return arr.map((tab) => ({
      type: tab.type,
      title: lang(tab.key),
    }));
  }, [
    isSavedMessages, isSavedDialog, hasStoriesTab, hasGiftsTab, hasMembersTab, hasPreviewMediaTab, isTopicInfo,
    hasCommonChatsTab, isChannel, isBot, similarChannels?.length, similarBots?.length, lang,
  ]);

  const initialTab = useMemo(() => {
    if (!nextProfileTab) {
      return 0;
    }

    const index = tabs.findIndex(({ type }) => type === nextProfileTab);
    return index === -1 ? 0 : index;
  }, [nextProfileTab, tabs]);

  const [allowAutoScrollToTabs, startAutoScrollToTabsIfNeeded, stopAutoScrollToTabs] = useFlag(false);

  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    if (!nextProfileTab) return;
    const index = tabs.findIndex(({ type }) => type === nextProfileTab);

    if (index === -1) return;
    setActiveTab(index);
  }, [nextProfileTab, tabs]);

  const handleSwitchTab = useCallback((index: number) => {
    startAutoScrollToTabsIfNeeded();
    setActiveTab(index);
  }, []);

  useEffect(() => {
    if (hasPreviewMediaTab && !botPreviewMedia) {
      loadPreviewMedias({ botId: chatId });
    }
  }, [chatId, botPreviewMedia, hasPreviewMediaTab]);

  useEffect(() => {
    if (isChannel && !similarChannels && isSynced) {
      loadChannelRecommendations({ chatId });
    }
  }, [chatId, isChannel, similarChannels, isSynced]);

  useEffect(() => {
    if (isBot && !similarBots && isSynced) {
      loadBotRecommendations({ userId: chatId });
    }
  }, [chatId, isBot, similarBots, isSynced]);

  const giftIds = useMemo(() => {
    return gifts?.map(({ date, gift, fromId }) => `${date}-${fromId}-${gift.id}`);
  }, [gifts]);

  const renderingActiveTab = activeTab > tabs.length - 1 ? tabs.length - 1 : activeTab;
  const tabType = tabs[renderingActiveTab].type as ProfileTabType;
  const handleLoadCommonChats = useCallback(() => {
    loadCommonChats({ userId: chatId });
  }, [chatId]);
  const handleLoadPeerStories = useCallback(({ offsetId }: { offsetId: number }) => {
    loadPeerProfileStories({ peerId: chatId, offsetId });
  }, [chatId]);
  const handleLoadStoriesArchive = useCallback(({ offsetId }: { offsetId: number }) => {
    loadStoriesArchive({ peerId: chatId, offsetId });
  }, [chatId]);
  const handleLoadGifts = useCallback(() => {
    loadPeerSavedGifts({ peerId: chatId });
  }, [chatId]);

  const [resultType, viewportIds, getMore, noProfileInfo] = useProfileViewportIds({
    loadMoreMembers,
    searchMessages: searchSharedMediaMessages,
    loadStories: handleLoadPeerStories,
    loadStoriesArchive: handleLoadStoriesArchive,
    loadMoreGifts: handleLoadGifts,
    loadCommonChats: handleLoadCommonChats,
    tabType,
    mediaSearchType,
    groupChatMembers: members,
    commonChatIds,
    usersById,
    userStatusesById,
    chatsById,
    chatMessages: messagesById,
    foundIds,
    threadId,
    storyIds,
    giftIds,
    pinnedStoryIds,
    archiveStoryIds,
    similarChannels,
    similarBots,
  });
  const isFirstTab = (isSavedMessages && resultType === 'dialogs')
    || (hasStoriesTab && resultType === 'stories')
    || resultType === 'members'
    || (!hasMembersTab && resultType === 'media');
  const activeKey = tabs.findIndex(({ type }) => type === resultType);

  usePeerStoriesPolling(resultType === 'members' ? viewportIds as string[] : undefined);

  const handleStopAutoScrollToTabs = useLastCallback(() => {
    stopAutoScrollToTabs();
  });

  const { handleScroll } = useProfileState(
    containerRef,
    resultType,
    profileState,
    onProfileStateChange,
    forceScrollProfileTab,
    allowAutoScrollToTabs,
    handleStopAutoScrollToTabs,
  );

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
    setSharedMediaSearchType({ mediaType: tabType as SharedMediaType });
  }, [setSharedMediaSearchType, tabType, threadId]);

  const handleSelectMedia = useLastCallback((messageId: number) => {
    openMediaViewer({
      chatId: profileId,
      threadId: MAIN_THREAD_ID,
      messageId,
      origin: MediaViewerOrigin.SharedMedia,
    });
  });

  const handleSelectPreviewMedia = useLastCallback((index: number) => {
    openMediaViewer({
      standaloneMedia: botPreviewMedia?.flatMap((item) => item?.content.photo
      || item?.content.video).filter(Boolean),
      origin: MediaViewerOrigin.PreviewMedia,
      mediaIndex: index,
    });
  });

  const handlePlayAudio = useLastCallback((messageId: number) => {
    openAudioPlayer({ chatId: profileId, messageId });
  });

  const handleMemberClick = useLastCallback((id: string) => {
    openChat({ id });
  });

  const handleMessageFocus = useLastCallback((message: ApiMessage) => {
    focusMessage({ chatId: message.chatId, messageId: message.id });
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

  const handleResetGiftsFilter = useLastCallback(() => {
    resetGiftProfileFilter({ peerId: chatId });
  });

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
  } else if (!viewportIds && !botPreviewMedia) {
    renderingDelay = SLIDE_TRANSITION_DURATION;
  }
  const canRenderContent = useAsyncRendering([chatId, threadId, resultType, renderingActiveTab], renderingDelay);

  function getMemberContextAction(memberId: string): MenuItemContextAction[] | undefined {
    return memberId === currentUserId || !canDeleteMembers ? undefined : [{
      title: oldLang('lng_context_remove_from_group'),
      icon: 'stop',
      handler: () => {
        setDeletingUserId(memberId);
      },
    }];
  }

  function renderNothingFoundGiftsWithFilter() {
    return (
      <div className="nothing-found-gifts">
        <AnimatedIconWithPreview
          size={160}
          tgsUrl={LOCAL_TGS_URLS.SearchingDuck}
          nonInteractive
          noLoop
        />
        <div className="description">
          {lang('GiftSearchEmpty')}
        </div>
        <Link
          className="date"
          onClick={handleResetGiftsFilter}
        >
          {lang('GiftSearchReset')}
        </Link>
      </div>
    );
  }

  function renderContent() {
    if (resultType === 'dialogs') {
      return (
        <ChatList className="saved-dialogs" folderType="saved" isActive />
      );
    }

    if ((!viewportIds && !botPreviewMedia) || !canRenderContent || !messagesById) {
      const noSpinner = isFirstTab && !canRenderContent;
      const forceRenderHiddenMembers = Boolean(resultType === 'members' && areMembersHidden);

      return (
        <div
          className="content empty-list"
        >
          {!noSpinner && !forceRenderHiddenMembers && <Spinner />}
          {forceRenderHiddenMembers && <NothingFound text="You have no access to group members list." />}
        </div>
      );
    }

    if (viewportIds && !viewportIds?.length) {
      let text: string;

      if (resultType === 'gifts' && isNotDefaultGiftFilter) {
        return renderNothingFoundGiftsWithFilter();
      }

      switch (resultType) {
        case 'members':
          text = areMembersHidden ? 'You have no access to group members list.' : 'No members found';
          break;
        case 'commonChats':
          text = oldLang('NoGroupsInCommon');
          break;
        case 'documents':
          text = oldLang('lng_media_file_empty');
          break;
        case 'links':
          text = oldLang('lng_media_link_empty');
          break;
        case 'audio':
          text = oldLang('lng_media_song_empty');
          break;
        case 'voice':
          text = oldLang('lng_media_audio_empty');
          break;
        case 'stories':
          text = oldLang('StoryList.SavedEmptyState.Title');
          break;
        case 'storiesArchive':
          text = oldLang('StoryList.ArchivedEmptyState.Title');
          break;
        default:
          text = oldLang('SharedMedia.EmptyTitle');
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
        dir={oldLang.isRtl && resultType === 'media' ? 'rtl' : undefined}
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
          (viewportIds as number[])!.map((id, i) => storyByIds?.[id] && (
            <MediaStory
              teactOrderKey={i}
              key={`${resultType}_${id}`}
              story={storyByIds[id]}
              isArchive={resultType === 'storiesArchive'}
            />
          ))
        ) : resultType === 'documents' ? (
          (viewportIds as number[])!.map((id) => messagesById[id] && (
            <Document
              key={id}
              document={getMessageDocument(messagesById[id])!}
              withDate
              smaller
              className="scroll-item"
              isDownloading={getIsDownloading(activeDownloads, getMessageDocument(messagesById[id])!)}
              observeIntersection={observeIntersectionForMedia}
              onDateClick={handleMessageFocus}
              message={messagesById[id]}
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
              isDownloading={getIsDownloading(activeDownloads, messagesById[id].content.audio!)}
            />
          ))
        ) : resultType === 'voice' ? (
          (viewportIds as number[])!.map((id) => {
            const message = messagesById[id];
            if (!message) return undefined;
            const media = messagesById[id] && getMessageDownloadableMedia(message)!;
            return messagesById[id] && (
              <Audio
                key={id}
                theme={theme}
                message={messagesById[id]}
                senderTitle={getSenderName(oldLang, messagesById[id], chatsById, usersById)}
                origin={AudioOrigin.SharedMedia}
                date={messagesById[id].date}
                className="scroll-item"
                onPlay={handlePlayAudio}
                onDateClick={handleMessageFocus}
                canDownload={!isChatProtected && !messagesById[id].isProtected}
                isDownloading={getIsDownloading(activeDownloads, media)}
              />
            );
          })
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
        ) : resultType === 'previewMedia' ? (
          botPreviewMedia!.map((media, i) => (
            <PreviewMedia
              key={media.date}
              media={media}
              isProtected={isChatProtected}
              observeIntersection={observeIntersectionForMedia}
              onClick={handleSelectPreviewMedia}
              index={i}
            />
          ))
        ) : resultType === 'similarChannels' ? (
          <div key={resultType}>
            {(viewportIds as string[])!.map((channelId, i) => (
              <ListItem
                key={channelId}
                teactOrderKey={i}
                className={buildClassName(
                  'chat-item-clickable search-result',
                  !isCurrentUserPremium && i === similarChannels!.length - 1 && 'blured',
                )}
                // eslint-disable-next-line react/jsx-no-bind
                onClick={() => openChat({ id: channelId })}
              >
                <GroupChatInfo avatarSize="large" chatId={channelId} withFullInfo />
              </ListItem>
            ))}
            {!isCurrentUserPremium && (
              <>
                {/* eslint-disable-next-line react/jsx-no-bind */}
                <Button className="show-more-channels" size="smaller" onClick={() => openPremiumModal()}>
                  {oldLang('UnlockSimilar')}
                  <Icon name="unlock-badge" />
                </Button>
                <div className="more-similar">
                  {renderText(oldLang('MoreSimilarText', limitSimilarPeers), ['simple_markdown'])}
                </div>
              </>
            )}
          </div>
        ) : resultType === 'similarBots' ? (
          <div key={resultType}>
            {(viewportIds as string[])!.map((userId, i) => (
              <ListItem
                key={userId}
                teactOrderKey={i}
                className={buildClassName(
                  'chat-item-clickable search-result',
                  !isCurrentUserPremium && i === similarBots!.length - 1 && 'blured',
                )}
                // eslint-disable-next-line react/jsx-no-bind
                onClick={() => openChat({ id: userId })}
              >
                {isUserId(userId) ? (
                  <PrivateChatInfo
                    userId={userId}
                    avatarSize="medium"
                  />
                ) : (
                  <GroupChatInfo
                    chatId={userId}
                    avatarSize="medium"
                  />
                )}
              </ListItem>
            ))}
            {!isCurrentUserPremium && (
              <>
                {/* eslint-disable-next-line react/jsx-no-bind */}
                <Button className="show-more-bots" size="smaller" onClick={() => openPremiumModal()}>
                  {lang('UnlockMoreSimilarBots')}
                  <Icon name="unlock-badge" />
                </Button>
                <div className="more-similar">
                  {renderText(lang('MoreSimilarBotsText', { count: limitSimilarPeers }, {
                    withNodes: true,
                    withMarkdown: true,
                  }))}
                </div>
              </>
            )}
          </div>
        ) : resultType === 'gifts' ? (
          (gifts?.map((gift) => (
            <SavedGift
              peerId={chatId}
              key={`${gift.date}-${gift.fromId}-${gift.gift.id}`}
              gift={gift}
              observeIntersection={observeIntersectionForMedia}
            />
          )))
        ) : undefined}
      </div>
    );
  }

  const shouldUseTransitionForContent = resultType === 'gifts';
  const contentTransitionKey = giftsTransitionKey;

  function renderContentWithTransition() {
    return (
      <Transition
        activeKey={contentTransitionKey}
        name="fade"
      >
        {renderContent()}
      </Transition>
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
      {!noProfileInfo && !isSavedMessages && (
        renderProfileInfo(profileId, isRightColumnShown && canRenderContent, isSavedDialog)
      )}
      {!isRestricted && (
        <div
          className="shared-media"
        >
          <Transition
            ref={transitionRef}
            name={oldLang.isRtl ? 'slideOptimizedRtl' : 'slideOptimized'}
            activeKey={activeKey}
            renderCount={tabs.length}
            shouldRestoreHeight
            className="shared-media-transition"
            onStart={applyTransitionFix}
            onStop={handleTransitionStop}
          >
            {shouldUseTransitionForContent ? renderContentWithTransition() : renderContent()}
          </Transition>
          <TabList activeTab={renderingActiveTab} tabs={tabs} onSwitchTab={handleSwitchTab} />
        </div>
      )}

      {canAddMembers && (
        <FloatingActionButton
          className={buildClassName(!isActive && 'hidden')}
          isShown={canRenderContent}
          onClick={handleNewMemberDialogOpen}
          ariaLabel={oldLang('lng_channel_add_users')}
        >
          <Icon name="add-user-filled" />
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

function renderProfileInfo(profileId: string, isReady: boolean, isSavedDialog?: boolean) {
  return (
    <div className="profile-info">
      <ProfileInfo peerId={profileId} canPlayVideo={isReady} />
      <ChatExtra chatOrUserId={profileId} isSavedDialog={isSavedDialog} />
    </div>
  );
}

export default memo(withGlobal<OwnProps>(
  (global, {
    chatId, threadId, isMobile,
  }): StateProps => {
    const user = selectUser(global, chatId);
    const chat = selectChat(global, chatId);
    const chatFullInfo = selectChatFullInfo(global, chatId);
    const userFullInfo = selectUserFullInfo(global, chatId);
    const messagesById = selectChatMessages(global, chatId);

    const { currentType: mediaSearchType, resultsByType } = selectCurrentSharedMediaSearch(global) || {};
    const { foundIds } = (resultsByType && mediaSearchType && resultsByType[mediaSearchType]) || {};

    const isTopicInfo = Boolean(chat?.isForum && threadId && threadId !== MAIN_THREAD_ID);

    const { byId: usersById, statusesById: userStatusesById } = global.users;
    const { byId: chatsById } = global.chats;

    const isSavedDialog = getIsSavedDialog(chatId, threadId, global.currentUserId);

    const isGroup = chat && isChatGroup(chat);
    const isChannel = chat && isChatChannel(chat);
    const isBot = user && isUserBot(user);
    const hasMembersTab = !isTopicInfo && !isSavedDialog && (isGroup || (isChannel && isChatAdmin(chat!)));
    const members = chatFullInfo?.members;
    const adminMembersById = chatFullInfo?.adminMembersById;
    const areMembersHidden = hasMembersTab && chat
      && (chat.isForbidden || (chatFullInfo && !chatFullInfo.canViewMembers));
    const canAddMembers = hasMembersTab && chat
      && (getHasAdminRight(chat, 'inviteUsers') || (!isChannel && !isUserRightBanned(chat, 'inviteUsers'))
        || chat.isCreator);
    const canDeleteMembers = hasMembersTab && chat && (getHasAdminRight(chat, 'banUsers') || chat.isCreator);
    const activeDownloads = selectActiveDownloads(global);
    const { similarChannelIds } = selectSimilarChannelIds(global, chatId) || {};
    const { similarBotsIds } = selectSimilarBotsIds(global, chatId) || {};
    const isCurrentUserPremium = selectIsCurrentUserPremium(global);

    const peer = user || chat;
    const peerFullInfo = userFullInfo || chatFullInfo;

    const hasCommonChatsTab = user && !user.isSelf && !isUserBot(user) && !isSavedDialog
      && Boolean(userFullInfo?.commonChatsCount);
    const commonChats = selectUserCommonChats(global, chatId);

    const hasPreviewMediaTab = userFullInfo?.botInfo?.hasPreviewMedia;
    const botPreviewMedia = global.users.previewMediaByBotId[chatId];

    const hasStoriesTab = peer && (user?.isSelf || (!peer.areStoriesHidden && peerFullInfo?.hasPinnedStories))
      && !isSavedDialog;
    const peerStories = hasStoriesTab ? selectPeerStories(global, peer.id) : undefined;
    const storyIds = peerStories?.profileIds;
    const pinnedStoryIds = peerStories?.pinnedIds;
    const storyByIds = peerStories?.byId;
    const archiveStoryIds = peerStories?.archiveIds;

    const hasGiftsTab = Boolean(peerFullInfo?.starGiftCount) && !isSavedDialog;
    const peerGifts = selectTabState(global).savedGifts.giftsByPeerId[chatId];
    const giftsTransitionKey = selectTabState(global).savedGifts.transitionKey || 0;

    const isNotDefaultGiftFilter = !selectIsGiftProfileFilterDefault(global);

    return {
      theme: selectTheme(global),
      isChannel,
      isBot,
      messagesById,
      foundIds,
      mediaSearchType,
      hasCommonChatsTab,
      hasStoriesTab,
      hasMembersTab,
      hasPreviewMediaTab,
      areMembersHidden,
      canAddMembers,
      canDeleteMembers,
      currentUserId: global.currentUserId,
      isRightColumnShown: selectIsRightColumnShown(global, isMobile),
      isRestricted: chat?.isRestricted,
      activeDownloads,
      usersById,
      userStatusesById,
      chatsById,
      storyIds,
      hasGiftsTab,
      gifts: peerGifts?.gifts,
      giftsTransitionKey,
      pinnedStoryIds,
      archiveStoryIds,
      storyByIds,
      isChatProtected: chat?.isProtected,
      nextProfileTab: selectTabState(global).nextProfileTab,
      forceScrollProfileTab: selectTabState(global).forceScrollProfileTab,
      shouldWarnAboutSvg: global.settings.byKey.shouldWarnAboutSvg,
      similarChannels: similarChannelIds,
      similarBots: similarBotsIds,
      botPreviewMedia,
      isCurrentUserPremium,
      isTopicInfo,
      isSavedDialog,
      isSynced: global.isSynced,
      isNotDefaultGiftFilter,
      limitSimilarPeers: selectPremiumLimit(global, 'recommendedChannels'),
      ...(hasMembersTab && members && { members, adminMembersById }),
      ...(hasCommonChatsTab && user && { commonChatIds: commonChats?.ids }),
    };
  },
)(Profile));
