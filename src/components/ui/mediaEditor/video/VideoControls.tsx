import { memo, useMemo, useRef, useState } from '@teact';

import type { VideoCoverSource, VideoTrim } from '../../../../types/mediaEditor';
import type { Signal } from '../../../../util/signals';

import buildClassName from '../../../../util/buildClassName';
import { REM } from '../../../common/helpers/mediaDimensions';

import useLang from '../../../../hooks/useLang';
import useResizeObserver from '../../../../hooks/useResizeObserver';
import useTimelineFrames from '../hooks/useTimelineFrames';

import Button from '../../Button';
import ShowTransition from '../../ShowTransition';
import CoverMenuButton from './CoverMenuButton';
import TrimTimeline from './TrimTimeline';

import styles from '../MediaEditor.module.scss';

type OwnProps = {
  blob: Blob;
  blobUrl: string;
  aspectRatio: number;
  duration: number;
  frameRate: number;
  canDecodeVideo: boolean;
  isHidden?: boolean;
  isDisabled?: boolean;
  trim?: VideoTrim;
  isPlaying: boolean;
  canTrim: boolean;
  maxTrimDuration?: number;
  canMute?: boolean;
  isMuted?: boolean;
  isGif?: boolean;
  canSendAsGif?: boolean;
  canSetCover?: boolean;
  cover?: VideoCoverSource;
  coverThumbUrl?: string;
  avatarCoverTime?: number;
  hint?: string;
  getCurrentTime: Signal<number>;
  onTogglePlay: NoneToVoidFunction;
  onSeek: (time: number) => void;
  onScrubStart: NoneToVoidFunction;
  onScrubEnd: NoneToVoidFunction;
  onTrimPreview: (trim: VideoTrim) => void;
  onTrimCommit: (trim: VideoTrim) => void;
  onToggleMute: NoneToVoidFunction;
  onCoverFileChoose: (file: File) => void;
  onCoverUseCurrentFrame: NoneToVoidFunction;
  onCoverClear: NoneToVoidFunction;
  onAvatarCoverChange: (time: number) => void;
};

const STRIP_HEIGHT = 3 * REM;
const MIN_FRAME_ASPECT = 9 / 16;
const MAX_FRAME_ASPECT = 4 / 3;

function VideoControls({
  blob,
  blobUrl,
  aspectRatio,
  duration,
  frameRate,
  canDecodeVideo,
  isHidden,
  isDisabled,
  trim,
  isPlaying,
  canTrim,
  maxTrimDuration,
  canMute,
  isMuted,
  isGif,
  canSendAsGif,
  canSetCover,
  cover,
  coverThumbUrl,
  avatarCoverTime,
  hint,
  getCurrentTime,
  onTogglePlay,
  onSeek,
  onScrubStart,
  onScrubEnd,
  onTrimPreview,
  onTrimCommit,
  onToggleMute,
  onCoverFileChoose,
  onCoverUseCurrentFrame,
  onCoverClear,
  onAvatarCoverChange,
}: OwnProps) {
  const lang = useLang();
  const stripRef = useRef<HTMLDivElement>();
  const [stripWidth, setStripWidth] = useState(0);

  useResizeObserver(stripRef, (entry) => {
    setStripWidth(entry.contentRect.width);
  });

  const frameWidth = STRIP_HEIGHT * Math.min(Math.max(aspectRatio, MIN_FRAME_ASPECT), MAX_FRAME_ASPECT);
  const count = stripWidth ? Math.ceil(stripWidth / frameWidth) : 0;
  const frameSize = useMemo(() => ({
    width: Math.round(frameWidth * window.devicePixelRatio),
    height: Math.round(STRIP_HEIGHT * window.devicePixelRatio),
  }), [frameWidth]);

  const frames = useTimelineFrames({
    blob, blobUrl, count, frameSize, canDecodeVideo,
  });

  const muteLabelKey = !isMuted ? 'AccActionMute' : canSendAsGif && !isGif ? 'EditorSendAsGif' : 'AccActionUnmute';

  return (
    <div
      className={buildClassName(styles.videoControls, hint && styles.withHint, isHidden && styles.hidden)}
      aria-hidden={isHidden}
      inert={isHidden || isDisabled}
    >
      <Button
        round
        color="translucent"
        size="smaller"
        className={styles.videoButton}
        iconName={isPlaying ? 'pause' : 'play'}
        ariaLabel={lang(isPlaying ? 'AccActionPause' : 'AccActionPlay')}
        onClick={onTogglePlay}
      />
      <div className={styles.timelineColumn}>
        {canSetCover && (
          <CoverMenuButton
            isHidden={isGif}
            coverThumbUrl={coverThumbUrl}
            hasCover={Boolean(cover)}
            onChooseFile={onCoverFileChoose}
            onUseCurrentFrame={onCoverUseCurrentFrame}
            onClear={onCoverClear}
          />
        )}
        <div ref={stripRef} className={styles.timelineWrapper} style={`--frame-width: ${frameWidth}px`}>
          <TrimTimeline
            duration={duration}
            trim={trim}
            frames={frames}
            frameSize={frameSize}
            getCurrentTime={getCurrentTime}
            canTrim={canTrim}
            maxTrimDuration={maxTrimDuration}
            coverTime={avatarCoverTime}
            coverThumbUrl={avatarCoverTime !== undefined ? coverThumbUrl : undefined}
            frameDuration={1 / frameRate}
            onSeek={onSeek}
            onScrubStart={onScrubStart}
            onScrubEnd={onScrubEnd}
            onTrimPreview={onTrimPreview}
            onTrimCommit={onTrimCommit}
            onCoverChange={onAvatarCoverChange}
          />
          {hint && <div className={styles.timelineHint}>{hint}</div>}
        </div>
      </div>
      {canMute && (
        <div className={styles.muteButton}>
          <Button
            round
            color="translucent"
            size="smaller"
            className={styles.videoButton}
            iconName={isMuted ? 'muted' : 'speaker'}
            ariaLabel={lang(muteLabelKey)}
            onClick={onToggleMute}
          />
          <ShowTransition
            isOpen={Boolean(isGif)}
            isCustom
            className={buildClassName(styles.gifBadge, styles.scaleFade)}
          >
            {lang('AttachGif')}
          </ShowTransition>
        </div>
      )}
    </div>
  );
}

export default memo(VideoControls);
