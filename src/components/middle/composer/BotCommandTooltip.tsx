import type { FC } from '../../../lib/teact/teact';
import React, { useEffect, useRef, memo } from '../../../lib/teact/teact';
import { getActions, getGlobal } from '../../../global';

import type { Signal } from '../../../util/signals';
import type { ApiBotCommand } from '../../../api/types';

import buildClassName from '../../../util/buildClassName';
import setTooltipItemVisible from '../../../util/setTooltipItemVisible';

import useLastCallback from '../../../hooks/useLastCallback';
import useShowTransition from '../../../hooks/useShowTransition';
import usePrevious from '../../../hooks/usePrevious';
import { useKeyboardNavigation } from './hooks/useKeyboardNavigation';

import BotCommand from './BotCommand';

import './BotCommandTooltip.scss';

export type OwnProps = {
  isOpen: boolean;
  withUsername?: boolean;
  botCommands?: ApiBotCommand[];
  getHtml: Signal<string>;
  onClick: NoneToVoidFunction;
  onClose: NoneToVoidFunction;
};

const BotCommandTooltip: FC<OwnProps> = ({
  isOpen,
  withUsername,
  botCommands,
  getHtml,
  onClick,
  onClose,
}) => {
  const { sendBotCommand } = getActions();

  // eslint-disable-next-line no-null/no-null
  const containerRef = useRef<HTMLDivElement>(null);
  const { shouldRender, transitionClassNames } = useShowTransition(isOpen, undefined, undefined, false);

  const handleSendCommand = useLastCallback(({ botId, command }: ApiBotCommand) => {
    // No need for expensive global updates on users and chats, so we avoid them
    const usersById = getGlobal().users.byId;
    const bot = usersById[botId];

    sendBotCommand({
      command: `/${command}${withUsername && bot ? `@${bot.usernames![0].username}` : ''}`,
    });
    onClick();
  });

  const handleSelect = useLastCallback((botCommand: ApiBotCommand) => {
    // We need an additional check because tooltip is updated with throttling
    if (!botCommand.command.startsWith(getHtml().slice(1))) {
      return false;
    }

    handleSendCommand(botCommand);
    return true;
  });

  const selectedCommandIndex = useKeyboardNavigation({
    isActive: isOpen,
    items: botCommands,
    onSelect: handleSelect,
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
          // No need for expensive global updates on users and chats, so we avoid them
          bot={getGlobal().users.byId[chatBotCommand.botId]}
          withAvatar
          onClick={handleSendCommand}
          focus={selectedCommandIndex === index}
        />
      ))}
    </div>
  );
};

export default memo(BotCommandTooltip);
