import type { FC } from '../../../lib/teact/teact';
import React, {
  memo, useCallback, useEffect, useRef,
} from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import type { ApiAvailableReaction, ApiMessage, ApiUser } from '../../../api/types';
import type { IAnchorPosition } from '../../../types';

import { getMessageCopyOptions } from './helpers/copyOptions';
import { disableScrolling, enableScrolling } from '../../../util/scrollLock';
import { getUserFullName } from '../../../global/helpers';
import buildClassName from '../../../util/buildClassName';
import { IS_SINGLE_COLUMN_LAYOUT } from '../../../util/environment';

import useFlag from '../../../hooks/useFlag';
import useContextMenuPosition from '../../../hooks/useContextMenuPosition';
import useLang from '../../../hooks/useLang';

import Menu from '../../ui/Menu';
import MenuItem from '../../ui/MenuItem';
import Avatar from '../../common/Avatar';
import ReactionSelector from './ReactionSelector';

import './MessageContextMenu.scss';

type OwnProps = {
  availableReactions?: ApiAvailableReaction[];
  isOpen: boolean;
  anchor: IAnchorPosition;
  message: ApiMessage;
  canSendNow?: boolean;
  enabledReactions?: string[];
  canReschedule?: boolean;
  canReply?: boolean;
  canPin?: boolean;
  canUnpin?: boolean;
  canDelete?: boolean;
  canReport?: boolean;
  canShowReactionsCount?: boolean;
  canShowReactionList?: boolean;
  canRemoveReaction?: boolean;
  canEdit?: boolean;
  canForward?: boolean;
  canFaveSticker?: boolean;
  canUnfaveSticker?: boolean;
  canCopy?: boolean;
  canCopyLink?: boolean;
  canSelect?: boolean;
  isPrivate?: boolean;
  canDownload?: boolean;
  canSaveGif?: boolean;
  isDownloading?: boolean;
  canShowSeenBy?: boolean;
  seenByRecentUsers?: ApiUser[];
  onReply: () => void;
  onEdit: () => void;
  onPin: () => void;
  onUnpin: () => void;
  onForward: () => void;
  onDelete: () => void;
  onReport: () => void;
  onFaveSticker: () => void;
  onUnfaveSticker: () => void;
  onSelect: () => void;
  onSend: () => void;
  onReschedule: () => void;
  onClose: () => void;
  onCloseAnimationEnd?: () => void;
  onCopyLink?: () => void;
  onCopyMessages?: (messageIds: number[]) => void;
  onCopyNumber?: () => void;
  onDownload?: () => void;
  onSaveGif?: () => void;
  onShowSeenBy?: () => void;
  onShowReactors?: () => void;
  onSendReaction: (reaction: string | undefined, x: number, y: number) => void;
};

const SCROLLBAR_WIDTH = 10;
const REACTION_BUBBLE_EXTRA_WIDTH = 32;
const ANIMATION_DURATION = 200;

const MessageContextMenu: FC<OwnProps> = ({
  availableReactions,
  isOpen,
  message,
  isPrivate,
  enabledReactions,
  anchor,
  canSendNow,
  canReschedule,
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
  isDownloading,
  canShowSeenBy,
  canShowReactionsCount,
  canRemoveReaction,
  canShowReactionList,
  seenByRecentUsers,
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
  onShowSeenBy,
  onShowReactors,
  onSendReaction,
  onCopyMessages,
}) => {
  const { showNotification } = getActions();
  // eslint-disable-next-line no-null/no-null
  const menuRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const scrollableRef = useRef<HTMLDivElement>(null);
  const lang = useLang();
  const noReactions = !isPrivate && !enabledReactions?.length;
  const withReactions = canShowReactionList && !noReactions;

  const [isReady, markIsReady, unmarkIsReady] = useFlag();

  const handleAfterCopy = useCallback(() => {
    showNotification({
      message: lang('Share.Link.Copied'),
    });
    onClose();
  }, [lang, onClose, showNotification]);

  const copyOptions = getMessageCopyOptions(
    message, handleAfterCopy, canCopyLink ? onCopyLink : undefined, onCopyMessages, onCopyNumber,
  );

  const getTriggerElement = useCallback(() => {
    return document.querySelector(`.Transition__slide--active > .MessageList div[data-message-id="${message.id}"]`);
  }, [message.id]);

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

  const handleRemoveReaction = useCallback(() => {
    onSendReaction(undefined, 0, 0);
  }, [onSendReaction]);

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
      {canShowReactionList && (
        <ReactionSelector
          enabledReactions={enabledReactions}
          onSendReaction={onSendReaction}
          isPrivate={isPrivate}
          availableReactions={availableReactions}
          isReady={isReady}
        />
      )}

      <div
        className="scrollable-content custom-scroll"
        style={menuStyle}
        ref={scrollableRef}
      >
        {canRemoveReaction && <MenuItem icon="heart-outline" onClick={handleRemoveReaction}>Remove Reaction</MenuItem>}
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
        {canDownload && (
          <MenuItem icon="download" onClick={onDownload}>
            {isDownloading ? lang('lng_context_cancel_download') : lang('lng_media_download')}
          </MenuItem>
        )}
        {canForward && <MenuItem icon="forward" onClick={onForward}>{lang('Forward')}</MenuItem>}
        {canSelect && <MenuItem icon="select" onClick={onSelect}>{lang('Common.Select')}</MenuItem>}
        {canReport && <MenuItem icon="flag" onClick={onReport}>{lang('lng_context_report_msg')}</MenuItem>}
        {(canShowSeenBy || canShowReactionsCount) && (
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
                  ? getUserFullName(seenByRecentUsers[0])
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
      </div>
    </Menu>
  );
};

export default memo(MessageContextMenu);
