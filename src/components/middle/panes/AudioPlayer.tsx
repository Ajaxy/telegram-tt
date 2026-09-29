import type { TeactNode } from '../../../lib/teact/teact';
import { useEffect, useMemo, useRef } from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type {
  ApiAudio, ApiChat, ApiMessage, ApiPeer,
} from '../../../api/types';
import type {
  OrderMode, PlaybackCapabilities, PlaybackItemRef, PlaybackMedia, PlaybackSource, RepeatMode, ThreadId,
} from '../../../types';
import type { IconName } from '../../../types/icons';
import type { TrackKey } from '../../../util/audioPlayback/mediaPool';

import { PLAYBACK_RATE_FOR_AUDIO_MIN_DURATION } from '../../../config';
import {
  getMediaFormat, getMediaHash, hasMessageTtl, isMessageLocal,
} from '../../../global/helpers';
import { getPeerTitle } from '../../../global/helpers/peers';
import {
  selectChat,
  selectSender, selectTabState,
} from '../../../global/selectors';
import {
  getPlaybackCapabilities,
  makeTrackKeyFromItem,
  selectCanGoNext, selectCanGoPrev,
  selectHasPlaybackModes, selectHasPlaylistWindow, selectNextMediaTrackKey, selectNextTrackMedia,
  selectPlaybackMedia,
  selectPlaybackMessage,
  selectPlaybackSource,
} from '../../../global/selectors/audioPlayer';
import { selectMessageMediaDuration } from '../../../global/selectors/media';
import { selectUserSavedMusic } from '../../../global/selectors/users';
import { ensureAudioContext } from '../../../util/audioPlayback/audioAnalyser';
import {
  cancelPlaybackIntent,
  getProgressSignal,
  prefetchTrack,
  refreshMediaSessionHandlers,
  seek as seekPlayback,
  stop as stopPlayback,
  updateTrackCapabilities,
} from '../../../util/audioPlayback/playbackController';
import { IS_IOS, IS_TOUCH_ENV } from '../../../util/browser/windowEnvironment';
import buildClassName from '../../../util/buildClassName';
import * as mediaLoader from '../../../util/mediaLoader';
import { clearMediaSession } from '../../../util/mediaSession';
import { getOrderButtonIcon, ORDER_BUTTON_ICONS } from '../../common/helpers/playbackOrder';
import renderText from '../../common/helpers/renderText';

import useAppLayout from '../../../hooks/useAppLayout';
import useAudioPlayback from '../../../hooks/useAudioPlayback';
import useClickable from '../../../hooks/useClickable';
import useContextMenuHandlers from '../../../hooks/useContextMenuHandlers';
import useEffectWithPrevDeps from '../../../hooks/useEffectWithPrevDeps';
import useFlag from '../../../hooks/useFlag';
import useFrozenProps from '../../../hooks/useFrozenProps';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import useMedia from '../../../hooks/useMedia';
import useMusicListenReporting from '../../../hooks/useMusicListenReporting';
import useTrackMediaMetadata from '../../../hooks/useTrackMediaMetadata';
import useHeaderPane, { type PaneState } from '../hooks/useHeaderPane';

import Icon from '../../common/icons/Icon';
import PlayPauseIcon from '../../common/PlayPauseIcon';
import Button from '../../ui/Button';
import DropdownMenu from '../../ui/DropdownMenu';
import MenuItem from '../../ui/MenuItem';
import MenuSeparator from '../../ui/MenuSeparator';
import RangeSlider from '../../ui/RangeSlider';
import RippleEffect from '../../ui/RippleEffect';
import ShowTransition from '../../ui/ShowTransition';
import Transition from '../../ui/Transition';
import PlayerSeekLine from './PlayerSeekLine';
import PlayerTime from './PlayerTime';

import styles from './AudioPlayer.module.scss';

type OwnProps = {
  className?: string;
  isIsland?: boolean;
  noUi?: boolean;
  isCompact?: boolean;
  isHidden?: boolean;
  onPaneStateChange?: (state: PaneState) => void;
};

