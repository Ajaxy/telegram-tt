import type { FC } from '../../../lib/teact/teact';
import {
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
  ApiWebPage,
} from '../../../api/types';
import type { IAnchorPosition } from '../../../types';

import {
  getUserFullName,
  groupStatefulContent,
} from '../../../global/helpers';
import buildClassName from '../../../util/buildClassName';
import { isUserId } from '../../../util/entities/ids';
import { disableScrolling } from '../../../util/scrollLock';
import { REM } from '../../common/helpers/mediaDimensions';
import renderText from '../../common/helpers/renderText';
import { getMessageCopyOptions } from './helpers/copyOptions';

import useAppLayout from '../../../hooks/useAppLayout';
import useFlag from '../../../hooks/useFlag';
import useLang from '../../../hooks/useLang';
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
  webPage?: ApiWebPage;
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
  canAppendTodoList?: boolean;
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
  onAppendTodoList?: NoneToVoidFunction;
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
  webPage,
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
  canAppendTodoList,
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
  onAppendTodoList,
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
  const menuRef = useRef<HTMLDivElement>();
  const scrollableRef = useRef<HTMLDivElement>();
  const oldLang = useOldLang();
  const lang = useLang();
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

  const [isReady, markIsReady, unmarkIsReady] = useFlag();
  const { isMobile } = useAppLayout();
  const seenByDatesCount = useMemo(() => (seenByDates ? Object.keys(seenByDates).length : 0), [seenByDates]);

  const handleAfterCopy = useLastCallback(() => {
    showNotification({
      message: oldLang('Share.Link.Copied'),
    });
    onClose();
  });

  const handleGiftClick = useLastCallback(() => {
    openGiftModal({ forUserId: message.chatId });
    onClose();
  });

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
    groupStatefulContent({ poll, webPage, story }),
    targetHref,
    canCopy,
    handleAfterCopy,
    canCopyLink ? onCopyLink : undefined,
    onCopyMessages,
    onCopyNumber,
  );

  const getTriggerElement = useLastCallback(() => {
    return document.querySelector(`.Transition_slide-active > .MessageList`);
  });

  const getRootElement = useLastCallback(() => document.body);

  const getMenuElement = useLastCallback(() => document.querySelector('.MessageContextMenu .bubble'));

  const getLayout = useLastCallback(() => {
    return {
      extraPaddingX: SCROLLBAR_WIDTH,
      extraTopPadding: (document.querySelector<HTMLElement>('.MiddleHeader')!).offsetHeight,
      shouldAvoidNegativePosition: true,
      menuElMinWidth: withReactions && isMobile ? REACTION_SELECTOR_WIDTH_REM * REM : undefined,
      withPortal: true,
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
    onClose();
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
      withPortal
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
        />
      )}

      <div
        ref={scrollableRef}
        className={buildClassName(
          'MessageContextMenu_items scrollable-content custom-scroll',
        )}
        dir={lang.isRtl ? 'rtl' : undefined}
      >
        {shouldShowGiftButton
          && (
            <MenuItem icon="gift" onClick={handleGiftClick}>
              {message?.isOutgoing ? oldLang('SendAnotherGift')
                : oldLang('Conversation.ContextMenuSendGiftTo', userFullName)}
            </MenuItem>
          )}
        {canSendNow && <MenuItem icon="send-outline" onClick={onSend}>{oldLang('MessageScheduleSend')}</MenuItem>}
        {canReschedule && (
          <MenuItem icon="schedule" onClick={onReschedule}>{oldLang('MessageScheduleEditTime')}</MenuItem>
        )}
        {canReply && (
          <MenuItem icon="reply" onClick={onReply}>
            {oldLang(canQuote ? 'lng_context_quote_and_reply' : 'Reply')}
          </MenuItem>
        )}
        {!noReplies && Boolean(repliesThreadInfo?.messagesCount) && (
          <MenuItem icon="replies" onClick={onOpenThread}>
            {oldLang('Conversation.ContextViewReplies', repliesThreadInfo.messagesCount, 'i')}
          </MenuItem>
        )}
        {canEdit && <MenuItem icon="edit" onClick={onEdit}>{oldLang('Edit')}</MenuItem>}
        {canAppendTodoList && (
          <MenuItem icon="add" onClick={onAppendTodoList}>
            {lang('MenuButtonAppendTodoList')}
          </MenuItem>
        )}
        {canFaveSticker && (
          <MenuItem icon="favorite" onClick={onFaveSticker}>{oldLang('AddToFavorites')}</MenuItem>
        )}
        {canUnfaveSticker && (
          <MenuItem icon="favorite" onClick={onUnfaveSticker}>{oldLang('Stickers.RemoveFromFavorites')}</MenuItem>
        )}
        {canTranslate && <MenuItem icon="language" onClick={onTranslate}>{oldLang('TranslateMessage')}</MenuItem>}
        {canShowOriginal && (
          <MenuItem icon="language" onClick={onShowOriginal}>
            {oldLang('ShowOriginalButton')}
          </MenuItem>
        )}
        {canSelectLanguage && (
          <MenuItem icon="web" onClick={onSelectLanguage}>{oldLang('lng_settings_change_lang')}</MenuItem>
        )}
        {copyOptions.map((option) => (
          <MenuItem
            key={option.label}
            icon={option.icon}
            onClick={option.handler}
            withPreventDefaultOnMouseDown
          >
            {oldLang(option.label)}
          </MenuItem>
        ))}
        {canPin && <MenuItem icon="pin" onClick={onPin}>{oldLang('DialogPin')}</MenuItem>}
        {canUnpin && <MenuItem icon="unpin" onClick={onUnpin}>{oldLang('DialogUnpin')}</MenuItem>}
        {canSaveGif && <MenuItem icon="gifs" onClick={onSaveGif}>{oldLang('lng_context_save_gif')}</MenuItem>}
        {canRevote && <MenuItem icon="revote" onClick={onCancelVote}>{oldLang('lng_polls_retract')}</MenuItem>}
        {canClosePoll && <MenuItem icon="stop" onClick={onClosePoll}>{oldLang('lng_polls_stop')}</MenuItem>}
        {canDownload && (
          <MenuItem icon="download" onClick={onDownload}>
            {isDownloading ? oldLang('lng_context_cancel_download') : oldLang('lng_media_download')}
          </MenuItem>
        )}
        {canForward && <MenuItem icon="forward" onClick={onForward}>{oldLang('Forward')}</MenuItem>}
        {canSelect && <MenuItem icon="select" onClick={onSelect}>{oldLang('Common.Select')}</MenuItem>}
        {canReport && <MenuItem icon="flag" onClick={onReport}>{oldLang('lng_context_report_msg')}</MenuItem>}
        {canDelete && <MenuItem destructive icon="delete" onClick={onDelete}>{oldLang('Delete')}</MenuItem>}
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
                {renderText(
                  oldLang('MessageContainsEmojiPack', customEmojiSets[0].title), ['simple_markdown', 'emoji'],
                )}
              </MenuItem>
            )}
            {customEmojiSets && customEmojiSets.length > 1 && (
              <MenuItem withWrap onClick={handleOpenCustomEmojiSets} className="menu-custom-emoji-sets">
                {renderText(oldLang('MessageContainsEmojiPacks', customEmojiSets.length), ['simple_markdown'])}
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
                      ? oldLang(
                        'Chat.OutgoingContextMixedReactionCount',
                        [message.reactors.count, seenByDatesCount],
                      )
                      : oldLang('Chat.ContextReactionCount', message.reactors.count, 'i')
                  ) : (
                    seenByDatesCount === 1 && seenByRecentPeers
                      ? renderText(
                        isUserId(seenByRecentPeers[0].id)
                          ? getUserFullName(seenByRecentPeers[0] as ApiUser)!
                          : (seenByRecentPeers[0] as ApiChat).title,
                      ) : (
                        seenByDatesCount
                          ? oldLang('Conversation.ContextMenuSeen', seenByDatesCount, 'i')
                          : oldLang('Conversation.ContextMenuNoViews')
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
