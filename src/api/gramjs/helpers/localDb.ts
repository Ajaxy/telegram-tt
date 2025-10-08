import { Api as GramJs } from '../../../lib/gramjs';

import { buildApiPeerId, getApiChatIdFromMtpPeer } from '../apiBuilders/peers';
import localDb, { type RepairInfo } from '../localDb';

export type MessageRepairContext = Pick<GramJs.TypeMessage, 'peerId' | 'id'>;
export type MediaRepairContext = MessageRepairContext;

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

export function addWebPageMediaToLocalDb(webPage: GramJs.TypeWebPage) {
  if (webPage instanceof GramJs.WebPage) {
    if (webPage.document) {
      const document = addWebPageRepairInfo(webPage.document, webPage);
      addDocumentToLocalDb(document);
    }
    if (webPage.photo) {
      const photo = addWebPageRepairInfo(webPage.photo, webPage);
      addPhotoToLocalDb(photo);
    }
  }
}

export function addMediaToLocalDb(media: GramJs.TypeMessageMedia, context?: MediaRepairContext) {
  if (media instanceof GramJs.MessageMediaDocument && media.document) {
    const document = addMessageRepairInfo(media.document, context);
    addDocumentToLocalDb(document);
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

    if (story.media.altDocuments) {
      for (const altDocument of story.media.altDocuments) {
        const doc = addStoryRepairInfo(altDocument, peerId, story);
        addDocumentToLocalDb(doc);
      }
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
): T & RepairInfo {
  if (!(media instanceof GramJs.Document || media instanceof GramJs.Photo)) return media;
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
): T & RepairInfo {
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

export function addWebPageRepairInfo<T extends GramJs.TypeDocument | GramJs.TypeWebDocument | GramJs.TypePhoto>(
  media: T, webPage?: GramJs.TypeWebPage,
): T & RepairInfo {
  if (!(webPage instanceof GramJs.WebPage)) return media;
  if (!(media instanceof GramJs.Document || media instanceof GramJs.Photo || media instanceof GramJs.WebDocument)) {
    return media;
  }

  const repairableMedia = media as T & RepairInfo;
  repairableMedia.localRepairInfo = {
    type: 'webPage',
    url: webPage.url,
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

export function addUserToLocalDb(user: GramJs.TypeUser) {
  if (user instanceof GramJs.UserEmpty) return;
  const id = buildApiPeerId(user.id, 'user');
  const storedUser = localDb.users[id];

  if (user.photo instanceof GramJs.Photo) {
    addPhotoToLocalDb(user.photo);
  }

  if (storedUser && !storedUser.min && user.min) return;

  localDb.users[id] = user;
}

export function addWebDocumentToLocalDb(webDocument: GramJs.TypeWebDocument) {
  localDb.webDocuments[webDocument.url] = webDocument;
}
