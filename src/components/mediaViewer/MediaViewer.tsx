import type React from '../../lib/teact/teact';
import {
  beginHeavyAnimation,
  memo, useEffect, useMemo, useRef,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type {
  ApiChat,
  ApiMessage,
  ApiPeer,
  ApiPeerPhotos,
  ApiPhoto,
  ApiSponsoredMessage,
} from '../../api/types';
import { type MediaViewerMedia, MediaViewerOrigin, type ThreadId } from '../../types';

import { ANIMATION_END_DELAY } from '../../config';
import { requestMutation } from '../../lib/fasterdom/fasterdom';
import {
  getMediaSearchType,
  getMessageContentIds,
  getMessagePaidMedia, isChatAdmin,
} from '../../global/helpers';
import {
  selectChatMessage,
  selectChatMessages,
  selectChatScheduledMessages,
  selectCurrentChatMediaSearch,
  selectCurrentSharedMediaSearch,
  selectIsChatWithSelf,
  selectListedIds,
  selectOutlyingListByMessageId,
  selectPeer,
  selectPeerPhotos,
  selectPerformanceSettingsValue,
  selectScheduledMessage, selectSponsoredMessage,
  selectTabState,
} from '../../global/selectors';
import { stopCurrentAudio } from '../../util/audioPlayer';
import { IS_TAURI } from '../../util/browser/globalEnvironment';
import { IS_MAC_OS } from '../../util/browser/windowEnvironment';
import captureEscKeyListener from '../../util/captureEscKeyListener';
import { disableDirectTextInput, enableDirectTextInput } from '../../util/directInputManager';
import { isUserId } from '../../util/entities/ids';
import { MEDIA_VIEWER_MEDIA_QUERY } from '../common/helpers/mediaDimensions';
import { renderMessageText } from '../common/helpers/renderMessageText';
import { getMediaViewerItem, type MediaViewerItem, type ViewableMedia } from './helpers/getViewableMedia';
import selectViewableMedia from './helpers/getViewableMedia';
import { animateClosing, animateOpening } from './helpers/ghostAnimation';

import useAppLayout from '../../hooks/useAppLayout';
import useFlag from '../../hooks/useFlag';
import useForceUpdate from '../../hooks/useForceUpdate';
import useLastCallback from '../../hooks/useLastCallback';
import useOldLang from '../../hooks/useOldLang';
import { exitPictureInPictureIfNeeded, PICTURE_IN_PICTURE_SIGNAL } from '../../hooks/usePictureInPicture';
import usePreviousDeprecated from '../../hooks/usePreviousDeprecated';
import { dispatchPriorityPlaybackEvent } from '../../hooks/usePriorityPlaybackCheck';
import { useMediaProps } from './hooks/useMediaProps';

import Icon from '../common/icons/Icon';
import ReportAvatarModal from '../common/ReportAvatarModal';
import Button from '../ui/Button';
import ShowTransition from '../ui/ShowTransition';
import Transition from '../ui/Transition';
import MediaViewerActions from './MediaViewerActions';
import MediaViewerSlides from './MediaViewerSlides';
import SenderInfo from './SenderInfo';

import './MediaViewer.scss';

type StateProps = {
  chatId?: string;
  threadId?: ThreadId;
  messageId?: number;
  message?: ApiMessage;
  collectedMessageIds?: number[];
  isChatWithSelf?: boolean;
  canUpdateMedia?: boolean;
  origin?: MediaViewerOrigin;
  avatar?: ApiPhoto;
  avatarOwner?: ApiPeer;
  profilePhotos?: ApiPeerPhotos;
  chatMessages?: Record<number, ApiMessage>;
  sponsoredMessage?: ApiSponsoredMessage;
  standaloneMedia?: MediaViewerMedia[];
  mediaIndex?: number;
  isHidden?: boolean;
  withAnimation?: boolean;
  shouldSkipHistoryAnimations?: boolean;
  withDynamicLoading?: boolean;
  isLoadingMoreMedia?: boolean;
  isSynced?: boolean;
  currentItem?: MediaViewerItem;
  viewableMedia?: ViewableMedia;
};

const ANIMATION_DURATION = 250;
const AVATAR_LOAD_TRIGGER = 4;

const MediaViewer = ({
  chatId,
  threadId,
  messageId,
  message,
  collectedMessageIds,
  isChatWithSelf,
  canUpdateMedia,
  origin,
  avatar,
  avatarOwner,
  profilePhotos,
  chatMessages,
  sponsoredMessage,
  standaloneMedia,
  mediaIndex,
  withAnimation,
  isHidden,
  shouldSkipHistoryAnimations,
  withDynamicLoading,
  isLoadingMoreMedia,
  isSynced,
  currentItem,
  viewableMedia,
}: StateProps) => {
  const {
    openMediaViewer,
    closeMediaViewer,
    openForwardMenu,
    focusMessage,
    toggleChatInfo,
    searchChatMediaMessages,
    loadMoreProfilePhotos,
    clickSponsored,
    openUrl,
  } = getActions();

  const isOpen = Boolean(avatarOwner || message || standaloneMedia || sponsoredMessage);
  const { isMobile } = useAppLayout();

  const { media, isSingle } = viewableMedia || {};

  /* Animation */
  const animationKey = useRef<number>();
  const senderId = message?.senderId || avatarOwner?.id || message?.chatId;
  const prevSenderId = usePreviousDeprecated<string | undefined>(senderId);
  const headerAnimation = withAnimation ? 'slideFade' : 'none';
  const isGhostAnimation = Boolean(withAnimation && !shouldSkipHistoryAnimations);

  /* Controls */
  const [isReportAvatarModalOpen, openReportAvatarModal, closeReportAvatarModal] = useFlag();

  const {
    isVideo,
    isPhoto,
    bestImageData,
    bestData,
    dimensions,
    isGif,
    contentType,
  } = useMediaProps({
    media, isAvatar: Boolean(avatarOwner), origin, delay: isGhostAnimation && ANIMATION_DURATION,
  });

  const canReportAvatar = (() => {
    if (isChatWithSelf) return false;
    if (currentItem?.type !== 'avatar' || !avatarOwner) return false;
    const info = currentItem.profilePhotos;
    if (media === info.personalPhoto) return false;
    return true;
  })();
  const isVisible = !isHidden && isOpen;

  const messageMediaIds = useMemo(() => {
    return withDynamicLoading
      ? collectedMessageIds
      : getMessageContentIds(chatMessages || {}, collectedMessageIds || [], contentType || 'media');
  }, [chatMessages, collectedMessageIds, contentType, withDynamicLoading]);

  if (isOpen && (!prevSenderId || prevSenderId !== senderId || animationKey.current === undefined)) {
    animationKey.current = isSingle ? 0 : (messageId || mediaIndex);
  }

  const [getIsPictureInPicture] = PICTURE_IN_PICTURE_SIGNAL;

  useEffect(() => {
    if (!isOpen || getIsPictureInPicture()) {
      return undefined;
    }

    disableDirectTextInput();
    const stopPriorityPlayback = dispatchPriorityPlaybackEvent();

    return () => {
      stopPriorityPlayback();
      enableDirectTextInput();
    };
  }, [isOpen, getIsPictureInPicture]);

  useEffect(() => {
    if (isVisible) {
      exitPictureInPictureIfNeeded();
    }
  }, [isVisible]);

  useEffect(() => {
    if (isMobile) {
      requestMutation(() => {
        document.body.classList.toggle('is-media-viewer-open', isOpen);
      });
    }
  }, [isMobile, isOpen]);

  const forceUpdate = useForceUpdate();
  useEffect(() => {
    const mql = window.matchMedia(MEDIA_VIEWER_MEDIA_QUERY);
    mql.addEventListener('change', forceUpdate);

    return () => {
      mql.removeEventListener('change', forceUpdate);
    };
  }, [forceUpdate]);

  const prevMessage = usePreviousDeprecated<ApiMessage | undefined>(message);
  const prevIsHidden = usePreviousDeprecated<boolean | undefined>(isHidden);
  const prevOrigin = usePreviousDeprecated(origin);
  const prevItem = usePreviousDeprecated(currentItem);
  const prevBestImageData = usePreviousDeprecated(bestImageData);
  const textParts = message ? renderMessageText({ message, forcePlayback: true, isForMediaViewer: true }) : undefined;
  const hasFooter = Boolean(textParts);
  const shouldAnimateOpening = prevIsHidden && prevItem !== currentItem;

  useEffect(() => {
    if (isGhostAnimation && isOpen && (shouldAnimateOpening || !prevItem)) {
      beginHeavyAnimation(ANIMATION_DURATION + ANIMATION_END_DELAY);
      animateOpening(hasFooter, origin!, bestImageData!, dimensions!, isVideo, message, mediaIndex);
    }

    if (isGhostAnimation && !isOpen && prevItem) {
      beginHeavyAnimation(ANIMATION_DURATION + ANIMATION_END_DELAY);
      animateClosing(prevOrigin!, prevBestImageData!, prevMessage, prevItem?.mediaIndex);
    }
  }, [
    bestImageData, dimensions, hasFooter, isGhostAnimation, isOpen, isVideo, message, origin,
    prevBestImageData, prevItem, prevMessage, prevOrigin, shouldAnimateOpening, mediaIndex,
  ]);

  const handleClose = useLastCallback(() => closeMediaViewer());

  const handleFooterClick = useLastCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target instanceof HTMLElement && e.target.closest('a')) return; // Prevent closing on timestamp click

    handleClose();

    if (!chatId || !messageId) return;

    if (isMobile) {
      setTimeout(() => {
        toggleChatInfo({ force: false }, { forceSyncOnIOs: true });
        focusMessage({ chatId, threadId, messageId });
      }, ANIMATION_DURATION);
    } else {
      focusMessage({ chatId, threadId, messageId });
    }
  });

  const handleSponsoredClick = useLastCallback((isFromMedia?: boolean) => {
    if (!sponsoredMessage || !chatId) return;

    clickSponsored({ isMedia: isFromMedia, isFullscreen: true, randomId: sponsoredMessage.randomId });
    openUrl({ url: sponsoredMessage.url });
    closeMediaViewer();
  });

  const handleForward = useLastCallback(() => {
    openForwardMenu({
      fromChatId: chatId!,
      messageIds: [messageId!],
    });
  });

  useEffect(() => (isOpen ? captureEscKeyListener(() => {
    handleClose();
  }) : undefined), [handleClose, isOpen]);

  useEffect(() => {
    if (isVideo && !isGif) {
      stopCurrentAudio();
    }
  }, [isGif, isVideo]);

  const loadMoreItemsIfNeeded = useLastCallback((item?: MediaViewerItem) => {
    if (!item || isLoadingMoreMedia) return;

    if (item.type === 'avatar') {
      const isNearEnd = item.mediaIndex >= item.profilePhotos.photos.length - AVATAR_LOAD_TRIGGER;
      if (!isNearEnd) return;
      loadMoreProfilePhotos({ peerId: item.avatarOwner.id });
    }

    if (item.type === 'message' && withDynamicLoading) {
      searchChatMediaMessages({ chatId, threadId, currentMediaMessageId: item.message.id });
    }
  });

  const getNextItem = useLastCallback((from: MediaViewerItem, direction: number): MediaViewerItem | undefined => {
    if (direction === 0 || isSingle) return undefined;

    if (from.type === 'standalone') {
      const { media: fromMedia, mediaIndex: fromMediaIndex } = from;
      const nextIndex = fromMediaIndex + direction;
      if (nextIndex >= 0 && nextIndex < fromMedia.length) {
        return { type: 'standalone', media: fromMedia, mediaIndex: nextIndex };
      }

      return undefined;
    }

    if (from.type === 'avatar') {
      const { avatarOwner: fromAvatarOwner, profilePhotos: fromProfilePhotos, mediaIndex: fromMediaIndex } = from;
      const nextIndex = fromMediaIndex + direction;
      if (nextIndex >= 0 && fromProfilePhotos && nextIndex < fromProfilePhotos.photos.length) {
        return {
          type: 'avatar',
          avatarOwner: fromAvatarOwner,
          profilePhotos: fromProfilePhotos,
          mediaIndex: nextIndex,
        };
      }

      return undefined;
    }

    if (from.type === 'sponsoredMessage') {
      const { message: fromSponsoredMessage, mediaIndex: fromSponsoredMessageIndex } = from;
      const nextIndex = fromSponsoredMessageIndex! + direction;
      if (nextIndex >= 0 && fromSponsoredMessage) {
        return { type: 'sponsoredMessage', message: fromSponsoredMessage, mediaIndex: nextIndex };
      }

      return undefined;
    }

    const { message: fromMessage, mediaIndex: fromMediaIndex } = from;

    const paidMedia = getMessagePaidMedia(fromMessage);
    if (paidMedia) {
      const nextIndex = fromMediaIndex! + direction;

      if (nextIndex >= 0 && nextIndex < paidMedia.extendedMedia.length) {
        return { type: 'message', message: fromMessage, mediaIndex: nextIndex };
      }
    }

    const index = messageMediaIds?.indexOf(fromMessage.id);
    if (index === undefined || index === -1) return undefined;
    const nextIndex = index + direction;
    const nextMessageId = messageMediaIds![nextIndex];
    const nextMessage = chatMessages?.[nextMessageId];
    if (nextMessage) {
      return { type: 'message', message: nextMessage };
    }

    return undefined;
  });

  const openMediaViewerItem = useLastCallback((item?: MediaViewerItem) => {
    if (!item) {
      handleClose();
      return;
    }

    const itemChatId = item.type === 'avatar'
      ? item.avatarOwner.id : item.type === 'message'
        ? item.message.chatId : undefined;
    const itemMessageId = item.type === 'message' ? item.message.id : undefined;
    const itemStandaloneMedia = item.type === 'standalone' ? item.media : undefined;

    openMediaViewer({
      origin: origin!,
      chatId: itemChatId,
      messageId: itemMessageId,
      standaloneMedia: itemStandaloneMedia,
      mediaIndex: item.mediaIndex,
      isAvatarView: item.type === 'avatar',
      withDynamicLoading,
    }, {
      forceOnHeavyAnimation: true,
    });
  });

  const handleBeforeDelete = useLastCallback(() => {
    const mediaCount = profilePhotos?.photos.length
      || standaloneMedia?.length || messageMediaIds?.length || 0;
    if (mediaCount <= 1 || !currentItem) {
      handleClose();
      return;
    }
    // Before deleting, select previous media
    const prevMedia = getNextItem(currentItem, -1);
    if (prevMedia) {
      openMediaViewerItem(prevMedia);
      return;
    }

    if ((currentItem.type === 'avatar' && isUserId(currentItem.avatarOwner.id)) || currentItem.type === 'standalone') {
      // Keep current item, it'll update when indexes shift
      return;
    }

    handleClose();
  });

  const lang = useOldLang();

  return (
    <ShowTransition
      id="MediaViewer"
      isOpen={isOpen}
      isHidden={isHidden}
      shouldAnimateFirstRender
      noCloseTransition={shouldSkipHistoryAnimations}
    >
      <div
        className="media-viewer-head"
        dir={lang.isRtl ? 'rtl' : undefined}
        data-tauri-drag-region={IS_TAURI && IS_MAC_OS ? true : undefined}
      >
        {isMobile && (
          <Button
            className="media-viewer-close"
            round
            size="smaller"
            color="translucent-white"
            ariaLabel={lang('Close')}
            onClick={handleClose}
          >
            <Icon name="close" />
          </Button>
        )}
        <Transition activeKey={animationKey.current!} name={headerAnimation}>
          <SenderInfo
            key={media?.id}
            item={currentItem}
          />
        </Transition>
        <MediaViewerActions
          mediaData={bestData}
          isVideo={isVideo}
          item={currentItem}
          canUpdateMedia={canUpdateMedia}
          canReportAvatar={canReportAvatar}
          onBeforeDelete={handleBeforeDelete}
          onReportAvatar={openReportAvatarModal}
          onCloseMediaViewer={handleClose}
          onForward={handleForward}
        />
        <ReportAvatarModal
          isOpen={isReportAvatarModalOpen}
          onClose={closeReportAvatarModal}
          photo={avatar}
          peerId={avatarOwner?.id}
        />
      </div>
      <MediaViewerSlides
        item={currentItem}
        loadMoreItemsIfNeeded={loadMoreItemsIfNeeded}
        isLoadingMoreMedia={isLoadingMoreMedia}
        isSynced={isSynced}
        getNextItem={getNextItem}
        chatId={chatId}
        isPhoto={isPhoto}
        isGif={isGif}
        threadId={threadId}
        avatarOwnerId={avatarOwner?.id}
        origin={origin}
        isOpen={isOpen}
        hasFooter={hasFooter}
        isVideo={isVideo}
        withAnimation={withAnimation}
        onClose={handleClose}
        selectItem={openMediaViewerItem}
        isHidden={isHidden}
        onFooterClick={handleFooterClick}
        handleSponsoredClick={handleSponsoredClick}
      />
    </ShowTransition>
  );
};

