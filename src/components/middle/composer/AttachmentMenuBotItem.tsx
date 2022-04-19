import React, {
  FC, memo, useCallback, useMemo, useState,
} from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import { IAnchorPosition, ISettings } from '../../../types';
import { ApiAttachMenuBot } from '../../../api/types';

import useFlag from '../../../hooks/useFlag';
import useLang from '../../../hooks/useLang';

import Portal from '../../ui/Portal';
import Menu from '../../ui/Menu';
import MenuItem from '../../ui/MenuItem';
import AttachmentMenuBotIcon from './AttachmentMenuBotIcon';

type OwnProps = {
  bot: ApiAttachMenuBot;
  theme: ISettings['theme'];
  chatId: string;
  onMenuOpened: VoidFunction;
  onMenuClosed: VoidFunction;
};

const AttachmentMenuBotItem: FC<OwnProps> = ({
  bot,
  theme,
  chatId,
  onMenuOpened,
  onMenuClosed,
}) => {
  const { callAttachMenuBot, toggleBotInAttachMenu } = getActions();

  const lang = useLang();

  const icon = useMemo(() => {
    return bot.icons.find(({ name }) => name === 'default_static')?.document;
  }, [bot.icons]);

  const [isMenuOpen, openMenu, closeMenu] = useFlag();
  const [menuPosition, setMenuPosition] = useState<IAnchorPosition | undefined>(undefined);

  const handleContextMenu = useCallback((e: React.UIEvent) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    setMenuPosition({ x: rect.right, y: rect.bottom });
    onMenuOpened();
    openMenu();
  }, [onMenuOpened, openMenu]);

  const handleCloseMenu = useCallback(() => {
    closeMenu();
    onMenuClosed();
  }, [closeMenu, onMenuClosed]);

  const handleCloseAnimationEnd = useCallback(() => {
    setMenuPosition(undefined);
  }, []);

  const handleRemoveBot = useCallback(() => {
    toggleBotInAttachMenu({
      botId: bot.id,
      isEnabled: false,
    });
  }, [bot.id, toggleBotInAttachMenu]);

  return (
    <MenuItem
      key={bot.id}
      customIcon={icon && <AttachmentMenuBotIcon icon={icon} theme={theme} />}
      icon={!icon ? 'bots' : undefined}
      // eslint-disable-next-line react/jsx-no-bind
      onClick={() => callAttachMenuBot({
        botId: bot.id,
        chatId,
      })}
      onContextMenu={handleContextMenu}
    >
      {bot.shortName}
      {menuPosition && (
        <Portal>
          <Menu
            isOpen={isMenuOpen}
            positionX="right"
            style={`left: ${menuPosition.x}px;top: ${menuPosition.y}px;`}
            className="bot-attach-context-menu"
            autoClose
            onClose={handleCloseMenu}
            onCloseAnimationEnd={handleCloseAnimationEnd}
          >
            <MenuItem icon="stop" destructive onClick={handleRemoveBot}>{lang('WebApp.RemoveBot')}</MenuItem>
          </Menu>
        </Portal>
      )}

    </MenuItem>
  );
};

export default memo(AttachmentMenuBotItem);
