import React, { memo, useMemo, useRef } from '../../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../../global';

import type { FC } from '../../../lib/teact/teact';
import type {
  ApiMessage, ApiReaction, ApiSticker, ApiReactionCustomEmoji, ApiStory, ApiStorySkipped,
  ApiMessageEntity,
} from '../../../api/types';
import type { IAnchorPosition } from '../../../types';

import { REM } from '../../common/helpers/mediaDimensions';
import buildClassName from '../../../util/buildClassName';
import { isUserId } from '../../../global/helpers';
import {
  selectChat, selectChatFullInfo, selectChatMessage, selectIsContextMenuTranslucent, selectIsCurrentUserPremium,
  selectTabState, selectUserStory,
} from '../../../global/selectors';
import parseMessageInput from '../../../util/parseMessageInput';
import { buildCustomEmojiHtml } from '../composer/helpers/customEmoji';

import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import useCurrentOrPrev from '../../../hooks/useCurrentOrPrev';
import useMenuPosition from '../../../hooks/useMenuPosition';
import { getIsMobile } from '../../../hooks/useAppLayout';

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
  story?: ApiStory | ApiStorySkipped;
  isCurrentUserPremium?: boolean;
  position?: IAnchorPosition;
  isTranslucent?: boolean;
  sendAsMessage?: boolean;
}

const FULL_PICKER_SHIFT_DELTA = { x: -23, y: -64 };
const LIMITED_PICKER_SHIFT_DELTA = { x: -21, y: -10 };
const REACTION_SELECTOR_WIDTH = 16.375 * REM;

