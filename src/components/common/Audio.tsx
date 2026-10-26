import { memo, useMemo } from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { ApiMessage, ApiWebPage } from '../../api/types';
import type {
  AudioVariant, PlaybackMediaType, PlaybackSource, ThemeKey, ThreadId,
} from '../../types';
import type { MenuItemContextAction } from '../ui/ListItem';
import { ApiMediaFormat, MAIN_THREAD_ID } from '../../api/types';

import {
  getMediaFormat,
  getMediaHash,
  getWebPageAudio,
  hasMessageTtl,
  isMessageLocal,
  isOwnMessage,
} from '../../global/helpers';
import { selectWebPageFromMessage } from '../../global/selectors';
import { getPlaybackCapabilities, makeMessageTrackKeyFrom } from '../../global/selectors/audioPlayer';
import { selectMessageMediaDuration } from '../../global/selectors/media';
import { prepareTrackSwitch } from '../../util/audioPlayback/playbackController';

import useLastCallback from '../../hooks/useLastCallback';
import useMedia from '../../hooks/useMedia';
import useMediaWithLoadProgress from '../../hooks/useMediaWithLoadProgress';

import TrackRow from './TrackRow';

type OwnProps = {
  theme: ThemeKey;
  message: ApiMessage;
  senderTitle?: string;
  uploadProgress?: number;
  variant: AudioVariant;
  threadId?: ThreadId;
  isInScheduled?: boolean;
  playbackSource?: PlaybackSource;
  noPlaylist?: boolean;
  noProgress?: boolean;
  withPlayingRing?: boolean;
  date?: number;
  noAvatars?: boolean;
  className?: string;
  isSelectable?: boolean;
  isSelected?: boolean;
  isDownloading?: boolean;
  isTranscribing?: boolean;
  isTranscribed?: boolean;
  canDownload?: boolean;
  canTranscribe?: boolean;
  isTranscriptionHidden?: boolean;
  isTranscriptionError?: boolean;
  autoPlay?: boolean;
  onHideTranscription?: (isHidden: boolean) => void;
  onPlay?: (messageId: number, chatId: string) => void;
  onPause?: NoneToVoidFunction;
  onReadMedia?: () => void;
  onCancelUpload?: () => void;
  onDateClick?: (arg: ApiMessage) => void;
  contextActions?: MenuItemContextAction[];
};

type StateProps = {
  mediaDuration?: number;
  webPage?: ApiWebPage;
};

const SINGLE_SOURCE: PlaybackSource = { type: 'single' };
// This is needed for browsers requiring user interaction before playing.
const PRELOAD = true;

