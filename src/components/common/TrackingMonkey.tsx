import type { FC } from '../../lib/teact/teact';
import React, { useState, useCallback, memo } from '../../lib/teact/teact';

import { STICKER_SIZE_AUTH, STICKER_SIZE_AUTH_MOBILE, STICKER_SIZE_TWO_FA } from '../../config';
import { IS_SINGLE_COLUMN_LAYOUT } from '../../util/environment';
import { LOCAL_TGS_URLS } from './helpers/animatedAssets';

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
const STICKER_SIZE = IS_SINGLE_COLUMN_LAYOUT ? STICKER_SIZE_AUTH_MOBILE : STICKER_SIZE_AUTH;

const TrackingMonkey: FC<OwnProps> = ({
  code,
  codeLength,
  trackingDirection,
  isTracking,
  isBig,
}) => {
  const [isFirstMonkeyLoaded, setIsFirstMonkeyLoaded] = useState(false);
  const TRACKING_FRAMES_PER_SYMBOL = (TRACKING_END_FRAME - TRACKING_START_FRAME) / codeLength;

  const handleFirstMonkeyLoad = useCallback(() => setIsFirstMonkeyLoaded(true), []);

  function getTrackingFrames(): [number, number] {
    const startFrame = (code && code.length > 1) || trackingDirection < 0
      ? TRACKING_START_FRAME + TRACKING_FRAMES_PER_SYMBOL * (code.length - 1)
      : 0;
    const endFrame = code.length === codeLength
      ? TRACKING_END_FRAME
      : TRACKING_START_FRAME + TRACKING_FRAMES_PER_SYMBOL * code.length;

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
        size={isBig ? STICKER_SIZE_TWO_FA : STICKER_SIZE}
        className={isTracking ? 'hidden' : undefined}
        tgsUrl={LOCAL_TGS_URLS.MonkeyIdle}
        play={!isTracking}
        onLoad={handleFirstMonkeyLoad}
      />
      <AnimatedSticker
        size={isBig ? STICKER_SIZE_TWO_FA : STICKER_SIZE}
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
