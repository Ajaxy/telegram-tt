import BigInt from 'big-integer';
import { Api as GramJs } from '../../../lib/gramjs';

import { ApiPrivacyKey } from '../../../types';

import { generateRandomBytes, readBigIntFromBuffer } from '../../../lib/gramjs/Helpers';
import {
  ApiSticker,
  ApiVideo,
  ApiNewPoll,
  ApiMessageEntity,
  ApiMessageEntityTypes,
  ApiChatFolder,
  ApiChatBannedRights,
  ApiChatAdminRights,
  ApiReportReason,
} from '../../types';
import localDb from '../localDb';
import { pick } from '../../../util/iteratees';

export function getEntityTypeById(chatOrUserId: number) {
  if (chatOrUserId > 0) {
    return 'user';
  } else if (chatOrUserId <= -1000000000) {
    return 'channel';
  } else {
    return 'chat';
  }
}

export function buildPeer(chatOrUserId: number): GramJs.TypePeer {
  if (chatOrUserId > 0) {
    return new GramJs.PeerUser({
      userId: chatOrUserId,
    });
  } else if (chatOrUserId <= -1000000000) {
    return new GramJs.PeerChannel({
      channelId: -chatOrUserId,
    });
  } else {
    return new GramJs.PeerChat({
      chatId: -chatOrUserId,
    });
  }
}

export function buildInputPeer(chatOrUserId: number, accessHash?: string): GramJs.TypeInputPeer {
  if (chatOrUserId > 0 || chatOrUserId <= -1000000000) {
    return chatOrUserId > 0
      ? new GramJs.InputPeerUser({
        userId: chatOrUserId,
        accessHash: BigInt(accessHash!),
      })
      : new GramJs.InputPeerChannel({
        channelId: -chatOrUserId,
        accessHash: BigInt(accessHash!),
      });
  } else {
    return new GramJs.InputPeerChat({
      chatId: -chatOrUserId,
    });
  }
}

export function buildInputPeerFromLocalDb(chatOrUserId: number): GramJs.TypeInputPeer | undefined {
  if (chatOrUserId > 0) {
    const { accessHash } = localDb.users[chatOrUserId] || {};

    return accessHash
      ? new GramJs.InputPeerUser({
        userId: chatOrUserId,
        accessHash,
      })
      : undefined;
  }

  if (chatOrUserId <= -1000000000) {
    const { accessHash } = (localDb.chats[-chatOrUserId] as GramJs.Channel) || {};

    return accessHash
      ? new GramJs.InputPeerChannel({
        channelId: -chatOrUserId,
        accessHash,
      })
      : undefined;
  }

  return new GramJs.InputPeerChat({
    chatId: -chatOrUserId,
  });
}

export function buildInputEntity(chatOrUserId: number, accessHash?: string) {
  if (chatOrUserId > 0) {
    return new GramJs.InputUser({
      userId: chatOrUserId,
      accessHash: BigInt(accessHash!),
    });
  } else if (chatOrUserId <= -1000000000) {
    return new GramJs.InputChannel({
      channelId: -chatOrUserId,
      accessHash: BigInt(accessHash!),
    });
  } else {
    return -chatOrUserId;
  }
}

export function buildInputStickerSet(id: string, accessHash: string) {
  return new GramJs.InputStickerSetID({
    id: BigInt(id),
    accessHash: BigInt(accessHash),
  });
}

export function buildInputDocument(media: ApiSticker | ApiVideo) {
  const document = localDb.documents[media.id];

  if (!document) {
    return undefined;
  }

  return new GramJs.InputDocument(pick(document, [
    'id',
    'accessHash',
    'fileReference',
  ]));
}

export function buildInputMediaDocument(media: ApiSticker | ApiVideo) {
  const inputDocument = buildInputDocument(media);

  if (!inputDocument) {
    return undefined;
  }

  return new GramJs.InputMediaDocument({ id: inputDocument });
}