const Audio = ({
  theme,
  message,
  senderTitle,
  uploadProgress,
  variant,
  threadId,
  isInScheduled,
  playbackSource,
  noPlaylist,
  noProgress,
  withPlayingRing,
  date,
  noAvatars,
  className,
  isSelectable,
  isSelected,
  isDownloading,
  isTranscribing,
  isTranscriptionHidden,
  isTranscribed,
  isTranscriptionError,
  canDownload,
  canTranscribe,
  autoPlay,
  webPage,
  mediaDuration,
  onHideTranscription,
  onPlay,
  onPause,
  onReadMedia,
  onCancelUpload,
  onDateClick,
  contextActions,
}: OwnProps & StateProps) => {
  const {
    cancelMediaDownload, downloadMedia, transcribeAudio, openOneTimeMediaModal,
    setAudioPlaybackSource, saveVoiceWaveform,
  } = getActions();

  const {
    content: {
      audio: contentAudio, voice, video,
    }, isMediaUnread,
  } = message;
  const audio = contentAudio || getWebPageAudio(webPage);
  const media = (voice || video || audio)!;
  const mediaSource = (voice || video);
  const isVoice = Boolean(voice || video);
  const hasTtl = hasMessageTtl(message);
  const isInOneTimeModal = variant === 'oneTimeModal';
  const mediaType: PlaybackMediaType = isVoice ? 'voice' : 'audio';
  const isOwn = isOwnMessage(message);
  const isScheduled = isInScheduled || message.isScheduled;
  const trackKey = makeMessageTrackKeyFrom(message, isScheduled);

  const source = useMemo<PlaybackSource>(() => {
    if (playbackSource) return playbackSource;
    if (noPlaylist || hasTtl || isScheduled || variant === 'oneTimeModal' || isMessageLocal(message)) {
      return SINGLE_SOURCE;
    }

    if (variant === 'search') {
      return { type: 'globalSearch', mediaType };
    }

    return {
      type: 'chat', chatId: message.chatId, threadId: threadId ?? MAIN_THREAD_ID, mediaType,
    };
  }, [playbackSource, noPlaylist, hasTtl, isScheduled, variant, message, threadId, mediaType]);

  const capabilities = useMemo(
    () => getPlaybackCapabilities('message', { isViewOnce: hasTtl, isSingle: source.type === 'single' }),
    [hasTtl, source.type],
  );

  const coverHash = getMediaHash(media, 'pictogram');
  const coverBlobUrl = useMedia(coverHash, false, ApiMediaFormat.BlobUrl);

  const mediaData = useMedia(
    getMediaHash(media, 'inline'),
    !PRELOAD,
    getMediaFormat(media, 'inline'),
  );

  const { loadProgress: downloadProgress } = useMediaWithLoadProgress(
    getMediaHash(media, 'download'),
    !isDownloading,
    getMediaFormat(media, 'download'),
  );

  const handleBeforePlay = useLastCallback(() => {
    if (source.type === 'globalSearch') prepareTrackSwitch(trackKey);
    setAudioPlaybackSource({ source });
    onPlay?.(message.id, message.chatId);
  });

  const handleLockedClick = useLastCallback(() => {
    openOneTimeMediaModal({ message });
    onReadMedia?.();
  });

  const handleDownloadClick = useLastCallback(() => {
    if (isDownloading) {
      cancelMediaDownload({ media });
    } else {
      downloadMedia({ media, originMessage: message });
    }
  });

  const handleDateClick = useLastCallback(() => {
    onDateClick!(message);
  });

  const handleTranscribe = useLastCallback(() => {
    transcribeAudio({ chatId: message.chatId, messageId: message.id });
  });

  const handleWaveformGenerated = useLastCallback((waveform: number[]) => {
    // Saving into the message persists the waveform, so it is not generated again after reload
    saveVoiceWaveform({ chatId: message.chatId, messageId: message.id, waveform });
  });

  return (
    <TrackRow
      theme={theme}
      variant={variant}
      className={className}
      audio={audio}
      mediaSource={mediaSource}
      trackKey={trackKey}
      mediaType={mediaType}
      capabilities={capabilities}
      src={mediaData}
      originalDuration={mediaDuration!}
      coverBlobUrl={coverBlobUrl}
      senderTitle={senderTitle}
      date={date}
      isOwn={isOwn}
      isMediaUnread={isMediaUnread}
      isViewOnceLocked={hasTtl && !isInOneTimeModal}
      noProgress={noProgress}
      noProgressUpdates={hasTtl && !isInOneTimeModal}
      withPlayingRing={withPlayingRing}
      noAvatars={noAvatars}
      isSelectable={isSelectable}
      isSelected={isSelected}
      isDownloading={isDownloading}
      canDownload={canDownload}
      uploadProgress={uploadProgress}
      downloadProgress={downloadProgress}
      isTranscribing={isTranscribing}
      isTranscribed={isTranscribed}
      isTranscriptionHidden={isTranscriptionHidden}
      isTranscriptionError={isTranscriptionError}
      autoPlay={autoPlay}
      contextActions={contextActions}
      onBeforePlay={handleBeforePlay}
      onPause={onPause}
      onLockedClick={handleLockedClick}
      onCancelUpload={onCancelUpload}
      onDownloadClick={handleDownloadClick}
      onDateClick={onDateClick ? handleDateClick : undefined}
      onTranscribe={canTranscribe ? handleTranscribe : undefined}
      onHideTranscription={onHideTranscription}
      onListened={hasTtl ? onReadMedia : undefined}
      onWaveformGenerated={handleWaveformGenerated}
    />
  );
};

export default memo(withGlobal<OwnProps>(
  (global, {
    message,
  }): Complete<StateProps> => {
    const webPage = selectWebPageFromMessage(global, message);
    const mediaDuration = selectMessageMediaDuration(global, message);

    return {
      webPage,
      mediaDuration,
    };
  },
)(Audio));
