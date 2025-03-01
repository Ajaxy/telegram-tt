import type { FC } from '../../../lib/teact/teact';
import React, {
  memo, useEffect, useMemo, useRef,
} from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import type {
  ApiAvailableReaction,
  ApiChat,
  ApiChatReactions,
  ApiMessage,
  ApiPeer,
  ApiPoll,
  ApiReaction,
  ApiStickerSet,
  ApiThreadInfo,
  ApiTypeStory,
  ApiUser,
} from '../../../api/types';
import type { IAnchorPosition } from '../../../types';

import {
  getUserFullName,
  groupStatefulContent,
  isUserId,
} from '../../../global/helpers';
import buildClassName from '../../../util/buildClassName';
import { disableScrolling } from '../../../util/scrollLock';
import { REM } from '../../common/helpers/mediaDimensions';
import renderText from '../../common/helpers/renderText';
import { getMessageCopyOptions } from './helpers/copyOptions';

import useAppLayout from '../../../hooks/useAppLayout';
import useFlag from '../../../hooks/useFlag';
import useLastCallback from '../../../hooks/useLastCallback';
import useOldLang from '../../../hooks/useOldLang';

import AvatarList from '../../common/AvatarList';
import Menu from '../../ui/Menu';
import MenuItem from '../../ui/MenuItem';
import MenuSeparator from '../../ui/MenuSeparator';
import Skeleton from '../../ui/placeholder/Skeleton';
import LastEditTimeMenuItem from './LastEditTimeMenuItem';
import ReactionSelector from './reactions/ReactionSelector';
import ReadTimeMenuItem from './ReadTimeMenuItem';

import './MessageContextMenu.scss';

type OwnProps = {
  isReactionPickerOpen?: boolean;
  availableReactions?: ApiAvailableReaction[];
  topReactions?: ApiReaction[];
  defaultTagReactions?: ApiReaction[];
  isOpen: boolean;
  anchor: IAnchorPosition;
  targetHref?: string;
  message: ApiMessage;
  poll?: ApiPoll;
  story?: ApiTypeStory;
  canSendNow?: boolean;
  enabledReactions?: ApiChatReactions;
  isWithPaidReaction?: boolean;
  reactionsLimit?: number;
  canReschedule?: boolean;
  canReply?: boolean;
  canQuote?: boolean;
  repliesThreadInfo?: ApiThreadInfo;
  canPin?: boolean;
  canUnpin?: boolean;
  canDelete?: boolean;
  canReport?: boolean;
  canShowReactionsCount?: boolean;
  canShowReactionList?: boolean;
  canBuyPremium?: boolean;
  canEdit?: boolean;
  canForward?: boolean;
  canFaveSticker?: boolean;
  canUnfaveSticker?: boolean;
  canCopy?: boolean;
  canCopyLink?: boolean;
  canSelect?: boolean;
  canTranslate?: boolean;
  canShowOriginal?: boolean;
  canSelectLanguage?: boolean;
  isPrivate?: boolean;
  isCurrentUserPremium?: boolean;
  canDownload?: boolean;
  canSaveGif?: boolean;
  canRevote?: boolean;
  canClosePoll?: boolean;
  isDownloading?: boolean;
  canShowSeenBy?: boolean;
  seenByRecentPeers?: ApiPeer[];
  noReplies?: boolean;
  hasCustomEmoji?: boolean;
  customEmojiSets?: ApiStickerSet[];
  canPlayAnimatedEmojis?: boolean;
  isInSavedMessages?: boolean;
  shouldRenderShowWhen?: boolean;
  canLoadReadDate?: boolean;
  onReply?: NoneToVoidFunction;
  onOpenThread?: VoidFunction;
  onEdit?: NoneToVoidFunction;
  onPin?: NoneToVoidFunction;
  onUnpin?: NoneToVoidFunction;
  onForward?: NoneToVoidFunction;
  onDelete?: NoneToVoidFunction;
  onFaveSticker?: NoneToVoidFunction;
  onReport?: NoneToVoidFunction;
  onUnfaveSticker?: NoneToVoidFunction;
  onSelect?: NoneToVoidFunction;
  onSend?: NoneToVoidFunction;
  onReschedule?: NoneToVoidFunction;
  onClose: NoneToVoidFunction;
  onCloseAnimationEnd?: NoneToVoidFunction;
  onCopyLink?: NoneToVoidFunction;
  onCopyMessages?: (messageIds: number[]) => void;
  onCopyNumber?: NoneToVoidFunction;
  onDownload?: NoneToVoidFunction;
  onSaveGif?: NoneToVoidFunction;
  onCancelVote?: NoneToVoidFunction;
  onClosePoll?: NoneToVoidFunction;
  onShowSeenBy?: NoneToVoidFunction;
  onShowReactors?: NoneToVoidFunction;
  onTranslate?: NoneToVoidFunction;
  onShowOriginal?: NoneToVoidFunction;
  onSelectLanguage?: NoneToVoidFunction;
  onToggleReaction?: (reaction: ApiReaction) => void;
  onSendPaidReaction?: NoneToVoidFunction;
  onShowPaidReactionModal?: NoneToVoidFunction;
  onReactionPickerOpen?: (position: IAnchorPosition) => void;
  userFullName?: string;
  canGift?: boolean;
};

