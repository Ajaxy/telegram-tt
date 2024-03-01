import BigInt from 'big-integer';
import { Api as GramJs } from '../../../lib/gramjs';
import { generateRandomBytes, readBigIntFromBuffer } from '../../../lib/gramjs/Helpers';

import type { ApiInputPrivacyRules, ApiPrivacyKey } from '../../../types';
import type {
  ApiBotApp,
  ApiChatAdminRights,
  ApiChatBannedRights,
  ApiChatFolder,
  ApiChatReactions,
  ApiFormattedText,
  ApiGroupCall,
  ApiInputReplyInfo,
  ApiMessageEntity,
  ApiNewPoll,
  ApiPhoneCall,
  ApiPhoto,
  ApiPoll,
  ApiReaction,
  ApiReportReason,
  ApiRequestInputInvoice,
  ApiSendMessageAction,
  ApiSticker,
  ApiStory,
  ApiStorySkipped,
  ApiThemeParameters,
  ApiVideo,
} from '../../types';
import {
  ApiMessageEntityTypes,
} from '../../types';

import { CHANNEL_ID_LENGTH, DEFAULT_STATUS_ICON_ID } from '../../../config';
import { pick } from '../../../util/iteratees';
import { deserializeBytes } from '../helpers';
import localDb from '../localDb';

const LEGACY_CHANNEL_ID_MIN_LENGTH = 11; // Example: -1234567890

function checkIfChannelId(id: string) {
  if (id.length >= CHANNEL_ID_LENGTH) return id.startsWith('-100');
  // LEGACY Unprefixed channel id
  if (id.length === LEGACY_CHANNEL_ID_MIN_LENGTH && id.startsWith('-4')) return false;
  return id.length >= LEGACY_CHANNEL_ID_MIN_LENGTH;
}

export function getEntityTypeById(chatOrUserId: string) {
  if (!chatOrUserId.startsWith('-')) {
    return 'user';
  } else if (checkIfChannelId(chatOrUserId)) {
    return 'channel';
  } else {
    return 'chat';
  }
}

export function buildPeer(chatOrUserId: string): GramJs.TypePeer {
  const type = getEntityTypeById(chatOrUserId);

  if (type === 'user') {
    return new GramJs.PeerUser({
      userId: buildMtpPeerId(chatOrUserId, 'user'),
    });
  } else if (type === 'channel') {
    return new GramJs.PeerChannel({
      channelId: buildMtpPeerId(chatOrUserId, 'channel'),
    });
  } else {
    return new GramJs.PeerChat({
      chatId: buildMtpPeerId(chatOrUserId, 'chat'),
    });
  }
}

export function buildInputPeer(chatOrUserId: string, accessHash?: string): GramJs.TypeInputPeer {
  const type = getEntityTypeById(chatOrUserId);

  if (type === 'user') {
    return new GramJs.InputPeerUser({
      userId: buildMtpPeerId(chatOrUserId, 'user'),
      accessHash: BigInt(accessHash!),
    });
  } else if (type === 'channel') {
    return new GramJs.InputPeerChannel({
      channelId: buildMtpPeerId(chatOrUserId, 'channel'),
      accessHash: BigInt(accessHash!),
    });
  } else {
    return new GramJs.InputPeerChat({
      chatId: buildMtpPeerId(chatOrUserId, 'chat'),
    });
  }
}

export function buildInputPeerFromLocalDb(chatOrUserId: string): GramJs.TypeInputPeer | undefined {
  const type = getEntityTypeById(chatOrUserId);
  let accessHash: BigInt.BigInteger | undefined;

  if (type === 'user') {
    accessHash = localDb.users[chatOrUserId]?.accessHash;
    if (!accessHash) {
      return undefined;
    }
  } else if (type === 'channel') {
    accessHash = (localDb.chats[chatOrUserId] as GramJs.Channel)?.accessHash;
    if (!accessHash) {
      return undefined;
    }
  }

  return buildInputPeer(chatOrUserId, String(accessHash));
}

export function buildInputEntity(chatOrUserId: string, accessHash?: string) {
  const type = getEntityTypeById(chatOrUserId);

  if (type === 'user') {
    return new GramJs.InputUser({
      userId: buildMtpPeerId(chatOrUserId, 'user'),
      accessHash: BigInt(accessHash!),
    });
  } else if (type === 'channel') {
    return new GramJs.InputChannel({
      channelId: buildMtpPeerId(chatOrUserId, 'channel'),
      accessHash: BigInt(accessHash!),
    });
  } else {
    return buildMtpPeerId(chatOrUserId, 'chat');
  }
}

