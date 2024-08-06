import { Api as GramJs } from '../../lib/gramjs';

import type { RepairInfo } from './localDb';

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

export type MessageRepairContext = Pick<GramJs.TypeMessage, 'peerId' | 'id'>;
export type MediaRepairContext = MessageRepairContext;

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

export function addMessageToLocalDb(message: GramJs.TypeMessage | GramJs.TypeSponsoredMessage) {
  if (message instanceof GramJs.Message) {
    if (message.media) addMediaToLocalDb(message.media, message);

    if (message.replyTo instanceof GramJs.MessageReplyHeader && message.replyTo.replyMedia) {
      addMediaToLocalDb(message.replyTo.replyMedia, message);
    }
  }

  if (message instanceof GramJs.MessageService && 'photo' in message.action) {
    const photo = addMessageRepairInfo(message.action.photo, message);
    addPhotoToLocalDb(photo);
  }

  if (message instanceof GramJs.SponsoredMessage && message.photo) {
    addPhotoToLocalDb(message.photo);
  }
}

export function addMediaToLocalDb(media: GramJs.TypeMessageMedia, context?: MediaRepairContext) {
  if (media instanceof GramJs.MessageMediaDocument && media.document) {
    const document = addMessageRepairInfo(media.document, context);
    addDocumentToLocalDb(document);
  }

  if (media instanceof GramJs.MessageMediaWebPage
    && media.webpage instanceof GramJs.WebPage
  ) {
    if (media.webpage.document) {
      const document = addMessageRepairInfo(media.webpage.document, context);
      addDocumentToLocalDb(document);
    }
    if (media.webpage.photo) {
      const photo = addMessageRepairInfo(media.webpage.photo, context);
      addPhotoToLocalDb(photo);
    }
  }

  if (media instanceof GramJs.MessageMediaGame) {
    if (media.game.document) {
      const document = addMessageRepairInfo(media.game.document, context);
      addDocumentToLocalDb(document);
    }

    const photo = addMessageRepairInfo(media.game.photo, context);
    addPhotoToLocalDb(photo);
  }

  if (media instanceof GramJs.MessageMediaPhoto && media.photo) {
    const photo = addMessageRepairInfo(media.photo, context);
    addPhotoToLocalDb(photo);
  }

  if (media instanceof GramJs.MessageMediaInvoice) {
    if (media.photo) {
      const photo = addMessageRepairInfo(media.photo, context);
      addWebDocumentToLocalDb(photo);
    }

    if (media.extendedMedia instanceof GramJs.MessageExtendedMedia) {
      addMediaToLocalDb(media.extendedMedia.media, context);
    }
  }

  if (media instanceof GramJs.MessageMediaPaidMedia) {
    media.extendedMedia.forEach((extendedMedia) => {
      if (extendedMedia instanceof GramJs.MessageExtendedMedia) {
        addMediaToLocalDb(extendedMedia.media, context);
      }
    });
  }
}

export function addStoryToLocalDb(story: GramJs.TypeStoryItem, peerId: string) {
  if (!(story instanceof GramJs.StoryItem)) {
    return;
  }

  if (story.media instanceof GramJs.MessageMediaPhoto && story.media.photo) {
    const photo = addStoryRepairInfo(story.media.photo, peerId, story);
    addPhotoToLocalDb(photo);
  }

  if (story.media instanceof GramJs.MessageMediaDocument) {
    if (story.media.document instanceof GramJs.Document) {
      const doc = addStoryRepairInfo(story.media.document, peerId, story);
      addDocumentToLocalDb(doc);
    }

    if (story.media.altDocument instanceof GramJs.Document) {
      const doc = addStoryRepairInfo(story.media.altDocument, peerId, story);
      addDocumentToLocalDb(doc);
    }
  }
}

export function addPhotoToLocalDb(photo: GramJs.TypePhoto) {
  if (photo instanceof GramJs.Photo) {
    localDb.photos[String(photo.id)] = photo;
  }
}

export function addDocumentToLocalDb(document: GramJs.TypeDocument) {
  if (document instanceof GramJs.Document) {
    localDb.documents[String(document.id)] = document;
  }
}

export function addStoryRepairInfo<T extends GramJs.TypeDocument | GramJs.TypeWebDocument | GramJs.TypePhoto>(
  media: T, peerId: string, story: GramJs.TypeStoryItem,
) : T & RepairInfo {
  if (!(media instanceof GramJs.Document && media instanceof GramJs.Photo)) return media;
  const repairableMedia = media as T & RepairInfo;
  repairableMedia.localRepairInfo = {
    type: 'story',
    peerId,
    id: story.id,
  };
  return repairableMedia;
}

export function addMessageRepairInfo<T extends GramJs.TypeDocument | GramJs.TypeWebDocument | GramJs.TypePhoto>(
  media: T, context?: MediaRepairContext,
) : T & RepairInfo {
  if (!context?.peerId) return media;
  if (!(media instanceof GramJs.Document || media instanceof GramJs.Photo || media instanceof GramJs.WebDocument)) {
    return media;
  }

  const repairableMedia = media as T & RepairInfo;
  repairableMedia.localRepairInfo = {
    type: 'message',
    peerId: getApiChatIdFromMtpPeer(context.peerId),
    id: context.id,
  };
  return repairableMedia;
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

  if (user.photo instanceof GramJs.Photo) {
    addPhotoToLocalDb(user.photo);
  }

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

export function addWebDocumentToLocalDb(webDocument: GramJs.TypeWebDocument) {
  localDb.webDocuments[webDocument.url] = webDocument;
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
