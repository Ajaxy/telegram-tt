import React, {
  FC, memo, useEffect, useRef,
} from '../../../lib/teact/teact';
import { getDispatch, withGlobal } from '../../../lib/teact/teactn';

import { ApiSticker } from '../../../api/types';

import { STICKER_SIZE_PICKER } from '../../../config';
import { IS_TOUCH_ENV } from '../../../util/environment';
import buildClassName from '../../../util/buildClassName';
import captureEscKeyListener from '../../../util/captureEscKeyListener';
import { useIntersectionObserver } from '../../../hooks/useIntersectionObserver';
import useShowTransition from '../../../hooks/useShowTransition';
import usePrevious from '../../../hooks/usePrevious';
import useSendMessageAction from '../../../hooks/useSendMessageAction';

import Loading from '../../ui/Loading';
import StickerButton from '../../common/StickerButton';

import './StickerTooltip.scss';

export type OwnProps = {
  chatId: string;
  threadId?: number;
  isOpen: boolean;
  onStickerSelect: (sticker: ApiSticker) => void;
};

type StateProps = {
  stickers?: ApiSticker[];
};

const INTERSECTION_THROTTLE = 200;

const StickerTooltip: FC<OwnProps & StateProps> = ({
  chatId,
  threadId,
  isOpen,
  onStickerSelect,
  stickers,
}) => {
  const { clearStickersForEmoji } = getDispatch();

  // eslint-disable-next-line no-null/no-null
  const containerRef = useRef<HTMLDivElement>(null);
  const { shouldRender, transitionClassNames } = useShowTransition(isOpen, undefined, undefined, false);
  const prevStickers = usePrevious(stickers, true);
  const displayedStickers = stickers || prevStickers;
  const sendMessageAction = useSendMessageAction(chatId, threadId);

  const {
    observe: observeIntersection,
  } = useIntersectionObserver({ rootRef: containerRef, throttleMs: INTERSECTION_THROTTLE });

  useEffect(() => (isOpen ? captureEscKeyListener(clearStickersForEmoji) : undefined), [isOpen, clearStickersForEmoji]);

  const handleMouseEnter = () => {
    document.body.classList.add('no-select');
  };

  const handleMouseMove = () => {
    sendMessageAction({ type: 'chooseSticker' });
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
      onMouseMove={handleMouseMove}
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
)(StickerTooltip));
