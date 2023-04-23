import React, {
  memo, useCallback, useMemo, useRef,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { FC } from '../../../lib/teact/teact';
import type {
  ApiMessage, ApiReaction, ApiSticker, ApiReactionCustomEmoji,
} from '../../../api/types';
import type { IAnchorPosition } from '../../../types';

import buildClassName from '../../../util/buildClassName';
import { isUserId } from '../../../global/helpers';
import { selectChat, selectChatMessage, selectTabState } from '../../../global/selectors';
import useCurrentOrPrev from '../../../hooks/useCurrentOrPrev';
import useMenuPosition from '../../../hooks/useMenuPosition';

import CustomEmojiPicker from '../../common/CustomEmojiPicker';
import ReactionPickerLimited from './ReactionPickerLimited';
import Menu from '../../ui/Menu';

import styles from './ReactionPicker.module.scss';

export type OwnProps = {
  isOpen: boolean;
};

interface StateProps {
  withCustomReactions?: boolean;
  message?: ApiMessage;
  position?: IAnchorPosition;
}

const FULL_PICKER_SHIFT_DELTA = { x: -30, y: -66 };
const LIMITED_PICKER_SHIFT_DELTA = { x: -25, y: -10 };

const ReactionPicker: FC<OwnProps & StateProps> = ({
  isOpen,
  message,
  position,
  withCustomReactions,
}) => {
  const { toggleReaction, closeReactionPicker } = getActions();

  // eslint-disable-next-line no-null/no-null
  const scrollHeaderRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const limitedScrollContainerRef = useRef<HTMLDivElement>(null);

  const renderedMessageId = useCurrentOrPrev(message?.id, true);
  const renderedChatId = useCurrentOrPrev(message?.chatId, true);
  const storedPosition = useCurrentOrPrev(position, true);
  // eslint-disable-next-line no-null/no-null
  const menuRef = useRef<HTMLDivElement>(null);
  const renderingPosition = useMemo((): IAnchorPosition | undefined => {
    if (!storedPosition) {
      return undefined;
    }

    return {
      x: storedPosition.x + (withCustomReactions ? FULL_PICKER_SHIFT_DELTA.x : LIMITED_PICKER_SHIFT_DELTA.x),
      y: storedPosition.y + (withCustomReactions ? FULL_PICKER_SHIFT_DELTA.y : LIMITED_PICKER_SHIFT_DELTA.y),
    };
  }, [storedPosition, withCustomReactions]);

  const getMenuElement = useCallback(() => menuRef.current, []);
  const getLayout = useCallback(() => ({ withPortal: true, isDense: true }), []);
  const {
    positionX, positionY, transformOriginX, transformOriginY, style,
  } = useMenuPosition(renderingPosition, getTriggerElement, getRootElement, getMenuElement, getLayout);

  const handleResetScrollPosition = useCallback(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
    if (scrollHeaderRef.current) {
      scrollHeaderRef.current.scrollLeft = 0;
    }
    if (limitedScrollContainerRef.current) {
      limitedScrollContainerRef.current.scrollTop = 0;
    }
  }, []);

  const handleToggleCustomReaction = useCallback((sticker: ApiSticker) => {
    if (!renderedChatId || !renderedMessageId) {
      return;
    }
    const reaction = sticker.isCustomEmoji
      ? { documentId: sticker.id } as ApiReactionCustomEmoji
      : { emoticon: sticker.emoji } as ApiReaction;

    toggleReaction({
      chatId: renderedChatId, messageId: renderedMessageId, reaction, shouldAddToRecent: true,
    });
    closeReactionPicker();
  }, [renderedChatId, renderedMessageId]);

  const handleToggleReaction = useCallback((reaction: ApiReaction) => {
    if (!renderedChatId || !renderedMessageId) {
      return;
    }

    toggleReaction({
      chatId: renderedChatId, messageId: renderedMessageId, reaction, shouldAddToRecent: true,
    });
    closeReactionPicker();
  }, [renderedChatId, renderedMessageId]);

  const selectedReactionIds = useMemo(() => {
    return (message?.reactions?.results || []).reduce<string[]>((acc, { chosenOrder, reaction }) => {
      if (chosenOrder !== undefined) {
        acc.push('emoticon' in reaction ? reaction.emoticon : reaction.documentId);
      }

      return acc;
    }, []);
  }, [message?.reactions?.results]);

  const bubbleFullClassName = buildClassName(
    styles.menuContent,
    !withCustomReactions && styles.onlyReactions,
  );

  return (
    <Menu
      isOpen={isOpen}
      ref={menuRef}
      className={styles.menu}
      bubbleClassName={bubbleFullClassName}
      withPortal
      noCompact
      positionX={positionX}
      positionY={positionY}
      transformOriginX={transformOriginX}
      transformOriginY={transformOriginY}
      style={style}
      onClose={closeReactionPicker}
      onCloseAnimationEnd={handleResetScrollPosition}
    >
      <CustomEmojiPicker
        idPrefix="message-emoji-set-"
        loadAndPlay={isOpen}
        isReactionPicker
        className={!withCustomReactions ? styles.hidden : undefined}
        scrollHeaderRef={scrollHeaderRef}
        scrollContainerRef={scrollContainerRef}
        onCustomEmojiSelect={handleToggleCustomReaction}
        onReactionSelect={handleToggleReaction}
        selectedReactionIds={selectedReactionIds}
      />
      {!withCustomReactions && Boolean(renderedChatId) && (
        <ReactionPickerLimited
          chatId={renderedChatId}
          loadAndPlay={isOpen}
          scrollContainerRef={limitedScrollContainerRef}
          onReactionSelect={handleToggleReaction}
          selectedReactionIds={selectedReactionIds}
        />
      )}
    </Menu>
  );
};

export default memo(withGlobal<OwnProps>((global): StateProps => {
  const state = selectTabState(global);
  const { chatId, messageId, position } = state.reactionPicker || {};
  const chat = chatId ? selectChat(global, chatId) : undefined;
  const message = chatId && messageId ? selectChatMessage(global, chatId, messageId) : undefined;
  const isPrivateChat = chatId ? isUserId(chatId) : false;
  const areSomeReactionsAllowed = chat?.fullInfo?.enabledReactions?.type === 'some';
  const areCustomReactionsAllowed = chat?.fullInfo?.enabledReactions?.type === 'all'
    && chat?.fullInfo?.enabledReactions?.areCustomAllowed;

  return {
    message,
    position,
    withCustomReactions: chat?.isForbidden || areSomeReactionsAllowed
      ? false
      : areCustomReactionsAllowed || isPrivateChat,
  };
})(ReactionPicker));

function getTriggerElement(): HTMLElement | null {
  return document.querySelector('body');
}

function getRootElement() {
  return document.querySelector('body');
}
