import React, {
  memo, useCallback, useEffect, useRef,
} from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import type { FC } from '../../../lib/teact/teact';
import type {
  ApiAvailableReaction, ApiChatReactions, ApiMessage, ApiReaction, ApiSponsoredMessage, ApiStickerSet, ApiUser,
} from '../../../api/types';
import type { IAnchorPosition } from '../../../types';

import { getMessageCopyOptions } from './helpers/copyOptions';
import { disableScrolling, enableScrolling } from '../../../util/scrollLock';
import { getUserFullName } from '../../../global/helpers';
import buildClassName from '../../../util/buildClassName';
import { IS_SINGLE_COLUMN_LAYOUT } from '../../../util/environment';
import renderText from '../../common/helpers/renderText';

import useFlag from '../../../hooks/useFlag';
import useContextMenuPosition from '../../../hooks/useContextMenuPosition';
import useLang from '../../../hooks/useLang';

import Menu from '../../ui/Menu';
import MenuItem from '../../ui/MenuItem';
import MenuSeparator from '../../ui/MenuSeparator';
import Skeleton from '../../ui/Skeleton';
import Avatar from '../../common/Avatar';
import ReactionSelector from './ReactionSelector';

import './MessageContextMenu.scss';

type OwnProps = {
  availableReactions?: ApiAvailableReaction[];
  isOpen: boolean;
  anchor: IAnchorPosition;
  message: ApiMessage | ApiSponsoredMessage;
  canSendNow?: boolean;
  enabledReactions?: ApiChatReactions;
  maxUniqueReactions?: number;
  canReschedule?: boolean;
  canReply?: boolean;
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
  isPrivate?: boolean;
  isCurrentUserPremium?: boolean;
  canDownload?: boolean;
  canSaveGif?: boolean;
  canRevote?: boolean;
  canClosePoll?: boolean;
  isDownloading?: boolean;
  canShowSeenBy?: boolean;
  seenByRecentUsers?: ApiUser[];
  hasCustomEmoji?: boolean;
  customEmojiSets?: ApiStickerSet[];
  onReply?: () => void;
  onEdit?: () => void;
  onPin?: () => void;
  onUnpin?: () => void;
  onForward?: () => void;
  onDelete?: () => void;
  onReport?: () => void;
  onFaveSticker?: () => void;
  onUnfaveSticker?: () => void;
  onSelect?: () => void;
  onSend?: () => void;
  onReschedule?: () => void;
  onClose: () => void;
  onCloseAnimationEnd?: () => void;
  onCopyLink?: () => void;
  onCopyMessages?: (messageIds: number[]) => void;
  onCopyNumber?: () => void;
  onDownload?: () => void;
  onSaveGif?: () => void;
  onCancelVote?: () => void;
  onClosePoll?: () => void;
  onShowSeenBy?: () => void;
  onShowReactors?: () => void;
  onAboutAds?: () => void;
  onSponsoredHide?: () => void;
  onToggleReaction?: (reaction: ApiReaction) => void;
};

const SCROLLBAR_WIDTH = 10;
const REACTION_BUBBLE_EXTRA_WIDTH = 32;
const ANIMATION_DURATION = 200;

