import { Api as GramJs } from '../../../lib/gramjs';

import type {
  ApiChat, ApiPoll, ApiThreadInfo, ApiUser,
  ApiWebPage,
} from '../../types';

import { buildCollectionByKey } from '../../../util/iteratees';
import { buildApiChatFromPreview } from '../apiBuilders/chats';
import { buildPollFromMedia, buildWebPageFromMedia } from '../apiBuilders/messageContent';
import { buildApiThreadInfoFromMessage } from '../apiBuilders/messages';
import { buildApiUser } from '../apiBuilders/users';
import { addChatToLocalDb, addMessageToLocalDb, addUserToLocalDb } from '../helpers/localDb';
import { sendImmediateApiUpdate } from './apiUpdateEmitter';

const TYPE_USER = new Set(['User', 'UserEmpty']);
const TYPE_CHAT = new Set(['ChatEmpty', 'Chat', 'ChatForbidden', 'Channel', 'ChannelForbidden']);
const TYPE_MESSAGE = new Set(['Message', 'MessageEmpty', 'MessageService']);

export function processAndUpdateEntities(response?: GramJs.AnyRequest['__response']) {
  if (!response || typeof response !== 'object') return;
  if (!('users' in response || 'chats' in response || 'messages' in response)) return;

  let userById: Record<string, ApiUser> | undefined;
  let chatById: Record<string, ApiChat> | undefined;
  const threadInfos: ApiThreadInfo[] | undefined = [];
  const polls: ApiPoll[] | undefined = [];
  const webPages: ApiWebPage[] | undefined = [];

  if ('users' in response && Array.isArray(response.users) && TYPE_USER.has(response.users[0]?.className)) {
    const users = response.users.map((user: GramJs.TypeUser) => {
      if (user instanceof GramJs.User) {
        addUserToLocalDb(user);
      }
      return buildApiUser(user);
    }).filter(Boolean);
    userById = buildCollectionByKey(users, 'id');
  }

  if ('chats' in response && Array.isArray(response.chats) && TYPE_CHAT.has(response.chats[0]?.className)) {
    const chats = response.chats.map((chat: GramJs.TypeChat) => {
      if ((chat instanceof GramJs.Chat || chat instanceof GramJs.Channel)) {
        addChatToLocalDb(chat);
      }
      return buildApiChatFromPreview(chat);
    }).filter(Boolean);
    chatById = buildCollectionByKey(chats, 'id');
  }

  if ('messages' in response && Array.isArray(response.messages) && TYPE_MESSAGE.has(response.messages[0]?.className)) {
    response.messages.forEach((message: GramJs.TypeMessage) => {
      addMessageToLocalDb(message);

      const threadInfo = buildApiThreadInfoFromMessage(message);
      if (threadInfo) {
        threadInfos.push(threadInfo);
      }

      if ('media' in message && message.media) {
        const poll = buildPollFromMedia(message.media);
        if (poll) {
          polls.push(poll);
        }

        const webPage = buildWebPageFromMedia(message.media);
        if (webPage) {
          webPages.push(webPage);
        }
      }
    });
  }

  if (!userById && !chatById && !threadInfos?.length) return;

  sendImmediateApiUpdate({
    '@type': 'updateEntities',
    users: userById,
    chats: chatById,
    threadInfos: threadInfos?.length ? threadInfos : undefined,
    polls: polls?.length ? polls : undefined,
    webPages: webPages?.length ? webPages : undefined,
  });
}

export function processMessageAndUpdateThreadInfo(message: GramJs.TypeMessage) {
  addMessageToLocalDb(message);
  const threadInfo = buildApiThreadInfoFromMessage(message);
  if (!threadInfo) return;
  sendImmediateApiUpdate({
    '@type': 'updateThreadInfo',
    threadInfo,
  });
}
