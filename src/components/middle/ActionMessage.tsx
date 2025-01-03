import type { FC } from '../../lib/teact/teact';
import React, {
  memo, useCallback, useEffect, useMemo, useRef, useUnmountCleanup,
} from '../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../global';

import type {
  ApiChat, ApiMessage, ApiSticker, ApiTopic, ApiUser,
} from '../../api/types';
import type { ObserveFn } from '../../hooks/useIntersectionObserver';
import type { FocusDirection, MessageListType, ThreadId } from '../../types';
import type { OnIntersectPinnedMessage } from './hooks/usePinnedMessage';

import { getChatTitle, getMessageHtmlId, isJoinedChannelMessage } from '../../global/helpers';
import { getMessageReplyInfo } from '../../global/helpers/replies';
import {
  selectCanPlayAnimatedEmojis,
  selectChat,
  selectChatMessage,
  selectGiftStickerForDuration,
  selectGiftStickerForStars,
  selectIsCurrentUserPremium,
  selectIsMessageFocused,
  selectStarGiftSticker,
  selectTabState,
  selectTheme,
  selectTopicFromMessage,
  selectUser,
} from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import { formatInteger, formatIntegerCompact } from '../../util/textFormat';
import { renderActionMessageText } from '../common/helpers/renderActionMessageText';
import renderText from '../common/helpers/renderText';
import { renderTextWithEntities } from '../common/helpers/renderTextWithEntities';
import { preventMessageInputBlur } from './helpers/preventMessageInputBlur';

import useContextMenuHandlers from '../../hooks/useContextMenuHandlers';
import useEnsureMessage from '../../hooks/useEnsureMessage';
import useFlag from '../../hooks/useFlag';
import { useIsIntersecting, useOnIntersect } from '../../hooks/useIntersectionObserver';
import useLang from '../../hooks/useLang';
import useOldLang from '../../hooks/useOldLang';
import useShowTransitionDeprecated from '../../hooks/useShowTransitionDeprecated';
import useFocusMessage from './message/hooks/useFocusMessage';

import AnimatedIconFromSticker from '../common/AnimatedIconFromSticker';
import Avatar from '../common/Avatar';
import GiftRibbon from '../common/gift/GiftRibbon';
import Sparkles from '../common/Sparkles';
import ActionMessageSuggestedAvatar from './ActionMessageSuggestedAvatar';
import ActionMessageUpdatedAvatar from './ActionMessageUpdatedAvatar';
import ContextMenuContainer from './message/ContextMenuContainer.async';
import Reactions from './message/reactions/Reactions';
import SimilarChannels from './message/SimilarChannels';

type OwnProps = {
  message: ApiMessage;
  threadId?: ThreadId;
  messageListType?: MessageListType;
  observeIntersectionForReading?: ObserveFn;
  observeIntersectionForLoading?: ObserveFn;
  observeIntersectionForPlaying?: ObserveFn;
  isEmbedded?: boolean;
  appearanceOrder?: number;
  isJustAdded?: boolean;
  isLastInList?: boolean;
  isInsideTopic?: boolean;
  memoFirstUnreadIdRef?: { current: number | undefined };
  onIntersectPinnedMessage?: OnIntersectPinnedMessage;
};

type StateProps = {
  senderUser?: ApiUser;
  senderChat?: ApiChat;
  targetUserIds?: string[];
  targetMessage?: ApiMessage;
  targetChatId?: string;
  targetChat?: ApiChat;
  isFocused: boolean;
  topic?: ApiTopic;
  focusDirection?: FocusDirection;
  noFocusHighlight?: boolean;
  premiumGiftSticker?: ApiSticker;
  starGiftSticker?: ApiSticker;
  starsGiftSticker?: ApiSticker;
  canPlayAnimatedEmojis?: boolean;
  patternColor?: string;
  isCurrentUserPremium?: boolean;
};

const APPEARANCE_DELAY = 10;
const STAR_GIFT_STICKER_SIZE = 120;

