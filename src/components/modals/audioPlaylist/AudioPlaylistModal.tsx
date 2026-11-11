import { memo, useEffect, useMemo, useRef, useState } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { ApiAudio, ApiPeer } from '../../../api/types';
import type { TabState } from '../../../global/types';
import type { PlaybackItemRef, PlaybackSource, PlaylistKey } from '../../../types';
import { MAIN_THREAD_ID } from '../../../api/types';
import { LoadMoreDirection } from '../../../types';

import { requestMeasure, requestMutation } from '../../../lib/fasterdom/fasterdom';
import { getPeerTitle } from '../../../global/helpers/peers';
import {
  selectChatMessageOrEphemeral, selectIsMessageProtected, selectPeer, selectTabState,
} from '../../../global/selectors';
import {
  selectCurrentPlaylistKey, selectPlaybackItem, selectPlaybackMedia, selectPlaybackSource, selectPlaylistKeys,
  selectRichMessageAudios, selectUpcomingTrackKey,
} from '../../../global/selectors/audioPlayer';
import { selectUserSavedMusic } from '../../../global/selectors/users';
import { ensureAudioContext } from '../../../util/audioPlayback/audioAnalyser';
import { makeMessageTrackKey } from '../../../util/audioPlayback/mediaPool';
import * as playbackController from '../../../util/audioPlayback/playbackController';
import { getState, subscribe } from '../../../util/audioPlayback/playbackController';
import buildClassName from '../../../util/buildClassName';
import { isSearchResultKey, parseSearchResultKey } from '../../../util/keys/searchResultKey';

import useCurrentOrPrev from '../../../hooks/useCurrentOrPrev';
import useForceUpdate from '../../../hooks/useForceUpdate';
import useInfiniteScroll from '../../../hooks/useInfiniteScroll';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import useReorderableList from '../../../hooks/useReorderableList';

import Icon from '../../common/icons/Icon';
import PlayableAudio from '../../common/PlayableAudio';
import ProfileMusic from '../../common/ProfileMusic';
import Island, { IslandTitle } from '../../gili/layout/Island';
import Modal, {
  ModalCloseButton, ModalHeader, ModalHeaderAction, ModalPictureInPictureButton, ModalTitle,
} from '../../gili/modal/Modal';
import InfiniteScroll from '../../ui/InfiniteScroll';
import PlaylistControls from './PlaylistControls';
import PlaylistTrack from './PlaylistTrack';

import styles from './AudioPlaylistModal.module.scss';

const AUDIO_PLAYLIST_PICTURE_IN_PICTURE_ID = 'audio-playlist';
const PICTURE_IN_PICTURE_OPTIONS: DocumentPictureInPictureOptions = { width: 360, height: 400 };
const FULL_QUEUE_MIN_TRACKS = 2;

type QueueLayout = 'full' | 'next' | 'none';

export type OwnProps = {
  modal: TabState['isAudioPlaylistModalOpen'];
};

type StateProps = {
  source?: PlaybackSource;
  chatId?: string;
  messageId?: number;
  currentKey?: PlaylistKey;
  nextKey?: PlaylistKey;
  playlistIds?: readonly PlaylistKey[];
  savedMusicById?: Record<string, ApiAudio>;
  isSavedMusicFullyLoaded?: boolean;
  playlistPeer?: ApiPeer;
  isOwnPlaylist?: boolean;
  isPlaylistLoaded?: boolean;
  isAudioTrack?: boolean;
  isSavedMusicStatusLoaded?: boolean;
  richMessageAudioById?: Record<string, ApiAudio>;
  isRichMessageProtected?: boolean;
};

