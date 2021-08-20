import React, { FC, memo, useCallback } from '../../../lib/teact/teact';
import { withGlobal } from '../../../lib/teact/teactn';

import { GlobalActions } from '../../../global/types';
import { ApiBotCommand } from '../../../api/types';

import { IS_SINGLE_COLUMN_LAYOUT, IS_TOUCH_ENV } from '../../../util/environment';
import { pick } from '../../../util/iteratees';
import useMouseInside from '../../../hooks/useMouseInside';

import Menu from '../../ui/Menu';
import BotCommand from './BotCommand';

import './BotCommandMenu.scss';

export type OwnProps = {
  isOpen: boolean;
  botCommands: ApiBotCommand[];
  onClose: NoneToVoidFunction;
};

type DispatchProps = Pick<GlobalActions, 'sendBotCommand'>;

const BotCommandMenu: FC<OwnProps & DispatchProps> = ({
  isOpen, botCommands, onClose, sendBotCommand,
}) => {
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

export default memo(withGlobal<OwnProps>(
  undefined,
  (setGlobal, actions): DispatchProps => pick(actions, ['sendBotCommand']),
)(BotCommandMenu));