type StateProps = {
  message?: ApiMessage;
  media?: PlaybackMedia;
  item?: PlaybackItemRef;
  capabilities?: PlaybackCapabilities;
  sender?: ApiPeer;
  chat?: ApiChat;
  mediaDuration?: number;
  volume: number;
  playbackRate: number;
  isPlaybackRateActive?: boolean;
  isMuted: boolean;
  nextTrackMedia?: PlaybackMedia;
  nextTrackKey?: TrackKey;
  repeatMode: RepeatMode;
  orderMode: OrderMode;
  canGoNext: boolean;
  canGoPrev: boolean;
  hasPlaylistWindow: boolean;
  isSynced?: boolean;
  isPlayerOpen: boolean;
  playbackSource?: PlaybackSource;
  hasPlaybackModes: boolean;
  savedMusicById?: Record<string, true>;
  isSavedMusicLoading?: boolean;
  hasPendingSavedMusicStep: boolean;
  isSavedMusicListLoading?: boolean;
  savedMusicListLength?: number;
  timestamp?: number;
  threadId?: ThreadId;
};

const PLAYBACK_RATES: Record<number, number> = {
  0.5: 0.66,
  0.75: 0.8,
  1: 1,
  1.5: 1.4,
  2: 1.8,
};
const PLAYBACK_RATE_VALUES = Object.keys(PLAYBACK_RATES).sort().map(Number);

const PLAY_PAUSE_ICON_SIZE = 32;
const REGULAR_PLAYBACK_RATE = 1;
const DEFAULT_FAST_PLAYBACK_RATE = 2;

