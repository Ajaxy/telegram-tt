import React, {
  FC, useCallback, useEffect, useMemo, useRef, useState, memo,
} from '../../lib/teact/teact';
import { withGlobal } from '../../lib/teact/teactn';

import {
  ApiMessage,
  ApiChatMember,
  ApiUser,
  MAIN_THREAD_ID,
} from '../../api/types';
import { GlobalActions } from '../../global/types';
import {
  ISettings,
  MediaViewerOrigin, ProfileState, ProfileTabType, SharedMediaType,
} from '../../types';

import {
  MEMBERS_SLICE,
  PROFILE_SENSITIVE_AREA,
  SHARED_MEDIA_SLICE,
  SLIDE_TRANSITION_DURATION,
} from '../../config';
import { IS_TOUCH_ENV } from '../../util/environment';
import {
  isChatAdmin, isChatChannel, isChatGroup, isChatPrivate,
} from '../../modules/helpers';
import {
  selectChatMessages,
  selectChat,
  selectCurrentMediaSearch,
  selectIsRightColumnShown,
  selectTheme,
} from '../../modules/selectors';
import { pick } from '../../util/iteratees';
import { captureEvents, SwipeDirection } from '../../util/captureEvents';
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
import ProfileInfo from './ProfileInfo';
import Document from '../common/Document';
import Audio from '../common/Audio';
import ChatExtra from './ChatExtra';
import Media from '../common/Media';
import WebLink from '../common/WebLink';
import NothingFound from '../common/NothingFound';

import './Profile.scss';

type OwnProps = {
  chatId: number;
  userId?: number;
  profileState: ProfileState;
  onProfileStateChange: (state: ProfileState) => void;
};

type StateProps = {
  theme: ISettings['theme'];
  isChannel?: boolean;
  resolvedUserId?: number;
  chatMessages?: Record<number, ApiMessage>;
  foundIds?: number[];
  mediaSearchType?: SharedMediaType;
  hasMembersTab?: boolean;
  areMembersHidden?: boolean;
  members?: ApiChatMember[];
  usersById?: Record<number, ApiUser>;
  isRightColumnShown: boolean;
  isRestricted?: boolean;
  lastSyncTime?: number;
  serverTimeOffset: number;
};

type DispatchProps = Pick<GlobalActions, (
  'setLocalMediaSearchType' | 'loadMoreMembers' | 'searchMediaMessagesLocal' | 'openMediaViewer' |
  'openAudioPlayer' | 'openUserInfo' | 'focusMessage' | 'loadProfilePhotos'
)>;

const TABS = [
  { type: 'media', title: 'SharedMediaTab2' },
  { type: 'documents', title: 'SharedFilesTab2' },
  { type: 'links', title: 'SharedLinksTab2' },
  { type: 'audio', title: 'SharedMusicTab2' },
];

const HIDDEN_RENDER_DELAY = 1000;

