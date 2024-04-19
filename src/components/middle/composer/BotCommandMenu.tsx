import type { FC } from '../../../lib/teact/teact';
import React, { memo } from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import type { ApiBotCommand } from '../../../api/types';

import { IS_TOUCH_ENV } from '../../../util/windowEnvironment';

import useAppLayout from '../../../hooks/useAppLayout';
import useLastCallback from '../../../hooks/useLastCallback';
import useMouseInside from '../../../hooks/useMouseInside';

import Menu from '../../ui/Menu';
import ChatCommand from './ChatCommand';

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

  const handleClick = useLastCallback((command: string) => {
    sendBotCommand({
      command: `/${command}`,
    });
    onClose();
  });

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
        <ChatCommand
          key={botCommand.command}
          command={botCommand.command}
          description={botCommand.description}
          clickArg={botCommand.command}
          onClick={handleClick}
        />
      ))}
    </Menu>
  );
};

export default memo(BotCommandMenu);
