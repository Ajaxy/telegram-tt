import { memo, useEffect, useMemo } from '../../lib/teact/teact';
import { withGlobal } from '../../global';

import type { ApiAttachment, ApiAudio } from '../../api/types';
import type { ThemeKey } from '../../types';

import { getMediaFormat, getMediaHash } from '../../global/helpers';
import { selectTheme } from '../../global/selectors';
import { DRAFT_CAPABILITIES } from '../../global/selectors/audioPlayer';
import { makeDraftTrackKey, peek } from '../../util/audioPlayback/mediaPool';
import { stopTransientTrack } from '../../util/audioPlayback/playbackController';

import useFlag from '../../hooks/useFlag';
import useMedia from '../../hooks/useMedia';
import useUniqueId from '../../hooks/useUniqueId';

import TrackRow from './TrackRow';

type OwnProps = {
  className?: string;
  uploadProgress?: number;
  onCancelUpload?: NoneToVoidFunction;
  onDecodeError?: NoneToVoidFunction;
} & ({
  attachment: ApiAttachment;
  audio?: ApiAudio;
} | {
  attachment?: ApiAttachment;
  audio: ApiAudio;
});

type StateProps = {
  theme: ThemeKey;
};

const AttachmentAudio = ({
  attachment, audio: providedAudio, className, theme, uploadProgress, onCancelUpload, onDecodeError,
}: OwnProps & StateProps) => {
  const draftId = useUniqueId();
  const trackKey = makeDraftTrackKey(attachment?.uniqueId || draftId);
  const [hasStarted, markStarted] = useFlag();
  const existingAudio = attachment ? undefined : providedAudio;
  const mediaData = useMedia(
    existingAudio && getMediaHash(existingAudio, 'inline'), !hasStarted,
    existingAudio ? getMediaFormat(existingAudio, 'inline') : undefined,
  );
  const coverBlobUrl = useMedia(existingAudio && getMediaHash(existingAudio, 'pictogram'));

  const audio = useMemo<ApiAudio>(() => attachment ? ({
    mediaType: 'audio',
    id: attachment.uniqueId,
    size: attachment.size,
    mimeType: attachment.mimeType,
    fileName: attachment.filename,
    duration: attachment.audio?.duration || 0,
    title: attachment.audio?.title,
    performer: attachment.audio?.performer,
  }) : existingAudio!, [attachment, existingAudio]);

  useEffect(() => {
    if (!hasStarted || !onDecodeError) return undefined;

    const element = peek(trackKey);
    if (!element) return undefined;

    if (element.error) {
      onDecodeError();
      return undefined;
    }

    const handleError = () => onDecodeError();
    element.addEventListener('error', handleError);

    return () => element.removeEventListener('error', handleError);
  }, [hasStarted, trackKey, onDecodeError]);

  useEffect(() => {
    return () => stopTransientTrack(trackKey);
  }, [trackKey]);

  return (
    <TrackRow
      theme={theme}
      variant="attachment"
      className={className}
      audio={audio}
      trackKey={trackKey}
      mediaType="audio"
      capabilities={DRAFT_CAPABILITIES}
      src={attachment?.blobUrl || mediaData}
      originalDuration={audio.duration}
      coverBlobUrl={attachment?.previewBlobUrl || coverBlobUrl}
      uploadProgress={uploadProgress}
      onCancelUpload={onCancelUpload}
      onBeforePlay={markStarted}
    />
  );
};

export default memo(withGlobal<OwnProps>(
  (global): Complete<StateProps> => {
    return {
      theme: selectTheme(global),
    };
  },
)(AttachmentAudio));
