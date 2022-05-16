import React, {
  FC, memo, useEffect, useRef,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import { ApiSticker } from '../../../api/types';

import { STICKER_SIZE_PICKER } from '../../../config';
import buildClassName from '../../../util/buildClassName';
import captureEscKeyListener from '../../../util/captureEscKeyListener';
import { useIntersectionObserver } from '../../../hooks/useIntersectionObserver';
import useShowTransition from '../../../hooks/useShowTransition';
import usePrevious from '../../../hooks/usePrevious';
import useSendMessageAction from '../../../hooks/useSendMessageAction';
import { selectIsChatWithSelf } from '../../../global/selectors';

import Loading from '../../ui/Loading';
import StickerButton from '../../common/StickerButton';

import './StickerTooltip.scss';

export type OwnProps = {
  chatId: string;
  threadId?: number;
  isOpen: boolean;
  onStickerSelect: (sticker: ApiSticker, isSilent?: boolean, shouldSchedule?: boolean) => void;
};

type StateProps = {
  stickers?: ApiSticker[];
  isSavedMessages?: boolean;
};

const INTERSECTION_THROTTLE = 200;

const StickerTooltip: FC<OwnProps & StateProps> = ({
  chatId,
  threadId,
  isOpen,
  stickers,
  isSavedMessages,
  onStickerSelect,
}) => {
  const { clearStickersForEmoji } = getActions();

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

  const handleMouseMove = () => {
    sendMessageAction({ type: 'chooseSticker' });
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
            isSavedMessages={isSavedMessages}
            canViewSet
          />
        ))
      ) : shouldRender ? (
        <Loading />
      ) : undefined}
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { chatId }): StateProps => {
    const { stickers } = global.stickers.forEmoji;
    const isSavedMessages = selectIsChatWithSelf(global, chatId);

    return { stickers, isSavedMessages };
  },
)(StickerTooltip));