const ActionMessage: FC<OwnProps & StateProps> = ({
  message,
  threadId,
  isEmbedded,
  appearanceOrder = 0,
  isJustAdded,
  isLastInList,
  senderUser,
  senderChat,
  targetUserIds,
  targetMessage,
  targetChatId,
  targetChat,
  isFocused,
  focusDirection,
  noFocusHighlight,
  premiumGiftSticker,
  starGiftSticker,
  starsGiftSticker,
  isInsideTopic,
  topic,
  memoFirstUnreadIdRef,
  canPlayAnimatedEmojis,
  patternColor,
  observeIntersectionForReading,
  observeIntersectionForLoading,
  observeIntersectionForPlaying,
  onIntersectPinnedMessage,
  isCurrentUserPremium,
}) => {
  const {
    openPremiumModal,
    requestConfetti,
    checkGiftCode,
    getReceipt,
    openGiftInfoModalFromMessage,
    openPrizeStarsTransactionFromGiveaway,
  } = getActions();

  const oldLang = useOldLang();
  const lang = useLang();

  // eslint-disable-next-line no-null/no-null
  const ref = useRef<HTMLDivElement>(null);

  useOnIntersect(ref, observeIntersectionForReading);
  useEnsureMessage(
    message.chatId,
    message.replyInfo?.type === 'message' ? message.replyInfo.replyToMsgId : undefined,
    targetMessage,
  );
  useFocusMessage({
    elementRef: ref,
    chatId: message.chatId,
    isFocused,
    focusDirection,
    noFocusHighlight,
    isJustAdded,
  });

  useUnmountCleanup(() => {
    if (message.isPinned) {
      onIntersectPinnedMessage?.({ viewportPinnedIdsToRemove: [message.id] });
    }
  });

  const noAppearanceAnimation = appearanceOrder <= 0;
  const [isShown, markShown] = useFlag(noAppearanceAnimation);
  const isPremiumGift = message.content.action?.type === 'giftPremium';
  const isGiftCode = message.content.action?.type === 'giftCode';
  const isSuggestedAvatar = message.content.action?.type === 'suggestProfilePhoto' && message.content.action!.photo;
  const isUpdatedAvatar = message.content.action?.type === 'updateProfilePhoto' && message.content.action!.photo;
  const isJoinedMessage = isJoinedChannelMessage(message);
  const isStarsGift = message.content.action?.type === 'giftStars';
  const isStarGift = message.content.action?.type === 'starGift';
  const isPrizeStars = message.content.action?.type === 'prizeStars';

  const withServiceReactions = Boolean(message.areReactionsPossible && message?.reactions);

  useEffect(() => {
    if (noAppearanceAnimation) {
      return;
    }

    setTimeout(markShown, appearanceOrder * APPEARANCE_DELAY);
  }, [appearanceOrder, markShown, noAppearanceAnimation]);

  const isVisible = useIsIntersecting(ref, observeIntersectionForPlaying);

  const shouldShowConfettiRef = useRef((() => {
    const isUnread = memoFirstUnreadIdRef?.current && message.id >= memoFirstUnreadIdRef.current;
    return isPremiumGift && !message.isOutgoing && isUnread;
  })());

  useEffect(() => {
    if (isVisible && shouldShowConfettiRef.current) {
      shouldShowConfettiRef.current = false;
      requestConfetti({ withStars: true });
    }
  }, [isVisible, requestConfetti]);

  const { transitionClassNames } = useShowTransitionDeprecated(isShown, undefined, noAppearanceAnimation, false);

  // No need for expensive global updates on users and chats, so we avoid them
  const usersById = getGlobal().users.byId;
  const targetUsers = useMemo(() => {
    return targetUserIds
      ? targetUserIds.map((userId) => usersById?.[userId]).filter(Boolean)
      : undefined;
  }, [targetUserIds, usersById]);

  const renderContent = useCallback(() => {
    return renderActionMessageText(
      oldLang,
      message,
      senderUser,
      senderChat,
      targetUsers,
      targetMessage,
      targetChatId,
      topic,
      { isEmbedded },
      observeIntersectionForLoading,
      observeIntersectionForPlaying,
    );
  }, [
    isEmbedded, message, observeIntersectionForLoading, observeIntersectionForPlaying, oldLang,
    senderChat, senderUser, targetChatId, targetMessage, targetUsers, topic,
  ]);

  const {
    isContextMenuOpen, contextMenuAnchor,
    handleBeforeContextMenu, handleContextMenu,
    handleContextMenuClose, handleContextMenuHide,
  } = useContextMenuHandlers(ref);
  const isContextMenuShown = contextMenuAnchor !== undefined;

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    preventMessageInputBlur(e);
    handleBeforeContextMenu(e);
  };

  const handleStarGiftClick = () => {
    openGiftInfoModalFromMessage({
      chatId: message.chatId,
      messageId: message.id,
    });
  };

  const handlePremiumGiftClick = () => {
    openPremiumModal({
      isGift: true,
      fromUserId: senderUser?.id,
      toUserId: targetUserIds?.[0],
      monthsAmount: message.content.action?.months || 0,
    });
  };

  const handlePrizeStarsClick = () => {
    openPrizeStarsTransactionFromGiveaway({
      chatId: message.chatId,
      messageId: message.id,
    });
  };

  const handleGiftCodeClick = () => {
    const slug = message.content.action?.slug;
    if (!slug) return;
    checkGiftCode({ slug, message: { chatId: message.chatId, messageId: message.id } });
  };

  const handleClick = () => {
    if (message.content.action?.type === 'receipt') {
      getReceipt({
        chatId: message.chatId,
        messageId: message.id,
      });
    }
  };

  // TODO Refactoring for action rendering
  const shouldSkipRender = isInsideTopic && message.content.action?.text === 'TopicWasCreatedAction';
  if (shouldSkipRender) {
    return <span ref={ref} />;
  }

  if (isEmbedded) {
    return <span ref={ref} className="embedded-action-message">{renderContent()}</span>;
  }

  function renderGift() {
    const giftMessage = message.content.action?.message;
    return (
      <span
        className="action-message-gift"
        tabIndex={0}
        role="button"
        onClick={handlePremiumGiftClick}
      >
        <AnimatedIconFromSticker
          key={message.id}
          sticker={premiumGiftSticker}
          play={canPlayAnimatedEmojis}
          noLoop
          nonInteractive
        />
        <strong>{oldLang('ActionGiftPremiumTitle')}</strong>
        <span>
          {oldLang('ActionGiftPremiumSubtitle', oldLang('Months', message.content.action?.months, 'i'))}
        </span>
        {giftMessage && (
          <div className="action-message-gift-subtitle">
            {renderTextWithEntities({ text: giftMessage.text, entities: giftMessage.entities })}
          </div>
        )}

        <span className="action-message-button">
          <Sparkles preset="button" />
          {oldLang('ActionGiftPremiumView')}
        </span>
      </span>
    );
  }

  function renderGiftCode() {
    const isFromGiveaway = message.content.action?.isGiveaway;
    const isUnclaimed = message.content.action?.isUnclaimed;
    const giftMessage = message.content.action?.message;
    return (
      <span
        className="action-message-gift action-message-gift-code"
        tabIndex={0}
        role="button"
        onClick={handleGiftCodeClick}
      >
        <AnimatedIconFromSticker
          key={message.id}
          sticker={premiumGiftSticker}
          play={canPlayAnimatedEmojis}
          noLoop
          nonInteractive
        />
        <strong>
          {oldLang(isUnclaimed ? 'BoostingUnclaimedPrize' : 'BoostingCongratulations')}
        </strong>
        <span className="action-message-subtitle">
          {targetChat && renderText(
            oldLang(
              isFromGiveaway ? 'BoostingReceivedGiftFrom' : isUnclaimed
                ? 'BoostingReceivedPrizeFrom' : 'BoostingYouHaveUnclaimedPrize',
              getChatTitle(oldLang, targetChat),
            ),
            ['simple_markdown'],
          )}
        </span>
        <span className="action-message-subtitle">
          {renderText(oldLang(
            'BoostingUnclaimedPrizeDuration',
            oldLang('Months', message.content.action?.months, 'i'),
          ), ['simple_markdown'])}
        </span>

        {giftMessage && (
          <div className="action-message-gift-subtitle">
            {renderTextWithEntities({ text: giftMessage.text, entities: giftMessage.entities })}
          </div>
        )}

        <span className="action-message-button">
          {oldLang('BoostingReceivedGiftOpenBtn')}
        </span>
      </span>
    );
  }

  function renderStarsGift() {
    return (
      <span
        className="action-message-gift action-message-gift-code"
        tabIndex={0}
        role="button"
        onClick={handleStarGiftClick}
      >
        <AnimatedIconFromSticker
          key={message.id}
          sticker={starsGiftSticker}
          play={canPlayAnimatedEmojis}
          noLoop
          nonInteractive
        />
        <div className="action-message-stars-balance">
          {formatInteger(message.content.action!.stars!)}
          <strong>{oldLang('Stars')}</strong>
        </div>
        <span className="action-message-stars-subtitle">
          {renderText(
            oldLang(!message.isOutgoing
              ? 'ActionGiftStarsSubtitleYou' : 'ActionGiftStarsSubtitle', getChatTitle(oldLang, targetChat!)),
            ['simple_markdown'],
          )}
        </span>
        <span className="action-message-button">
          <Sparkles preset="button" />
          {oldLang('ActionGiftPremiumView')}
        </span>
      </span>
    );
  }

  function renderStarGiftUserCaption() {
    const targetUser = targetUsers && targetUsers[0];
    if (!targetUser || !senderUser) return undefined;

    if (message.isOutgoing) {
      return (
        <div className="action-message-user-caption">
          <span> {lang('GiftTo')} </span>
          <Avatar className="action-message-user-avatar" size="micro" peer={targetChat} />
          <span> {targetUser.firstName} </span>
        </div>
      );
    }

    return (
      <div className="action-message-user-caption">
        <span> {lang('GiftFrom')} </span>
        <Avatar className="action-message-user-avatar" size="micro" peer={senderUser} />
        <span> {senderUser.firstName} </span>
      </div>
    );
  }

  function renderStarGiftUserDescription() {
    const starGift = message.content.action?.starGift;
    const targetUser = targetUsers && targetUsers[0]?.firstName;
    const starGiftMessage = message.content.action?.starGift?.message;
    if (!starGift) return undefined;

    if (starGiftMessage) {
      return renderTextWithEntities({ text: starGiftMessage.text, entities: starGiftMessage.entities });
    }
    const amount = starGift?.starsToConvert;

    if (message.isOutgoing) {
      return lang('ActionStarGiftOutDescription', {
        user: targetUser || 'User',
        count: amount,
      }, { withNodes: true });
    }

    if (starGift.isSaved) {
      return lang('ActionStarGiftDisplaying');
    }

    if (starGift.isConverted) {
      return message.isOutgoing
        ? lang('GiftInfoDescriptionOutConverted', {
          amount: formatInteger(amount!),
          user: targetUser || 'User',
        }, {
          pluralValue: amount!,
          withNodes: true,
          withMarkdown: true,
        })
        : lang('GiftInfoDescriptionConverted', {
          amount: formatInteger(amount!),
        }, {
          pluralValue: amount!,
          withNodes: true,
          withMarkdown: true,
        });
    }

    return lang('ActionStarGiftDescription', {
      count: amount,
    }, { withNodes: true });
  }

  function renderStarGift() {
    const starGift = message.content.action?.starGift;
    if (!starGift) return undefined;

    return (
      <span
        className="action-message-gift action-message-gift-code action-message-star-gift"
        tabIndex={0}
        role="button"
        onClick={handleStarGiftClick}
      >

        <AnimatedIconFromSticker
          sticker={starGiftSticker}
          play={canPlayAnimatedEmojis}
          noLoop
          nonInteractive
          size={STAR_GIFT_STICKER_SIZE}
        />

        {renderStarGiftUserCaption()}
        <div className="action-message-gift-subtitle">
          {renderStarGiftUserDescription()}
        </div>

        {!message.isOutgoing && (
          <div className="action-message-button">
            <Sparkles preset="button" />
            {oldLang('ActionGiftPremiumView')}
          </div>
        )}
        {starGift.gift.availabilityTotal && (
          <GiftRibbon
            color={patternColor || 'blue'}
            text={oldLang('Gift2Limited1OfRibbon', formatIntegerCompact(starGift.gift.availabilityTotal))}
          />
        )}
      </span>
    );
  }

  function renderPrizeStars() {
    const isUnclaimed = message.content.action?.isUnclaimed;

    return (
      <span
        className="action-message-gift action-message-gift-code"
        tabIndex={0}
        role="button"
        onClick={handlePrizeStarsClick}
      >
        <AnimatedIconFromSticker
          key={message.id}
          sticker={starGiftSticker}
          play={canPlayAnimatedEmojis}
          noLoop
          nonInteractive
        />
        <strong>
          {oldLang(isUnclaimed ? 'BoostingUnclaimedPrize' : 'BoostingCongratulations')}
        </strong>
        <span className="action-message-subtitle">
          {targetChat && renderText(oldLang(isUnclaimed
            ? 'BoostingReceivedPrizeFrom' : 'BoostingYouHaveUnclaimedPrize', getChatTitle(oldLang, targetChat)),
          ['simple_markdown'])}
        </span>
        <span className="action-message-subtitle">
          {renderText(lang(
            'PrizeCredits', {
              count: (
                <b>{formatInteger(message.content.action?.stars!)}</b>
              ),
            }, {
              withNodes: true,
            },
          ), ['simple_markdown'])}
        </span>
        <span className="action-message-button">{
          oldLang('ActionGiftPremiumView')
        }
        </span>
      </span>
    );
  }

  const className = buildClassName(
    'ActionMessage message-list-item',
    isFocused && !noFocusHighlight && 'focused',
    (isPremiumGift || isSuggestedAvatar || isUpdatedAvatar) && 'centered-action',
    isContextMenuShown && 'has-menu-open',
    isLastInList && 'last-in-list',
    transitionClassNames,
  );

  return (
    <div
      ref={ref}
      id={getMessageHtmlId(message.id)}
      className={className}
      data-message-id={message.id}
      data-is-pinned={message.isPinned || undefined}
      onMouseDown={handleMouseDown}
      onContextMenu={handleContextMenu}
    >
      {!isSuggestedAvatar && !isGiftCode && !isJoinedMessage && !isUpdatedAvatar && (
        <span className="action-message-content" onClick={handleClick}>{renderContent()}</span>
      )}
      {isPremiumGift && renderGift()}
      {isGiftCode && renderGiftCode()}
      {isStarsGift && renderStarsGift()}
      {isStarGift && renderStarGift()}
      {isPrizeStars && renderPrizeStars()}
      {isSuggestedAvatar && (
        <ActionMessageSuggestedAvatar message={message} renderContent={renderContent} />
      )}
      {isUpdatedAvatar && (
        <ActionMessageUpdatedAvatar message={message} renderContent={renderContent} />
      )}
      {isJoinedMessage && <SimilarChannels chatId={targetChatId!} />}
      {contextMenuAnchor && (
        <ContextMenuContainer
          isOpen={isContextMenuOpen}
          anchor={contextMenuAnchor}
          message={message}
          messageListType="thread"
          onClose={handleContextMenuClose}
          onCloseAnimationEnd={handleContextMenuHide}
        />
      )}
      {withServiceReactions && (
        <Reactions
          isOutside
          message={message!}
          threadId={threadId}
          observeIntersection={observeIntersectionForPlaying}
          isCurrentUserPremium={isCurrentUserPremium}
        />
      )}
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { message, threadId }): StateProps => {
    const {
      chatId, senderId, content,
    } = message;

    const { targetUserIds, targetChatId } = content.action || {};
    const targetMessageId = getMessageReplyInfo(message)?.replyToMsgId;
    const targetMessage = targetMessageId
      ? selectChatMessage(global, chatId, targetMessageId)
      : undefined;

    const theme = selectTheme(global);
    const {
      patternColor,
    } = global.settings.themes[theme] || {};

    const isFocused = threadId ? selectIsMessageFocused(global, message, threadId) : false;
    const {
      direction: focusDirection,
      noHighlight: noFocusHighlight,
    } = (isFocused && selectTabState(global).focusedMessage) || {};

    const senderUser = selectUser(global, senderId || chatId);
    const senderChat = selectChat(global, chatId);

    const targetChat = targetChatId ? selectChat(global, targetChatId) : undefined;

    const giftDuration = content.action?.months;
    const premiumGiftSticker = selectGiftStickerForDuration(global, giftDuration);

    const starGift = content.action?.type === 'starGift' ? content.action.starGift?.gift : undefined;
    const starCount = content.action?.stars;
    const starGiftSticker = starGift?.stickerId ? selectStarGiftSticker(global, starGift.stickerId) : undefined;
    const starsGiftSticker = selectGiftStickerForStars(global, starCount);

    const topic = selectTopicFromMessage(global, message);

    return {
      senderUser,
      senderChat,
      targetChat,
      targetChatId,
      targetUserIds,
      targetMessage,
      isFocused,
      premiumGiftSticker,
      starGiftSticker,
      starsGiftSticker,
      topic,
      patternColor,
      canPlayAnimatedEmojis: selectCanPlayAnimatedEmojis(global),
      ...(isFocused && {
        focusDirection,
        noFocusHighlight,
      }),
      isCurrentUserPremium: selectIsCurrentUserPremium(global),
    };
  },
)(ActionMessage));