export function buildInputStickerSet(id: string, accessHash: string) {
  return new GramJs.InputStickerSetID({
    id: BigInt(id),
    accessHash: BigInt(accessHash),
  });
}

export function buildInputStickerSetShortName(shortName: string) {
  return new GramJs.InputStickerSetShortName({
    shortName,
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
    answers: summary.answers.map(({ text, option }) => {
      return new GramJs.PollAnswer({ text, option: deserializeBytes(option) });
    }),
    quiz: summary.quiz,
    multipleChoice: summary.multipleChoice,
  });

  if (!quiz) {
    return new GramJs.InputMediaPoll({ poll });
  }

  const correctAnswers = quiz.correctAnswers.map(deserializeBytes);
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

export function buildInputPollFromExisting(poll: ApiPoll, shouldClose = false) {
  return new GramJs.InputMediaPoll({
    poll: new GramJs.Poll({
      id: BigInt(poll.id),
      publicVoters: poll.summary.isPublic,
      question: poll.summary.question,
      answers: poll.summary.answers.map(({ text, option }) => {
        return new GramJs.PollAnswer({ text, option: deserializeBytes(option) });
      }),
      quiz: poll.summary.quiz,
      multipleChoice: poll.summary.multipleChoice,
      closeDate: poll.summary.closeDate,
      closePeriod: poll.summary.closePeriod,
      closed: shouldClose ? true : poll.summary.closed,
    }),
    correctAnswers: poll.results.results?.filter((o) => o.isCorrect).map((o) => deserializeBytes(o.option)),
    solution: poll.results.solution,
    solutionEntities: poll.results.solutionEntities?.map(buildMtpMessageEntity),
  });
}

export function buildFilterFromApiFolder(folder: ApiChatFolder): GramJs.DialogFilter | GramJs.DialogFilterChatlist {
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
    ? pinnedChatIds.map(buildInputPeerFromLocalDb).filter(Boolean)
    : [];

  const includePeers = includedChatIds
    ? includedChatIds.map(buildInputPeerFromLocalDb).filter(Boolean)
    : [];

  const excludePeers = excludedChatIds
    ? excludedChatIds.map(buildInputPeerFromLocalDb).filter(Boolean)
    : [];

  if (folder.isChatList) {
    return new GramJs.DialogFilterChatlist({
      id: folder.id,
      title: folder.title,
      emoticon: emoticon || undefined,
      pinnedPeers,
      includePeers,
      hasMyInvites: folder.hasMyInvites,
    });
  }

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

export function buildInputStory(story: ApiStory | ApiStorySkipped) {
  const peer = buildInputPeerFromLocalDb(story.peerId)!;
  return new GramJs.InputMediaStory({
    peer,
    id: story.id,
  });
}

export function generateRandomBigInt() {
  return readBigIntFromBuffer(generateRandomBytes(8), true, true);
}

export function generateRandomInt() {
  return readBigIntFromBuffer(generateRandomBytes(4), true, true).toJSNumber();
}

export function buildMessageFromUpdate(
  id: number,
  chatId: string,
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
    type, offset, length,
  } = entity;

  const user = 'userId' in entity ? localDb.users[entity.userId] : undefined;

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
      return new GramJs.MessageEntityPre({ offset, length, language: entity.language || '' });
    case ApiMessageEntityTypes.Blockquote:
      return new GramJs.MessageEntityBlockquote({ offset, length });
    case ApiMessageEntityTypes.TextUrl:
      return new GramJs.MessageEntityTextUrl({ offset, length, url: entity.url });
    case ApiMessageEntityTypes.Url:
      return new GramJs.MessageEntityUrl({ offset, length });
    case ApiMessageEntityTypes.Hashtag:
      return new GramJs.MessageEntityHashtag({ offset, length });
    case ApiMessageEntityTypes.MentionName:
      return new GramJs.InputMessageEntityMentionName({
        offset,
        length,
        userId: new GramJs.InputUser({ userId: BigInt(user!.id), accessHash: user!.accessHash! }),
      });
    case ApiMessageEntityTypes.Spoiler:
      return new GramJs.MessageEntitySpoiler({ offset, length });
    case ApiMessageEntityTypes.CustomEmoji:
      return new GramJs.MessageEntityCustomEmoji({ offset, length, documentId: BigInt(entity.documentId) });
    default:
      return new GramJs.MessageEntityUnknown({ offset, length });
  }
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
        )
      )
    ) || (
      media instanceof GramJs.MessageMediaGame
      && (media.game.document instanceof GramJs.Document || media.game.photo instanceof GramJs.Photo)
    ) || (
      media instanceof GramJs.MessageMediaInvoice && (media.photo || media.extendedMedia)
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

export function buildInputPhoto(photo: ApiPhoto) {
  const localPhoto = localDb.photos[photo?.id];

  if (!localPhoto) {
    return undefined;
  }

  return new GramJs.InputPhoto(pick(localPhoto, [
    'id',
    'accessHash',
    'fileReference',
  ]));
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

    case 'addByPhone':
      return new GramJs.InputPrivacyKeyAddedByPhone();

    case 'lastSeen':
      return new GramJs.InputPrivacyKeyStatusTimestamp();

    case 'profilePhoto':
      return new GramJs.InputPrivacyKeyProfilePhoto();

    case 'forwards':
      return new GramJs.InputPrivacyKeyForwards();

    case 'chatInvite':
      return new GramJs.InputPrivacyKeyChatInvite();

    case 'phoneCall':
      return new GramJs.InputPrivacyKeyPhoneCall();

    case 'phoneP2P':
      return new GramJs.InputPrivacyKeyPhoneP2P();

    case 'voiceMessages':
      return new GramJs.InputPrivacyKeyVoiceMessages();

    case 'bio':
      return new GramJs.InputPrivacyKeyAbout();
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
    case 'illegalDrugs':
      return new GramJs.InputReportReasonIllegalDrugs();
    case 'personalDetails':
      return new GramJs.InputReportReasonPersonalDetails();
    case 'other':
      return new GramJs.InputReportReasonOther();
  }

  return undefined;
}

