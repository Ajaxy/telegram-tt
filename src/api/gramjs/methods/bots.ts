import BigInt from 'big-integer';
import { Api as GramJs } from '../../../lib/gramjs';

import { ApiBotInlineSwitchPm, ApiChat, ApiUser } from '../../types';

import localDb from '../localDb';
import { invokeRequest } from './client';
import { buildInputPeer, calculateResultHash, generateRandomBigInt } from '../gramjsBuilders';
import { buildApiUser } from '../apiBuilders/users';
import { buildApiBotInlineMediaResult, buildApiBotInlineResult } from '../apiBuilders/bots';
import { buildApiChatFromPreview } from '../apiBuilders/chats';
import { pick } from '../../../util/iteratees';

export function init() {
}

export function answerCallbackButton(
  {
    chatId, accessHash, messageId, data,
  }: {
    chatId: number; accessHash?: string; messageId: number; data: string;
  },
) {
  return invokeRequest(new GramJs.messages.GetBotCallbackAnswer({
    peer: buildInputPeer(chatId, accessHash),
    msgId: messageId,
    data: Buffer.from(data),
  }));
}

export async function fetchTopInlineBots({ hash = 0 }: { hash?: number }) {
  const topPeers = await invokeRequest(new GramJs.contacts.GetTopPeers({
    hash,
    botsInline: true,
  }));

  if (!(topPeers instanceof GramJs.contacts.TopPeers)) {
    return undefined;
  }

  const users = topPeers.users.map(buildApiUser).filter<ApiUser>(Boolean as any);
  const ids = users.map(({ id }) => id);

  return {
    hash: calculateResultHash(ids),
    ids,
    users,
  };
}

export async function fetchInlineBot({ username }: { username: string }) {
  const resolvedPeer = await invokeRequest(new GramJs.contacts.ResolveUsername({ username }));

  if (
    !resolvedPeer
    || !(
      resolvedPeer.users[0] instanceof GramJs.User
      && resolvedPeer.users[0].bot
      && resolvedPeer.users[0].botInlinePlaceholder
    )
  ) {
    return undefined;
  }

  addUserToLocalDb(resolvedPeer.users[0]);

  return {
    user: buildApiUser(resolvedPeer.users[0]),
    chat: buildApiChatFromPreview(resolvedPeer.users[0]),
  };
}

export async function fetchInlineBotResults({
  bot, chat, query, offset = '',
}: {
  bot: ApiUser; chat: ApiChat; query: string; offset?: string;
}) {
  const result = await invokeRequest(new GramJs.messages.GetInlineBotResults({
    bot: buildInputPeer(bot.id, bot.accessHash),
    peer: buildInputPeer(chat.id, chat.accessHash),
    query,
    offset,
  }));

  if (!result) {
    return undefined;
  }

  result.users.map(addUserToLocalDb);

  return {
    isGallery: Boolean(result.gallery),
    help: bot.botPlaceholder,
    nextOffset: result.nextOffset,
    switchPm: buildSwitchPm(result.switchPm),
    users: result.users.map(buildApiUser).filter<ApiUser>(Boolean as any),
    results: processInlineBotResult(String(result.queryId), result.results),
  };
}

export async function sendInlineBotResult({
  chat, resultId, queryId, replyingTo,
}: {
  chat: ApiChat;
  resultId: string;
  queryId: string;
  replyingTo?: number;
}) {
  const randomId = generateRandomBigInt();

  await invokeRequest(new GramJs.messages.SendInlineBotResult({
    clearDraft: true,
    randomId,
    queryId: BigInt(queryId),
    peer: buildInputPeer(chat.id, chat.accessHash),
    id: resultId,
    ...(replyingTo && { replyToMsgId: replyingTo }),
  }), true);
}

function buildSwitchPm(switchPm?: GramJs.InlineBotSwitchPM) {
  return switchPm ? pick(switchPm, ['text', 'startParam']) as ApiBotInlineSwitchPm : undefined;
}

function processInlineBotResult(queryId: string, results: GramJs.TypeBotInlineResult[]) {
  return results.map((result) => {
    if (result instanceof GramJs.BotInlineMediaResult) {
      if (result.document instanceof GramJs.Document) {
        addDocumentToLocalDb(result.document);
      }

      if (result.photo instanceof GramJs.Photo) {
        addPhotoToLocalDb(result.photo);
      }

      return buildApiBotInlineMediaResult(result, queryId);
    }

    if (result.thumb) {
      addWebDocumentToLocalDb(result.thumb);
    }

    return buildApiBotInlineResult(result, queryId);
  });
}

function addUserToLocalDb(user: GramJs.User) {
  localDb.users[user.id] = user;
}

function addDocumentToLocalDb(document: GramJs.Document) {
  localDb.documents[String(document.id)] = document;
}

function addPhotoToLocalDb(photo: GramJs.Photo) {
  localDb.photos[String(photo.id)] = photo;
}

function addWebDocumentToLocalDb(webDocument: GramJs.TypeWebDocument) {
  localDb.webDocuments[webDocument.url] = webDocument;
}
