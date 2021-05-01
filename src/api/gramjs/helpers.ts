import { Api as GramJs } from '../../lib/gramjs';
import localDb from './localDb';
import { getApiChatIdFromMtpPeer } from './apiBuilders/chats';

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

  if (message instanceof GramJs.MessageService && 'photo' in message.action) {
    addPhotoToLocalDb(message.action.photo);
  }
}

export function addPhotoToLocalDb(photo: GramJs.TypePhoto) {
  if (photo instanceof GramJs.Photo) {
    localDb.photos[String(photo.id)] = photo;
  }
}