const AudioPlayer = ({
  message,
  media,
  item,
  capabilities,
  mediaDuration,
  className,
  isIsland,
  noUi,
  isHidden,
  isCompact,
  sender,
  chat,
  volume,
  playbackRate,
  isPlaybackRateActive,
  isMuted,
  nextTrackMedia,
  nextTrackKey,
  repeatMode,
  orderMode,
  canGoNext,
  canGoPrev,
  hasPlaylistWindow,
  isSynced,
  isPlayerOpen,
  playbackSource,
  hasPlaybackModes,
  savedMusicById,
  isSavedMusicLoading,
  hasPendingSavedMusicStep,
  isSavedMusicListLoading,
  savedMusicListLength,
  timestamp,
  threadId,
  onPaneStateChange,
}: OwnProps & StateProps) => {
  const {
    setAudioPlayerVolume,
    setAudioPlayerPlaybackRate,
    setAudioPlayerMuted,
    loadSavedMusicIds,
    toggleMusicInProfile,
    openBrowserTab,
    focusMessage,
    closeAudioPlayer,
    playNextTrack,
    playPreviousTrack,
    setAudioPlayerRepeatMode,
    setAudioPlayerOrderMode,
    openAudioPlaylistModal,
    searchChatMediaMessages,
    settlePendingPlaylistStep,
  } = getActions();

  const lang = useLang();

  const { isMobile } = useAppLayout();

  const isOpen = Boolean(message || media);
  const {
    message: renderingMessage,
    media: renderingMedia,
    item: renderingItem,
    sender: renderingSender,
    chat: renderingChat,
  } = useFrozenProps({
    message, media, item, sender, chat,
  }, !isOpen);

  const audio = renderingMedia?.mediaType === 'audio' ? renderingMedia : undefined;
  const isLocalMessage = Boolean(message && isMessageLocal(message));
  const isVoice = renderingMedia?.mediaType === 'voice' || renderingMedia?.mediaType === 'video';
  const isMusicSaved = Boolean(audio && savedMusicById?.[audio.id]);
  const shouldRenderPlaybackButton = isVoice || (audio?.duration || 0) > PLAYBACK_RATE_FOR_AUDIO_MIN_DURATION;
  const senderName = renderingSender ? getPeerTitle(lang, renderingSender) : undefined;

  const mediaHash = renderingMedia && getMediaHash(renderingMedia, 'inline');
  const mediaFormat = renderingMedia && getMediaFormat(renderingMedia, 'inline');
  const mediaData = useMedia(mediaHash, false, mediaFormat);
  const currentTrackKey = !isHidden && item ? makeTrackKeyFromItem(item) : undefined;

  useEffect(() => {
    if (!noUi || !currentTrackKey || !capabilities) return;
    updateTrackCapabilities(currentTrackKey, capabilities);
  }, [noUi, currentTrackKey, capabilities]);

  useEffect(() => {
    if (!noUi || !currentTrackKey || !mediaHash || !mediaFormat || mediaData) return;

    void mediaLoader.fetch(mediaHash, mediaFormat).then((data) => {
      if (!data) cancelPlaybackIntent(currentTrackKey);
    });
  }, [noUi, currentTrackKey, mediaHash, mediaFormat, mediaData]);
  const mediaMetadata = useTrackMediaMetadata({
    audio,
    message: renderingMessage,
    sender: renderingSender,
    chat: renderingChat,
  });

  const nextTrackMediaData = useMedia(
    nextTrackMedia && getMediaHash(nextTrackMedia, 'inline'),
    !nextTrackMedia,
    nextTrackMedia && getMediaFormat(nextTrackMedia, 'inline'),
  );
  useEffect(() => {
    if (!nextTrackKey || !nextTrackMediaData) return undefined;

    return prefetchTrack(nextTrackKey, nextTrackMediaData);
  }, [nextTrackKey, nextTrackMediaData]);

  const {
    playPause,
    isPlaying,
    duration,
    setVolume,
    toggleMuted,
    setPlaybackRate,
    setCurrentTime,
    audioElement,
  } = useAudioPlayback({
    trackKey: currentTrackKey,
    mediaType: isVoice ? 'voice' : 'audio',
    capabilities: capabilities!,
    src: mediaData,
    originalDuration: mediaDuration || 0,
    metadata: mediaMetadata,
    shouldPlay: true,
    noProgressUpdates: true,
  });

  const listenedAudio = noUi && media?.mediaType === 'audio' && !isLocalMessage ? media : undefined;
  useMusicListenReporting(listenedAudio, audioElement);

  const isPane = !noUi;

  const transitionRef = useRef<HTMLDivElement>();

  const { ref, shouldRender } = useHeaderPane({
    isOpen,
    isDisabled: !isPane,
    ref: transitionRef,
    onStateChange: onPaneStateChange,
  });

  const {
    isContextMenuOpen,
    handleBeforeContextMenu, handleContextMenu,
    handleContextMenuClose, handleContextMenuHide,
  } = useContextMenuHandlers(transitionRef, !shouldRender);

  // A plain flag rather than `useContextMenuHandlers`: that hook keeps an anchor position this menu
  // never uses, and a stale anchor silently blocks every reopen
  const [isOrderMenuOpen, openOrderMenu, closeOrderMenu] = useFlag();

  useEffect(() => {
    if (isOpen && audio && !savedMusicById && !isSavedMusicLoading) {
      loadSavedMusicIds();
    }
  }, [isOpen, audio, savedMusicById, isSavedMusicLoading, loadSavedMusicIds]);

  useEffect(() => {
    if (!noUi || !isSynced || hasPlaylistWindow || !message) return;
    const source = playbackSource;
    if (source?.type !== 'chat') return;

    searchChatMediaMessages({
      chatId: source.chatId,
      threadId: source.threadId,
      mediaType: source.mediaType,
      currentMediaMessageId: message.id,
    });
  }, [noUi, isSynced, hasPlaylistWindow, message, playbackSource, searchChatMediaMessages]);

  useEffect(() => {
    if (timestamp) {
      setCurrentTime(timestamp);
    }
  }, [timestamp, setCurrentTime]);

  useEffectWithPrevDeps(([prevIsPlayerOpen]) => {
    if (prevIsPlayerOpen && !isPlayerOpen) {
      stopPlayback();
      clearMediaSession();
    }
  }, [isPlayerOpen]);

  useEffect(() => {
    if (noUi) refreshMediaSessionHandlers();
  }, [noUi, canGoNext, canGoPrev]);

  useEffect(() => {
    if (!noUi || !hasPendingSavedMusicStep || isSavedMusicListLoading) return;

    settlePendingPlaylistStep({ shouldContinue: true });
  }, [noUi, hasPendingSavedMusicStep, isSavedMusicListLoading, savedMusicListLength, settlePendingPlaylistStep]);

  useEffect(() => {
    if (isPlaying && message?.isDeleting) {
      playPause();
    }
  }, [isPlaying, message?.isDeleting, playPause]);

  const handleClick = useLastCallback(() => {
    if (!renderingMessage) {
      if (item?.type === 'instantView') {
        openBrowserTab({ tab: { type: 'instantView', webPageId: item.webPageId } });
        return;
      }
      if (hasPlaybackModes) {
        ensureAudioContext();
        openAudioPlaylistModal();
      }
      return;
    }

    const { chatId, id } = renderingMessage;
    focusMessage({ chatId, threadId, messageId: id });
  });

  const withPlaylistNav = Boolean(playbackSource && playbackSource.type !== 'single');

  const contentClickableProps = useClickable<HTMLDivElement>(handleClick);

  const handleClose = useLastCallback(() => {
    closeAudioPlayer();
  });

  const handleToggleMusicInProfile = useLastCallback(() => {
    toggleMusicInProfile({ audio: audio! });
  });

  const handleVolumeChange = useLastCallback((value: number) => {
    setAudioPlayerVolume({ volume: value / 100 });
    setVolume(value / 100);
  });

  const handleVolumeClick = useLastCallback(() => {
    if (IS_TOUCH_ENV && !IS_IOS) return;
    toggleMuted();
    setAudioPlayerMuted({ isMuted: !isMuted });
  });

  const updatePlaybackRate = useLastCallback((newRate: number, isActive = true) => {
    const rate = PLAYBACK_RATES[newRate];
    const shouldBeActive = newRate !== REGULAR_PLAYBACK_RATE && isActive;
    setAudioPlayerPlaybackRate({ playbackRate: rate, isPlaybackRateActive: shouldBeActive });
    setPlaybackRate(shouldBeActive ? rate : REGULAR_PLAYBACK_RATE);
  });

  const handlePlaybackClick = useLastCallback(() => {
    handleContextMenuClose();
    const oldRate = Number(Object.entries(PLAYBACK_RATES).find(([, rate]) => rate === playbackRate)?.[0])
      || REGULAR_PLAYBACK_RATE;
    const newIsActive = !isPlaybackRateActive;

    updatePlaybackRate(
      newIsActive && oldRate === REGULAR_PLAYBACK_RATE ? DEFAULT_FAST_PLAYBACK_RATE : oldRate,
      newIsActive,
    );
  });

  const PlaybackRateButton = useLastCallback(() => {
    const displayRate = Object.entries(PLAYBACK_RATES).find(([, rate]) => rate === playbackRate)?.[0]
      || REGULAR_PLAYBACK_RATE;
    const text = `${playbackRate === REGULAR_PLAYBACK_RATE ? DEFAULT_FAST_PLAYBACK_RATE : displayRate}Х`;
    return (
      <div className={styles.playbackWrapper}>
        {isContextMenuOpen && <div className={styles.playbackBackdrop} onClick={handleContextMenuClose} />}

        <Button
          round
          className={buildClassName(
            styles.playbackButton, isPlaybackRateActive && styles.applied, isContextMenuOpen && styles.onTop,
          )}
          color="translucent"
          size="smaller"
          ariaLabel={lang('AudioPlaybackRate')}
          ripple={!isMobile}
          onMouseEnter={handleContextMenu}
          onClick={handlePlaybackClick}
          onMouseDown={handleBeforeContextMenu}
          onContextMenu={handleContextMenu}
        >
          <span className={buildClassName(
            styles.playbackButtonInner,
            text.length === 4 && styles.playbackButtonInnerSmall,
            text.length === 5 && styles.playbackButtonInnerTiny,
          )}
          >
            {text}
          </span>
        </Button>
      </div>
    );
  });

  const handlePlayNext = useLastCallback(() => {
    playNextTrack({});
  });

  const handlePlayPrevious = useLastCallback(() => {
    playPreviousTrack();
  });

  const handleOpenPlaylist = useLastCallback(() => {
    ensureAudioContext();
    openAudioPlaylistModal();
  });

  const handleShuffleClick = useLastCallback(() => {
    setAudioPlayerOrderMode({ orderMode: orderMode === 'shuffle' ? 'default' : 'shuffle' });
  });

  const handleReverseClick = useLastCallback(() => {
    setAudioPlayerOrderMode({ orderMode: orderMode === 'reverse' ? 'default' : 'reverse' });
  });

  const handleRepeatListClick = useLastCallback(() => {
    setAudioPlayerRepeatMode({ repeatMode: repeatMode === 'all' ? 'none' : 'all' });
  });

  const handleRepeatSongClick = useLastCallback(() => {
    setAudioPlayerRepeatMode({ repeatMode: repeatMode === 'one' ? 'none' : 'one' });
  });

  const orderIcon = getOrderButtonIcon(orderMode, repeatMode);
  const isOrderApplied = orderMode !== 'default' || repeatMode !== 'none';

  const OrderButton = useLastCallback(() => (
    <div className={styles.orderWrapper}>
      {/* Keeps the menu open while the pointer travels from the button down to it */}
      {isOrderMenuOpen && <div className={styles.orderBackdrop} />}
      <Button
        round
        ripple={!isMobile}
        color="translucent"
        size="smaller"
        className={buildClassName(
          styles.playerButton, styles.modeButton, isOrderApplied && styles.applied, isOrderMenuOpen && styles.onTop,
        )}
        ariaLabel={lang('AudioPlaybackOrder')}
        onClick={IS_TOUCH_ENV ? openOrderMenu : undefined}
        onMouseEnter={openOrderMenu}
      >
        <Transition
          name="fade"
          activeKey={ORDER_BUTTON_ICONS.indexOf(orderIcon)}
          className={styles.orderIcon}
          slideClassName={styles.orderIconSlide}
          shouldCleanup
        >
          <Icon name={orderIcon} />
        </Transition>
      </Button>
    </div>
  ));

  const timeNode = (
    <PlayerTime className={styles.playerTime} duration={duration} getProgress={getProgressSignal()} />
  );

  const volumeIcon: IconName = useMemo(() => {
    if (volume === 0 || isMuted) return 'muted';
    if (volume < 0.3) return 'volume-1';
    if (volume < 0.6) return 'volume-2';
    return 'speaker';
  }, [volume, isMuted]);

  if (noUi || !shouldRender) {
    return undefined;
  }

  if (isCompact) {
    return (
      <div
        className={buildClassName(
          styles.root, styles.fullWidthPlayer, styles.compactPlayer, !isOpen && styles.islandPlayerClosing, className,
        )}
        dir={lang.isRtl ? 'rtl' : undefined}
        ref={ref}
      >
        <Button
          round
          ripple={!isMobile}
          color="translucent"
          size="smaller"
          className={buildClassName('toggle-play', styles.playerButton)}
          onClick={playPause}
          ariaLabel={lang(isPlaying ? 'AudioPause' : 'AudioPlay')}
        >
          <PlayPauseIcon
            size={PLAY_PAUSE_ICON_SIZE}
            isPlaying={isPlaying}
            shouldSkipInitialTransition
            isTransitionDisabled={!isOpen}
          />
        </Button>
        <div className={styles.content} {...contentClickableProps}>
          {audio ? renderAudio(audio, timeNode) : renderVoice(lang('AttachAudio'), senderName)}
          <RippleEffect />
        </div>
        <Button
          round
          className={styles.playerClose}
          color="translucent"
          size="smaller"
          onClick={handleClose}
          ariaLabel={lang('AudioPlayerClose')}
          iconName="close"
        />
        <PlayerSeekLine
          duration={duration}
          getProgress={getProgressSignal()}
          onSeek={seekPlayback}
        />
      </div>
    );
  }

  return (
    <div
      className={buildClassName(
        styles.root,
        styles.fullWidthPlayer,
        isIsland && styles.islandPlayer,
        !isOpen && styles.islandPlayerClosing,
        className,
      )}
      dir={lang.isRtl ? 'rtl' : undefined}
      ref={ref}
    >
      {withPlaylistNav && (
        <Button
          round
          ripple={!isMobile}
          color="translucent"
          size="smaller"
          className={styles.playerButton}
          disabled={!canGoPrev}
          onClick={handlePlayPrevious}
          ariaLabel={lang('AudioPlayerPrevious')}
          iconName="skip-previous"
        />
      )}
      <Button
        round
        ripple={!isMobile}
        color="translucent"
        size="smaller"
        className={buildClassName('toggle-play', styles.playerButton)}
        onClick={playPause}
        ariaLabel={lang(isPlaying ? 'AudioPause' : 'AudioPlay')}
      >
        <PlayPauseIcon
          size={PLAY_PAUSE_ICON_SIZE}
          isPlaying={isPlaying}
          shouldSkipInitialTransition
          isTransitionDisabled={!isOpen}
        />
      </Button>
      {withPlaylistNav && (
        <Button
          round
          ripple={!isMobile}
          color="translucent"
          size="smaller"
          className={styles.playerButton}
          disabled={!canGoNext}
          onClick={handlePlayNext}
          ariaLabel={lang('AudioPlayerNext')}
          iconName="skip-next"
        />
      )}

      <div className={styles.content} {...contentClickableProps}>
        {audio ? renderAudio(audio, timeNode) : renderVoice(lang('AttachAudio'), senderName)}
        <RippleEffect />
      </div>

      <ShowTransition
        isOpen={Boolean(audio && renderingItem?.type !== 'instantView' && !isLocalMessage && savedMusicById)}
        className={styles.profileMusicButtonWrapper}
        shouldAnimateFirstRender
      >
        <Button
          round
          ripple={!isMobile}
          color="translucent"
          size="smaller"
          className={styles.playerButton}
          disabled={isSavedMusicLoading}
          onClick={handleToggleMusicInProfile}
          ariaLabel={lang(isMusicSaved ? 'AudioRemoveFromProfile' : 'AudioAddToProfile')}
        >
          <Icon
            name="add-music"
            className={buildClassName(styles.profileMusicStateIcon, isMusicSaved && styles.stateIconHidden)}
          />
          <Icon
            name="remove-music"
            className={buildClassName(styles.profileMusicStateIcon, !isMusicSaved && styles.stateIconHidden)}
          />
        </Button>
      </ShowTransition>

      {hasPlaybackModes && (
        <Button
          round
          ripple={!isMobile}
          color="translucent"
          size="smaller"
          className={styles.playerButton}
          onClick={handleOpenPlaylist}
          ariaLabel={lang('AudioOpenPlaylist')}
          iconName="list"
        />
      )}

      <div className={styles.volumeButtonWrapper}>
        <Button
          round
          className={styles.playerButton}
          color="translucent"
          size="smaller"
          ariaLabel={lang('AudioVolume')}
          onClick={handleVolumeClick}
          ripple={!isMobile}
          iconName={volumeIcon}
        />

        {!IS_IOS && (
          <div className={styles.volumeSliderWrapper}>
            <div className={styles.volumeSliderSpacer} />
            <div className={styles.volumeSlider}>
              <RangeSlider bold value={isMuted ? 0 : volume * 100} onChange={handleVolumeChange} />
            </div>
          </div>
        )}
      </div>

      {shouldRenderPlaybackButton && (
        <DropdownMenu
          forceOpen={isContextMenuOpen}
          positionX="right"
          positionY="top"
          className={styles.playbackRateMenu}
          trigger={PlaybackRateButton}
          onClose={handleContextMenuClose}
          onHide={handleContextMenuHide}
          onMouseEnterBackdrop={handleContextMenuClose}
        >
          {PLAYBACK_RATE_VALUES.map((rate) => {
            return renderPlaybackRateMenuItem(rate, playbackRate, updatePlaybackRate, isPlaybackRateActive);
          })}
        </DropdownMenu>
      )}

      {hasPlaybackModes && (
        <DropdownMenu
          forceOpen={isOrderMenuOpen}
          positionX="right"
          positionY="top"
          className={styles.orderMenu}
          trigger={OrderButton}
          onClose={closeOrderMenu}
          onMouseEnterBackdrop={closeOrderMenu}
        >
          <MenuItem
            icon="shuffle"
            className={orderMode === 'shuffle' ? styles.menuItemSelected : undefined}
            onClick={handleShuffleClick}
          >
            {lang('AudioShuffleList')}
          </MenuItem>
          <MenuItem
            icon="order"
            className={orderMode === 'reverse' ? styles.menuItemSelected : undefined}
            onClick={handleReverseClick}
          >
            {lang('AudioReverseOrder')}
          </MenuItem>
          <MenuSeparator />
          <MenuItem
            icon="repeat"
            className={repeatMode === 'all' ? styles.menuItemSelected : undefined}
            onClick={handleRepeatListClick}
          >
            {lang('AudioRepeatList')}
          </MenuItem>
          <MenuItem
            icon="repeat-one"
            className={repeatMode === 'one' ? styles.menuItemSelected : undefined}
            onClick={handleRepeatSongClick}
          >
            {lang('AudioRepeatSong')}
          </MenuItem>
        </DropdownMenu>
      )}

      <Button
        round
        className={styles.playerClose}
        color="translucent"
        size="smaller"
        onClick={handleClose}
        ariaLabel={lang('AudioPlayerClose')}
        iconName="close"
      />

      <PlayerSeekLine
        duration={duration}
        getProgress={getProgressSignal()}
        onSeek={seekPlayback}
      />
    </div>
  );
};