export function buildInputPoll(pollParams: ApiNewPoll, randomId: BigInt.BigInteger) {
  const { summary, quiz } = pollParams;

  const poll = new GramJs.Poll({
    id: randomId,
    publicVoters: summary.isPublic,
    question: summary.question,
    answers: summary.answers.map(({ text, option }) => new GramJs.PollAnswer({ text, option: Buffer.from(option) })),
    quiz: summary.quiz,
    multipleChoice: summary.multipleChoice,
  });

  if (!quiz) {
    return new GramJs.InputMediaPoll({ poll });
  }

  const correctAnswers = quiz.correctAnswers.map((key) => Buffer.from(key));
  const { solution } = quiz;
  const solutionEntities = quiz.solutionEntities ? quiz.solutionEntities.map(buildMtpMessageEntity) : [];

  return new GramJs.InputMediaPoll({
    poll,
    correctAnswers,
    ...(solution && {
      solution,
      solutionEntities,
    }),
  });
}

export function buildFilterFromApiFolder(folder: ApiChatFolder): GramJs.DialogFilter {
  const {
    emoticon,
    contacts,
    nonContacts,
    groups,
    channels,
    bots,
    excludeArchived,
    excludeMuted,
    excludeRead,
    pinnedChatIds,
    includedChatIds,
    excludedChatIds,
  } = folder;

  const pinnedPeers = pinnedChatIds
    ? pinnedChatIds.map(buildInputPeerFromLocalDb).filter<GramJs.TypeInputPeer>(Boolean as any)
    : [];

  const includePeers = includedChatIds
    ? includedChatIds.map(buildInputPeerFromLocalDb).filter<GramJs.TypeInputPeer>(Boolean as any)
    : [];

  const excludePeers = excludedChatIds
    ? excludedChatIds.map(buildInputPeerFromLocalDb).filter<GramJs.TypeInputPeer>(Boolean as any)
    : [];

  return new GramJs.DialogFilter({
    id: folder.id,
    title: folder.title,
    emoticon: emoticon || undefined,
    contacts: contacts || undefined,
    nonContacts: nonContacts || undefined,
    groups: groups || undefined,
    bots: bots || undefined,
    excludeArchived: excludeArchived || undefined,
    excludeMuted: excludeMuted || undefined,
    excludeRead: excludeRead || undefined,
    broadcasts: channels || undefined,
    pinnedPeers,
    includePeers,
    excludePeers,
  });
}

export function generateRandomBigInt() {
  return readBigIntFromBuffer(generateRandomBytes(8), true, true);
}

export function buildMessageFromUpdate(
  id: number,
  chatId: number,
  update: GramJs.UpdateShortSentMessage | GramJs.UpdateServiceNotification,
) {
  // This is not a proper message, but we only need these fields for downloading media through `localDb`.
  return new GramJs.Message({
    id,
    peerId: buildPeer(chatId),
    fromId: buildPeer(chatId),
    media: update.media,
  } as GramJs.Message);
}

export function buildMtpMessageEntity(entity: ApiMessageEntity): GramJs.TypeMessageEntity {
  const {
    type, offset, length, url, userId,
  } = entity;

  const user = userId ? localDb.users[userId] : undefined;

  switch (type) {
    case ApiMessageEntityTypes.Bold:
      return new GramJs.MessageEntityBold({ offset, length });
    case ApiMessageEntityTypes.Italic:
      return new GramJs.MessageEntityItalic({ offset, length });
    case ApiMessageEntityTypes.Underline:
      return new GramJs.MessageEntityUnderline({ offset, length });
    case ApiMessageEntityTypes.Strike:
      return new GramJs.MessageEntityStrike({ offset, length });
    case ApiMessageEntityTypes.Code:
      return new GramJs.MessageEntityCode({ offset, length });
    case ApiMessageEntityTypes.Pre:
      return new GramJs.MessageEntityPre({ offset, length, language: '' });
    case ApiMessageEntityTypes.Blockquote:
      return new GramJs.MessageEntityBlockquote({ offset, length });
    case ApiMessageEntityTypes.TextUrl:
      return new GramJs.MessageEntityTextUrl({ offset, length, url: url! });
    case ApiMessageEntityTypes.Url:
      return new GramJs.MessageEntityUrl({ offset, length });
    case ApiMessageEntityTypes.Hashtag:
      return new GramJs.MessageEntityHashtag({ offset, length });
    case ApiMessageEntityTypes.MentionName:
      return new GramJs.InputMessageEntityMentionName({
        offset,
        length,
        userId: new GramJs.InputUser({ userId: userId!, accessHash: user!.accessHash! }),
      });
    default:
      return new GramJs.MessageEntityUnknown({ offset, length });
  }
}

