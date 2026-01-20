import { memo, useRef, useState } from '@teact';
import { getActions, withGlobal } from '../../../../global';

import type { ApiSticker } from '../../../../api/types';
import type { OwnProps } from './DiceWrapper';

import { selectDiceSticker, selectIdleDiceSticker } from '../../../../global/selectors/symbols';
import buildClassName from '../../../../util/buildClassName';
import { getStickerDimensions, REM } from '../../../common/helpers/mediaDimensions';

import useAppLayout from '../../../../hooks/useAppLayout';
import useFlag from '../../../../hooks/useFlag';
import useLastCallback from '../../../../hooks/useLastCallback';

import StickerView from '../../../common/StickerView';

import styles from './Dice.module.scss';

type StateProps = {
  idleSticker?: ApiSticker;
  valueSticker?: ApiSticker;
  winEffect?: {
    value: number;
    frameStart: number;
  };
};

const FALLBACK_SIZE = 13 * REM;

const Dice = ({
  dice,
  idleSticker,
  valueSticker,
  winEffect,
  canPlayWinEffect,
  isLocal,
  isOutgoing,
  onEffectPlayed,
  observeIntersectionForLoading,
  observeIntersectionForPlaying,
}: OwnProps & StateProps) => {
  const { requestConfetti, showNotification } = getActions();
  const { isMobile } = useAppLayout();
  const { width } = idleSticker ? getStickerDimensions(idleSticker, isMobile) : { width: FALLBACK_SIZE };

  const shouldSkipToEnd = !canPlayWinEffect && !isLocal;
  const [isShowingResult, setIsShowingResult] = useState<boolean>(shouldSkipToEnd);
  const [isValueStickerLoaded, markValueStickerLoaded] = useFlag();

  const idleContainerRef = useRef<HTMLDivElement>();
  const valueContainerRef = useRef<HTMLDivElement>();

  const onIdleLoop = useLastCallback(() => {
    setIsShowingResult(isValueStickerLoaded);
  });

  const onValueFrame = useLastCallback((frame: number) => {
    if (canPlayWinEffect && isOutgoing && dice.value === winEffect?.value && frame === winEffect?.frameStart) {
      requestConfetti({});
      onEffectPlayed?.();
    }
  });

  const handleClick = useLastCallback(() => {
    showNotification({
      message: {
        key: 'DiceToast',
        variables: {
          emoji: dice.emoticon,
        },
        options: {
          withNodes: true,
        },
      },
      action: {
        action: 'sendDiceInCurrentChat',
        payload: {
          emoji: dice.emoticon,
        },
      },
      actionText: {
        key: 'DiceToastSend',
      },
    });
  });

  return (
    <div className={styles.root} style={`--_size: ${width}px`} onClick={handleClick}>
      {idleSticker && (
        <div
          ref={idleContainerRef}
          className={buildClassName(styles.sticker, isShowingResult && styles.hidden)}
        >
          <StickerView
            containerRef={idleContainerRef}
            sticker={idleSticker}
            size={width}
            noPlay={isShowingResult}
            shouldLoop
            forceAlways
            skipPreview={isShowingResult}
            onAnimatedStickerLoop={onIdleLoop}
            observeIntersectionForLoading={observeIntersectionForLoading}
            observeIntersectionForPlaying={observeIntersectionForPlaying}
          />
        </div>
      )}
      {valueSticker && (
        <div ref={valueContainerRef} className={buildClassName(styles.sticker, !isShowingResult && styles.hidden)}>
          <StickerView
            containerRef={valueContainerRef}
            sticker={valueSticker}
            size={width}
            noPlay={!isShowingResult}
            skipPreview
            forceAlways
            forceAnimatedStickerOnEnd={shouldSkipToEnd}
            observeIntersectionForLoading={observeIntersectionForLoading}
            observeIntersectionForPlaying={observeIntersectionForPlaying}
            onAnimatedStickerLoad={markValueStickerLoaded}
            onAnimatedStickerFrame={onValueFrame}
          />
        </div>
      )}
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { dice }): Complete<StateProps> => {
    const idleSticker = selectIdleDiceSticker(global, dice.emoticon);
    const valueSticker = selectDiceSticker(global, dice.emoticon, dice.value);

    const winEffect = global.appConfig.diceEmojiesSuccess[dice.emoticon];
    return {
      idleSticker,
      valueSticker,
      winEffect,
    };
  },
)(Dice));
