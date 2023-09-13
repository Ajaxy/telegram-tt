import type { FC } from '../../lib/teact/teact';
import React, { memo, useCallback, useState } from '../../lib/teact/teact';

import { STICKER_SIZE_AUTH, STICKER_SIZE_AUTH_MOBILE, STICKER_SIZE_TWO_FA } from '../../config';
import { LOCAL_TGS_URLS } from './helpers/animatedAssets';

import useAppLayout from '../../hooks/useAppLayout';

import AnimatedSticker from './AnimatedSticker';

import './PasswordMonkey.scss';

type OwnProps = {
  code: string;
  codeLength: number;
  trackingDirection: number;
  isTracking: boolean;
  isBig?: boolean;
};

const TRACKING_START_FRAME = 15;
const TRACKING_END_FRAME = 180;

const TrackingMonkey: FC<OwnProps> = ({
  code,
  codeLength,
  trackingDirection,
  isTracking,
  isBig,
}) => {
  const [isFirstMonkeyLoaded, setIsFirstMonkeyLoaded] = useState(false);
  const { isMobile } = useAppLayout();
  const trackningFramesPerSymbol = (TRACKING_END_FRAME - TRACKING_START_FRAME) / codeLength;
  const stickerSize = isMobile ? STICKER_SIZE_AUTH_MOBILE : STICKER_SIZE_AUTH;

  const handleFirstMonkeyLoad = useCallback(() => setIsFirstMonkeyLoaded(true), []);

  function getTrackingFrames(): [number, number] {
    const startFrame = (code && code.length > 1) || trackingDirection < 0
      ? TRACKING_START_FRAME + trackningFramesPerSymbol * (code.length - 1)
      : 0;
    const endFrame = code.length === codeLength
      ? TRACKING_END_FRAME
      : TRACKING_START_FRAME + trackningFramesPerSymbol * code.length;

    if (trackingDirection < 1) {
      return [
        endFrame,
        startFrame,
      ];
    }

    return [
      startFrame,
      endFrame,
    ];
  }

  return (
    <div id="monkey" className={isBig ? 'big' : ''}>
      {!isFirstMonkeyLoaded && (
        <div className="monkey-preview" />
      )}
      <AnimatedSticker
        size={isBig ? STICKER_SIZE_TWO_FA : stickerSize}
        className={isTracking ? 'hidden' : undefined}
        tgsUrl={LOCAL_TGS_URLS.MonkeyIdle}
        play={!isTracking}
        onLoad={handleFirstMonkeyLoad}
      />
      <AnimatedSticker
        size={isBig ? STICKER_SIZE_TWO_FA : stickerSize}
        className={!isTracking ? 'hidden' : 'shown'}
        tgsUrl={LOCAL_TGS_URLS.MonkeyTracking}
        playSegment={isTracking ? getTrackingFrames() : undefined}
        speed={2}
        noLoop
      />
    </div>
  );
};

export default memo(TrackingMonkey);
