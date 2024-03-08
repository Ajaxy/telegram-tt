import type { FC } from '../../../lib/teact/teact';
import React, {
  memo, useCallback, useEffect, useMemo, useRef, useState,
} from '../../../lib/teact/teact';
import { withGlobal } from '../../../global';

import type { ApiChat, ApiUser } from '../../../api/types';
import type { GroupCallParticipant as TypeGroupCallParticipant } from '../../../lib/secret-sauce';
import type { VideoLayout, VideoParticipant } from './hooks/useGroupCallVideoLayout';

import { GROUP_CALL_DEFAULT_VOLUME } from '../../../config';
import fastBlur from '../../../lib/fastBlur';
import { requestMutation } from '../../../lib/fasterdom/fasterdom';
import { getUserStreams, THRESHOLD } from '../../../lib/secret-sauce';
import { selectChat, selectUser } from '../../../global/selectors';
import { animate } from '../../../util/animation';
import buildClassName from '../../../util/buildClassName';
import { fastRaf } from '../../../util/schedulers';
import { IS_CANVAS_FILTER_SUPPORTED } from '../../../util/windowEnvironment';
import formatGroupCallVolume from './helpers/formatGroupCallVolume';

import useInterval from '../../../hooks/schedulers/useInterval';
import useContextMenuHandlers from '../../../hooks/useContextMenuHandlers';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import useMenuPosition from '../../../hooks/useMenuPosition';

import FullNameTitle from '../../common/FullNameTitle';
import Button from '../../ui/Button';
import Skeleton from '../../ui/placeholder/Skeleton';
import GroupCallParticipantMenu from './GroupCallParticipantMenu';
import OutlinedMicrophoneIcon from './OutlinedMicrophoneIcon';

import styles from './GroupCallParticipantVideo.module.scss';

const BLUR_RADIUS = 2;
const BLUR_ITERATIONS = 2;
const VIDEO_FALLBACK_UPDATE_INTERVAL = 1000;

type OwnProps = {
  layout: VideoLayout;
  setPinned: (participant?: VideoParticipant) => void;
  pinnedVideo: VideoParticipant | undefined;
  canPin: boolean;
  participant: TypeGroupCallParticipant;
  className?: string;
};

type StateProps = {
  user?: ApiUser;
  chat?: ApiChat;
};

