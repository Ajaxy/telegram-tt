import type { FC } from '../../../lib/teact/teact';
import React, {
  memo, useMemo, useState,
} from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import type { ApiAttachBot } from '../../../api/types';
import type { IAnchorPosition, ISettings, ThreadId } from '../../../types';

import useFlag from '../../../hooks/useFlag';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import Menu from '../../ui/Menu';
import MenuItem from '../../ui/MenuItem';
import AttachBotIcon from './AttachBotIcon';

type OwnProps = {
  bot: ApiAttachBot;
  theme: ISettings['theme'];
  isInSideMenu?: true;
  chatId?: string;
  threadId?: ThreadId;
  canShowNew?: boolean;
  onMenuOpened: VoidFunction;
  onMenuClosed: VoidFunction;
};

const AttachBotItem: FC<OwnProps> = ({
  bot,
  theme,
  chatId,
  threadId,
  isInSideMenu,
  canShowNew,
  onMenuOpened,
  onMenuClosed,
}) => {
  const { callAttachBot, toggleAttachBot } = getActions();

  const lang = useLang();

  const icon = useMemo(() => {
    return bot.icons.find(({ name }) => name === 'default_static')?.document;
  }, [bot.icons]);

  const [isMenuOpen, openMenu, closeMenu] = useFlag();
  const [menuPosition, setMenuPosition] = useState<IAnchorPosition | undefined>(undefined);

  const handleContextMenu = useLastCallback((e: React.UIEvent) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    setMenuPosition({ x: rect.right, y: rect.bottom });
    onMenuOpened();
    openMenu();
  });

  const handleClick = useLastCallback(() => {
    if (isInSideMenu) {
      callAttachBot({
        bot,
        isFromSideMenu: true,
      });
    } else {
      callAttachBot({
        bot,
        chatId: chatId!,
        threadId,
      });
    }
  });

  const handleCloseMenu = useLastCallback(() => {
    closeMenu();
    onMenuClosed();
  });

  const handleCloseAnimationEnd = useLastCallback(() => {
    setMenuPosition(undefined);
  });

  const handleRemoveBot = useLastCallback(() => {
    toggleAttachBot({
      botId: bot.id,
      isEnabled: false,
    });
  });

  return (
    <MenuItem
      key={bot.id}
      customIcon={icon && <AttachBotIcon icon={icon} theme={theme} />}
      icon={!icon ? 'bots' : undefined}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
    >
      {bot.shortName}
      {canShowNew && bot.isDisclaimerNeeded && <span className="menu-item-badge">{lang('New')}</span>}
      {menuPosition && (
        <Menu
          isOpen={isMenuOpen}
          positionX="right"
          style={`left: ${menuPosition.x}px;top: ${menuPosition.y}px;`}
          className="bot-attach-context-menu"
          autoClose
          withPortal
          onClose={handleCloseMenu}
          onCloseAnimationEnd={handleCloseAnimationEnd}
        >
          <MenuItem icon="stop" destructive onClick={handleRemoveBot}>{lang('WebApp.RemoveBot')}</MenuItem>
        </Menu>
      )}

    </MenuItem>
  );
};

export default memo(AttachBotItem);
