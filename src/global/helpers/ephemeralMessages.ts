import type { ApiChat, ApiKeyboardButton, ApiMessage } from '../../api/types';
import type { SendMessageParams } from '../../types';
import type { GlobalState } from '../types';

import { isUserId } from '../../util/entities/ids';
import { selectChatFullInfo, selectUser, selectUserFullInfo } from '../selectors';
import { isChatGroup } from './chats';
import { getMainUsername } from './users';

const UNSUPPORTED_EPHEMERAL_BUTTON_TYPES = new Set<ApiKeyboardButton['action']['type']>([
  'buy',
  'game',
  'requestPeer',
  'requestPhone',
  'requestPoll',
  'urlAuth',
]);

export function buildAnchoredEphemeralMessage(anchor: ApiMessage, ephemeral: ApiMessage): ApiMessage {
  return {
    ...ephemeral,
    id: anchor.id,
    ephemeralId: ephemeral.id,
    date: anchor.date,
    senderId: anchor.senderId,
    isOutgoing: anchor.isOutgoing,
    replyInfo: anchor.replyInfo,
    forwardInfo: anchor.forwardInfo,
    viaBotId: anchor.viaBotId,
    viaBusinessBotId: anchor.viaBusinessBotId,
    guestChatViaId: anchor.guestChatViaId,
    postAuthorTitle: anchor.postAuthorTitle,
    fromRank: anchor.fromRank,
    senderBoosts: anchor.senderBoosts,
    viewsCount: anchor.viewsCount,
    forwardsCount: anchor.forwardsCount,
    hasUnreadMention: anchor.hasUnreadMention,
    isProtected: anchor.isProtected || ephemeral.isProtected,
    isPinned: anchor.isPinned,
  };
}

export function isMessageLocalOnly(message: ApiMessage) {
  return Boolean(message.isEphemeral && !message.anchorMsgId);
}

export function getCanReplyToEphemeralMessage(message: ApiMessage) {
  return Boolean(
    message.isEphemeral
    && !message.anchorMsgId
    && !message.isOutgoing
    && message.ephemeralBotId
    && isUserId(message.ephemeralBotId),
  );
}

export function isKeyboardButtonUnsupportedForEphemeral(button: ApiKeyboardButton) {
  return UNSUPPORTED_EPHEMERAL_BUTTON_TYPES.has(button.action.type);
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