const AudioPlaylistModal = ({
  modal,
  source,
  chatId,
  messageId,
  currentKey,
  nextKey,
  playlistIds,
  savedMusicById,
  isSavedMusicFullyLoaded,
  playlistPeer,
  isOwnPlaylist,
  isPlaylistLoaded,
  isAudioTrack,
  isSavedMusicStatusLoaded,
  richMessageAudioById,
  isRichMessageProtected,
}: OwnProps & StateProps) => {
  const {
    closeAudioPlaylistModal, openAudioPlayer, searchChatMediaMessages, loadSavedMusic, searchMessagesGlobal,
    reorderSavedMusic, loadSavedMusicIds,
  } = getActions();

  const isOpen = Boolean(modal);

  const scrollRef = useRef<HTMLDivElement>();
  const layoutRef = useRef<HTMLDivElement>();
  const controlsRef = useRef<HTMLDivElement>();
  const queueTitleRef = useRef<HTMLDivElement>();
  const forceUpdate = useForceUpdate();
  const lang = useLang();

  const [queueLayout, setQueueLayout] = useState<QueueLayout>('full');
  // Modal mounts its body after the parent's effects
  layoutRef.onChange = forceUpdate;
  scrollRef.onChange = forceUpdate;

  const [previewOrder, setPreviewOrder] = useState<string[] | undefined>();
  const lastDraggedIdRef = useRef<string | undefined>();

  useEffect(() => subscribe(forceUpdate), [forceUpdate]);
  const { isPlaying, duration } = getState();

  const isChatSource = source?.type === 'chat';

  const displayedIds = useMemo(() => {
    if (!playlistIds) return undefined;
    if (source?.type === 'savedMusic') {
      return playlistIds.filter((id) => typeof id === 'string' && savedMusicById?.[id]);
    }

    return isChatSource ? playlistIds.slice().reverse() : playlistIds.slice();
  }, [playlistIds, isChatSource, source?.type, savedMusicById]);

  const richMessageTracks = useMemo(() => {
    if (source?.type !== 'richMessage' || !richMessageAudioById) return undefined;

    return new Map(Object.values(richMessageAudioById).map((audio) => [audio.id, {
      audio,
      item: {
        type: 'message',
        chatId: source.chatId,
        threadId: source.threadId,
        messageId: source.messageId,
        documentId: audio.id,
      } satisfies PlaybackItemRef,
    }]));
  }, [source, richMessageAudioById]);

  const loadMoreChatTracks = useLastCallback((direction: LoadMoreDirection) => {
    if (source?.type !== 'chat' || messageId === undefined) return;

    searchChatMediaMessages({
      chatId: source.chatId,
      threadId: source.threadId,
      mediaType: source.mediaType,
      currentMediaMessageId: messageId,
      direction,
    });
  });

  const handleLoadMore = useLastCallback(({ offsetId }: { offsetId?: string | number }) => {
    if (source?.type === 'savedMusic') {
      const isBottomEdge = offsetId === undefined || offsetId === displayedIds?.[displayedIds.length - 1];
      if (isBottomEdge && !isSavedMusicFullyLoaded) {
        loadSavedMusic({ userId: source.peerId });
      }
      return;
    }

    if (source?.type === 'globalSearch') {
      searchMessagesGlobal({ type: source.mediaType });
      return;
    }

    loadMoreChatTracks(LoadMoreDirection.Backwards);
  });

  const [viewportIds, getMore] = useInfiniteScroll(
    handleLoadMore, displayedIds, !isOpen, undefined, currentKey,
  );

  const handleScrollLoadMore = useLastCallback((
    { direction, noScroll }: { direction: LoadMoreDirection; noScroll?: boolean },
  ) => {
    getMore?.({ direction, noScroll });

    if (direction === LoadMoreDirection.Forwards) {
      loadMoreChatTracks(LoadMoreDirection.Forwards);
    }
  });

  useEffect(() => {
    if (!isOpen || source?.type !== 'chat' || messageId === undefined) return;

    searchChatMediaMessages({
      chatId: source.chatId,
      threadId: source.threadId,
      mediaType: source.mediaType,
      currentMediaMessageId: messageId,
      direction: LoadMoreDirection.Forwards,
    });
  }, [isOpen, source, messageId, searchChatMediaMessages]);

  useEffect(() => {
    if (!isOpen || source?.type !== 'savedMusic' || isSavedMusicFullyLoaded || playlistIds?.length) return;

    loadSavedMusic({ userId: source.peerId });
  }, [isOpen, source, isSavedMusicFullyLoaded, playlistIds, loadSavedMusic]);

  const hasAudioTrack = isAudioTrack || source?.type === 'savedMusic';

  useEffect(() => {
    if (!isOpen || !hasAudioTrack || isSavedMusicStatusLoaded) return;

    loadSavedMusicIds();
  }, [isOpen, hasAudioTrack, isSavedMusicStatusLoaded, loadSavedMusicIds]);

  const isDataReady = isPlaylistLoaded && (!isAudioTrack || isSavedMusicStatusLoaded);
  // A new source loading keeps the shown modal in place, including picture-in-picture
  const shouldShowModal = Boolean(useCurrentOrPrev(isOpen ? (isDataReady || undefined) : false, true));

  const canReorder = Boolean(isOwnPlaylist && displayedIds && displayedIds.length > 1);

  const reorderableIds = useMemo(() => (
    canReorder ? (previewOrder || (displayedIds as string[])) : undefined
  ), [canReorder, previewOrder, displayedIds]);

  const handleReorder = useLastCallback((ids: string[], movedId?: string) => {
    if (movedId !== undefined) {
      const newIndex = ids.indexOf(movedId);
      reorderSavedMusic({
        audioId: movedId,
        afterAudioId: newIndex > 0 ? ids[newIndex - 1] : undefined,
      });
      return;
    }

    setPreviewOrder(ids);
  });

  const {
    draggedId,
    getRowProps,
    getDragElementProps,
    getHandleProps,
    getPlaceholderStyle,
    getDragStyle,
  } = useReorderableList({
    itemIds: reorderableIds || [],
    isDisabled: !canReorder,
    withAutoscroll: true,
    onReorder: handleReorder,
  });

  useEffect(() => {
    if (draggedId !== undefined) {
      lastDraggedIdRef.current = draggedId;
      return;
    }

    const movedId = lastDraggedIdRef.current;
    lastDraggedIdRef.current = undefined;
    if (!movedId || !previewOrder) return;

    setPreviewOrder(undefined);

    const newIndex = previewOrder.indexOf(movedId);
    if (newIndex < 0 || newIndex === displayedIds?.indexOf(movedId)) return;

    reorderSavedMusic({
      audioId: movedId,
      afterAudioId: newIndex > 0 ? previewOrder[newIndex - 1] : undefined,
    });
  }, [draggedId, previewOrder, displayedIds, reorderSavedMusic]);

  const handleTrackClick = useLastCallback((trackMessageId: number, trackChatId: string) => {
    if (source?.type === 'chat') {
      playbackController.prepareTrackSwitch(makeMessageTrackKey(source.chatId, trackMessageId));
      openAudioPlayer({
        item: {
          type: 'message', chatId: source.chatId, threadId: source.threadId, messageId: trackMessageId,
        },
      });
      return;
    }

    if (source?.type === 'globalSearch') {
      playbackController.prepareTrackSwitch(makeMessageTrackKey(trackChatId, trackMessageId));
      openAudioPlayer({
        item: {
          type: 'message', chatId: trackChatId, threadId: MAIN_THREAD_ID, messageId: trackMessageId,
        },
      });
    }
  });

  function renderMessageTrack(trackId: PlaylistKey) {
    const parsedKey = isSearchResultKey(trackId) ? parseSearchResultKey(trackId) : undefined;
    const trackChatId = parsedKey ? parsedKey[0] : chatId;
    const trackMessageId = parsedKey ? parsedKey[1] : trackId;
    if (!trackChatId || typeof trackMessageId !== 'number') return undefined;

    return (
      <PlaylistTrack
        chatId={trackChatId}
        messageId={trackMessageId}
        threadId={source?.type === 'chat' ? source.threadId : undefined}
        playbackSource={source!}
        onPlay={handleTrackClick}
      />
    );
  }

  function renderRichMessageTrack(trackId: PlaylistKey) {
    const track = typeof trackId === 'string' ? richMessageTracks?.get(trackId) : undefined;
    if (!track || source?.type !== 'richMessage') return undefined;

    return (
      <PlayableAudio
        audio={track.audio}
        item={track.item}
        source={source}
        variant="sharedMedia"
        noProgress
        withPlayingRing
        canDownload={!isRichMessageProtected}
      />
    );
  }

  function renderSavedMusicTrack(trackId: PlaylistKey) {
    if (source?.type !== 'savedMusic') return undefined;

    const trackAudio = typeof trackId === 'string' ? savedMusicById?.[trackId] : undefined;
    if (!trackAudio) return undefined;

    return (
      <ProfileMusic
        audio={trackAudio}
        peerId={source.peerId}
        noProgress
        withPlayingRing
      />
    );
  }

  const handlePlayPause = useLastCallback(() => {
    ensureAudioContext();
    playbackController.togglePlayPause();
  });

  const revealedForRef = useRef<PlaylistKey>();
  const revealCurrentTrack = useLastCallback(() => {
    if (!shouldShowModal || currentKey === undefined) {
      revealedForRef.current = undefined;
      return;
    }
    if (revealedForRef.current === currentKey || !viewportIds) return;

    const list = scrollRef.current;
    const element = list?.querySelector<HTMLElement>(`[data-track-id="${currentKey}"]`);
    if (!list || !element) return;

    requestMeasure(() => {
      if (!list.clientHeight) return;

      revealedForRef.current = currentKey;
      const listRect = list.getBoundingClientRect();
      const elementRect = element.getBoundingClientRect();
      const scrollTop = list.scrollTop + elementRect.top - listRect.top - (listRect.height - elementRect.height) / 2;

      requestMutation(() => {
        list.scrollTop = scrollTop;
      });
    });
  });
  useEffect(revealCurrentTrack, [shouldShowModal, currentKey, viewportIds, revealCurrentTrack]);

  function renderTrack(trackId: PlaylistKey) {
    switch (source?.type) {
      case 'savedMusic':
        return renderSavedMusicTrack(trackId);
      case 'richMessage':
        return renderRichMessageTrack(trackId);
      default:
        return renderMessageTrack(trackId);
    }
  }

  const hasList = Boolean(displayedIds && displayedIds.length > 1);

  const updateQueueLayout = useLastCallback(() => {
    revealCurrentTrack();

    requestMeasure(() => {
      const layout = layoutRef.current;
      const controls = controlsRef.current;
      if (!layout || !controls) return;

      const list = scrollRef.current;
      const row = list?.firstElementChild;
      const nextRow = row?.nextElementSibling;
      if (!list || !row || !nextRow) {
        setQueueLayout('none');
        return;
      }

      const ownerWindow = layout.ownerDocument.defaultView!;
      const layoutStyle = ownerWindow.getComputedStyle(layout);
      const listStyle = ownerWindow.getComputedStyle(list);
      const titleStyle = ownerWindow.getComputedStyle(queueTitleRef.current!);
      const queueStyle = ownerWindow.getComputedStyle(queueTitleRef.current!.parentElement!);
      const maxHeight = parseFloat(layoutStyle.maxHeight);
      const availableHeight = (Number.isNaN(maxHeight) ? layout.clientHeight : maxHeight)
        - parseFloat(layoutStyle.paddingTop) - parseFloat(layoutStyle.paddingBottom)
        - controls.offsetHeight - parseFloat(layoutStyle.rowGap);
      const rowHeight = parseFloat(ownerWindow.getComputedStyle(row).height);
      const rowGap = parseFloat(ownerWindow.getComputedStyle(nextRow).marginTop);
      const listPadding = parseFloat(listStyle.paddingTop) + parseFloat(listStyle.paddingBottom);
      const headingHeight = parseFloat(titleStyle.lineHeight) + parseFloat(queueStyle.rowGap);
      const nextHeight = rowHeight + listPadding + headingHeight;
      const fullHeight = rowHeight * FULL_QUEUE_MIN_TRACKS + rowGap + listPadding
        + (ownerWindow.matchMedia('(display-mode: picture-in-picture)').matches ? headingHeight : 0);

      setQueueLayout(availableHeight >= fullHeight ? 'full'
        : availableHeight >= nextHeight && nextKey !== undefined ? 'next' : 'none');
    });
  });

  // Observers run with their window's rendering, which pauses for a hidden opener while picture-in-picture is shown
  const [layoutWindow, setLayoutWindow] = useState<Window & typeof globalThis>();
  const handleAdopt = useLastCallback(() => {
    setLayoutWindow(layoutRef.current?.ownerDocument.defaultView || undefined);
  });

  const hasLayout = Boolean(layoutRef.current);
  const hasScroll = Boolean(scrollRef.current);
  useEffect(() => {
    if (!hasLayout || !layoutWindow) return undefined;

    const observer = new layoutWindow.ResizeObserver(updateQueueLayout);
    observer.observe(layoutRef.current!);
    observer.observe(controlsRef.current!);
    if (hasScroll) observer.observe(scrollRef.current!);
    layoutWindow.addEventListener('resize', updateQueueLayout);

    return () => {
      observer.disconnect();
      layoutWindow.removeEventListener('resize', updateQueueLayout);
    };
  }, [hasLayout, hasScroll, layoutWindow, updateQueueLayout]);
  useEffect(updateQueueLayout, [viewportIds, nextKey, updateQueueLayout]);

  const title = source?.type === 'savedMusic'
    ? (isOwnPlaylist
      ? lang('PlaylistYourTitle')
      : lang('PlaylistTitle', { peer: playlistPeer ? getPeerTitle(lang, playlistPeer) : '' }))
    : lang('Playlist');

  function renderSortableTracks() {
    const windowIds = new Set(viewportIds);
    // The dragged row stays rendered even when the viewport window moves past it,
    // otherwise its placeholder and drag element unmount mid-drag and the drop is lost
    const renderedIds = reorderableIds!.filter((id) => windowIds.has(id) || id === draggedId);

    return renderedIds.map((id) => {
      const rowProps = getRowProps(id);
      const handleProps = getHandleProps(id);
      const dragElementProps = getDragElementProps(id);

      return (
        <div
          key={id}
          ref={rowProps.ref}
          className={buildClassName(
            styles.trackRow,
            id === currentKey && styles.activeTrackRow,
            'scroll-item',
          )}
          style={getPlaceholderStyle(id)}
          data-track-id={id}
        >
          <div
            ref={dragElementProps.ref}
            style={getDragStyle(id)}
            className={buildClassName(styles.reorderRow, draggedId === id && styles.draggedRow)}
          >
            {renderSavedMusicTrack(id)}
            <div
              ref={handleProps.ref}
              className={styles.dragHandle}
              role={handleProps.role}
              tabIndex={handleProps.tabIndex}
              aria-label={lang('DragToSortAria')}
              onMouseDown={handleProps.onMouseDown}
              onTouchStart={handleProps.onTouchStart}
              onKeyDown={handleProps.onKeyDown}
            >
              <Icon name="hamburger" className={styles.dragHandleIcon} />
            </div>
          </div>
        </div>
      );
    });
  }

  return (
    <Modal
      isOpen={shouldShowModal}
      dialogClassName={styles.modal}
      contentClassName={styles.content}
      height="auto"
      noScrollable
      noContentInlinePadding
      pictureInPictureId={AUDIO_PLAYLIST_PICTURE_IN_PICTURE_ID}
      pictureInPictureOptions={PICTURE_IN_PICTURE_OPTIONS}
      noHeaderInPictureInPicture
      ariaLabel={title}
      header={(
        <ModalHeader noMask>
          <ModalCloseButton />
          <ModalTitle>{title}</ModalTitle>
          <ModalHeaderAction>
            <ModalPictureInPictureButton />
          </ModalHeaderAction>
        </ModalHeader>
      )}
      onClose={closeAudioPlaylistModal}
      onAdopt={handleAdopt}
    >
      <div
        ref={layoutRef}
        className={buildClassName(
          styles.layout,
          queueLayout === 'next' && styles.compactQueue,
          queueLayout === 'none' && styles.noQueue,
        )}
      >
        {hasList && (
          <div
            className={styles.listContainer}
            style={`--playlist-track-count: ${viewportIds?.length || displayedIds!.length};`}
          >
            <div className={styles.queue}>
              <IslandTitle ref={queueTitleRef} className={styles.queueTitle}>
                {queueLayout === 'next' ? lang('AudioUpNext') : title}
              </IslandTitle>
              <Island className={styles.listIsland}>
                <InfiniteScroll
                  ref={scrollRef}
                  items={viewportIds}
                  itemSelector=".scroll-item"
                  onLoadMore={handleScrollLoadMore}
                  className={buildClassName('custom-scroll', styles.list, styles.fullList)}
                >
                  {canReorder ? renderSortableTracks() : viewportIds?.map((trackId) => (
                    <div
                      key={trackId}
                      className={buildClassName(
                        styles.trackRow,
                        trackId === currentKey && styles.activeTrackRow,
                        'scroll-item',
                      )}
                      data-track-id={trackId}
                    >
                      {renderTrack(trackId)}
                    </div>
                  ))}
                </InfiniteScroll>
                {queueLayout === 'next' && nextKey !== undefined && (
                  <div className={styles.list}>
                    <div className={styles.trackRow} data-track-id={nextKey}>
                      {renderTrack(nextKey)}
                    </div>
                  </div>
                )}
              </Island>
            </div>
          </div>
        )}
        <div ref={controlsRef} className={styles.controlsContainer}>
          <PlaylistControls
            isPlaying={isPlaying}
            duration={duration}
            onPlayPause={handlePlayPause}
            onSeek={playbackController.seek}
          />
        </div>
      </div>
    </Modal>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): Complete<StateProps> => {
    const { activeItem } = selectTabState(global).audioPlayer;
    const chatId = activeItem?.type === 'message' ? activeItem.chatId : undefined;
    const messageId = activeItem?.type === 'message' ? activeItem.messageId : undefined;
    const source = selectPlaybackSource(global);
    const savedMusic = source?.type === 'savedMusic' ? selectUserSavedMusic(global, source.peerId) : undefined;
    const currentMedia = selectPlaybackMedia(global, selectPlaybackItem(global));
    const richMessage = source?.type === 'richMessage'
      ? selectChatMessageOrEphemeral(global, source.chatId, source.messageId) : undefined;

    return {
      source,
      chatId,
      messageId,
      currentKey: selectCurrentPlaylistKey(global),
      nextKey: selectUpcomingTrackKey(global),
      playlistIds: selectPlaylistKeys(global),
      savedMusicById: savedMusic?.byId,
      isSavedMusicFullyLoaded: savedMusic?.isFullyLoaded,
      playlistPeer: source?.type === 'savedMusic' ? selectPeer(global, source.peerId) : undefined,
      isOwnPlaylist: source?.type === 'savedMusic' && source.peerId === global.currentUserId,
      isPlaylistLoaded: source?.type !== 'savedMusic' || Boolean(savedMusic?.isLoaded),
      isAudioTrack: currentMedia?.mediaType === 'audio',
      isSavedMusicStatusLoaded: Boolean(global.users.savedMusicById),
      richMessageAudioById: source?.type === 'richMessage'
        ? selectRichMessageAudios(global, source.chatId, source.messageId)?.byId : undefined,
      isRichMessageProtected: richMessage && selectIsMessageProtected(global, richMessage),
    };
  },
)(AudioPlaylistModal));
