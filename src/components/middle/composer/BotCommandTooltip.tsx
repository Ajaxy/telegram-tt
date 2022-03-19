import React, {
  FC, useCallback, useEffect, useRef, memo,
} from '../../../lib/teact/teact';
import { getDispatch, withGlobal } from '../../../modules';

import { ApiBotCommand, ApiUser } from '../../../api/types';

import buildClassName from '../../../util/buildClassName';
import setTooltipItemVisible from '../../../util/setTooltipItemVisible';
import useShowTransition from '../../../hooks/useShowTransition';
import usePrevious from '../../../hooks/usePrevious';
import { useKeyboardNavigation } from './hooks/useKeyboardNavigation';

import BotCommand from './BotCommand';

import './BotCommandTooltip.scss';

export type OwnProps = {
  isOpen: boolean;
  withUsername?: boolean;
  botCommands?: ApiBotCommand[];
  onClick: NoneToVoidFunction;
  onClose: NoneToVoidFunction;
};

type StateProps = {
  usersById: Record<string, ApiUser>;
};

const BotCommandTooltip: FC<OwnProps & StateProps> = ({
  usersById,
  isOpen,
  withUsername,
  botCommands,
  onClick,
  onClose,
}) => {
  const { sendBotCommand } = getDispatch();

  // eslint-disable-next-line no-null/no-null
  const containerRef = useRef<HTMLDivElement>(null);
  const { shouldRender, transitionClassNames } = useShowTransition(isOpen, undefined, undefined, false);

  const handleSendCommand = useCallback(({ botId, command }: ApiBotCommand) => {
    const bot = usersById[botId];
    sendBotCommand({
      command: `/${command}${withUsername && bot ? `@${bot.username}` : ''}`,
      botId,
    });
    onClick();
  }, [onClick, sendBotCommand, usersById, withUsername]);

  const selectedCommandIndex = useKeyboardNavigation({
    isActive: isOpen,
    items: botCommands,
    onSelect: handleSendCommand,
    onClose,
  });

  useEffect(() => {
    if (botCommands && !botCommands.length) {
      onClose();
    }
  }, [botCommands, onClose]);

  useEffect(() => {
    setTooltipItemVisible('.chat-item-clickable', selectedCommandIndex, containerRef);
  }, [selectedCommandIndex]);

  const prevCommands = usePrevious(botCommands && botCommands.length ? botCommands : undefined, shouldRender);
  const renderedCommands = botCommands && !botCommands.length ? prevCommands : botCommands;

  if (!shouldRender || (renderedCommands && !renderedCommands.length)) {
    return undefined;
  }

  const className = buildClassName(
    'BotCommandTooltip composer-tooltip custom-scroll',
    transitionClassNames,
  );

  return (
    <div className={className} ref={containerRef}>
      {renderedCommands && renderedCommands.map((chatBotCommand, index) => (
        <BotCommand
          key={`${chatBotCommand.botId}_${chatBotCommand.command}`}
          botCommand={chatBotCommand}
          bot={usersById[chatBotCommand.botId]}
          withAvatar
          onClick={handleSendCommand}
          focus={selectedCommandIndex === index}
        />
      ))}
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => ({
    usersById: global.users.byId,
  }),
)(BotCommandTooltip));
