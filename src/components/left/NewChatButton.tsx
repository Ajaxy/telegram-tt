import type { FC } from '../../lib/teact/teact';
import {
  useCallback, useEffect, useMemo, useState,
} from '../../lib/teact/teact';
import { getActions } from '../../global';

import buildClassName from '../../util/buildClassName';

import useOldLang from '../../hooks/useOldLang';

import Icon from '../common/icons/Icon';
import Button from '../ui/Button';
import Menu from '../ui/Menu';
import MenuItem from '../ui/MenuItem';

import './NewChatButton.scss';

type OwnProps = {
  isShown: boolean;
  onNewPrivateChat: () => void;
  onNewChannel: () => void;
  onNewGroup: () => void;
  isAccountFrozen?: boolean;
};

const NewChatButton: FC<OwnProps> = ({
  isShown,
  onNewPrivateChat,
  onNewChannel,
  onNewGroup,
  isAccountFrozen,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { openFrozenAccountModal } = getActions();

  const shouldRender = isShown || isMenuOpen;

  useEffect(() => {
    if (!shouldRender) {
      setIsMenuOpen(false);
    }
  }, [shouldRender]);

  const lang = useOldLang();

  const fabClassName = buildClassName(
    'NewChatButton',
    shouldRender && 'revealed',
    isMenuOpen && 'menu-is-open',
  );

  const toggleIsMenuOpen = useCallback(() => {
    if (isAccountFrozen) {
      openFrozenAccountModal();
      return;
    }
    setIsMenuOpen(!isMenuOpen);
  }, [isMenuOpen, isAccountFrozen]);

  const handleClose = useCallback(() => {
    setIsMenuOpen(false);
  }, []);

  const menuItems = useMemo(() => (
    <>
      <MenuItem icon="channel" onClick={onNewChannel}>{lang('NewChannel')}</MenuItem>
      <MenuItem icon="group" onClick={onNewGroup}>{lang('NewGroup')}</MenuItem>
      <MenuItem icon="user" onClick={onNewPrivateChat}>{lang('NewMessageTitle')}</MenuItem>
    </>
  ), [lang, onNewChannel, onNewGroup, onNewPrivateChat]);

  return (
    <div className={fabClassName} dir={lang.isRtl ? 'rtl' : undefined}>
      <Button
        round
        color="primary"
        className={isMenuOpen ? 'active' : ''}
        onClick={toggleIsMenuOpen}
        ariaLabel={lang(isMenuOpen ? 'Close' : 'NewMessageTitle')}
        tabIndex={-1}
      >
        <Icon name="new-chat-filled" />
        <Icon name="close" />
      </Button>
      <Menu
        isOpen={isMenuOpen}
        positionX={lang.isRtl ? 'left' : 'right'}
        positionY="bottom"
        autoClose
        onClose={handleClose}
      >
        {menuItems}
      </Menu>
    </div>
  );
};

export default NewChatButton;
