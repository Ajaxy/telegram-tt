import { Api as GramJs } from '../../lib/gramjs';

import type { StoryRepairInfo } from './localDb';

import { buildApiPeerId, getApiChatIdFromMtpPeer } from './apiBuilders/peers';
import localDb from './localDb';

const LOG_BACKGROUND = '#111111DD';
const LOG_PREFIX_COLOR = '#E4D00A';
const LOG_SUFFIX = {
  INVOKE: '#49DBF5',
  BEACON: '#F549DB',
  RESPONSE: '#6887F7',
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

export function isChatFolder(
  filter?: GramJs.TypeDialogFilter,
): filter is GramJs.DialogFilter | GramJs.DialogFilterChatlist {
  return filter instanceof GramJs.DialogFilter || filter instanceof GramJs.DialogFilterChatlist;
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

export function addStoryToLocalDb(story: GramJs.TypeStoryItem, peerId: string) {
  if (!(story instanceof GramJs.StoryItem)) {
    return;
  }

  const storyData = {
    id: story.id,
    peerId,
  };

  if (story.media instanceof GramJs.MessageMediaPhoto) {
    const photo = story.media.photo as GramJs.Photo & StoryRepairInfo;
    photo.storyData = storyData;
    addPhotoToLocalDb(photo);
  }
  if (story.media instanceof GramJs.MessageMediaDocument) {
    if (story.media.document instanceof GramJs.Document) {
      const doc = story.media.document as GramJs.Document & StoryRepairInfo;
      doc.storyData = storyData;
      localDb.documents[String(story.media.document.id)] = doc;
    }

    if (story.media.altDocument instanceof GramJs.Document) {
      const doc = story.media.altDocument as GramJs.Document & StoryRepairInfo;
      doc.storyData = storyData;
      localDb.documents[String(story.media.altDocument.id)] = doc;
    }
  }
}

export function addPhotoToLocalDb(photo: GramJs.TypePhoto) {
  if (photo instanceof GramJs.Photo) {
    localDb.photos[String(photo.id)] = photo;
  }
}

export function addChatToLocalDb(chat: GramJs.Chat | GramJs.Channel) {
  const id = buildApiPeerId(chat.id, chat instanceof GramJs.Chat ? 'chat' : 'channel');
  const storedChat = localDb.chats[id];

  const isStoredMin = storedChat && 'min' in storedChat && storedChat.min;
  const isChatMin = 'min' in chat && chat.min;
  if (storedChat && !isStoredMin && isChatMin) return;

  localDb.chats[id] = chat;
}

export function addUserToLocalDb(user: GramJs.User) {
  const id = buildApiPeerId(user.id, 'user');
  const storedUser = localDb.users[id];
  if (storedUser && !storedUser.min && user.min) return;

  localDb.users[id] = user;
}

export function addEntitiesToLocalDb(entities: (GramJs.TypeUser | GramJs.TypeChat)[]) {
  entities.forEach((entity) => {
    if (entity instanceof GramJs.User) {
      addUserToLocalDb(entity);
    } else if ((entity instanceof GramJs.Chat || entity instanceof GramJs.Channel)) {
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

export function isResponseUpdate<T extends GramJs.AnyRequest>(result: T['__response']): result is GramJs.TypeUpdate {
  return result instanceof GramJs.UpdatesTooLong || result instanceof GramJs.UpdateShortMessage
    || result instanceof GramJs.UpdateShortChatMessage || result instanceof GramJs.UpdateShort
    || result instanceof GramJs.UpdatesCombined || result instanceof GramJs.Updates
    || result instanceof GramJs.UpdateShortSentMessage;
}
