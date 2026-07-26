import { memo, useRef } from '../../../lib/teact/teact';

import type { ApiSticker } from '../../../api/types';
import type { ThreadId } from '../../../types';

import { STICKER_SIZE_PICKER } from '../../../config';
import buildClassName from '../../../util/buildClassName';

import useFrozenProps from '../../../hooks/useFrozenProps';
import { useIntersectionObserver } from '../../../hooks/useIntersectionObserver';
import useSendMessageAction from '../../../hooks/useSendMessageAction';

import StickerButton from '../StickerButton';
import RichEditorTooltipPanel from './RichEditorTooltipPanel';

import sharedStyles from './RichEditorTooltip.module.scss';
import styles from './StickerTooltip.module.scss';

export type OwnProps = {
  isOpen: boolean;
  chatId: string;
  threadId?: ThreadId;
  stickers?: ApiSticker[];
  isSavedMessages?: boolean;
  isCurrentUserPremium?: boolean;
  onStickerSelect: (sticker: ApiSticker, isSilent?: boolean, shouldSchedule?: boolean) => void;
};

const INTERSECTION_THROTTLE = 200;

const StickerTooltip = ({ isOpen, ...props }: OwnProps) => {
  const {
    chatId,
    threadId,
    onStickerSelect,
    stickers,
    isSavedMessages,
    isCurrentUserPremium,
  } = useFrozenProps(props, !isOpen);

  const containerRef = useRef<HTMLDivElement>();
  const sendMessageAction = useSendMessageAction(chatId, threadId);

  const {
    observe: observeIntersection,
  } = useIntersectionObserver({ rootRef: containerRef, throttleMs: INTERSECTION_THROTTLE });

  const handleMouseMove = () => {
    sendMessageAction({ type: 'chooseSticker' });
  };

  const className = buildClassName(
    sharedStyles.root,
    styles.root,
    'composer-tooltip custom-scroll',
  );

  if (!stickers?.length) {
    return undefined;
  }

  return (
    <RichEditorTooltipPanel isOpen={isOpen}>
      <div
        ref={containerRef}
        className={className}
        onMouseMove={handleMouseMove}
      >
        {stickers.map((sticker) => (
          <StickerButton
            key={sticker.id}
            sticker={sticker}
            size={STICKER_SIZE_PICKER}
            observeIntersection={observeIntersection}
            onClick={onStickerSelect}
            clickArg={sticker}
            isSavedMessages={isSavedMessages}
            canViewSet
            isCurrentUserPremium={isCurrentUserPremium}
          />
        ))}
      </div>
    </RichEditorTooltipPanel>
  );
};

export default memo(StickerTooltip);
