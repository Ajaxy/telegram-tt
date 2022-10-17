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
  localDb.messages[messageFullId] = message;

  if (message instanceof GramJs.Message) {
    if (message.media instanceof GramJs.MessageMediaDocument
      && message.media.document instanceof GramJs.Document
    ) {
      localDb.documents[String(message.media.document.id)] = message.media.document;
    }

    if (message.media instanceof GramJs.MessageMediaWebPage
      && message.media.webpage instanceof GramJs.WebPage
      && message.media.webpage.document instanceof GramJs.Document
    ) {
      localDb.documents[String(message.media.webpage.document.id)] = message.media.webpage.document;
    }

    if (message.media instanceof GramJs.MessageMediaGame) {
      if (message.media.game.document instanceof GramJs.Document) {
        localDb.documents[String(message.media.game.document.id)] = message.media.game.document;
      }
      addPhotoToLocalDb(message.media.game.photo);
    }

    if (message.media instanceof GramJs.MessageMediaInvoice
      && message.media.photo) {
      localDb.webDocuments[String(message.media.photo.url)] = message.media.photo;
    }
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
