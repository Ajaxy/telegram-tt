import type { ApiChat, ApiKeyboardButton } from '../../api/types';
import type { SendMessageParams } from '../../types';
import type { GlobalState } from '../types';

import { selectChatFullInfo, selectUser, selectUserFullInfo } from '../selectors';
import { isChatGroup } from './chats';
import { getMainUsername } from './users';

const UNSUPPORTED_EPHEMERAL_BUTTON_TYPES = new Set<ApiKeyboardButton['type']>([
  'buy',
  'game',
  'requestPhone',
  'requestPoll',
  'urlAuth',
]);

export function isKeyboardButtonUnsupportedForEphemeral(button: ApiKeyboardButton) {
  return UNSUPPORTED_EPHEMERAL_BUTTON_TYPES.has(button.type);
}

export function isEphemeralSendSupported({
  scheduledAt, contact, dice, poll, story, suggestedMedia, todo,
}: SendMessageParams) {
  return !scheduledAt && !(
    contact
    || dice
    || poll
    || story
    || suggestedMedia
    || todo
  );
}

export function resolveEphemeralCommand<T extends GlobalState>(
  global: T,
  {
    chat, commandText, botId,
  }: {
    chat: ApiChat;
    commandText: string;
    botId?: string;
  },
) {
  const isGroupChat = isChatGroup(chat);
  const commands = isGroupChat
    ? selectChatFullInfo(global, chat.id)?.botCommands
    : selectUserFullInfo(global, chat.id)?.botInfo?.commands;
  const [commandToken] = commandText.trim().split(/\s+/, 1);
  if (!commandToken.startsWith('/')) return undefined;

  const [commandName, commandUsername] = commandToken.slice(1).split('@', 2);
  const matchingCommands = commands?.filter((command) => {
    if (command.command !== commandName || (botId && command.botId !== botId)) return false;
    if (!commandUsername) return true;

    const bot = selectUser(global, command.botId);
    const username = bot && getMainUsername(bot);
    return commandUsername === username;
  });

  const command = matchingCommands?.length === 1 ? matchingCommands[0] : undefined;
  return command?.isEphemeral ? command : undefined;
}
