import type { FC } from '../../../lib/teact/teact';
import React, { memo, useEffect, useRef } from '../../../lib/teact/teact';
import { getActions, getGlobal } from '../../../global';

import type { ApiSendAsPeerId } from '../../../api/types';

import buildClassName from '../../../util/buildClassName';
import setTooltipItemVisible from '../../../util/setTooltipItemVisible';
import { IS_TOUCH_ENV } from '../../../util/windowEnvironment';

import useLastCallback from '../../../hooks/useLastCallback';
import useMouseInside from '../../../hooks/useMouseInside';
import useOldLang from '../../../hooks/useOldLang';
import { useKeyboardNavigation } from './hooks/useKeyboardNavigation';

import Avatar from '../../common/Avatar';
import FullNameTitle from '../../common/FullNameTitle';
import Icon from '../../common/icons/Icon';
import ListItem from '../../ui/ListItem';
import Menu from '../../ui/Menu';

import './SendAsMenu.scss';

export type OwnProps = {
  isOpen: boolean;
  chatId?: string;
  selectedSendAsId?: string;
  sendAsPeerIds?: ApiSendAsPeerId[];
  isCurrentUserPremium?: boolean;
  onClose: () => void;
};

const SendAsMenu: FC<OwnProps> = ({
  isOpen,
  chatId,
  selectedSendAsId,
  sendAsPeerIds,
  isCurrentUserPremium,
  onClose,
}) => {
  const { saveDefaultSendAs, showNotification } = getActions();

  // No need for expensive global updates on users and chats, so we avoid them
  const usersById = getGlobal().users.byId;
  const chatsById = getGlobal().chats.byId;

  const lang = useOldLang();
  // eslint-disable-next-line no-null/no-null
  const containerRef = useRef<HTMLDivElement>(null);

  const [handleMouseEnter, handleMouseLeave, markMouseInside] = useMouseInside(isOpen, onClose, undefined);

  useEffect(() => {
    if (isOpen) {
      markMouseInside();
    }
  }, [isOpen, markMouseInside]);

  const handleUserSelect = useLastCallback((id: string) => {
    onClose();
    saveDefaultSendAs({ chatId: chatId!, sendAsId: id });
  });

  const selectedSendAsIndex = useKeyboardNavigation({
    isActive: isOpen,
    items: sendAsPeerIds,
    onSelect: handleUserSelect,
    shouldSelectOnTab: true,
    shouldSaveSelectionOnUpdateItems: true,
    onClose,
  });

  useEffect(() => {
    setTooltipItemVisible('.chat-item-clickable', selectedSendAsIndex, containerRef);
  }, [selectedSendAsIndex]);

  useEffect(() => {
    if (sendAsPeerIds && !sendAsPeerIds.length) {
      onClose();
    }
  }, [sendAsPeerIds, onClose]);

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
      {usersById && chatsById && sendAsPeerIds?.map(({ id, isPremium }, index) => {
        const user = usersById[id];
        const chat = chatsById[id];
        const peer = user || chat;

        const handleClick = () => {
          if (!isPremium || isCurrentUserPremium) {
            handleUserSelect(id);
          } else {
            showNotification({
              message: lang('SelectSendAsPeerPremiumHint'),
              actionText: lang('Open'),
              action: {
                action: 'openPremiumModal',
                payload: {},
              },
            });
          }
        };

        const avatarClassName = buildClassName(selectedSendAsId === id && 'selected');

        return (
          <ListItem
            key={id}
            className="SendAsItem chat-item-clickable scroll-item with-avatar"
            // eslint-disable-next-line react/jsx-no-bind
            onClick={handleClick}
            focus={selectedSendAsIndex === index}
            rightElement={!isCurrentUserPremium && isPremium
              && <Icon name="lock-badge" className="send-as-icon-locked" />}
          >
            <Avatar
              size="small"
              peer={peer}
              className={avatarClassName}
            />
            <div className="info">
              {peer && <FullNameTitle peer={peer} noFake />}
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