const Profile: FC<OwnProps & StateProps & DispatchProps> = ({
  chatId,
  profileState,
  onProfileStateChange,
  theme,
  isChannel,
  resolvedUserId,
  chatMessages,
  foundIds,
  mediaSearchType,
  hasMembersTab,
  areMembersHidden,
  members,
  usersById,
  isRightColumnShown,
  isRestricted,
  lastSyncTime,
  setLocalMediaSearchType,
  loadMoreMembers,
  searchMediaMessagesLocal,
  openMediaViewer,
  openAudioPlayer,
  openUserInfo,
  focusMessage,
  loadProfilePhotos,
  serverTimeOffset,
}) => {
  // eslint-disable-next-line no-null/no-null
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const transitionRef = useRef<HTMLDivElement>(null);
  const lang = useLang();
  const [activeTab, setActiveTab] = useState(0);

  const tabs = useMemo(() => ([
    ...(hasMembersTab ? [{
      type: 'members', title: isChannel ? 'ChannelSubscribers' : 'GroupMembers',
    }] : []),
    ...TABS,
  ]), [hasMembersTab, isChannel]);
  const tabType = tabs[activeTab].type as ProfileTabType;

  const [resultType, viewportIds, getMore, noProfileInfo] = useProfileViewportIds(
    isRightColumnShown, loadMoreMembers, searchMediaMessagesLocal, tabType, mediaSearchType, members,
    usersById, chatMessages, foundIds, chatId, lastSyncTime, serverTimeOffset,
  );
  const activeKey = tabs.findIndex(({ type }) => type === resultType);

  const { handleScroll } = useProfileState(containerRef, tabType, profileState, onProfileStateChange);

  const { applyTransitionFix, releaseTransitionFix } = useTransitionFixes(containerRef);

  const [cacheBuster, resetCacheBuster] = useCacheBuster();

  const handleTransitionStop = useCallback(() => {
    releaseTransitionFix();
    resetCacheBuster();
  }, [releaseTransitionFix, resetCacheBuster]);

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

  const handleMemberClick = useCallback((id: number) => {
    openUserInfo({ id });
  }, [openUserInfo]);

  const handleMessageFocus = useCallback((messageId: number) => {
    focusMessage({ chatId: profileId, messageId });
  }, [profileId, focusMessage]);

  useEffect(() => {
    if (!transitionRef.current || !IS_TOUCH_ENV) {
      return undefined;
    }

    return captureEvents(transitionRef.current, {
      onSwipe: ((e, direction) => {
        if (direction === SwipeDirection.Left) {
          setActiveTab(Math.min(activeTab + 1, tabs.length - 1));
        } else if (direction === SwipeDirection.Right) {
          setActiveTab(Math.max(0, activeTab - 1));
        }
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
  const canRenderContents = useAsyncRendering([chatId, resultType], renderingDelay);

  function renderSharedMedia() {
    if (!viewportIds || !canRenderContents || !chatMessages) {
      // This is just a single-frame delay so we do not show spinner
      const noSpinner = isFirstTab && viewportIds && !canRenderContents;

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
        case 'documents':
          text = lang('lng_media_file_empty_search');
          break;
        case 'links':
          text = lang('lng_media_link_empty_search');
          break;
        case 'audio':
          text = lang('lng_media_song_empty_search');
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
          viewportIds!.map((id) => chatMessages[id] && (
            <Media
              key={id}
              message={chatMessages[id]}
              onClick={handleSelectMedia}
            />
          ))
        ) : resultType === 'documents' ? (
          viewportIds!.map((id) => chatMessages[id] && (
            <Document
              key={id}
              message={chatMessages[id]}
              withDate
              smaller
              className="scroll-item"
              onDateClick={handleMessageFocus}
            />
          ))
        ) : resultType === 'links' ? (
          viewportIds!.map((id) => chatMessages[id] && (
            <WebLink
              key={id}
              message={chatMessages[id]}
              onMessageClick={handleMessageFocus}
            />
          ))
        ) : resultType === 'audio' ? (
          viewportIds!.map((id) => chatMessages[id] && (
            <Audio
              key={id}
              theme={theme}
              message={chatMessages[id]}
              target="sharedMedia"
              date={chatMessages[id].date}
              lastSyncTime={lastSyncTime}
              className="scroll-item"
              onPlay={handlePlayAudio}
              onDateClick={handleMessageFocus}
            />
          ))
        ) : resultType === 'members' ? (
          viewportIds!.map((id, i) => (
            <ListItem
              key={id}
              teactOrderKey={i}
              className="chat-item-clickable scroll-item"
              onClick={() => handleMemberClick(id)}
            >
              <PrivateChatInfo userId={id} forceShowSelf />
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
      items={canRenderContents ? viewportIds : undefined}
      cacheBuster={cacheBuster}
      sensitiveArea={PROFILE_SENSITIVE_AREA}
      preloadBackwards={canRenderContents ? (resultType === 'members' ? MEMBERS_SLICE : SHARED_MEDIA_SLICE) : 0}
      // To prevent scroll jumps caused by reordering member list
      noScrollRestoreOnTop
      noFastList
      onLoadMore={getMore}
      onScroll={handleScroll}
    >
      {!noProfileInfo && renderProfileInfo(chatId, resolvedUserId)}
      {!isRestricted && (
        <div className="shared-media">
          <Transition
            ref={transitionRef}
            name={lang.isRtl ? 'slide-reversed' : 'slide'}
            activeKey={activeKey}
            renderCount={tabs.length}
            shouldRestoreHeight
            className="shared-media-transition"
            onStart={applyTransitionFix}
            onStop={handleTransitionStop}
          >
            {renderSharedMedia}
          </Transition>
          <TabList big activeTab={activeTab} tabs={tabs} onSwitchTab={setActiveTab} />
        </div>
      )}
    </InfiniteScroll>
  );
};

function renderProfileInfo(chatId: number, resolvedUserId?: number) {
  return (
    <div className="profile-info">
      <ProfileInfo
        userId={resolvedUserId || chatId}
        forceShowSelf={resolvedUserId !== chatId}
      />
      <ChatExtra chatOrUserId={resolvedUserId || chatId} forceShowSelf={resolvedUserId !== chatId} />
    </div>
  );
}

function buildInfiniteScrollItemSelector(resultType: string) {
  return [
    // Used on first render
    `.shared-media-transition > div:only-child > .${resultType}-list > .scroll-item`,
    // Used after transition
    `.shared-media-transition > div.active > .${resultType}-list > .scroll-item`,
  ].join(', ');
}

export default memo(withGlobal<OwnProps>(
  (global, { chatId, userId }): StateProps => {
    const chat = selectChat(global, chatId);

    const chatMessages = selectChatMessages(global, userId || chatId);
    const { currentType: mediaSearchType, resultsByType } = selectCurrentMediaSearch(global) || {};
    const { foundIds } = (resultsByType && mediaSearchType && resultsByType[mediaSearchType]) || {};

    const { byId: usersById } = global.users;

    const isGroup = chat && isChatGroup(chat);
    const isChannel = chat && isChatChannel(chat);
    const hasMembersTab = isGroup || (isChannel && isChatAdmin(chat!));
    const members = chat && chat.fullInfo && chat.fullInfo.members;
    const areMembersHidden = hasMembersTab && chat && chat.fullInfo && !chat.fullInfo.canViewMembers;

    let resolvedUserId;
    if (userId) {
      resolvedUserId = userId;
    } else if (isChatPrivate(chatId)) {
      resolvedUserId = chatId;
    }

    return {
      theme: selectTheme(global),
      isChannel,
      resolvedUserId,
      chatMessages,
      foundIds,
      mediaSearchType,
      hasMembersTab,
      areMembersHidden,
      ...(hasMembersTab && members && {
        members,
        usersById,
      }),
      isRightColumnShown: selectIsRightColumnShown(global),
      isRestricted: chat && chat.isRestricted,
      lastSyncTime: global.lastSyncTime,
      serverTimeOffset: global.serverTimeOffset,
    };
  },
  (setGlobal, actions): DispatchProps => pick(actions, [
    'setLocalMediaSearchType',
    'loadMoreMembers',
    'searchMediaMessagesLocal',
    'openMediaViewer',
    'openAudioPlayer',
    'openUserInfo',
    'focusMessage',
    'loadProfilePhotos',
  ]),
)(Profile));