// TODO: This formula is taken from API docs, but doesn't seem to calculate hash correctly
export function calculateResultHash(ids: number[]) {
  let hash = 0;
  ids.forEach((id) => {
    // eslint-disable-next-line no-bitwise
    hash = (((hash * 0x4F25) & 0x7FFFFFFF) + id) & 0x7FFFFFFF;
  });

  return hash;
}

export function isMessageWithMedia(message: GramJs.Message | GramJs.UpdateServiceNotification) {
  const { media } = message;
  if (!media) {
    return false;
  }

  return (
    media instanceof GramJs.MessageMediaPhoto
    || media instanceof GramJs.MessageMediaDocument
    || (
      media instanceof GramJs.MessageMediaWebPage
      && media.webpage instanceof GramJs.WebPage
      && (
        media.webpage.photo instanceof GramJs.Photo || (
          media.webpage.document instanceof GramJs.Document
          && media.webpage.document.mimeType.startsWith('video')
        )
      )
    )
  );
}

export function isServiceMessageWithMedia(message: GramJs.MessageService) {
  return 'photo' in message.action && message.action.photo instanceof GramJs.Photo;
}

export function buildChatPhotoForLocalDb(photo: GramJs.TypePhoto) {
  if (photo instanceof GramJs.PhotoEmpty) {
    return new GramJs.ChatPhotoEmpty();
  }

  const { dcId, id: photoId } = photo;

  return new GramJs.ChatPhoto({
    dcId,
    photoId,
  });
}

export function buildInputContact({
  phone,
  firstName,
  lastName,
}: {
  phone: string;
  firstName: string;
  lastName: string;
}) {
  return new GramJs.InputPhoneContact({
    clientId: BigInt(1),
    phone,
    firstName,
    lastName,
  });
}

export function buildChatBannedRights(
  bannedRights: ApiChatBannedRights,
  untilDate = 0,
) {
  return new GramJs.ChatBannedRights({
    ...bannedRights,
    untilDate,
  });
}

export function buildChatAdminRights(
  adminRights: ApiChatAdminRights,
) {
  return new GramJs.ChatAdminRights(adminRights);
}

export function buildShippingInfo(info: GramJs.PaymentRequestedInfo) {
  const { shippingAddress } = info;
  return new GramJs.PaymentRequestedInfo({
    ...info,
    shippingAddress: shippingAddress
      ? new GramJs.PostAddress(shippingAddress)
      : undefined,
  });
}

export function buildInputPrivacyKey(privacyKey: ApiPrivacyKey) {
  switch (privacyKey) {
    case 'phoneNumber':
      return new GramJs.InputPrivacyKeyPhoneNumber();

    case 'lastSeen':
      return new GramJs.InputPrivacyKeyStatusTimestamp();

    case 'profilePhoto':
      return new GramJs.InputPrivacyKeyProfilePhoto();

    case 'forwards':
      return new GramJs.InputPrivacyKeyForwards();

    case 'chatInvite':
      return new GramJs.InputPrivacyKeyChatInvite();
  }

  return undefined;
}

export function buildInputReportReason(reason: ApiReportReason) {
  switch (reason) {
    case 'spam':
      return new GramJs.InputReportReasonSpam();
    case 'violence':
      return new GramJs.InputReportReasonViolence();
    case 'childAbuse':
      return new GramJs.InputReportReasonChildAbuse();
    case 'pornography':
      return new GramJs.InputReportReasonPornography();
    case 'copyright':
      return new GramJs.InputReportReasonCopyright();
    case 'fake':
      return new GramJs.InputReportReasonFake();
    case 'geoIrrelevant':
      return new GramJs.InputReportReasonGeoIrrelevant();
    case 'other':
      return new GramJs.InputReportReasonOther();
  }

  return undefined;
}