export default memo(withGlobal(
  (global): Complete<StateProps> => {
    const { mediaViewer, shouldSkipHistoryAnimations } = selectTabState(global);
    const {
      chatId,
      threadId,
      messageId,
      origin,
      isHidden,
      withDynamicLoading,
      standaloneMedia,
      mediaIndex,
      isAvatarView,
      isSponsoredMessage,
    } = mediaViewer;
    const withAnimation = selectPerformanceSettingsValue(global, 'mediaViewerAnimations');

    const { currentUserId, isSynced } = global;
    const isChatWithSelf = Boolean(chatId) && selectIsChatWithSelf(global, chatId);

    if (isAvatarView) {
      const avatarOwner = selectPeer(global, chatId!);
      let canUpdateMedia = false;
      if (avatarOwner) {
        canUpdateMedia = isUserId(avatarOwner.id)
          ? avatarOwner.id === currentUserId : isChatAdmin(avatarOwner as ApiChat);
      }

      const profilePhotos = selectPeerPhotos(global, chatId!);

      const currentItem = getMediaViewerItem({
        avatarOwner, standaloneMedia, profilePhotos, mediaIndex,
      });
      const viewableMedia = selectViewableMedia(global, origin, currentItem);

      return {
        profilePhotos,
        avatar: profilePhotos?.photos[mediaIndex!],
        avatarOwner,
        isLoadingMoreMedia: profilePhotos?.isLoading,
        isChatWithSelf,
        canUpdateMedia,
        withAnimation,
        origin,
        shouldSkipHistoryAnimations,
        isHidden,
        standaloneMedia,
        mediaIndex,
        isSynced,
        currentItem,
        viewableMedia,
        chatId,
        threadId,
        messageId,
        message: undefined,
        collectedMessageIds: undefined,
        chatMessages: undefined,
        sponsoredMessage: undefined,
        withDynamicLoading,
      };
    }

    let message: ApiMessage | undefined;
    if (chatId && messageId) {
      if (origin && [MediaViewerOrigin.ScheduledAlbum, MediaViewerOrigin.ScheduledInline].includes(origin)) {
        message = selectScheduledMessage(global, chatId, messageId);
      } else {
        message = selectChatMessage(global, chatId, messageId);
      }
    }

    let sponsoredMessage: ApiSponsoredMessage | undefined;
    if (isSponsoredMessage && chatId) {
      if (origin === MediaViewerOrigin.SponsoredMessage) {
        sponsoredMessage = selectSponsoredMessage(global, chatId);
      }
    }

    const currentItem = getMediaViewerItem({
      message, standaloneMedia, mediaIndex, sponsoredMessage,
    });
    const viewableMedia = selectViewableMedia(global, origin, currentItem);

    let chatMessages: Record<number, ApiMessage> | undefined;

    if (chatId) {
      if (origin && [MediaViewerOrigin.ScheduledAlbum, MediaViewerOrigin.ScheduledInline].includes(origin)) {
        chatMessages = selectChatScheduledMessages(global, chatId);
      } else {
        chatMessages = selectChatMessages(global, chatId);
      }
    }

    let isLoadingMoreMedia = false;
    const isOriginInline = origin === MediaViewerOrigin.Inline;
    const isOriginAlbum = origin === MediaViewerOrigin.Album;
    let collectedMessageIds: number[] | undefined;

    if (chatId && threadId && messageId) {
      if (withDynamicLoading && (isOriginInline || isOriginAlbum)) {
        const currentSearch = selectCurrentChatMediaSearch(global);
        isLoadingMoreMedia = Boolean(currentSearch?.isLoading);
        const { foundIds } = (currentSearch?.currentSegment) || {};
        collectedMessageIds = foundIds;
      } else if (origin === MediaViewerOrigin.SharedMedia) {
        const currentSearch = selectCurrentSharedMediaSearch(global);
        const resultsByType = currentSearch?.resultsByType;
        const contentType = viewableMedia && getMediaSearchType(viewableMedia?.media);
        const { foundIds } = (contentType && resultsByType?.[contentType]) || {};
        collectedMessageIds = foundIds;
      } else if (isOriginInline || isOriginAlbum) {
        const outlyingList = selectOutlyingListByMessageId(global, chatId, threadId, messageId);
        collectedMessageIds = outlyingList || selectListedIds(global, chatId, threadId);
      }
    }

    return {
      chatId,
      threadId,
      messageId,
      isChatWithSelf,
      origin,
      message,
      chatMessages,
      sponsoredMessage,
      collectedMessageIds,
      withAnimation,
      isHidden,
      shouldSkipHistoryAnimations,
      withDynamicLoading,
      standaloneMedia,
      mediaIndex,
      isLoadingMoreMedia,
      isSynced,
      currentItem,
      viewableMedia,
      canUpdateMedia: undefined,
      avatar: undefined,
      avatarOwner: undefined,
      profilePhotos: undefined,
    };
  },
)(MediaViewer));
