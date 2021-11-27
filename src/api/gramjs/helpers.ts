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

export function addChatToLocalDb(chat: GramJs.TypeChat) {
  if (chat instanceof GramJs.Chat || chat instanceof GramJs.Channel) {
    localDb.chats[buildApiPeerId(chat.id, chat instanceof GramJs.Chat ? 'chat' : 'channel')] = chat;
  }
}

export function addUserToLocalDb(user: GramJs.User) {
  localDb.users[buildApiPeerId(user.id, 'user')] = user;
}
