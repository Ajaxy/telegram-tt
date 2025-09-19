import type { FC } from '../../../lib/teact/teact';
import { memo, useEffect, useRef } from '../../../lib/teact/teact';
import { withGlobal } from '../../../global';

import type { ApiSticker } from '../../../api/types';
import type { ThreadId } from '../../../types';

import { STICKER_SIZE_PICKER } from '../../../config';
import { selectIsChatWithSelf, selectIsCurrentUserPremium } from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import captureEscKeyListener from '../../../util/captureEscKeyListener';

import { useIntersectionObserver } from '../../../hooks/useIntersectionObserver';
import usePreviousDeprecated from '../../../hooks/usePreviousDeprecated';
import useSendMessageAction from '../../../hooks/useSendMessageAction';
import useShowTransitionDeprecated from '../../../hooks/useShowTransitionDeprecated';

import StickerButton from '../../common/StickerButton';
import Loading from '../../ui/Loading';

import './StickerTooltip.scss';

export type OwnProps = {
  chatId: string;
  threadId?: ThreadId;
  isOpen: boolean;
  onStickerSelect: (sticker: ApiSticker, isSilent?: boolean, shouldSchedule?: boolean) => void;
  onClose: NoneToVoidFunction;
};

type StateProps = {
  stickers?: ApiSticker[];
  isSavedMessages?: boolean;
  isCurrentUserPremium?: boolean;
};

const INTERSECTION_THROTTLE = 200;

const StickerTooltip: FC<OwnProps & StateProps> = ({
  chatId,
  threadId,
  isOpen,
  onStickerSelect,
  onClose,
  stickers,
  isSavedMessages,
  isCurrentUserPremium,
}) => {
  const containerRef = useRef<HTMLDivElement>();
  const { shouldRender, transitionClassNames } = useShowTransitionDeprecated(isOpen, undefined, undefined, false);
  const prevStickers = usePreviousDeprecated(stickers, true);
  const displayedStickers = stickers || prevStickers;
  const sendMessageAction = useSendMessageAction(chatId, threadId);

  const {
    observe: observeIntersection,
  } = useIntersectionObserver({ rootRef: containerRef, throttleMs: INTERSECTION_THROTTLE });

  useEffect(() => (isOpen ? captureEscKeyListener(onClose) : undefined), [isOpen, onClose]);

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
            onClick={isOpen ? onStickerSelect : undefined}
            clickArg={sticker}
            isSavedMessages={isSavedMessages}
            canViewSet
            isCurrentUserPremium={isCurrentUserPremium}
          />
        ))
      ) : shouldRender ? (
        <Loading />
      ) : undefined}
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { chatId }): Complete<StateProps> => {
    const { stickers } = global.stickers.forEmoji;
    const isSavedMessages = selectIsChatWithSelf(global, chatId);
    const isCurrentUserPremium = selectIsCurrentUserPremium(global);
    return { stickers, isSavedMessages, isCurrentUserPremium };
  },
)(StickerTooltip));
