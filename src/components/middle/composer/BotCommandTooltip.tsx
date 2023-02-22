import type { FC } from '../../../lib/teact/teact';
import React, {
  useCallback, useEffect, useRef, memo,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { Signal } from '../../../util/signals';
import type { ApiBotCommand, ApiUser } from '../../../api/types';

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
  getHtml: Signal<string>;
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
  getHtml,
  onClick,
  onClose,
}) => {
  const { sendBotCommand } = getActions();

  // eslint-disable-next-line no-null/no-null
  const containerRef = useRef<HTMLDivElement>(null);
  const { shouldRender, transitionClassNames } = useShowTransition(isOpen, undefined, undefined, false);

  const handleSendCommand = useCallback(({ botId, command }: ApiBotCommand) => {
    const bot = usersById[botId];
    sendBotCommand({
      command: `/${command}${withUsername && bot ? `@${bot.usernames![0].username}` : ''}`,
    });
    onClick();
  }, [onClick, sendBotCommand, usersById, withUsername]);

  const handleSelect = useCallback((botCommand: ApiBotCommand) => {
    // We need an additional check because tooltip is updated with throttling
    if (!botCommand.command.startsWith(getHtml())) {
      return false;
    }

    handleSendCommand(botCommand);
    return true;
  }, [getHtml, handleSendCommand]);

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
