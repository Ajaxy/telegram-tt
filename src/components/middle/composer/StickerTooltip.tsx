import React, {
  FC, memo, useEffect, useRef,
} from '../../../lib/teact/teact';
import { withGlobal } from '../../../lib/teact/teactn';

import { ApiSticker } from '../../../api/types';
import { GlobalActions } from '../../../global/types';

import { STICKER_SIZE_PICKER } from '../../../config';
import { IS_TOUCH_ENV } from '../../../util/environment';
import buildClassName from '../../../util/buildClassName';
import captureEscKeyListener from '../../../util/captureEscKeyListener';
import { pick } from '../../../util/iteratees';
import { useIntersectionObserver } from '../../../hooks/useIntersectionObserver';
import useShowTransition from '../../../hooks/useShowTransition';
import usePrevious from '../../../hooks/usePrevious';

import Loading from '../../ui/Loading';
import StickerButton from '../../common/StickerButton';

import './StickerTooltip.scss';

export type OwnProps = {
  isOpen: boolean;
  onStickerSelect: (sticker: ApiSticker) => void;
};

type StateProps = {
  stickers?: ApiSticker[];
};

type DispatchProps = Pick<GlobalActions, 'clearStickersForEmoji'>;

const INTERSECTION_THROTTLE = 200;

const StickerTooltip: FC<OwnProps & StateProps & DispatchProps> = ({
  isOpen,
  onStickerSelect,
  stickers,
  clearStickersForEmoji,
}) => {
  // eslint-disable-next-line no-null/no-null
  const containerRef = useRef<HTMLDivElement>(null);
  const { shouldRender, transitionClassNames } = useShowTransition(isOpen, undefined, undefined, false);
  const prevStickers = usePrevious(stickers, true);
  const displayedStickers = stickers || prevStickers;

  const {
    observe: observeIntersection,
  } = useIntersectionObserver({ rootRef: containerRef, throttleMs: INTERSECTION_THROTTLE });

  useEffect(() => (isOpen ? captureEscKeyListener(clearStickersForEmoji) : undefined), [isOpen, clearStickersForEmoji]);

  const handleMouseEnter = () => {
    document.body.classList.add('no-select');
  };

  const handleMouseLeave = () => {
    document.body.classList.remove('no-select');
  };

  const className = buildClassName(
    'StickerTooltip composer-tooltip custom-scroll',
    transitionClassNames,
    !(displayedStickers?.length) && 'hidden',
  );

  return (
    <div
      ref={containerRef}
      className={className}
      onMouseEnter={!IS_TOUCH_ENV ? handleMouseEnter : undefined}
      onMouseLeave={!IS_TOUCH_ENV ? handleMouseLeave : undefined}
    >
      {shouldRender && displayedStickers ? (
        displayedStickers.map((sticker) => (
          <StickerButton
            key={sticker.id}
            sticker={sticker}
            size={STICKER_SIZE_PICKER}
            observeIntersection={observeIntersection}
            onClick={onStickerSelect}
            clickArg={sticker}
          />
        ))
      ) : shouldRender ? (
        <Loading />
      ) : undefined}
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    const { stickers } = global.stickers.forEmoji;

    return { stickers };
  },
  (setGlobal, actions): DispatchProps => pick(actions, ['clearStickersForEmoji']),
)(StickerTooltip));
