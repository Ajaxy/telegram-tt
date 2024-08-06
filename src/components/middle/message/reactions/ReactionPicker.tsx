import type { FC } from '../../../../lib/teact/teact';
import React, { memo, useMemo, useRef } from '../../../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../../../global';

import type { IAnchorPosition } from '../../../../types';
import {
  type ApiAvailableEffect,
  type ApiMessage, type ApiMessageEntity,
  type ApiReaction, type ApiReactionCustomEmoji, type ApiSticker, type ApiStory, type ApiStorySkipped,
  MAIN_THREAD_ID,
} from '../../../../api/types';

import { getReactionKey, getStoryKey, isUserId } from '../../../../global/helpers';
import {
  selectChat, selectChatFullInfo, selectChatMessage, selectIsContextMenuTranslucent, selectIsCurrentUserPremium,
  selectPeerStory, selectTabState,
} from '../../../../global/selectors';
import buildClassName from '../../../../util/buildClassName';
import parseHtmlAsFormattedText from '../../../../util/parseHtmlAsFormattedText';
import { REM } from '../../../common/helpers/mediaDimensions';
import { buildCustomEmojiHtml } from '../../composer/helpers/customEmoji';

import { getIsMobile } from '../../../../hooks/useAppLayout';
import useCurrentOrPrev from '../../../../hooks/useCurrentOrPrev';
import useLastCallback from '../../../../hooks/useLastCallback';
import useMenuPosition from '../../../../hooks/useMenuPosition';
import useOldLang from '../../../../hooks/useOldLang';

import CustomEmojiPicker from '../../../common/CustomEmojiPicker';
import Menu from '../../../ui/Menu';
import StickerPicker from '../../composer/StickerPicker';
import ReactionPickerLimited from './ReactionPickerLimited';

import styles from './ReactionPicker.module.scss';

export type OwnProps = {
  isOpen: boolean;
};

