import React, {
  FC, useState, useEffect, memo,
} from '../../lib/teact/teact';

import buildClassName from '../../util/buildClassName';
import useLang from '../../hooks/useLang';

import Button from '../ui/Button';
import Menu from '../ui/Menu';
import MenuItem from '../ui/MenuItem';

import './NewChatButton.scss';

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

  return (
    <div className={fabClassName}>
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
