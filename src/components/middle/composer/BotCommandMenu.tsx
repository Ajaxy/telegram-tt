import React, { FC, memo, useCallback } from '../../../lib/teact/teact';

import { ApiBotCommand } from '../../../api/types';

import { IS_SINGLE_COLUMN_LAYOUT, IS_TOUCH_ENV } from '../../../util/environment';
import useMouseInside from '../../../hooks/useMouseInside';

import Menu from '../../ui/Menu';
import BotCommand from './BotCommand';

import './BotCommandMenu.scss';
import { getDispatch } from '../../../lib/teact/teactn';

export type OwnProps = {
  isOpen: boolean;
  botCommands: ApiBotCommand[];
  onClose: NoneToVoidFunction;
};

const BotCommandMenu: FC<OwnProps> = ({
  isOpen, botCommands, onClose,
}) => {
  const { sendBotCommand } = getDispatch();

  const [handleMouseEnter, handleMouseLeave] = useMouseInside(isOpen, onClose, undefined, IS_SINGLE_COLUMN_LAYOUT);

  const handleClick = useCallback((botCommand: ApiBotCommand) => {
    sendBotCommand({
      command: `/${botCommand.command}`,
      botId: botCommand.botId,
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