const ReactionPicker: FC<OwnProps & StateProps> = ({
  isOpen,
  message,
  story,
  position,
  isTranslucent,
  isCurrentUserPremium,
  withCustomReactions,
  sendAsMessage,
}) => {
  const {
    toggleReaction, closeReactionPicker, sendMessage, showNotification, sendStoryReaction,
  } = getActions();

  const lang = useLang();

  const renderedMessageId = useCurrentOrPrev(message?.id, true);
  const renderedChatId = useCurrentOrPrev(message?.chatId, true);
  const renderedStoryUserId = useCurrentOrPrev(story?.userId, true);
  const renderedStoryId = useCurrentOrPrev(story?.id);
  const storedPosition = useCurrentOrPrev(position, true);
  // eslint-disable-next-line no-null/no-null
  const menuRef = useRef<HTMLDivElement>(null);
  const renderingPosition = useMemo((): IAnchorPosition | undefined => {
    if (!storedPosition) {
      return undefined;
    }

    if (renderedStoryId) {
      return storedPosition;
    }

    return {
      x: storedPosition.x + (withCustomReactions ? FULL_PICKER_SHIFT_DELTA.x : LIMITED_PICKER_SHIFT_DELTA.x),
      y: storedPosition.y + (withCustomReactions ? FULL_PICKER_SHIFT_DELTA.y : LIMITED_PICKER_SHIFT_DELTA.y),
    };
  }, [renderedStoryId, storedPosition, withCustomReactions]);

  const getMenuElement = useLastCallback(() => menuRef.current);
  const getLayout = useLastCallback(() => ({
    withPortal: true,
    isDense: !renderedStoryUserId,
    deltaX: !getIsMobile() && menuRef.current
      ? -(menuRef.current.offsetWidth - REACTION_SELECTOR_WIDTH) / 2 - FULL_PICKER_SHIFT_DELTA.x / 2
      : 0,
  }));
  const {
    positionX, positionY, transformOriginX, transformOriginY, style,
  } = useMenuPosition(renderingPosition, getTriggerElement, getRootElement, getMenuElement, getLayout);

  const handleToggleCustomReaction = useLastCallback((sticker: ApiSticker) => {
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
  });

  const handleToggleReaction = useLastCallback((reaction: ApiReaction) => {
    if (!renderedChatId || !renderedMessageId) {
      return;
    }

    toggleReaction({
      chatId: renderedChatId, messageId: renderedMessageId, reaction, shouldAddToRecent: true,
    });
    closeReactionPicker();
  });

  const handleStoryReactionSelect = useLastCallback((item: ApiReaction | ApiSticker) => {
    const reaction = 'id' in item ? { documentId: item.id } : item;

    const sticker = 'documentId' in item
      ? getGlobal().customEmojis.byId[item.documentId] : 'emoticon' in item ? undefined : item;

    if (sticker && !sticker.isFree && !isCurrentUserPremium) {
      showNotification({
        message: lang('UnlockPremiumEmojiHint'),
        action: {
          action: 'openPremiumModal',
          payload: { initialSection: 'animated_emoji' },
        },
        actionText: lang('PremiumMore'),
      });

      closeReactionPicker();

      return;
    }

    if (!sendAsMessage) {
      sendStoryReaction({
        userId: renderedStoryUserId!, storyId: renderedStoryId!, reaction, shouldAddToRecent: true,
      });
      closeReactionPicker();
      return;
    }

    let text: string | undefined;
    let entities: ApiMessageEntity[] | undefined;

    if ('emoticon' in item) {
      text = item.emoticon;
    } else {
      const customEmojiMessage = parseMessageInput(buildCustomEmojiHtml(sticker!));
      text = customEmojiMessage.text;
      entities = customEmojiMessage.entities;
    }

    sendMessage({ text, entities, isReaction: true });
    closeReactionPicker();
  });

  const selectedReactionIds = useMemo(() => {
    return (message?.reactions?.results || []).reduce<string[]>((acc, { chosenOrder, reaction }) => {
      if (chosenOrder !== undefined) {
        acc.push('emoticon' in reaction ? reaction.emoticon : reaction.documentId);
      }

      return acc;
    }, []);
  }, [message?.reactions?.results]);

  return (
    <Menu
      isOpen={isOpen}
      ref={menuRef}
      className={buildClassName(styles.menu, 'ReactionPicker')}
      bubbleClassName={buildClassName(
        styles.menuContent,
        !withCustomReactions && !renderedStoryId && styles.onlyReactions,
        renderedStoryId && styles.storyMenu,
      )}
      withPortal
      noCompact
      positionX={positionX}
      positionY={positionY}
      transformOriginX={transformOriginX}
      transformOriginY={transformOriginY}
      style={style}
      backdropExcludedSelector=".Modal.confirm"
      onClose={closeReactionPicker}
    >
      <CustomEmojiPicker
        idPrefix="message-emoji-set-"
        isHidden={!isOpen || !(withCustomReactions || renderedStoryId)}
        loadAndPlay={Boolean(isOpen && withCustomReactions)}
        isReactionPicker
        className={!withCustomReactions && !renderedStoryId ? styles.hidden : undefined}
        selectedReactionIds={selectedReactionIds}
        isTranslucent={isTranslucent}
        onCustomEmojiSelect={renderedStoryId ? handleStoryReactionSelect : handleToggleCustomReaction}
        onReactionSelect={renderedStoryId ? handleStoryReactionSelect : handleToggleReaction}
      />
      {!withCustomReactions && Boolean(renderedChatId) && (
        <ReactionPickerLimited
          chatId={renderedChatId}
          loadAndPlay={isOpen}
          onReactionSelect={renderedStoryId ? handleStoryReactionSelect : handleToggleReaction}
          selectedReactionIds={selectedReactionIds}
        />
      )}
    </Menu>
  );
};

export default memo(withGlobal<OwnProps>((global): StateProps => {
  const state = selectTabState(global);
  const {
    chatId, messageId, storyUserId, storyId, position, sendAsMessage,
  } = state.reactionPicker || {};
  const story = storyUserId && storyId
    ? selectUserStory(global, storyUserId, storyId) as ApiStory | ApiStorySkipped
    : undefined;
  const chat = chatId ? selectChat(global, chatId) : undefined;
  const chatFullInfo = chatId ? selectChatFullInfo(global, chatId) : undefined;
  const message = chatId && messageId ? selectChatMessage(global, chatId, messageId) : undefined;
  const isPrivateChat = chatId ? isUserId(chatId) : Boolean(storyUserId);
  const areSomeReactionsAllowed = chatFullInfo?.enabledReactions?.type === 'some';
  const areCustomReactionsAllowed = chatFullInfo?.enabledReactions?.type === 'all'
    && chatFullInfo?.enabledReactions?.areCustomAllowed;

  return {
    message,
    story,
    position,
    withCustomReactions: chat?.isForbidden || areSomeReactionsAllowed
      ? false
      : areCustomReactionsAllowed || isPrivateChat,
    isTranslucent: selectIsContextMenuTranslucent(global),
    isCurrentUserPremium: selectIsCurrentUserPremium(global),
    sendAsMessage,
  };
})(ReactionPicker));

function getTriggerElement(): HTMLElement | null {
  return document.querySelector('body');
}

function getRootElement() {
  return document.querySelector('body');
}
