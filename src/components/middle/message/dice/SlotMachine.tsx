import { memo, useRef, useState } from '../../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../../global';

import type { ApiStickerSet } from '../../../../api/types';
import type { OwnProps } from './DiceWrapper';

import { SLOT_MACHINE_EMOJI } from '../../../../config';
import { getStickerMediaHash } from '../../../../global/helpers';
import { selectStickerSet } from '../../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';
import { getStickerDimensions, REM } from '../../../common/helpers/mediaDimensions';
import { prepareSlotMachine } from '../helpers/prepareSlotMachine';

import useAppLayout from '../../../../hooks/useAppLayout';
import useFlag from '../../../../hooks/useFlag';
import { useIsIntersecting } from '../../../../hooks/useIntersectionObserver';
import useLastCallback from '../../../../hooks/useLastCallback';
import useMedia from '../../../../hooks/useMedia';
import useMediaTransition from '../../../../hooks/useMediaTransition';

import AnimatedSticker from '../../../common/AnimatedSticker';

import styles from './Dice.module.scss';

type StateProps = {
  slotsStickerSet?: ApiStickerSet;
  winEffect?: {
    value: number;
    frameStart: number;
  };
};

const FALLBACK_SIZE = 13 * REM;
const STICKER_RENDER_DELAY = 100;
const WIN_BACKGROUND_DELAY = 700;

const SlotMachine = ({
  dice,
  canPlayWinEffect,
  isLocal,
  isOutgoing,
  slotsStickerSet,
  winEffect,
  onEffectPlayed,
  observeIntersectionForLoading,
}: OwnProps & StateProps) => {
  const { requestConfetti, showNotification } = getActions();
  const { isMobile } = useAppLayout();

  const isWin = dice.value === winEffect?.value;
  const shouldSkipToEnd = !canPlayWinEffect && !isLocal;

  const loadedCountRef = useRef(0);
  const [isReady, markReady] = useFlag(!shouldSkipToEnd);

  const [backgroundState, setBackgroundState] = useState<'base' | 'win'>(shouldSkipToEnd && isWin ? 'win' : 'base');
  const [spinState, setSpinState] = useState<'base' | 'result'>(shouldSkipToEnd ? 'result' : 'base');

  const { ref } = useMediaTransition({
    hasMediaData: isReady,
  });

  const canLoad = useIsIntersecting(ref, observeIntersectionForLoading);

  const preparedStickers = slotsStickerSet?.stickers && prepareSlotMachine(slotsStickerSet?.stickers, dice.value);
  const backgroundHash = preparedStickers?.background
    ? getStickerMediaHash(preparedStickers.background, 'full') : undefined;
  const backgroundData = useMedia(backgroundHash, !canLoad);
  const frameWinHash = preparedStickers?.frameWin && isWin
    ? getStickerMediaHash(preparedStickers.frameWin, 'full') : undefined;
  const frameWinData = useMedia(frameWinHash, !canLoad);
  const frameStartHash = preparedStickers?.frameStart
    ? getStickerMediaHash(preparedStickers.frameStart, 'full') : undefined;
  const frameStartData = useMedia(frameStartHash, !canLoad);

  const leftSpinHash = preparedStickers?.leftSpin
    ? getStickerMediaHash(preparedStickers.leftSpin, 'full') : undefined;
  const leftSpinData = useMedia(leftSpinHash, !canLoad);
  const middleSpinHash = preparedStickers?.middleSpin
    ? getStickerMediaHash(preparedStickers.middleSpin, 'full') : undefined;
  const middleSpinData = useMedia(middleSpinHash, !canLoad);
  const rightSpinHash = preparedStickers?.rightSpin
    ? getStickerMediaHash(preparedStickers.rightSpin, 'full') : undefined;
  const rightSpinData = useMedia(rightSpinHash, !canLoad);

  const leftResultHash = preparedStickers?.leftResult
    ? getStickerMediaHash(preparedStickers.leftResult, 'full') : undefined;
  const leftResultData = useMedia(leftResultHash, !canLoad);
  const middleResultHash = preparedStickers?.middleResult
    ? getStickerMediaHash(preparedStickers.middleResult, 'full') : undefined;
  const middleResultData = useMedia(middleResultHash, !canLoad);
  const rightResultHash = preparedStickers?.rightResult
    ? getStickerMediaHash(preparedStickers.rightResult, 'full') : undefined;
  const rightResultData = useMedia(rightResultHash, !canLoad);

  const { width } = preparedStickers ? getStickerDimensions(preparedStickers.background, isMobile)
    : { width: FALLBACK_SIZE };

  const isWaitingForResults = !leftResultData || !middleResultData || !rightResultData;

  const handleLoaded = useLastCallback(() => {
    loadedCountRef.current += 1;
    if (loadedCountRef.current >= 3) {
      setTimeout(() => {
        markReady();
      }, STICKER_RENDER_DELAY);
    }
  });

  const handleSpinEnded = useLastCallback(() => {
    if (isWaitingForResults) return;
    setSpinState('result');
    // Result spin start - too early. Result spin end - too late.
    if (isWin) setTimeout(() => setBackgroundState('win'), WIN_BACKGROUND_DELAY);
  });

  const onWinBackgroundFrame = useLastCallback((frame: number) => {
    if (canPlayWinEffect && isOutgoing && isWin && frame === winEffect?.frameStart) {
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

  function renderSticker(
    tgsUrl: string | undefined,
    isHidden: boolean,
    shouldLoop?: boolean,
    noRenderOnHidden?: boolean,
    onEnded?: NoneToVoidFunction,
    onFrame?: (frame: number) => void,
  ) {
    if (noRenderOnHidden && isHidden) return undefined;
    return (
      <div className={buildClassName(styles.sticker, isHidden && styles.hidden)}>
        <AnimatedSticker
          tgsUrl={tgsUrl}
          size={width}
          play={!isHidden}
          noLoop={!shouldLoop}
          forceAlways
          onEnded={onEnded}
          onFrame={onFrame}
          onLoad={!isHidden ? handleLoaded : undefined}
          seekToEnd={shouldSkipToEnd}
        />
      </div>
    );
  }

  return (
    <div ref={ref} className={styles.root} style={`--_size: ${width}px`} onClick={handleClick}>
      {renderSticker(backgroundData, backgroundState !== 'base', false, true)}
      {renderSticker(frameWinData, backgroundState !== 'win', false, false, undefined, onWinBackgroundFrame)}

      {renderSticker(leftSpinData, spinState !== 'base', isWaitingForResults, true)}
      {renderSticker(middleSpinData, spinState !== 'base', isWaitingForResults, true)}
      {renderSticker(rightSpinData, spinState !== 'base', isWaitingForResults, true, handleSpinEnded)}

      {renderSticker(leftResultData, spinState !== 'result')}
      {renderSticker(middleResultData, spinState !== 'result')}
      {renderSticker(rightResultData, spinState !== 'result')}

      {renderSticker(frameStartData, false)}
    </div>
  );
};

export default memo(withGlobal(
  (global): Complete<StateProps> => {
    const stickerSetId = global.stickers.diceSetIdByEmoji?.[SLOT_MACHINE_EMOJI];
    const slotsStickerSet = stickerSetId ? selectStickerSet(global, stickerSetId) : undefined;
    const winEffect = global.appConfig.diceEmojiesSuccess[SLOT_MACHINE_EMOJI];

    return {
      slotsStickerSet,
      winEffect,
    };
  },
)(SlotMachine));