const SCROLLBAR_WIDTH = 10;
const REACTION_SELECTOR_WIDTH_REM = 19.25;
const ANIMATION_DURATION = 200;

const MessageContextMenu: FC<OwnProps> = ({
  isReactionPickerOpen,
  availableReactions,
  topReactions,
  defaultTagReactions,
  isOpen,
  message,
  poll,
  story,
  isPrivate,
  isCurrentUserPremium,
  enabledReactions,
  isWithPaidReaction,
  reactionsLimit,
  anchor,
  targetHref,
  canSendNow,
  canReschedule,
  canBuyPremium,
  canReply,
  canQuote,
  canEdit,
  noReplies,
  canPin,
  canUnpin,
  canDelete,
  canForward,
  canReport,
  canFaveSticker,
  canUnfaveSticker,
  canCopy,
  canCopyLink,
  canSelect,
  canDownload,
  canSaveGif,
  canRevote,
  canClosePoll,
  canTranslate,
  canShowOriginal,
  canSelectLanguage,
  isDownloading,
  repliesThreadInfo,
  canShowSeenBy,
  canShowReactionsCount,
  canShowReactionList,
  seenByRecentPeers,
  hasCustomEmoji,
  customEmojiSets,
  canPlayAnimatedEmojis,
  isInSavedMessages,
  shouldRenderShowWhen,
  canLoadReadDate,
  onReply,
  onOpenThread,
  onEdit,
  onPin,
  onUnpin,
  onForward,
  onDelete,
  onFaveSticker,
  onReport,
  onUnfaveSticker,
  onSelect,
  onSend,
  onReschedule,
  onClose,
  onCloseAnimationEnd,
  onCopyLink,
  onCopyNumber,
  onDownload,
  onSaveGif,
  onCancelVote,
  onClosePoll,
  onShowSeenBy,
  onShowReactors,
  onToggleReaction,
  onSendPaidReaction,
  onShowPaidReactionModal,
  onCopyMessages,
  onReactionPickerOpen,
  onTranslate,
  onShowOriginal,
  onSelectLanguage,
  userFullName,
  canGift,
}) => {
  const {
    showNotification, openStickerSet, openCustomEmojiSets, loadStickers, openGiftModal,
  } = getActions();
  // eslint-disable-next-line no-null/no-null
  const menuRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const scrollableRef = useRef<HTMLDivElement>(null);
  const lang = useOldLang();
  const noReactions = !isPrivate && !enabledReactions;
  const areReactionsPossible = message.areReactionsPossible;
  const withReactions = (canShowReactionList && !noReactions) || areReactionsPossible;
  const isEdited = ('isEdited' in message) && message.isEdited;
  const seenByDates = message.seenByDates;
  const isPremiumGift = message.content.action?.type === 'giftPremium';
  const isGiftCode = message.content.action?.type === 'giftCode';
  const isStarGift = message.content.action?.type === 'starGift';
  const isStarGiftUnique = message.content.action?.type === 'starGiftUnique';
  const shouldShowGiftButton = isUserId(message.chatId)
    && canGift && (isPremiumGift || isGiftCode || isStarGift || isStarGiftUnique);

  const [areItemsHidden, hideItems] = useFlag();
  const [isReady, markIsReady, unmarkIsReady] = useFlag();
  const { isMobile, isDesktop } = useAppLayout();
  const seenByDatesCount = useMemo(() => (seenByDates ? Object.keys(seenByDates).length : 0), [seenByDates]);

  const handleAfterCopy = useLastCallback(() => {
    showNotification({
      message: lang('Share.Link.Copied'),
    });
    onClose();
  });

  const handleGiftClick = useLastCallback(() => {
    openGiftModal({ forUserId: message.chatId });
    onClose();
  });

  useEffect(() => {
    if (isOpen && areItemsHidden && !isReactionPickerOpen) {
      onClose();
    }
  }, [onClose, isOpen, isReactionPickerOpen, areItemsHidden]);

  useEffect(() => {
    if (customEmojiSets?.length) {
      customEmojiSets.map((customEmojiSet) => {
        return loadStickers({
          stickerSetInfo: {
            id: customEmojiSet.id,
            accessHash: customEmojiSet.accessHash,
          },
        });
      });
    }
  }, [customEmojiSets, openCustomEmojiSets]);

  const handleOpenCustomEmojiSets = useLastCallback(() => {
    if (!customEmojiSets) return;
    if (customEmojiSets.length === 1) {
      openStickerSet({
        stickerSetInfo: {
          shortName: customEmojiSets[0].shortName,
        },
      });
    } else {
      openCustomEmojiSets({
        setIds: customEmojiSets.map((set) => set.id),
      });
    }
    onClose();
  });

  const copyOptions = getMessageCopyOptions(
    message,
    groupStatefulContent({ poll, story }),
    targetHref,
    canCopy,
    handleAfterCopy,
    canCopyLink ? onCopyLink : undefined,
    onCopyMessages,
    onCopyNumber,
  );

  const getTriggerElement = useLastCallback(() => {
    return document.querySelector(`.Transition_slide-active > .MessageList div[data-message-id="${message.id}"]`);
  });

  const getRootElement = useLastCallback(() => document.querySelector('.Transition_slide-active > .MessageList'));

  const getMenuElement = useLastCallback(() => document.querySelector('.MessageContextMenu .bubble'));

  const getLayout = useLastCallback(() => {
    const extraHeightAudioPlayer = (isMobile
      && (document.querySelector<HTMLElement>('.AudioPlayer-content'))?.offsetHeight) || 0;
    const middleColumn = document.getElementById('MiddleColumn')!;
    const middleColumnComputedStyle = getComputedStyle(middleColumn);
    const headerToolsHeight = parseFloat(middleColumnComputedStyle.getPropertyValue('--middle-header-panes-height'));
    const extraHeightPinned = headerToolsHeight || 0;

    return {
      extraPaddingX: SCROLLBAR_WIDTH,
      extraTopPadding: (document.querySelector<HTMLElement>('.MiddleHeader')!).offsetHeight,
      extraMarginTop: extraHeightPinned + extraHeightAudioPlayer,
      shouldAvoidNegativePosition: !isDesktop,
      menuElMinWidth: withReactions && isMobile ? REACTION_SELECTOR_WIDTH_REM * REM : undefined,
    };
  });

  useEffect(() => {
    if (!isOpen) {
      unmarkIsReady();
      return;
    }

    setTimeout(() => {
      markIsReady();
    }, ANIMATION_DURATION);
  }, [isOpen, markIsReady, unmarkIsReady]);

  useEffect(() => {
    return disableScrolling(scrollableRef.current, '.ReactionPicker');
  }, [isOpen]);

  const handleOpenMessageReactionPicker = useLastCallback((position: IAnchorPosition) => {
    onReactionPickerOpen!(position);
    hideItems();
  });

  return (
    <Menu
      ref={menuRef}
      isOpen={isOpen}
      anchor={anchor}
      getTriggerElement={getTriggerElement}
      getRootElement={getRootElement}
      getMenuElement={getMenuElement}
      getLayout={getLayout}
      withMaxHeight
      className={buildClassName(
        'MessageContextMenu', 'fluid', withReactions && 'with-reactions',
      )}
      onClose={onClose}
      onCloseAnimationEnd={onCloseAnimationEnd}
    >
      {withReactions && (
        <ReactionSelector
          enabledReactions={enabledReactions}
          topReactions={topReactions}
          allAvailableReactions={availableReactions}
          defaultTagReactions={defaultTagReactions}
          currentReactions={message.reactions?.results}
          reactionsLimit={reactionsLimit}
          onToggleReaction={onToggleReaction!}
          onSendPaidReaction={onSendPaidReaction}
          onShowPaidReactionModal={onShowPaidReactionModal}
          isWithPaidReaction={isWithPaidReaction}
          isPrivate={isPrivate}
          isReady={isReady}
          canBuyPremium={canBuyPremium}
          isCurrentUserPremium={isCurrentUserPremium}
          isInSavedMessages={isInSavedMessages}
          canPlayAnimatedEmojis={canPlayAnimatedEmojis}
          onShowMore={handleOpenMessageReactionPicker}
          onClose={onClose}
          className={buildClassName(areItemsHidden && 'ReactionSelector-hidden')}
        />
      )}

      <div
        ref={scrollableRef}
        className={buildClassName(
          'MessageContextMenu_items scrollable-content custom-scroll',
          areItemsHidden && 'MessageContextMenu_items-hidden',
        )}
        dir={lang.isRtl ? 'rtl' : undefined}
      >
        {shouldShowGiftButton
          && (
            <MenuItem icon="gift" onClick={handleGiftClick}>
              {message?.isOutgoing ? lang('SendAnotherGift')
                : lang('Conversation.ContextMenuSendGiftTo', userFullName)}
            </MenuItem>
          )}
        {canSendNow && <MenuItem icon="send-outline" onClick={onSend}>{lang('MessageScheduleSend')}</MenuItem>}
        {canReschedule && (
          <MenuItem icon="schedule" onClick={onReschedule}>{lang('MessageScheduleEditTime')}</MenuItem>
        )}
        {canReply && (
          <MenuItem icon="reply" onClick={onReply}>
            {lang(canQuote ? 'lng_context_quote_and_reply' : 'Reply')}
          </MenuItem>
        )}
        {!noReplies && Boolean(repliesThreadInfo?.messagesCount) && (
          <MenuItem icon="replies" onClick={onOpenThread}>
            {lang('Conversation.ContextViewReplies', repliesThreadInfo!.messagesCount, 'i')}
          </MenuItem>
        )}
        {canEdit && <MenuItem icon="edit" onClick={onEdit}>{lang('Edit')}</MenuItem>}
        {canFaveSticker && (
          <MenuItem icon="favorite" onClick={onFaveSticker}>{lang('AddToFavorites')}</MenuItem>
        )}
        {canUnfaveSticker && (
          <MenuItem icon="favorite" onClick={onUnfaveSticker}>{lang('Stickers.RemoveFromFavorites')}</MenuItem>
        )}
        {canTranslate && <MenuItem icon="language" onClick={onTranslate}>{lang('TranslateMessage')}</MenuItem>}
        {canShowOriginal && <MenuItem icon="language" onClick={onShowOriginal}>{lang('ShowOriginalButton')}</MenuItem>}
        {canSelectLanguage && (
          <MenuItem icon="web" onClick={onSelectLanguage}>{lang('lng_settings_change_lang')}</MenuItem>
        )}
        {copyOptions.map((option) => (
          <MenuItem
            key={option.label}
            icon={option.icon}
            onClick={option.handler}
            withPreventDefaultOnMouseDown
          >{lang(option.label)}
          </MenuItem>
        ))}
        {canPin && <MenuItem icon="pin" onClick={onPin}>{lang('DialogPin')}</MenuItem>}
        {canUnpin && <MenuItem icon="unpin" onClick={onUnpin}>{lang('DialogUnpin')}</MenuItem>}
        {canSaveGif && <MenuItem icon="gifs" onClick={onSaveGif}>{lang('lng_context_save_gif')}</MenuItem>}
        {canRevote && <MenuItem icon="revote" onClick={onCancelVote}>{lang('lng_polls_retract')}</MenuItem>}
        {canClosePoll && <MenuItem icon="stop" onClick={onClosePoll}>{lang('lng_polls_stop')}</MenuItem>}
        {canDownload && (
          <MenuItem icon="download" onClick={onDownload}>
            {isDownloading ? lang('lng_context_cancel_download') : lang('lng_media_download')}
          </MenuItem>
        )}
        {canForward && <MenuItem icon="forward" onClick={onForward}>{lang('Forward')}</MenuItem>}
        {canSelect && <MenuItem icon="select" onClick={onSelect}>{lang('Common.Select')}</MenuItem>}
        {canReport && <MenuItem icon="flag" onClick={onReport}>{lang('lng_context_report_msg')}</MenuItem>}
        {canDelete && <MenuItem destructive icon="delete" onClick={onDelete}>{lang('Delete')}</MenuItem>}
        {hasCustomEmoji && (
          <>
            <MenuSeparator size="thick" />
            {!customEmojiSets && (
              <>
                <Skeleton inline className="menu-loading-row" />
                <Skeleton inline className="menu-loading-row" />
              </>
            )}
            {customEmojiSets && customEmojiSets.length === 1 && (
              <MenuItem withWrap onClick={handleOpenCustomEmojiSets} className="menu-custom-emoji-sets">
                {renderText(lang('MessageContainsEmojiPack', customEmojiSets[0].title), ['simple_markdown', 'emoji'])}
              </MenuItem>
            )}
            {customEmojiSets && customEmojiSets.length > 1 && (
              <MenuItem withWrap onClick={handleOpenCustomEmojiSets} className="menu-custom-emoji-sets">
                {renderText(lang('MessageContainsEmojiPacks', customEmojiSets.length), ['simple_markdown'])}
              </MenuItem>
            )}
          </>
        )}
        {(canShowSeenBy || canShowReactionsCount) && (
          <>
            <MenuSeparator size={hasCustomEmoji ? 'thin' : 'thick'} />
            <MenuItem
              icon={canShowReactionsCount ? 'heart-outline' : 'group'}
              onClick={canShowReactionsCount ? onShowReactors : onShowSeenBy}
              disabled={!canShowReactionsCount && !seenByDatesCount}
            >
              <span className="MessageContextMenu--seen-by-label-wrapper">
                <span className="MessageContextMenu--seen-by-label" dir={lang.isRtl ? 'rtl' : undefined}>
                  {canShowReactionsCount && message.reactors?.count ? (
                    canShowSeenBy && seenByDatesCount
                      ? lang(
                        'Chat.OutgoingContextMixedReactionCount',
                        [message.reactors.count, seenByDatesCount],
                      )
                      : lang('Chat.ContextReactionCount', message.reactors.count, 'i')
                  ) : (
                    seenByDatesCount === 1 && seenByRecentPeers
                      ? renderText(
                        isUserId(seenByRecentPeers[0].id)
                          ? getUserFullName(seenByRecentPeers[0] as ApiUser)!
                          : (seenByRecentPeers[0] as ApiChat).title,
                      ) : (
                        seenByDatesCount
                          ? lang('Conversation.ContextMenuSeen', seenByDatesCount, 'i')
                          : lang('Conversation.ContextMenuNoViews')
                      )
                  )}
                </span>
              </span>
              <AvatarList className="avatars" size="micro" peers={seenByRecentPeers} />
            </MenuItem>
          </>
        )}
        {(canLoadReadDate || shouldRenderShowWhen || isEdited) && (
          <MenuSeparator size={hasCustomEmoji ? 'thin' : 'thick'} />
        )}
        {(canLoadReadDate || shouldRenderShowWhen) && (
          <ReadTimeMenuItem
            canLoadReadDate={canLoadReadDate}
            shouldRenderShowWhen={shouldRenderShowWhen}
            message={message}
            closeContextMenu={onClose}
          />
        )}
        {isEdited && (
          <LastEditTimeMenuItem
            message={message}
          />
        )}
      </div>
    </Menu>
  );
};

export default memo(MessageContextMenu);
