import BigInt from 'big-integer';
import { Api as GramJs } from '../../../lib/gramjs';

import type { ApiChat, ApiReaction } from '../../types';

import {
  API_GENERAL_ID_LIMIT,
  REACTION_LIST_LIMIT,
  RECENT_REACTIONS_LIMIT,
  TOP_REACTIONS_LIMIT,
} from '../../../config';
import { split } from '../../../util/iteratees';
import { buildApiChatFromPreview } from '../apiBuilders/chats';
import {
  buildApiAvailableReaction,
  buildApiReaction,
  buildApiSavedReactionTag,
  buildMessagePeerReaction,
} from '../apiBuilders/reactions';
import { buildApiUser } from '../apiBuilders/users';
import { buildInputPeer, buildInputReaction } from '../gramjsBuilders';
import { addEntitiesToLocalDb } from '../helpers';
import localDb from '../localDb';
import { invokeRequest } from './client';

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
  }), {
    abortControllerChatId: chat.id,
  });
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
  }), {
    abortControllerChatId: chat.id,
  });
}

export async function fetchAvailableReactions() {
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
    if (reaction.appearAnimation instanceof GramJs.Document) {
      localDb.documents[String(reaction.appearAnimation.id)] = reaction.appearAnimation;
    }
    if (reaction.centerIcon instanceof GramJs.Document) {
      localDb.documents[String(reaction.centerIcon.id)] = reaction.centerIcon;
    }
  });

  return result.reactions.map(buildApiAvailableReaction);
}

export function sendReaction({
  chat, messageId, reactions, shouldAddToRecent,
}: {
  chat: ApiChat;
  messageId: number;
  reactions?: ApiReaction[];
  shouldAddToRecent?: boolean;
}) {
  return invokeRequest(new GramJs.messages.SendReaction({
    reaction: reactions?.map((r) => buildInputReaction(r)),
    peer: buildInputPeer(chat.id, chat.accessHash),
    msgId: messageId,
    ...(shouldAddToRecent && { addToRecent: true }),
  }), {
    shouldReturnTrue: true,
    shouldThrow: true,
  });
}

export function fetchMessageReactions({
  ids, chat,
}: {
  ids: number[]; chat: ApiChat;
}) {
  const chunks = split(ids, API_GENERAL_ID_LIMIT);
  chunks.forEach((chunkIds) => {
    invokeRequest(new GramJs.messages.GetMessagesReactions({
      id: chunkIds,
      peer: buildInputPeer(chat.id, chat.accessHash),
    }), {
      shouldReturnTrue: true,
      abortControllerChatId: chat.id,
    });
  });
}

export async function fetchMessageReactionsList({
  chat, messageId, reaction, offset,
}: {
  chat: ApiChat; messageId: number; reaction?: ApiReaction; offset?: string;
}) {
  const result = await invokeRequest(new GramJs.messages.GetMessageReactionsList({
    peer: buildInputPeer(chat.id, chat.accessHash),
    id: messageId,
    ...(reaction && { reaction: buildInputReaction(reaction) }),
    limit: REACTION_LIST_LIMIT,
    ...(offset && { offset }),
  }));

  if (!result) {
    return undefined;
  }

  addEntitiesToLocalDb(result.users);
  addEntitiesToLocalDb(result.chats);

  const { nextOffset, reactions, count } = result;

  return {
    users: result.users.map(buildApiUser).filter(Boolean),
    chats: result.chats.map((c) => buildApiChatFromPreview(c)).filter(Boolean),
    nextOffset,
    reactions: reactions.map(buildMessagePeerReaction).filter(Boolean),
    count,
  };
}

export function setDefaultReaction({
  reaction,
}: {
  reaction: ApiReaction;
}) {
  return invokeRequest(new GramJs.messages.SetDefaultReaction({
    reaction: buildInputReaction(reaction),
  }));
}

export async function fetchTopReactions({ hash = '0' }: { hash?: string }) {
  const result = await invokeRequest(new GramJs.messages.GetTopReactions({
    limit: TOP_REACTIONS_LIMIT,
    hash: BigInt(hash),
  }));

  if (!result || result instanceof GramJs.messages.ReactionsNotModified) {
    return undefined;
  }

  return {
    hash: String(result.hash),
    reactions: result.reactions.map(buildApiReaction).filter(Boolean),
  };
}

export async function fetchRecentReactions({ hash = '0' }: { hash?: string }) {
  const result = await invokeRequest(new GramJs.messages.GetRecentReactions({
    limit: RECENT_REACTIONS_LIMIT,
    hash: BigInt(hash),
  }));

  if (!result || result instanceof GramJs.messages.ReactionsNotModified) {
    return undefined;
  }

  return {
    hash: String(result.hash),
    reactions: result.reactions.map(buildApiReaction).filter(Boolean),
  };
}

export function clearRecentReactions() {
  return invokeRequest(new GramJs.messages.ClearRecentReactions());
}

export async function fetchDefaultTagReactions({ hash = '0' }: { hash?: string }) {
  const result = await invokeRequest(new GramJs.messages.GetDefaultTagReactions({
    hash: BigInt(hash),
  }));

  if (!result || result instanceof GramJs.messages.ReactionsNotModified) {
    return undefined;
  }

  return {
    hash: String(result.hash),
    reactions: result.reactions.map(buildApiReaction).filter(Boolean),
  };
}

export async function fetchSavedReactionTags({ hash = '0' }: { hash?: string }) {
  const result = await invokeRequest(new GramJs.messages.GetSavedReactionTags({ hash: BigInt(hash) }));

  if (!result || result instanceof GramJs.messages.SavedReactionTagsNotModified) {
    return undefined;
  }

  return {
    hash: String(result.hash),
    tags: result.tags.map(buildApiSavedReactionTag).filter(Boolean),
  };
}

export function updateSavedReactionTag({
  reaction,
  title,
}: {
  reaction: ApiReaction;
  title?: string;
}) {
  return invokeRequest(new GramJs.messages.UpdateSavedReactionTag({
    reaction: buildInputReaction(reaction),
    title,
  }), {
    shouldReturnTrue: true,
  });
}