function renderAudio(audio: ApiAudio, timeNode: TeactNode) {
  const { title, performer, fileName } = audio;

  return (
    <>
      <div className={styles.title} dir="auto">{renderText(title || fileName)}</div>
      <div className={styles.subtitle} dir="auto">
        {timeNode}
        {performer && ' \u2022 '}
        {performer && renderText(performer)}
      </div>
    </>
  );
}

function renderVoice(subtitle: string, senderName?: string) {
  return (
    <>
      <div className={styles.title} dir="auto">{senderName && renderText(senderName)}</div>
      <div className={styles.subtitle} dir="auto">{subtitle}</div>
    </>
  );
}

function renderPlaybackRateMenuItem(
  rate: number, currentRate: number, onClick: (rate: number) => void,
  isPlaybackRateActive?: boolean,
) {
  const isSelected = (currentRate === PLAYBACK_RATES[rate] && isPlaybackRateActive)
    || (rate === REGULAR_PLAYBACK_RATE && !isPlaybackRateActive);
  return (
    <MenuItem
      key={rate}

      onClick={() => onClick(rate)}
      icon={isSelected ? 'check' : undefined}
      customIcon={!isSelected ? <Icon name="placeholder" /> : undefined}
    >
      {rate}
      X
    </MenuItem>
  );
}