const MessageContextMenu: FC<OwnProps> = ({
  availableReactions,
  isOpen,
  message,
  isPrivate,
  isCurrentUserPremium,
  enabledReactions,
  maxUniqueReactions,
  anchor,
  canSendNow,
  canReschedule,
  canBuyPremium,
  canReply,
  canEdit,
  canPin,
  canUnpin,
  canDelete,
  canReport,
  canForward,
  canFaveSticker,
  canUnfaveSticker,
  canCopy,
  canCopyLink,
  canSelect,
  canDownload,
  canSaveGif,
  canRevote,
  canClosePoll,
  isDownloading,
  canShowSeenBy,
  canShowReactionsCount,
  canShowReactionList,
  seenByRecentUsers,
  hasCustomEmoji,
  customEmojiSets,
  onReply,
  onEdit,
  onPin,
  onUnpin,
  onForward,
  onDelete,
  onReport,
  onFaveSticker,
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
  onCopyMessages,
  onAboutAds,
  onSponsoredHide,
}) => {
  const { showNotification, openStickerSet, openCustomEmojiSets } = getActions();
  // eslint-disable-next-line no-null/no-null
  const menuRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const scrollableRef = useRef<HTMLDivElement>(null);
  const lang = useLang();
  const noReactions = !isPrivate && !enabledReactions;
  const withReactions = canShowReactionList && !noReactions;
  const isSponsoredMessage = !('id' in message);
  const messageId = !isSponsoredMessage ? message.id : '';

  const [isReady, markIsReady, unmarkIsReady] = useFlag();

  const handleAfterCopy = useCallback(() => {
    showNotification({
      message: lang('Share.Link.Copied'),
    });
    onClose();
  }, [lang, onClose, showNotification]);

  const handleOpenCustomEmojiSets = useCallback(() => {
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
  }, [customEmojiSets, onClose, openCustomEmojiSets, openStickerSet]);

  const copyOptions = isSponsoredMessage
    ? []
    : getMessageCopyOptions(
      message, handleAfterCopy, canCopyLink ? onCopyLink : undefined, onCopyMessages, onCopyNumber,
    );

  const getTriggerElement = useCallback(() => {
    return isSponsoredMessage
      ? document.querySelector('.Transition__slide--active > .MessageList .SponsoredMessage')
      : document.querySelector(`.Transition__slide--active > .MessageList div[data-message-id="${messageId}"]`);
  }, [isSponsoredMessage, messageId]);

  const getRootElement = useCallback(
    () => document.querySelector('.Transition__slide--active > .MessageList'),
    [],
  );

  const getMenuElement = useCallback(
    () => document.querySelector('.MessageContextMenu .bubble'),
    [],
  );

  const getLayout = useCallback(() => {
    const extraHeightAudioPlayer = (IS_SINGLE_COLUMN_LAYOUT
      && (document.querySelector<HTMLElement>('.AudioPlayer-content'))?.offsetHeight) || 0;
    const pinnedElement = document.querySelector<HTMLElement>('.HeaderPinnedMessage-wrapper');
    const extraHeightPinned = (((IS_SINGLE_COLUMN_LAYOUT && !extraHeightAudioPlayer)
      || (!IS_SINGLE_COLUMN_LAYOUT && pinnedElement?.classList.contains('full-width')))
      && pinnedElement?.offsetHeight) || 0;

    return {
      extraPaddingX: SCROLLBAR_WIDTH,
      extraTopPadding: (document.querySelector<HTMLElement>('.MiddleHeader')!).offsetHeight,
      marginSides: withReactions ? REACTION_BUBBLE_EXTRA_WIDTH : undefined,
      extraMarginTop: extraHeightPinned + extraHeightAudioPlayer,
    };
  }, [withReactions]);

  useEffect(() => {
    if (!isOpen) {
      unmarkIsReady();
      return;
    }

    setTimeout(() => {
      markIsReady();
    }, ANIMATION_DURATION);
  }, [isOpen, markIsReady, unmarkIsReady]);

  const {
    positionX, positionY, transformOriginX, transformOriginY, style, menuStyle, withScroll,
  } = useContextMenuPosition(anchor, getTriggerElement, getRootElement, getMenuElement, getLayout);

  useEffect(() => {
    disableScrolling(withScroll ? scrollableRef.current : undefined, '.ReactionSelector');

    return enableScrolling;
  }, [withScroll]);

  return (
    <Menu
      ref={menuRef}
      isOpen={isOpen}
      transformOriginX={transformOriginX}
      transformOriginY={transformOriginY}
      positionX={positionX}
      positionY={positionY}
      style={style}
      bubbleStyle={menuStyle}
      className={buildClassName(
        'MessageContextMenu', 'fluid', withReactions && 'with-reactions',
      )}
      onClose={onClose}
      onCloseAnimationEnd={onCloseAnimationEnd}
    >
      {withReactions && (
        <ReactionSelector
          enabledReactions={enabledReactions}
          currentReactions={!isSponsoredMessage ? message.reactions?.results : undefined}
          maxUniqueReactions={maxUniqueReactions}
          onToggleReaction={onToggleReaction!}
          isPrivate={isPrivate}
          availableReactions={availableReactions}
          isReady={isReady}
          canBuyPremium={canBuyPremium}
          isCurrentUserPremium={isCurrentUserPremium}
        />
      )}

      <div
        className="scrollable-content custom-scroll"
        style={menuStyle}
        ref={scrollableRef}
      >
        {canSendNow && <MenuItem icon="send-outline" onClick={onSend}>{lang('MessageScheduleSend')}</MenuItem>}
        {canReschedule && (
          <MenuItem icon="schedule" onClick={onReschedule}>{lang('MessageScheduleEditTime')}</MenuItem>
        )}
        {canReply && <MenuItem icon="reply" onClick={onReply}>{lang('Reply')}</MenuItem>}
        {canEdit && <MenuItem icon="edit" onClick={onEdit}>{lang('Edit')}</MenuItem>}
        {canFaveSticker && (
          <MenuItem icon="favorite" onClick={onFaveSticker}>{lang('AddToFavorites')}</MenuItem>
        )}
        {canUnfaveSticker && (
          <MenuItem icon="favorite" onClick={onUnfaveSticker}>{lang('Stickers.RemoveFromFavorites')}</MenuItem>
        )}
        {canCopy && copyOptions.map((option) => (
          <MenuItem key={option.label} icon={option.icon} onClick={option.handler}>{lang(option.label)}</MenuItem>
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
        {(canShowSeenBy || canShowReactionsCount) && !isSponsoredMessage && (
          <MenuItem
            className="MessageContextMenu--seen-by"
            icon={canShowReactionsCount ? 'heart-outline' : 'group'}
            onClick={canShowReactionsCount ? onShowReactors : onShowSeenBy}
            disabled={!canShowReactionsCount && !message.seenByUserIds?.length}
          >
            <span className="MessageContextMenu--seen-by-label">
              {canShowReactionsCount && message.reactors?.count ? (
                canShowSeenBy && message.seenByUserIds?.length
                  ? lang(
                    'Chat.OutgoingContextMixedReactionCount',
                    [message.reactors.count, message.seenByUserIds.length],
                  )
                  : lang('Chat.ContextReactionCount', message.reactors.count, 'i')
              ) : (
                message.seenByUserIds?.length === 1 && seenByRecentUsers
                  ? renderText(getUserFullName(seenByRecentUsers[0])!)
                  : (message.seenByUserIds?.length
                    ? lang('Conversation.ContextMenuSeen', message.seenByUserIds.length, 'i')
                    : lang('Conversation.ContextMenuNoViews')
                  )
              )}
            </span>
            <div className="avatars">
              {seenByRecentUsers?.map((user) => (
                <Avatar
                  size="micro"
                  user={user}
                />
              ))}
            </div>
          </MenuItem>
        )}
        {canDelete && <MenuItem destructive icon="delete" onClick={onDelete}>{lang('Delete')}</MenuItem>}
        {hasCustomEmoji && (
          <>
            <MenuSeparator />
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
        {isSponsoredMessage && <MenuItem icon="help" onClick={onAboutAds}>{lang('SponsoredMessageInfo')}</MenuItem>}
        {isSponsoredMessage && onSponsoredHide && (
          <MenuItem icon="stop" onClick={onSponsoredHide}>{lang('HideAd')}</MenuItem>
        )}
      </div>
    </Menu>
  );
};

export default memo(MessageContextMenu);
