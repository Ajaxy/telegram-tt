import React, { FC, useCallback, useEffect } from '../../../lib/teact/teact';

import { ApiMessage } from '../../../api/types';
import { IAnchorPosition } from '../../../types';

import { getMessageCopyOptions } from './helpers/copyOptions';
import useContextMenuPosition from '../../../hooks/useContextMenuPosition';
import { dispatchHeavyAnimationEvent } from '../../../hooks/useHeavyAnimationCheck';
import useLang from '../../../hooks/useLang';

import Menu from '../../ui/Menu';
import MenuItem from '../../ui/MenuItem';

import './MessageContextMenu.scss';

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
  canEdit?: boolean;
  canForward?: boolean;
  canFaveSticker?: boolean;
  canUnfaveSticker?: boolean;
  canCopy?: boolean;
  canCopyLink?: boolean;
  canSelect?: boolean;
  onReply: () => void;
  onEdit: () => void;
  onPin: () => void;
  onUnpin: () => void;
  onForward: () => void;
  onDelete: () => void;
  onFaveSticker: () => void;
  onUnfaveSticker: () => void;
  onSelect: () => void;
  onSend: () => void;
  onReschedule: () => void;
  onClose: () => void;
  onCloseAnimationEnd?: () => void;
  onCopyLink?: () => void;
};

const ANIMATION_DURATION = 200;
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
  canForward,
  canFaveSticker,
  canUnfaveSticker,
  canCopy,
  canCopyLink,
  canSelect,
  onReply,
  onEdit,
  onPin,
  onUnpin,
  onForward,
  onDelete,
  onFaveSticker,
  onUnfaveSticker,
  onSelect,
  onSend,
  onReschedule,
  onClose,
  onCloseAnimationEnd,
  onCopyLink,
}) => {
  useEffect(() => {
    dispatchHeavyAnimationEvent(ANIMATION_DURATION);
  }, [isOpen]);

  const copyOptions = getMessageCopyOptions(message, onClose, canCopyLink ? onCopyLink : undefined);

  const getTriggerElement = useCallback(() => {
    return document.querySelector(`.active > .MessageList div[data-message-id="${message.id}"]`);
  }, [message.id]);

  const getRootElement = useCallback(
    () => document.querySelector('.active > .MessageList'),
    [],
  );

  const getMenuElement = useCallback(
    () => document.querySelector('.MessageContextMenu .bubble'),
    [],
  );

  const { positionX, positionY, style } = useContextMenuPosition(
    anchor,
    getTriggerElement,
    getRootElement,
    getMenuElement,
    SCROLLBAR_WIDTH,
    (document.querySelector('.MiddleHeader') as HTMLElement).offsetHeight,
  );

  const lang = useLang();

  return (
    <Menu
      isOpen={isOpen}
      positionX={positionX}
      positionY={positionY}
      style={style}
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
      {canFaveSticker && (
        <MenuItem icon="favorite" onClick={onFaveSticker}>{lang('AddToFavorites')}</MenuItem>
      )}
      {canUnfaveSticker && (
        <MenuItem icon="favorite" onClick={onUnfaveSticker}>{lang('Stickers.RemoveFromFavorites')}</MenuItem>
      )}
      {canCopy && copyOptions.map((options) => (
        <MenuItem key={options.label} icon="copy" onClick={options.handler}>{lang(options.label)}</MenuItem>
      ))}
      {canPin && <MenuItem icon="pin" onClick={onPin}>{lang('DialogPin')}</MenuItem>}
      {canUnpin && <MenuItem icon="unpin" onClick={onUnpin}>{lang('DialogUnpin')}</MenuItem>}
      {canForward && <MenuItem icon="forward" onClick={onForward}>{lang('Forward')}</MenuItem>}
      {canSelect && <MenuItem icon="select" onClick={onSelect}>{lang('Common.Select')}</MenuItem>}
      {canDelete && <MenuItem destructive icon="delete" onClick={onDelete}>{lang('Delete')}</MenuItem>}
    </Menu>
  );
};

export default MessageContextMenu;