interface StateProps {
  shouldUseFullPicker?: boolean;
  message?: ApiMessage;
  story?: ApiStory | ApiStorySkipped;
  isCurrentUserPremium?: boolean;
  position?: IAnchorPosition;
  isTranslucent?: boolean;
  sendAsMessage?: boolean;
  chatId?: string;
  isForEffects?: boolean;
  availableEffectById: Record<string, ApiAvailableEffect>;
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
  shouldUseFullPicker,
  sendAsMessage,
  chatId,
  isForEffects,
  availableEffectById,
}) => {
  const {
    toggleReaction, closeReactionPicker, sendMessage, showNotification, sendStoryReaction, saveEffectInDraft,
    requestEffectInComposer,
  } = getActions();

  const lang = useOldLang();

  const renderedMessageId = useCurrentOrPrev(message?.id, true);
  const renderedChatId = useCurrentOrPrev(message?.chatId, true);
  const renderedStoryPeerId = useCurrentOrPrev(story?.peerId, true);
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
      x: storedPosition.x + (shouldUseFullPicker ? FULL_PICKER_SHIFT_DELTA.x : LIMITED_PICKER_SHIFT_DELTA.x),
      y: storedPosition.y + (shouldUseFullPicker ? FULL_PICKER_SHIFT_DELTA.y : LIMITED_PICKER_SHIFT_DELTA.y),
    };
  }, [renderedStoryId, storedPosition, shouldUseFullPicker]);

  const getMenuElement = useLastCallback(() => menuRef.current);
  const getLayout = useLastCallback(() => ({
    withPortal: true,
    isDense: !renderedStoryPeerId,
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
        peerId: renderedStoryPeerId!,
        storyId: renderedStoryId!,
        containerId: getStoryKey(renderedStoryPeerId!, renderedStoryId!),
        reaction,
        shouldAddToRecent: true,
      });
      closeReactionPicker();
      return;
    }

    let text: string | undefined;
    let entities: ApiMessageEntity[] | undefined;

    if ('emoticon' in item) {
      text = item.emoticon;
    } else {
      const customEmojiMessage = parseHtmlAsFormattedText(buildCustomEmojiHtml(sticker!));
      text = customEmojiMessage.text;
      entities = customEmojiMessage.entities;
    }

    sendMessage({ text, entities, isReaction: true });
    closeReactionPicker();
  });

  const handleStickerSelect = useLastCallback((sticker: ApiSticker) => {
    const availableEffects = Object.values(availableEffectById);
    const effectId = availableEffects.find((effect) => effect.effectStickerId === sticker.id)?.id;

    if (chatId) saveEffectInDraft({ chatId, threadId: MAIN_THREAD_ID, effectId });

    if (effectId) requestEffectInComposer({ });
    closeReactionPicker();
  });

  const selectedReactionIds = useMemo(() => {
    return (message?.reactions?.results || []).reduce<string[]>((acc, { chosenOrder, reaction }) => {
      if (chosenOrder !== undefined) {
        acc.push(getReactionKey(reaction));
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
        !shouldUseFullPicker && !renderedStoryId && styles.onlyReactions,
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
      {isForEffects && chatId ? (
        <StickerPicker
          className=""
          isHidden={!isOpen}
          loadAndPlay={Boolean(isOpen && shouldUseFullPicker)}
          idPrefix="message-effect"
          canSendStickers={false}
          noContextMenus={false}
          chatId={chatId}
          isTranslucent={isTranslucent}
          onStickerSelect={handleStickerSelect}
          isForEffects={isForEffects}
        />
      ) : (
        <>
          <CustomEmojiPicker
            chatId={renderedChatId}
            idPrefix="message-emoji-set-"
            isHidden={!isOpen || !(shouldUseFullPicker || renderedStoryId)}
            loadAndPlay={Boolean(isOpen && shouldUseFullPicker)}
            isReactionPicker
            className={!shouldUseFullPicker && !renderedStoryId ? styles.hidden : undefined}
            selectedReactionIds={selectedReactionIds}
            isTranslucent={isTranslucent}
            onCustomEmojiSelect={renderedStoryId ? handleStoryReactionSelect : handleToggleCustomReaction}
            onReactionSelect={renderedStoryId ? handleStoryReactionSelect : handleToggleReaction}
          />
          {!shouldUseFullPicker && Boolean(renderedChatId) && (
            <ReactionPickerLimited
              chatId={renderedChatId}
              loadAndPlay={isOpen}
              onReactionSelect={renderedStoryId ? handleStoryReactionSelect : handleToggleReaction}
              selectedReactionIds={selectedReactionIds}
              message={message}
            />
          )}
        </>
      )}
    </Menu>
  );
};

export default memo(withGlobal<OwnProps>((global): StateProps => {
  const state = selectTabState(global);
  const availableEffectById = global.availableEffectById;
  const {
    chatId, messageId, storyPeerId, storyId, position, sendAsMessage, isForEffects,
  } = state.reactionPicker || {};
  const story = storyPeerId && storyId
    ? selectPeerStory(global, storyPeerId, storyId) as ApiStory | ApiStorySkipped
    : undefined;
  const chat = chatId ? selectChat(global, chatId) : undefined;
  const chatFullInfo = chatId ? selectChatFullInfo(global, chatId) : undefined;
  const message = chatId && messageId ? selectChatMessage(global, chatId, messageId) : undefined;
  const isPrivateChat = isUserId(chatId || storyPeerId || '');
  const areSomeReactionsAllowed = chatFullInfo?.enabledReactions?.type === 'some';
  const { maxUniqueReactions } = global.appConfig || {};
  const areAllReactionsAllowed = chatFullInfo?.enabledReactions?.type === 'all'
  && chatFullInfo?.enabledReactions?.areCustomAllowed;

  const currentReactions = message?.reactions?.results;
  const shouldUseCurrentReactions = Boolean(maxUniqueReactions && currentReactions
    && currentReactions.length >= maxUniqueReactions);

  return {
    message,
    story,
    position,
    shouldUseFullPicker: (chat?.isForbidden || areSomeReactionsAllowed || shouldUseCurrentReactions) ? false
      : (areAllReactionsAllowed || isPrivateChat),
    isTranslucent: selectIsContextMenuTranslucent(global),
    isCurrentUserPremium: selectIsCurrentUserPremium(global),
    sendAsMessage,
    isForEffects,
    chatId,
    availableEffectById,
  };
})(ReactionPicker));

function getTriggerElement(): HTMLElement | null {
  return document.querySelector('body');
}

function getRootElement() {
  return document.querySelector('body');
}