export default withGlobal<OwnProps>(
  (global, { isHidden }): Complete<StateProps> => {
    const { audioPlayer } = selectTabState(global);
    const { activeItem: item } = audioPlayer;
    const threadId = item?.type === 'message' ? item.threadId : undefined;
    const message = !isHidden ? selectPlaybackMessage(global, item) : undefined;
    const media = !isHidden ? selectPlaybackMedia(global, item) : undefined;
    const savedMusicList = audioPlayer.source?.type === 'savedMusic'
      ? selectUserSavedMusic(global, audioPlayer.source.peerId)
      : undefined;
    const sender = message && selectSender(global, message);
    const chat = message && selectChat(global, message.chatId);
    const {
      playbackRate, isMuted, isPlaybackRateActive, timestamp,
    } = selectTabState(global).audioPlayer;
    const { volume } = global.audioPlayer;

    const isRichMessageTrack = item?.type === 'message' && Boolean(item.documentId);
    const mediaDuration = message && !isRichMessageTrack
      ? selectMessageMediaDuration(global, message)
      : media?.duration;
    const playbackSource = selectPlaybackSource(global);
    const capabilities = item ? getPlaybackCapabilities(item.type, {
      isViewOnce: message ? hasMessageTtl(message) : undefined,
      isSingle: playbackSource?.type === 'single',
    }) : undefined;

    return {
      message,
      media,
      item,
      sender,
      chat,
      volume,
      playbackRate,
      isPlaybackRateActive,
      isMuted,
      nextTrackMedia: !isHidden ? selectNextTrackMedia(global) : undefined,
      nextTrackKey: !isHidden ? selectNextMediaTrackKey(global) : undefined,
      repeatMode: global.audioPlayer.repeatMode,
      orderMode: global.audioPlayer.orderMode,
      canGoNext: selectCanGoNext(global),
      canGoPrev: selectCanGoPrev(global),
      hasPlaylistWindow: selectHasPlaylistWindow(global),
      isSynced: global.isSynced,
      isPlayerOpen: Boolean(item),
      capabilities,
      playbackSource,
      hasPlaybackModes: selectHasPlaybackModes(global),
      savedMusicById: global.users.savedMusicById,
      isSavedMusicLoading: global.users.isSavedMusicLoading,
      hasPendingSavedMusicStep: Boolean(audioPlayer.pendingStep) && audioPlayer.source?.type === 'savedMusic',
      isSavedMusicListLoading: savedMusicList?.isLoading,
      savedMusicListLength: savedMusicList?.ids.length,
      timestamp,
      threadId,
      mediaDuration,
    };
  },
)(AudioPlayer);
