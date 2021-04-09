import React, {
  FC, memo, useCallback, useEffect, useState,
} from '../../lib/teact/teact';
import { withGlobal } from '../../lib/teact/teactn';

import { GlobalActions } from '../../global/types';
import { ApiChat } from '../../api/types';
import { IAnchorPosition } from '../../types';

import { IS_MOBILE_SCREEN } from '../../util/environment';
import { disableScrolling, enableScrolling } from '../../util/scrollLock';
import { selectChat } from '../../modules/selectors';
import { pick } from '../../util/iteratees';
import { isChatPrivate, getCanDeleteChat } from '../../modules/helpers';
import useShowTransition from '../../hooks/useShowTransition';
import useLang from '../../hooks/useLang';

import Portal from '../ui/Portal';
import Menu from '../ui/Menu';
import MenuItem from '../ui/MenuItem';
import DeleteChatModal from '../common/DeleteChatModal';

import './HeaderMenuContainer.scss';

type DispatchProps = Pick<GlobalActions, 'updateChatMutedState' | 'toggleStatistics' | 'enterMessageSelectMode'>;

export type OwnProps = {
  chatId: number;
  threadId: number;
  isOpen: boolean;
  anchor: IAnchorPosition;
  isChannel?: boolean;
  canSubscribe?: boolean;
  canSearch?: boolean;
  canMute?: boolean;
  canSelect?: boolean;
  canSeeStatistics?: boolean;
  canLeave?: boolean;
  onSubscribeChannel: () => void;
  onSearchClick: () => void;
  onClose: () => void;
  onCloseAnimationEnd: () => void;
};

type StateProps = {
  chat?: ApiChat;
  isPrivate?: boolean;
  isMuted?: boolean;
  canDeleteChat?: boolean;
};

const HeaderMenuContainer: FC<OwnProps & StateProps & DispatchProps> = ({
  chatId,
  isOpen,
  anchor,
  isChannel,
  canSubscribe,
  canSearch,
  canMute,
  canSelect,
  canSeeStatistics,
  canLeave,
  chat,
  isPrivate,
  isMuted,
  canDeleteChat,
  onSubscribeChannel,
  onSearchClick,
  onClose,
  onCloseAnimationEnd,
  updateChatMutedState,
  toggleStatistics,
  enterMessageSelectMode,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(true);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const { x, y } = anchor;

  useShowTransition(isOpen, onCloseAnimationEnd, undefined, false);

  const handleDelete = useCallback(() => {
    setIsMenuOpen(false);
    setIsDeleteModalOpen(true);
  }, []);

  const closeMenu = useCallback(() => {
    setIsMenuOpen(false);
    onClose();
  }, [onClose]);

  const closeDeleteModal = useCallback(() => {
    setIsDeleteModalOpen(false);
    onClose();
  }, [onClose]);

  const handleToggleMuteClick = useCallback(() => {
    updateChatMutedState({ chatId, isMuted: !isMuted });
    closeMenu();
  }, [chatId, closeMenu, isMuted, updateChatMutedState]);

  const handleSubscribe = useCallback(() => {
    onSubscribeChannel();
    closeMenu();
  }, [closeMenu, onSubscribeChannel]);

  const handleSearch = useCallback(() => {
    onSearchClick();
    closeMenu();
  }, [closeMenu, onSearchClick]);

  const handleStatistics = useCallback(() => {
    toggleStatistics();
    closeMenu();
  }, [closeMenu, toggleStatistics]);

  const handleSelectMessages = useCallback(() => {
    enterMessageSelectMode();
    closeMenu();
  }, [closeMenu, enterMessageSelectMode]);

  useEffect(() => {
    disableScrolling();

    return enableScrolling;
  }, []);

  const lang = useLang();

  return (
    <Portal>
      <div className="HeaderMenuContainer">
        <Menu
          isOpen={isMenuOpen}
          positionX="right"
          style={`left: ${x}px;top: ${y}px;`}
          onClose={closeMenu}
        >
          {IS_MOBILE_SCREEN && canSubscribe && (
            <MenuItem
              icon={isChannel ? 'channel' : 'group'}
              onClick={handleSubscribe}
            >
              {lang(isChannel ? 'Subscribe' : 'Join Group')}
            </MenuItem>
          )}
          {IS_MOBILE_SCREEN && canSearch && (
            <MenuItem
              icon="search"
              onClick={handleSearch}
            >
              {lang('Search')}
            </MenuItem>
          )}
          {canMute && (
            <MenuItem
              icon={isMuted ? 'unmute' : 'mute'}
              onClick={handleToggleMuteClick}
            >
              {lang(isMuted ? 'ChatsUnmute' : 'ChatsMute')}
            </MenuItem>
          )}
          {canSelect && (
            <MenuItem
              icon="select"
              onClick={handleSelectMessages}
            >
              {lang('ReportSelectMessages')}
            </MenuItem>
          )}
          {canSeeStatistics && (
            <MenuItem
              icon="poll"
              onClick={handleStatistics}
            >
              {lang('Statistics')}
            </MenuItem>
          )}
          {canLeave && (
            <MenuItem
              destructive
              icon="delete"
              onClick={handleDelete}
            >
              {lang(isPrivate ? 'Delete' : (canDeleteChat ? 'Delete and Leave' : 'Leave'))}
            </MenuItem>
          )}
        </Menu>
        {chat && (
          <DeleteChatModal
            isOpen={isDeleteModalOpen}
            onClose={closeDeleteModal}
            chat={chat}
          />
        )}
      </div>
    </Portal>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { chatId }): StateProps => {
    const chat = selectChat(global, chatId);
    if (!chat || chat.isRestricted) {
      return {};
    }

    return {
      chat,
      isMuted: chat.isMuted,
      isPrivate: isChatPrivate(chat.id),
      canDeleteChat: getCanDeleteChat(chat),
    };
  },
  (setGlobal, actions): DispatchProps => pick(actions, [
    'updateChatMutedState',
    'toggleStatistics',
    'enterMessageSelectMode',
  ]),
)(HeaderMenuContainer));
