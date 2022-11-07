import { Api as GramJs } from '../../lib/gramjs';
import localDb from './localDb';
import { buildApiPeerId, getApiChatIdFromMtpPeer } from './apiBuilders/peers';

const LOG_BACKGROUND = '#111111DD';
const LOG_PREFIX_COLOR = '#E4D00A';
const LOG_SUFFIX = {
  INVOKE: '#49DBF5',
  'INVOKE RESPONSE': '#6887F7',
  CONNECTING: '#E4D00A',
  CONNECTED: '#26D907',
  'CONNECTING ERROR': '#D1191C',
  'INVOKE ERROR': '#D1191C',
  UPDATE: '#0DD151',
  'UNEXPECTED UPDATE': '#9C9C9C',
  'UNEXPECTED RESPONSE': '#D1191C',
};

export function resolveMessageApiChatId(mtpMessage: GramJs.TypeMessage) {
  if (!(mtpMessage instanceof GramJs.Message || mtpMessage instanceof GramJs.MessageService)) {
    return undefined;
  }

  return getApiChatIdFromMtpPeer(mtpMessage.peerId);
}

export function addMessageToLocalDb(message: GramJs.Message | GramJs.MessageService) {
  const messageFullId = `${resolveMessageApiChatId(message)}-${message.id}`;

  let mockMessage = message;
  if (message instanceof GramJs.Message
    && message.media instanceof GramJs.MessageMediaInvoice
    && message.media.extendedMedia instanceof GramJs.MessageExtendedMedia) {
    mockMessage = new GramJs.Message({
      ...message,
      media: message.media.extendedMedia.media,
    });
  }

  localDb.messages[messageFullId] = mockMessage;

  if (mockMessage instanceof GramJs.Message) {
    if (mockMessage.media instanceof GramJs.MessageMediaDocument
      && mockMessage.media.document instanceof GramJs.Document
    ) {
      localDb.documents[String(mockMessage.media.document.id)] = mockMessage.media.document;
    }

    if (mockMessage.media instanceof GramJs.MessageMediaWebPage
      && mockMessage.media.webpage instanceof GramJs.WebPage
      && mockMessage.media.webpage.document instanceof GramJs.Document
    ) {
      localDb.documents[String(mockMessage.media.webpage.document.id)] = mockMessage.media.webpage.document;
    }

    if (mockMessage.media instanceof GramJs.MessageMediaGame) {
      if (mockMessage.media.game.document instanceof GramJs.Document) {
        localDb.documents[String(mockMessage.media.game.document.id)] = mockMessage.media.game.document;
      }
      addPhotoToLocalDb(mockMessage.media.game.photo);
    }

    if (mockMessage.media instanceof GramJs.MessageMediaInvoice
      && mockMessage.media.photo) {
      localDb.webDocuments[String(mockMessage.media.photo.url)] = mockMessage.media.photo;
    }
  }

  if (mockMessage instanceof GramJs.MessageService && 'photo' in mockMessage.action) {
    addPhotoToLocalDb(mockMessage.action.photo);
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

export function swapLocalInvoiceMedia(
  chatId: string, messageId: number, extendedMedia: GramJs.TypeMessageExtendedMedia,
) {
  const localMessage = localDb.messages[`${chatId}-${messageId}`];
  if (!(localMessage instanceof GramJs.Message) || !localMessage.media) return;

  if (extendedMedia instanceof GramJs.MessageExtendedMediaPreview) {
    if (!(localMessage.media instanceof GramJs.MessageMediaInvoice)) {
      return;
    }
    localMessage.media.extendedMedia = extendedMedia;
  }

  if (extendedMedia instanceof GramJs.MessageExtendedMedia) {
    localMessage.media = extendedMedia.media;
  }
}

export function serializeBytes(value: Buffer) {
  return String.fromCharCode(...value);
}

export function deserializeBytes(value: string) {
  return Buffer.from(value, 'binary');
}

export function log(suffix: keyof typeof LOG_SUFFIX, ...data: any) {
  /* eslint-disable max-len */
  /* eslint-disable no-console */
  const func = suffix === 'UNEXPECTED RESPONSE' ? console.error
    : suffix === 'INVOKE ERROR' || suffix === 'UNEXPECTED UPDATE' ? console.warn : console.log;
  /* eslint-enable no-console */
  func(
    `%cGramJS%c${suffix}`,
    `color: ${LOG_PREFIX_COLOR}; background: ${LOG_BACKGROUND}; padding: 0.25rem; border-radius: 0.25rem;`,
    `color: ${LOG_SUFFIX[suffix]}; background: ${LOG_BACKGROUND}; padding: 0.25rem; border-radius: 0.25rem; margin-left: 0.25rem;`,
    ...data,
  );
  /* eslint-enable max-len */
}
