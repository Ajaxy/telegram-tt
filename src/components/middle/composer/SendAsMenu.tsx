import React, {
  FC, useCallback, useEffect, useRef, memo,
} from '../../../lib/teact/teact';

import setTooltipItemVisible from '../../../util/setTooltipItemVisible';
import { useKeyboardNavigation } from './hooks/useKeyboardNavigation';
import { IS_TOUCH_ENV } from '../../../util/environment';
import renderText from '../../common/helpers/renderText';
import { getUserFullName, isUserId } from '../../../global/helpers';
import useMouseInside from '../../../hooks/useMouseInside';
import useLang from '../../../hooks/useLang';
import buildClassName from '../../../util/buildClassName';
import { getActions, getGlobal } from '../../../global';

import ListItem from '../../ui/ListItem';
import Avatar from '../../common/Avatar';
import Menu from '../../ui/Menu';

import './SendAsMenu.scss';

export type OwnProps = {
  isOpen: boolean;
  onClose: () => void;
  chatId?: string;
  selectedSendAsId?: string;
  sendAsIds?: string[];
};

const SendAsMenu: FC<OwnProps> = ({
  isOpen,
  onClose,
  chatId,
  selectedSendAsId,
  sendAsIds,
}) => {
  const { saveDefaultSendAs } = getActions();

  // No need for expensive global updates on users and chats, so we avoid them
  const usersById = getGlobal().users.byId;
  const chatsById = getGlobal().chats.byId;

  const lang = useLang();
  // eslint-disable-next-line no-null/no-null
  const containerRef = useRef<HTMLDivElement>(null);

  const [handleMouseEnter, handleMouseLeave, markMouseInside] = useMouseInside(isOpen, onClose, undefined);

  useEffect(() => {
    if (isOpen) {
      markMouseInside();
    }
  }, [isOpen, markMouseInside]);

  const handleUserSelect = useCallback((id: string) => {
    onClose();
    saveDefaultSendAs({ chatId, sendAsId: id });
  }, [chatId, onClose, saveDefaultSendAs]);

  const selectedSendAsIndex = useKeyboardNavigation({
    isActive: isOpen,
    items: sendAsIds,
    onSelect: handleUserSelect,
    shouldSelectOnTab: true,
    shouldSaveSelectionOnUpdateItems: true,
    onClose,
  });

  useEffect(() => {
    setTooltipItemVisible('.chat-item-clickable', selectedSendAsIndex, containerRef);
  }, [selectedSendAsIndex]);

  useEffect(() => {
    if (sendAsIds && !sendAsIds.length) {
      onClose();
    }
  }, [sendAsIds, onClose]);

  return (
    <Menu
      isOpen={isOpen}
      positionX="left"
      positionY="bottom"
      onClose={onClose}
      className="SendAsMenu"
      onCloseAnimationEnd={onClose}
      onMouseEnter={!IS_TOUCH_ENV ? handleMouseEnter : undefined}
      onMouseLeave={!IS_TOUCH_ENV ? handleMouseLeave : undefined}
      noCloseOnBackdrop={!IS_TOUCH_ENV}
      noCompact
    >
      <div className="send-as-title" dir="auto">{lang('SendMessageAsTitle')}</div>
      {usersById && chatsById && sendAsIds?.map((id, index) => {
        const user = isUserId(id) ? usersById[id] : undefined;
        const chat = !user ? chatsById[id] : undefined;
        const fullName = user ? getUserFullName(user) : chat?.title;

        return (
          <ListItem
            key={id}
            className="SendAsItem chat-item-clickable scroll-item with-avatar"
            // eslint-disable-next-line react/jsx-no-bind
            onClick={() => handleUserSelect(id)}
            focus={selectedSendAsIndex === index}
          >
            <Avatar
              size="small"
              user={user}
              chat={chat}
              className={buildClassName(selectedSendAsId === id && 'selected')}
            />
            <div className="info">
              <div className="title">
                <h3 dir="auto">{fullName && renderText(fullName)}</h3>
              </div>
              <span className="subtitle">{user
                ? lang('VoipGroupPersonalAccount')
                : lang('Subscribers', chat?.membersCount, 'i')}
              </span>
            </div>
          </ListItem>
        );
      })}
    </Menu>
  );
};

export default memo(SendAsMenu);
