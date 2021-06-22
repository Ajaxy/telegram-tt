import React, {
  FC, useState, useEffect, useCallback, memo,
} from '../../lib/teact/teact';

import { STICKER_SIZE_AUTH, STICKER_SIZE_AUTH_MOBILE, STICKER_SIZE_TWO_FA } from '../../config';
import { IS_SINGLE_COLUMN_LAYOUT } from '../../util/environment';
import getAnimationData from './helpers/animatedAssets';

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
  const [idleMonkeyData, setIdleMonkeyData] = useState<Record<string, any>>();
  const [trackingMonkeyData, setTrackingMonkeyData] = useState<Record<string, any>>();
  const [isFirstMonkeyLoaded, setIsFirstMonkeyLoaded] = useState(false);
  const TRACKING_FRAMES_PER_SYMBOL = (TRACKING_END_FRAME - TRACKING_START_FRAME) / codeLength;

  useEffect(() => {
    if (!idleMonkeyData) {
      getAnimationData('MonkeyIdle').then(setIdleMonkeyData);
    }
  }, [idleMonkeyData]);

  useEffect(() => {
    if (!trackingMonkeyData) {
      getAnimationData('MonkeyTracking').then(setTrackingMonkeyData);
    }
  }, [trackingMonkeyData]);

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
      {idleMonkeyData && (
        <AnimatedSticker
          id="idleMonkey"
          size={isBig ? STICKER_SIZE_TWO_FA : STICKER_SIZE}
          className={isTracking ? 'hidden' : undefined}
          animationData={idleMonkeyData}
          play={!isTracking}
          onLoad={handleFirstMonkeyLoad}
        />
      )}
      {trackingMonkeyData && (
        <AnimatedSticker
          id="trackingMonkey"
          size={isBig ? STICKER_SIZE_TWO_FA : STICKER_SIZE}
          className={!isTracking ? 'hidden' : 'shown'}
          animationData={trackingMonkeyData}
          playSegment={isTracking ? getTrackingFrames() : undefined}
          speed={2}
          noLoop
        />
      )}
    </div>
  );
};

export default memo(TrackingMonkey);
