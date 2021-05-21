import React, {
  FC, useCallback, useState, useEffect, memo,
} from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';
import useLang from '../../hooks/useLang';

import Button from '../ui/Button';
import Menu from '../ui/Menu';
import MenuItem from '../ui/MenuItem';

import './NewChatButton.scss';

const MENU_CLOSE_DELAY_MS = 750;
let closeTimeout: number | undefined;

type OwnProps = {
  isShown: boolean;
  onNewPrivateChat: () => void;
  onNewChannel: () => void;
  onNewGroup: () => void;
};

const NewChatButton: FC<OwnProps> = ({
  isShown,
  onNewPrivateChat,
  onNewChannel,
  onNewGroup,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    if (!isShown) {
      setIsMenuOpen(false);
    }
  }, [isShown]);

  const lang = useLang();

  const fabClassName = buildClassName(
    'NewChatButton',
    isShown && 'revealed',
    isMenuOpen && 'menu-is-open',
  );

  const toggleIsMenuOpen = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const handleClose = () => {
    setIsMenuOpen(false);
  };

  const handleMouseEnter = useCallback(() => {
    if (closeTimeout) {
      clearTimeout(closeTimeout);
      closeTimeout = undefined;
    }
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (closeTimeout) {
      clearTimeout(closeTimeout);
      closeTimeout = undefined;
    }

    closeTimeout = window.setTimeout(() => {
      setIsMenuOpen(false);
    }, MENU_CLOSE_DELAY_MS);
  }, []);

  return (
    <div
      className={fabClassName}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <Button
        round
        color="primary"
        className={isMenuOpen ? 'active' : ''}
        onClick={toggleIsMenuOpen}
        ariaLabel={lang(isMenuOpen ? 'Close' : 'NewMessageTitle')}
        tabIndex={-1}
      >
        <i className="icon-new-chat-filled" />
        <i className="icon-close" />
      </Button>
      <Menu
        isOpen={isMenuOpen}
        positionX="right"
        positionY="bottom"
        autoClose
        onClose={handleClose}
      >
        <MenuItem icon="channel" onClick={onNewChannel}>{lang('NewChannel')}</MenuItem>
        <MenuItem icon="group" onClick={onNewGroup}>{lang('NewGroup')}</MenuItem>
        <MenuItem icon="user" onClick={onNewPrivateChat}>{lang('NewMessageTitle')}</MenuItem>
      </Menu>
    </div>
  );
};

export default memo(NewChatButton);