export function buildSendMessageAction(action: ApiSendMessageAction) {
  switch (action.type) {
    case 'cancel':
      return new GramJs.SendMessageCancelAction();
    case 'typing':
      return new GramJs.SendMessageTypingAction();
    case 'recordAudio':
      return new GramJs.SendMessageRecordAudioAction();
    case 'chooseSticker':
      return new GramJs.SendMessageChooseStickerAction();
    case 'playingGame':
      return new GramJs.SendMessageGamePlayAction();
  }
  return undefined;
}

export function buildInputThemeParams(params: ApiThemeParameters) {
  return new GramJs.DataJSON({
    data: JSON.stringify(params),
  });
}

export function buildMtpPeerId(id: string, type: 'user' | 'chat' | 'channel') {
  if (type === 'user') {
    return BigInt(id);
  }

  if (type === 'channel') {
    if (id.length === CHANNEL_ID_LENGTH) {
      return BigInt(id.slice(4));
    }

    // LEGACY Unprefixed channel id
    return BigInt(id.slice(1));
  }

  return BigInt(id.slice(1));
}

export function buildInputGroupCall(groupCall: Partial<ApiGroupCall>) {
  return new GramJs.InputGroupCall({
    id: BigInt(groupCall.id!),
    accessHash: BigInt(groupCall.accessHash!),
  });
}

export function buildInputPhoneCall({ id, accessHash }: ApiPhoneCall) {
  return new GramJs.InputPhoneCall({
    id: BigInt(id),
    accessHash: BigInt(accessHash!),
  });
}

export function buildInputInvoice(invoice: ApiRequestInputInvoice) {
  if ('slug' in invoice) {
    return new GramJs.InputInvoiceSlug({
      slug: invoice.slug,
    });
  } else {
    return new GramJs.InputInvoiceMessage({
      peer: buildInputPeer(invoice.chat.id, invoice.chat.accessHash),
      msgId: invoice.messageId,
    });
  }
}

export function buildInputReaction(reaction?: ApiReaction) {
  if (reaction && 'emoticon' in reaction) {
    return new GramJs.ReactionEmoji({
      emoticon: reaction.emoticon,
    });
  }

  if (reaction && 'documentId' in reaction) {
    return new GramJs.ReactionCustomEmoji({
      documentId: BigInt(reaction.documentId),
    });
  }

  return new GramJs.ReactionEmpty();
}

