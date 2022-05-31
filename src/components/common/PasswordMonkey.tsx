import type { FC } from '../../lib/teact/teact';
import React, { useCallback, memo } from '../../lib/teact/teact';

import { STICKER_SIZE_AUTH, STICKER_SIZE_AUTH_MOBILE, STICKER_SIZE_TWO_FA } from '../../config';
import { IS_SINGLE_COLUMN_LAYOUT } from '../../util/environment';
import { LOCAL_TGS_URLS } from './helpers/animatedAssets';

import AnimatedSticker from './AnimatedSticker';

import useTimeout from '../../hooks/useTimeout';
import useFlag from '../../hooks/useFlag';

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
  const [isFirstMonkeyLoaded, markFirstMonkeyLoaded] = useFlag(false);
  const [isPeekShown, markPeekShown] = useFlag(false);

  useTimeout(markPeekShown, PEEK_MONKEY_SHOW_DELAY);
  const handleFirstMonkeyLoad = useCallback(markFirstMonkeyLoaded, [markFirstMonkeyLoaded]);

  return (
    <div id="monkey" className={isBig ? 'big' : ''}>
      {!isFirstMonkeyLoaded && (
        <div className="monkey-preview" />
      )}
      <AnimatedSticker
        size={isBig ? STICKER_SIZE_TWO_FA : STICKER_SIZE}
        className={isPeekShown ? 'hidden' : 'shown'}
        tgsUrl={LOCAL_TGS_URLS.MonkeyClose}
        playSegment={SEGMENT_COVER_EYES}
        noLoop
        onLoad={handleFirstMonkeyLoad}
      />
      <AnimatedSticker
        size={isBig ? STICKER_SIZE_TWO_FA : STICKER_SIZE}
        className={isPeekShown ? 'shown' : 'hidden'}
        tgsUrl={LOCAL_TGS_URLS.MonkeyPeek}
        playSegment={isPasswordVisible ? SEGMENT_UNCOVER_EYE : SEGMENT_COVER_EYE}
        noLoop
      />
    </div>
  );
};

export default memo(PasswordMonkey);
