import type { FC } from '../../../lib/teact/teact';
import {
  memo, useEffect, useMemo, useRef,
} from '../../../lib/teact/teact';
import { getActions, getGlobal } from '../../../global';

import type {
  ApiBotCommand, ApiMessage, ApiQuickReply, ApiUser,
} from '../../../api/types';
import type { Signal } from '../../../util/signals';

import { getMainUsername } from '../../../global/helpers';
import buildClassName from '../../../util/buildClassName';
import setTooltipItemVisible from '../../../util/setTooltipItemVisible';

import useLastCallback from '../../../hooks/useLastCallback';
import useShowTransitionDeprecated from '../../../hooks/useShowTransitionDeprecated';
import { useKeyboardNavigation } from './hooks/useKeyboardNavigation';

import ChatCommand from './ChatCommand';

import styles from './ChatCommandTooltip.module.scss';

export type OwnProps = {
  isOpen: boolean;
  chatId: string;
  withUsername?: boolean;
  botCommands?: ApiBotCommand[];
  quickReplies?: ApiQuickReply[];
  quickReplyMessages?: Record<number, ApiMessage>;
  self: ApiUser;
  getHtml: Signal<string>;
  onClick: NoneToVoidFunction;
  onClose: NoneToVoidFunction;
};

type QuickReplyWithDescription = {
  id: number;
  command: string;
  description: string;
};

const ChatCommandTooltip: FC<OwnProps> = ({
  isOpen,
  chatId,
  withUsername,
  botCommands,
  quickReplies,
  quickReplyMessages,
  self,
  getHtml,
  onClick,
  onClose,
}) => {
  const { sendBotCommand, sendQuickReply } = getActions();

  const containerRef = useRef<HTMLDivElement>();
  const { shouldRender, transitionClassNames } = useShowTransitionDeprecated(isOpen, undefined, undefined, false);

  const handleSendCommand = useLastCallback(({ botId, command }: ApiBotCommand) => {
    // No need for expensive global updates on users and chats, so we avoid them
    const usersById = getGlobal().users.byId;
    const bot = usersById[botId];

    sendBotCommand({
      command: `/${command}${withUsername && bot ? `@${getMainUsername(bot)}` : ''}`,
    });
    onClick();
  });

  const handleSendQuickReply = useLastCallback((id: number) => {
    sendQuickReply({ chatId, quickReplyId: id });
    onClick();
  });

  const quickRepliesWithDescription = useMemo(() => {
    if (!quickReplies?.length || !quickReplyMessages) return undefined;
    return quickReplies.map((reply) => {
      const message = quickReplyMessages[reply.topMessageId];
      return {
        id: reply.id,
        command: reply.shortcut,
        description: message?.content.text?.text || '',
      } satisfies QuickReplyWithDescription;
    });
  }, [quickReplies, quickReplyMessages]);

  const handleKeyboardSelect = useLastCallback((item: ApiBotCommand | QuickReplyWithDescription) => {
    if (!item.command.startsWith(getHtml().slice(1))) {
      return false;
    }

    if ('id' in item) {
      handleSendQuickReply(item.id);
    } else {
      handleSendCommand(item);
    }

    return true;
  });

  const keyboardNavigationItems = useMemo(() => {
    if (!botCommands && !quickRepliesWithDescription) return undefined;
    return ([] as (ApiBotCommand | QuickReplyWithDescription)[])
      .concat(quickRepliesWithDescription || [], botCommands || []);
  }, [botCommands, quickRepliesWithDescription]);

  const selectedCommandIndex = useKeyboardNavigation({
    isActive: isOpen,
    items: keyboardNavigationItems,
    onSelect: handleKeyboardSelect,
    onClose,
  });

  const isEmpty = (botCommands && !botCommands.length) || (quickReplies && !quickReplies.length);

  useEffect(() => {
    if (isEmpty) {
      onClose();
    }
  }, [isEmpty, onClose]);

  useEffect(() => {
    setTooltipItemVisible('.chat-item-clickable', selectedCommandIndex, containerRef);
  }, [selectedCommandIndex]);

  if (!shouldRender || isEmpty) {
    return undefined;
  }

  const className = buildClassName(
    styles.root,
    'composer-tooltip custom-scroll',
    transitionClassNames,
  );

  return (
    <div className={className} ref={containerRef}>
      {quickRepliesWithDescription?.map((reply, index) => (
        <ChatCommand
          key={`quickReply_${reply.id}`}
          command={reply.command}
          description={reply.description}
          peer={self}
          withAvatar
          clickArg={reply.id}
          onClick={handleSendQuickReply}
          focus={selectedCommandIndex === index}
        />
      ))}
      {botCommands?.map((command, index) => (
        <ChatCommand
          key={`${command.botId}_${command.command}`}
          command={command.command}
          description={command.description}
          // No need for expensive global updates on users and chats, so we avoid them
          peer={getGlobal().users.byId[command.botId]}
          withAvatar
          clickArg={command}
          onClick={handleSendCommand}
          focus={selectedCommandIndex + (quickRepliesWithDescription?.length || 0) === index}
        />
      ))}
    </div>
  );
};

export default memo(ChatCommandTooltip);
