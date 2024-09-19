import { Api as GramJs } from '../../../lib/gramjs';

import type { ApiChat, ApiThreadInfo, ApiUser } from '../../types';

import { buildCollectionByKey } from '../../../util/iteratees';
import { buildApiChatFromPreview } from '../apiBuilders/chats';
import { buildApiThreadInfoFromMessage } from '../apiBuilders/messages';
import { buildApiUser } from '../apiBuilders/users';
import { addChatToLocalDb, addMessageToLocalDb, addUserToLocalDb } from '../helpers';
import { sendImmediateApiUpdate } from './apiUpdateEmitter';

const TYPE_USER = new Set(['User', 'UserEmpty']);
const TYPE_CHAT = new Set(['ChatEmpty', 'Chat', 'ChatForbidden', 'Channel', 'ChannelForbidden']);
const TYPE_MESSAGE = new Set(['Message', 'MessageEmpty', 'MessageService']);

export function processAndUpdateEntities(response?: GramJs.AnyRequest['__response']) {
  if (!response || typeof response !== 'object') return;
  if (!('users' in response || 'chats' in response || 'messages' in response)) return;

  let userById: Record<string, ApiUser> | undefined;
  let chatById: Record<string, ApiChat> | undefined;
  let threadInfos: ApiThreadInfo[] | undefined;

  if ('users' in response && Array.isArray(response.users) && TYPE_USER.has(response.users[0]?.className)) {
    const users = response.users.map((user) => {
      if (user instanceof GramJs.User) {
        addUserToLocalDb(user);
      }
      return buildApiUser(user);
    }).filter(Boolean);
    userById = buildCollectionByKey(users, 'id');
  }

  if ('chats' in response && Array.isArray(response.chats) && TYPE_CHAT.has(response.chats[0]?.className)) {
    const chats = response.chats.map((chat) => {
      if ((chat instanceof GramJs.Chat || chat instanceof GramJs.Channel)) {
        addChatToLocalDb(chat);
      }
      return buildApiChatFromPreview(chat);
    }).filter(Boolean);
    chatById = buildCollectionByKey(chats, 'id');
  }

  if ('messages' in response && Array.isArray(response.messages) && TYPE_MESSAGE.has(response.messages[0]?.className)) {
    threadInfos = response.messages.map((message) => {
      addMessageToLocalDb(message);
      return buildApiThreadInfoFromMessage(message);
    }).filter(Boolean);
  }

  if (!userById && !chatById && !threadInfos) return;

  sendImmediateApiUpdate({
    '@type': 'updateEntities',
    users: userById,
    chats: chatById,
    threadInfos,
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
