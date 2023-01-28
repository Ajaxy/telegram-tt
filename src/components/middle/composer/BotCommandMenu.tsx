import React, { memo, useCallback } from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import type { FC } from '../../../lib/teact/teact';
import type { ApiBotCommand } from '../../../api/types';

import { IS_TOUCH_ENV } from '../../../util/environment';
import useMouseInside from '../../../hooks/useMouseInside';
import useAppLayout from '../../../hooks/useAppLayout';

import Menu from '../../ui/Menu';
import BotCommand from './BotCommand';

import './BotCommandMenu.scss';

export type OwnProps = {
  isOpen: boolean;
  botCommands: ApiBotCommand[];
  onClose: NoneToVoidFunction;
};

const BotCommandMenu: FC<OwnProps> = ({
  isOpen, botCommands, onClose,
}) => {
  const { sendBotCommand } = getActions();
  const { isMobile } = useAppLayout();

  const [handleMouseEnter, handleMouseLeave] = useMouseInside(isOpen, onClose, undefined, isMobile);

  const handleClick = useCallback((botCommand: ApiBotCommand) => {
    sendBotCommand({
      command: `/${botCommand.command}`,
    });
    onClose();
  }, [onClose, sendBotCommand]);

  return (
    <Menu
      isOpen={isOpen}
      positionX="left"
      positionY="bottom"
      onClose={onClose}
      className="BotCommandMenu"
      onCloseAnimationEnd={onClose}
      onMouseEnter={!IS_TOUCH_ENV ? handleMouseEnter : undefined}
      onMouseLeave={!IS_TOUCH_ENV ? handleMouseLeave : undefined}
      noCloseOnBackdrop={!IS_TOUCH_ENV}
      noCompact
    >
      {botCommands.map((botCommand) => (
        <BotCommand
          key={botCommand.command}
          botCommand={botCommand}
          onClick={handleClick}
        />
      ))}
    </Menu>
  );
};

export default memo(BotCommandMenu);