const GroupCallParticipantVideo: FC<OwnProps & StateProps> = ({
  layout,
  pinnedVideo,
  setPinned,
  canPin,
  className,
  participant,
  user,
  chat,
}) => {
  const lang = useLang();

  // eslint-disable-next-line no-null/no-null
  const thumbnailRef = useRef<HTMLCanvasElement>(null);
  // eslint-disable-next-line no-null/no-null
  const videoRef = useRef<HTMLVideoElement>(null);
  // eslint-disable-next-line no-null/no-null
  const videoFallbackRef = useRef<HTMLCanvasElement>(null);

  const {
    x, y, width, height, noAnimate, isRemoved,
    type,
  } = layout;
  const {
    isSelf, isMutedByMe, isMuted,
  } = participant;
  const isPinned = pinnedVideo?.id === participant.id && pinnedVideo?.type === type;
  const isSpeaking = (participant.amplitude || 0) > THRESHOLD;
  const isRaiseHand = Boolean(participant.raiseHandRating);
  const shouldFlipVideo = type === 'video' && participant.isSelf;

  const status = useMemo(() => {
    if (isSelf) {
      return lang('ThisIsYou');
    }

    if (isMutedByMe) {
      return lang('VoipGroupMutedForMe');
    }

    if (isRaiseHand) {
      return lang('WantsToSpeak');
    }

    if (isMuted || !isSpeaking) {
      return lang('Listening');
    }

    if (participant.volume && participant.volume !== GROUP_CALL_DEFAULT_VOLUME) {
      return lang('SpeakingWithVolume', formatGroupCallVolume(participant))
        .replace('%%', '%');
    }

    return lang('Speaking');
  }, [isSelf, isMutedByMe, isRaiseHand, isMuted, isSpeaking, participant, lang]);

  const prevLayoutRef = useRef<VideoLayout>();
  if (!isRemoved) {
    prevLayoutRef.current = layout;
  }
  const {
    x: prevX, y: prevY, width: prevWidth, height: prevHeight,
  } = prevLayoutRef.current || {};

  const [currentX, currentY, currentWidth, currentHeight] = isRemoved
    ? [prevX, prevY, prevWidth, prevHeight] : [x, y, width, height];

  const [isHidden, setIsHidden] = useState(!noAnimate);

  const streams = getUserStreams(user?.id || chat!.id);
  const actualStream = type === 'video' ? streams?.video : streams?.presentation;
  const streamRef = useRef(actualStream);
  if (actualStream?.active && actualStream?.getVideoTracks()[0].enabled) {
    streamRef.current = actualStream;
  }
  const stream = streamRef.current;

  const handleInactive = useLastCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    // eslint-disable-next-line no-null/no-null
    video.srcObject = null;
  });

  useEffect(() => {
    stream?.addEventListener('inactive', handleInactive);
    return () => {
      stream?.removeEventListener('inactive', handleInactive);
    };
  }, [handleInactive, stream]);

  useEffect(() => {
    setIsHidden(false);
  }, []);

  const [isLoading, setIsLoading] = useState(true);

  const handleCanPlay = useLastCallback(() => {
    setIsLoading(false);
  });

  // When video stream is removed, the video element starts showing empty black screen.
  // To avoid that, we hide the video element and show the fallback frame instead, which is constantly updated
  // every VIDEO_FALLBACK_UPDATE_INTERVAL milliseconds.
  useInterval(() => {
    if (!stream?.active) return;
    const video = videoRef.current!;
    const canvas = videoFallbackRef.current!;

    requestMutation(() => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d')!.drawImage(video, 0, 0, canvas.width, canvas.height);
    });
  }, VIDEO_FALLBACK_UPDATE_INTERVAL);

  useEffect(() => {
    const video = videoRef.current;
    const thumbnail = thumbnailRef.current;
    if (!video || !thumbnail || !stream) return undefined;

    const ctx = thumbnail.getContext('2d', { alpha: false });
    if (!ctx) return undefined;

    let isDrawing = true;
    requestMutation(() => {
      if (!isDrawing) return;
      thumbnail.width = 16;
      thumbnail.height = 16;
      ctx.filter = 'blur(2px)';

      const draw = () => {
        if (!isDrawing) return false;
        if (!stream.active) {
          return false;
        }
        ctx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight, 0, 0, thumbnail.width, thumbnail.height);
        if (!IS_CANVAS_FILTER_SUPPORTED) {
          fastBlur(ctx, 0, 0, thumbnail.width, thumbnail.height, BLUR_RADIUS, BLUR_ITERATIONS);
        }
        return true;
      };

      animate(draw, fastRaf);
    });

    return () => {
      isDrawing = false;
    };
  }, [stream]);

  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const menuRef = useRef<HTMLDivElement>(null);

  const {
    isContextMenuOpen,
    contextMenuPosition,
    handleContextMenu,
    handleContextMenuClose,
    handleContextMenuHide,
  } = useContextMenuHandlers(ref, isSelf);

  const getTriggerElement = useCallback(() => ref.current, []);

  const getRootElement = useCallback(
    () => ref.current!.closest('.custom-scroll, .no-scrollbar'),
    [],
  );

  const getMenuElement = useCallback(
    () => menuRef.current!,
    [],
  );

  const getLayout = useCallback(
    () => ({ withPortal: true }),
    [],
  );

  const {
    positionX, positionY, transformOriginX, transformOriginY, style: menuStyle,
  } = useMenuPosition(
    contextMenuPosition,
    getTriggerElement,
    getRootElement,
    getMenuElement,
    getLayout,
  );

  const handleClickPin = useCallback(() => {
    setPinned(!isPinned ? {
      id: user?.id || chat!.id,
      type,
    } : undefined);
  }, [chat, isPinned, setPinned, type, user?.id]);

  return (
    <div
      className={buildClassName(
        styles.wrapper,
        (isHidden || isRemoved) && styles.hidden,
        noAnimate && styles.noAnimate,
        className,
        isPinned && styles.pinned,
      )}
      style={`--x: ${currentX}px; --y: ${currentY}px; --width: ${currentWidth}px; --height: ${currentHeight}px;`}
      ref={ref}
      onContextMenu={handleContextMenu}
      onDoubleClick={canPin ? handleClickPin : undefined}
    >
      <div
        className={buildClassName(
          styles.root,
          isSpeaking && styles.speaking,
        )}
      >
        {isLoading && (
          <Skeleton className={buildClassName(styles.video, styles.loader)} />
        )}
        {stream && (
          <video
            className={buildClassName(styles.video, shouldFlipVideo && styles.flipped)}
            muted
            autoPlay
            playsInline
            srcObject={stream}
            ref={videoRef}
            onCanPlay={handleCanPlay}
          />
        )}
        <canvas
          className={buildClassName(styles.videoFallback, shouldFlipVideo && styles.flipped)}
          ref={videoFallbackRef}
        />
        <div className={styles.thumbnailWrapper}>
          <canvas
            className={buildClassName(styles.thumbnail, shouldFlipVideo && styles.flipped)}
            ref={thumbnailRef}
          />
        </div>
        {canPin && (
          <Button
            round
            size="smaller"
            ripple
            color="translucent"
            className={styles.pinButton}
            ariaLabel={lang(isPinned ? 'lng_group_call_context_unpin_camera' : 'lng_group_call_context_pin_camera')}
            onClick={handleClickPin}
          >
            <i className={buildClassName('icon', isPinned ? 'icon-unpin' : 'icon-pin')} />
          </Button>
        )}
        <div className={styles.bottomPanel}>
          <div className={styles.info}>
            <FullNameTitle peer={user || chat!} className={styles.name} />
            <div className={styles.status}>{status}</div>
          </div>
          <OutlinedMicrophoneIcon participant={participant} className={styles.icon} noColor />
        </div>
      </div>

      <GroupCallParticipantMenu
        participant={participant}
        isDropdownOpen={isContextMenuOpen}
        positionX={positionX}
        positionY={positionY}
        transformOriginX={transformOriginX}
        transformOriginY={transformOriginY}
        style={menuStyle}
        onClose={handleContextMenuClose}
        onCloseAnimationEnd={handleContextMenuHide}
        menuRef={menuRef}
      />
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { participant }): StateProps => {
    return {
      user: participant.isUser ? selectUser(global, participant.id) : undefined,
      chat: !participant.isUser ? selectChat(global, participant.id) : undefined,
    };
  },
)(GroupCallParticipantVideo));
