import type { ApiChat, ApiUser } from '../../types';
import { invokeRequest } from './client';
import { Api as GramJs } from '../../../lib/gramjs';
import { buildInputPeer } from '../gramjsBuilders';
import localDb from '../localDb';
import { buildApiAvailableReaction, buildMessagePeerReaction } from '../apiBuilders/messages';
import { REACTION_LIST_LIMIT } from '../../../config';
import { addEntitiesWithPhotosToLocalDb } from '../helpers';
import { buildApiUser } from '../apiBuilders/users';

export function sendWatchingEmojiInteraction({
  chat,
  emoticon,
}: {
  chat: ApiChat; emoticon: string;
}) {
  return invokeRequest(new GramJs.messages.SetTyping({
    peer: buildInputPeer(chat.id, chat.accessHash),
    action: new GramJs.SendMessageEmojiInteractionSeen({
      emoticon,
    }),
  }));
}

export function sendEmojiInteraction({
  chat,
  emoticon,
  messageId,
  timestamps,
}: {
  chat: ApiChat; messageId: number; emoticon: string; timestamps: number[];
}) {
  return invokeRequest(new GramJs.messages.SetTyping({
    peer: buildInputPeer(chat.id, chat.accessHash),
    action: new GramJs.SendMessageEmojiInteraction({
      emoticon,
      msgId: messageId,
      interaction: new GramJs.DataJSON({
        data: JSON.stringify({
          v: 1,
          a: timestamps.map((t: number) => ({
            t,
            i: 1,
          })),
        }),
      }),
    }),
  }));
}

export async function getAvailableReactions() {
  const result = await invokeRequest(new GramJs.messages.GetAvailableReactions({}));

  if (!result || result instanceof GramJs.messages.AvailableReactionsNotModified) {
    return undefined;
  }

  result.reactions.forEach((reaction) => {
    if (reaction.staticIcon instanceof GramJs.Document) {
      localDb.documents[String(reaction.staticIcon.id)] = reaction.staticIcon;
    }
    if (reaction.selectAnimation instanceof GramJs.Document) {
      localDb.documents[String(reaction.selectAnimation.id)] = reaction.selectAnimation;
    }
    if (reaction.aroundAnimation instanceof GramJs.Document) {
      localDb.documents[String(reaction.aroundAnimation.id)] = reaction.aroundAnimation;
    }
    if (reaction.centerIcon instanceof GramJs.Document) {
      localDb.documents[String(reaction.centerIcon.id)] = reaction.centerIcon;
    }
  });

  return result.reactions.map(buildApiAvailableReaction);
}

export function sendReaction({
  chat, messageId, reaction,
}: {
  chat: ApiChat; messageId: number; reaction?: string;
}) {
  return invokeRequest(new GramJs.messages.SendReaction({
    ...(reaction && { reaction }),
    peer: buildInputPeer(chat.id, chat.accessHash),
    msgId: messageId,
  }), true);
}

export function fetchMessageReactions({
  ids, chat,
}: {
  ids: number[]; chat: ApiChat;
}) {
  return invokeRequest(new GramJs.messages.GetMessagesReactions({
    id: ids,
    peer: buildInputPeer(chat.id, chat.accessHash),
  }), true);
}

export async function fetchMessageReactionsList({
  chat, messageId, reaction, offset,
}: {
  chat: ApiChat; messageId: number; reaction?: string; offset?: string;
}) {
  const result = await invokeRequest(new GramJs.messages.GetMessageReactionsList({
    peer: buildInputPeer(chat.id, chat.accessHash),
    id: messageId,
    ...(reaction && { reaction }),
    limit: REACTION_LIST_LIMIT,
    ...(offset && { offset }),
  }));

  if (!result) {
    return undefined;
  }

  addEntitiesWithPhotosToLocalDb(result.users);

  const { nextOffset, reactions, count } = result;

  return {
    users: result.users.map(buildApiUser).filter<ApiUser>(Boolean as any),
    nextOffset,
    reactions: reactions.map(buildMessagePeerReaction),
    count,
  };
}

export function setDefaultReaction({
  reaction,
}: {
  reaction: string;
}) {
  return invokeRequest(new GramJs.messages.SetDefaultReaction({
    reaction,
  }));
}