export function buildInputChatReactions(chatReactions?: ApiChatReactions) {
  if (chatReactions?.type === 'all') {
    return new GramJs.ChatReactionsAll({
      allowCustom: chatReactions.areCustomAllowed,
    });
  }

  if (chatReactions?.type === 'some') {
    return new GramJs.ChatReactionsSome({
      reactions: chatReactions.allowed.map(buildInputReaction),
    });
  }

  return new GramJs.ChatReactionsNone();
}

export function buildInputEmojiStatus(emojiStatus: ApiSticker, expires?: number) {
  if (emojiStatus.id === DEFAULT_STATUS_ICON_ID) {
    return new GramJs.EmojiStatusEmpty();
  }

  if (expires) {
    return new GramJs.EmojiStatusUntil({
      documentId: BigInt(emojiStatus.id),
      until: expires,
    });
  }

  return new GramJs.EmojiStatus({
    documentId: BigInt(emojiStatus.id),
  });
}

export function buildInputTextWithEntities(formatted: ApiFormattedText) {
  return new GramJs.TextWithEntities({
    text: formatted.text,
    entities: formatted.entities?.map(buildMtpMessageEntity) || [],
  });
}

export function buildInputBotApp(app: ApiBotApp) {
  return new GramJs.InputBotAppID({
    id: BigInt(app.id),
    accessHash: BigInt(app.accessHash),
  });
}

export function buildInputReplyTo(replyInfo: ApiInputReplyInfo) {
  if (replyInfo.type === 'story') {
    return new GramJs.InputReplyToStory({
      peer: buildInputPeerFromLocalDb(replyInfo.peerId)!,
      storyId: replyInfo.storyId,
    });
  }

  if (replyInfo.type === 'message') {
    const {
      replyToMsgId, replyToTopId, replyToPeerId, quoteText,
    } = replyInfo;
    return new GramJs.InputReplyToMessage({
      replyToMsgId,
      topMsgId: replyToTopId,
      replyToPeerId: replyToPeerId ? buildInputPeerFromLocalDb(replyToPeerId)! : undefined,
      quoteText: quoteText?.text,
      quoteEntities: quoteText?.entities?.map(buildMtpMessageEntity),
    });
  }

  return undefined;
}

export function buildInputPrivacyRules(
  rules: ApiInputPrivacyRules,
) {
  const privacyRules: GramJs.TypeInputPrivacyRule[] = [];

  if (rules.allowedUsers?.length) {
    privacyRules.push(new GramJs.InputPrivacyValueAllowUsers({
      users: rules.allowedUsers.map(({ id, accessHash }) => buildInputEntity(id, accessHash) as GramJs.InputUser),
    }));
  }
  if (rules.allowedChats?.length) {
    privacyRules.push(new GramJs.InputPrivacyValueAllowChatParticipants({
      chats: rules.allowedChats.map(({ id, type }) => (
        buildMtpPeerId(id, type === 'chatTypeBasicGroup' ? 'chat' : 'channel')
      )),
    }));
  }
  if (rules.blockedUsers?.length) {
    privacyRules.push(new GramJs.InputPrivacyValueDisallowUsers({
      users: rules.blockedUsers.map(({ id, accessHash }) => buildInputEntity(id, accessHash) as GramJs.InputUser),
    }));
  }
  if (rules.blockedChats?.length) {
    privacyRules.push(new GramJs.InputPrivacyValueDisallowChatParticipants({
      chats: rules.blockedChats.map(({ id, type }) => (
        buildMtpPeerId(id, type === 'chatTypeBasicGroup' ? 'chat' : 'channel')
      )),
    }));
  }

  if (!rules.isUnspecified) {
    switch (rules.visibility) {
      case 'everybody':
        privacyRules.push(new GramJs.InputPrivacyValueAllowAll());
        break;

      case 'contacts':
        privacyRules.push(new GramJs.InputPrivacyValueAllowContacts());
        break;

      case 'nonContacts':
        privacyRules.push(new GramJs.InputPrivacyValueDisallowContacts());
        break;

      case 'nobody':
        privacyRules.push(new GramJs.InputPrivacyValueDisallowAll());
        break;
    }
  }

  return privacyRules;
}
