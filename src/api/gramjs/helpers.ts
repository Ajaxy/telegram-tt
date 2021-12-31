import { Api as GramJs } from '../../lib/gramjs';
import localDb from './localDb';
import { buildApiPeerId, getApiChatIdFromMtpPeer } from './apiBuilders/peers';

export function resolveMessageApiChatId(mtpMessage: GramJs.TypeMessage) {
  if (!(mtpMessage instanceof GramJs.Message || mtpMessage instanceof GramJs.MessageService)) {
    return undefined;
  }

  return getApiChatIdFromMtpPeer(mtpMessage.peerId);
}

export function addMessageToLocalDb(message: GramJs.Message | GramJs.MessageService) {
  const messageFullId = `${resolveMessageApiChatId(message)}-${message.id}`;
  localDb.messages[messageFullId] = message;

  if (
    message instanceof GramJs.Message
    && message.media instanceof GramJs.MessageMediaDocument
    && message.media.document instanceof GramJs.Document
  ) {
    localDb.documents[String(message.media.document.id)] = message.media.document;
  }

  if (
    message instanceof GramJs.Message
    && message.media instanceof GramJs.MessageMediaWebPage
    && message.media.webpage instanceof GramJs.WebPage
    && message.media.webpage.document instanceof GramJs.Document
  ) {
    localDb.documents[String(message.media.webpage.document.id)] = message.media.webpage.document;
  }

  if (message instanceof GramJs.MessageService && 'photo' in message.action) {
    addPhotoToLocalDb(message.action.photo);
  }
}

export function addPhotoToLocalDb(photo: GramJs.TypePhoto) {
  if (photo instanceof GramJs.Photo) {
    localDb.photos[String(photo.id)] = photo;
  }
}

function addChatToLocalDb(chat: GramJs.Chat | GramJs.Channel, noOverwrite = false) {
  const id = buildApiPeerId(chat.id, chat instanceof GramJs.Chat ? 'chat' : 'channel');
  if (!noOverwrite || !localDb.chats[id]) {
    localDb.chats[id] = chat;
  }
}

export function addUserToLocalDb(user: GramJs.User, shouldOverwrite = false) {
  const id = buildApiPeerId(user.id, 'user');
  if (shouldOverwrite || !localDb.users[id]) {
    localDb.users[id] = user;
  }
}

export function addEntitiesWithPhotosToLocalDb(entities: (GramJs.TypeUser | GramJs.TypeChat)[]) {
  entities.forEach((entity) => {
    if (entity instanceof GramJs.User && entity.photo) {
      addUserToLocalDb(entity);
    } else if ((entity instanceof GramJs.Chat || entity instanceof GramJs.Channel) && entity.photo) {
      addChatToLocalDb(entity);
    }
  });
}

export function serializeBytes(value: Buffer) {
  return String.fromCharCode(...value);
}

export function deserializeBytes(value: string) {
  return Buffer.from(value, 'binary');
}
