import React, {
  FC, memo, useCallback, useEffect, useRef,
} from '../../../lib/teact/teact';

import { ApiMessage, ApiUser } from '../../../api/types';
import { IAnchorPosition } from '../../../types';

import { getMessageCopyOptions } from './helpers/copyOptions';
import { disableScrolling, enableScrolling } from '../../../util/scrollLock';
import useContextMenuPosition from '../../../hooks/useContextMenuPosition';
import useLang from '../../../hooks/useLang';

import Menu from '../../ui/Menu';
import MenuItem from '../../ui/MenuItem';
import Avatar from '../../common/Avatar';

import './MessageContextMenu.scss';
import { getUserFullName } from '../../../modules/helpers';

type OwnProps = {
  isOpen: boolean;
  anchor: IAnchorPosition;
  message: ApiMessage;
  canSendNow?: boolean;
  canReschedule?: boolean;
  canReply?: boolean;
  canPin?: boolean;
  canUnpin?: boolean;
  canDelete?: boolean;
  canReport?: boolean;
  canEdit?: boolean;
  canForward?: boolean;
  canFaveSticker?: boolean;
  canUnfaveSticker?: boolean;
  canCopy?: boolean;
  canCopyLink?: boolean;
  canSelect?: boolean;
  canDownload?: boolean;
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
  onDownload?: () => void;
  onShowSeenBy?: () => void;
};

const SCROLLBAR_WIDTH = 10;

const MessageContextMenu: FC<OwnProps> = ({
  isOpen,
  message,
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
  isDownloading,
  canShowSeenBy,
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
  onDownload,
  onShowSeenBy,
}) => {
  // eslint-disable-next-line no-null/no-null
  const menuRef = useRef<HTMLDivElement>(null);
  const copyOptions = getMessageCopyOptions(message, onClose, canCopyLink ? onCopyLink : undefined);

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

  const {
    positionX, positionY, style, menuStyle, withScroll,
  } = useContextMenuPosition(
    anchor,
    getTriggerElement,
    getRootElement,
    getMenuElement,
    SCROLLBAR_WIDTH,
    (document.querySelector('.MiddleHeader') as HTMLElement).offsetHeight,
  );

  useEffect(() => {
    disableScrolling(withScroll ? menuRef.current : undefined);

    return enableScrolling;
  }, [withScroll]);

  const lang = useLang();

  return (
    <Menu
      ref={menuRef}
      isOpen={isOpen}
      positionX={positionX}
      positionY={positionY}
      style={style}
      menuStyle={menuStyle}
      className="MessageContextMenu fluid"
      onClose={onClose}
      onCloseAnimationEnd={onCloseAnimationEnd}
    >
      {canSendNow && <MenuItem icon="send-outline" onClick={onSend}>{lang('MessageScheduleSend')}</MenuItem>}
      {canReschedule && (
        <MenuItem icon="schedule" onClick={onReschedule}>{lang('MessageScheduleEditTime')}</MenuItem>
      )}
      {canReply && <MenuItem icon="reply" onClick={onReply}>{lang('Reply')}</MenuItem>}
      {canEdit && <MenuItem icon="edit" onClick={onEdit}>{lang('Edit')}</MenuItem>}
      {canFaveSticker && !canUnfaveSticker && (
        <MenuItem icon="favorite" onClick={onFaveSticker}>{lang('AddToFavorites')}</MenuItem>
      )}
      {canUnfaveSticker && !canFaveSticker && (
        <MenuItem icon="favorite" onClick={onUnfaveSticker}>{lang('Stickers.RemoveFromFavorites')}</MenuItem>
      )}
      {canCopy && copyOptions.map((options) => (
        <MenuItem key={options.label} icon="copy" onClick={options.handler}>{lang(options.label)}</MenuItem>
      ))}
      {canPin && !canUnpin && <MenuItem icon="pin" onClick={onPin}>{lang('DialogPin')}</MenuItem>}
      {canUnpin && !canPin && <MenuItem icon="unpin" onClick={onUnpin}>{lang('DialogUnpin')}</MenuItem>}
      {canDownload && (
        <MenuItem icon="download" onClick={onDownload}>
          {isDownloading ? lang('lng_context_cancel_download') : lang('lng_media_download')}
        </MenuItem>
      )}
      {canForward && <MenuItem icon="forward" onClick={onForward}>{lang('Forward')}</MenuItem>}
      {canSelect && <MenuItem icon="select" onClick={onSelect}>{lang('Common.Select')}</MenuItem>}
      {canReport && <MenuItem icon="flag" onClick={onReport}>{lang('lng_context_report_msg')}</MenuItem>}
      {canShowSeenBy && (
        <MenuItem icon="group" onClick={onShowSeenBy} disabled={!message.seenByUserIds?.length}>
          {message.seenByUserIds?.length === 1 && (
            getUserFullName(seenByRecentUsers[0])
          )}
          {message.seenByUserIds?.length !== 1 && (
            message.seenByUserIds?.length
            ? lang('Conversation.ContextMenuSeen', message.seenByUserIds?.length, 'i')
            : lang('Conversation.ContextMenuNoViews'))}
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
    </Menu>
  );
};

export default memo(MessageContextMenu);
