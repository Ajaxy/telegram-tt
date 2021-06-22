import React, {
  FC, useState, useEffect, useCallback, memo,
} from '../../lib/teact/teact';

import { STICKER_SIZE_AUTH, STICKER_SIZE_AUTH_MOBILE, STICKER_SIZE_TWO_FA } from '../../config';
import { IS_SINGLE_COLUMN_LAYOUT } from '../../util/environment';
import getAnimationData from './helpers/animatedAssets';

import AnimatedSticker from './AnimatedSticker';

import './PasswordMonkey.scss';

type OwnProps = {
  isPasswordVisible: boolean;
  isBig?: boolean;
};

const PEEK_MONKEY_SHOW_DELAY = 2000;
const SEGMENT_COVER_EYES: [number, number] = [0, 50];
const SEGMENT_UNCOVER_EYE: [number, number] = [0, 20];
const SEGMENT_COVER_EYE: [number, number] = [20, 0];
const STICKER_SIZE = IS_SINGLE_COLUMN_LAYOUT ? STICKER_SIZE_AUTH_MOBILE : STICKER_SIZE_AUTH;

const PasswordMonkey: FC<OwnProps> = ({ isPasswordVisible, isBig }) => {
  const [closeMonkeyData, setCloseMonkeyData] = useState<Record<string, any>>();
  const [peekMonkeyData, setPeekMonkeyData] = useState<Record<string, any>>();
  const [isFirstMonkeyLoaded, setIsFirstMonkeyLoaded] = useState(false);
  const [isPeekShown, setIsPeekShown] = useState(false);

  useEffect(() => {
    if (!closeMonkeyData) {
      getAnimationData('MonkeyClose').then(setCloseMonkeyData);
    } else {
      setTimeout(() => setIsPeekShown(true), PEEK_MONKEY_SHOW_DELAY);
    }
  }, [closeMonkeyData]);

  useEffect(() => {
    if (!peekMonkeyData) {
      getAnimationData('MonkeyPeek').then(setPeekMonkeyData);
    }
  }, [peekMonkeyData]);

  const handleFirstMonkeyLoad = useCallback(() => setIsFirstMonkeyLoaded(true), []);

  return (
    <div id="monkey" className={isBig ? 'big' : ''}>
      {!isFirstMonkeyLoaded && (
        <div className="monkey-preview" />
      )}
      {closeMonkeyData && (
        <AnimatedSticker
          id="closeMonkey"
          size={isBig ? STICKER_SIZE_TWO_FA : STICKER_SIZE}
          className={isPeekShown ? 'hidden' : 'shown'}
          animationData={closeMonkeyData}
          playSegment={SEGMENT_COVER_EYES}
          noLoop
          onLoad={handleFirstMonkeyLoad}
        />
      )}
      {peekMonkeyData && (
        <AnimatedSticker
          id="peekMonkey"
          size={isBig ? STICKER_SIZE_TWO_FA : STICKER_SIZE}
          className={isPeekShown ? 'shown' : 'hidden'}
          animationData={peekMonkeyData}
          playSegment={isPasswordVisible ? SEGMENT_UNCOVER_EYE : SEGMENT_COVER_EYE}
          noLoop
        />
      )}
    </div>
  );
};

export default memo(PasswordMonkey);
