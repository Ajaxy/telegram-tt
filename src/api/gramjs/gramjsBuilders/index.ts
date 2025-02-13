import BigInt from 'big-integer';
import { Api as GramJs } from '../../../lib/gramjs';
import { generateRandomBytes, readBigIntFromBuffer } from '../../../lib/gramjs/Helpers';

import type {
  ApiBotApp,
  ApiChatAdminRights,
  ApiChatBannedRights,
  ApiChatFolder,
  ApiChatReactions,
  ApiEmojiStatusType,
  ApiFormattedText,
  ApiGroupCall,
  ApiInputPrivacyRules,
  ApiInputReplyInfo,
  ApiInputStorePaymentPurpose,
  ApiMessageEntity,
  ApiNewPoll,
  ApiPhoneCall,
  ApiPhoto,
  ApiPoll,
  ApiPremiumGiftCodeOption,
  ApiPrivacyKey,
  ApiReactionWithPaid,
  ApiReportReason,
  ApiRequestInputInvoice,
  ApiRequestInputSavedStarGift,
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
import { deserializeBytes } from '../helpers/misc';
import localDb from '../localDb';

function checkIfChannelId(id: string) {
  return id.length === CHANNEL_ID_LENGTH && id.startsWith('-1');
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
    question: buildInputTextWithEntities(summary.question),
    answers: summary.answers.map(({ text, option }) => {
      return new GramJs.PollAnswer({
        text: buildInputTextWithEntities(text),
        option: deserializeBytes(option),
      });
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
      question: buildInputTextWithEntities(poll.summary.question),
      answers: poll.summary.answers.map(({ text, option }) => {
        return new GramJs.PollAnswer({
          text: buildInputTextWithEntities(text),
          option: deserializeBytes(option),
        });
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
    noTitleAnimations,
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
      title: buildInputTextWithEntities(folder.title),
      emoticon: emoticon || undefined,
      pinnedPeers,
      includePeers,
      hasMyInvites: folder.hasMyInvites,
      titleNoanimate: noTitleAnimations,
    });
  }

  return new GramJs.DialogFilter({
    id: folder.id,
    title: buildInputTextWithEntities(folder.title),
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
    titleNoanimate: noTitleAnimations,
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

export function generateRandomTimestampedBigInt() {
  // 32 bits for timestamp, 32 bits are random
  const buffer = generateRandomBytes(8);
  const timestampBuffer = Buffer.alloc(4);
  timestampBuffer.writeUInt32LE(Math.floor(Date.now() / 1000), 0);
  buffer.set(timestampBuffer, 4);
  return readBigIntFromBuffer(buffer, true, true);
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

    case 'birthday':
      return new GramJs.InputPrivacyKeyBirthday();

    case 'gifts':
      return new GramJs.InputPrivacyKeyStarGiftsAutoSave();
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
    return BigInt(id.slice(2)); // Slice "-1", zeroes are trimmed when converting to BigInt
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

export function buildInputStorePaymentPurpose(purpose: ApiInputStorePaymentPurpose):
GramJs.TypeInputStorePaymentPurpose {
  if (purpose.type === 'stars') {
    return new GramJs.InputStorePaymentStarsTopup({
      stars: BigInt(purpose.stars),
      currency: purpose.currency,
      amount: BigInt(purpose.amount),
    });
  }

  if (purpose.type === 'starsgift') {
    return new GramJs.InputStorePaymentStarsGift({
      userId: buildInputEntity(purpose.user.id, purpose.user.accessHash) as GramJs.InputUser,
      stars: BigInt(purpose.stars),
      currency: purpose.currency,
      amount: BigInt(purpose.amount),
    });
  }

  if (purpose.type === 'giftcode') {
    return new GramJs.InputStorePaymentPremiumGiftCode({
      users: purpose.users.map((user) => buildInputEntity(user.id, user.accessHash) as GramJs.InputUser),
      boostPeer: purpose.boostChannel
        ? buildInputPeer(purpose.boostChannel.id, purpose.boostChannel.accessHash)
        : undefined,
      currency: purpose.currency,
      amount: BigInt(purpose.amount),
      message: purpose.message && buildInputTextWithEntities(purpose.message),
    });
  }

  const randomId = generateRandomBigInt();

  if (purpose.type === 'starsgiveaway') {
    return new GramJs.InputStorePaymentStarsGiveaway({
      boostPeer: buildInputPeer(purpose.chat.id, purpose.chat.accessHash),
      additionalPeers: purpose.additionalChannels?.map((chat) => buildInputPeer(chat.id, chat.accessHash)),
      stars: BigInt(purpose.stars!),
      countriesIso2: purpose.countries,
      prizeDescription: purpose.prizeDescription,
      onlyNewSubscribers: purpose.isOnlyForNewSubscribers || undefined,
      winnersAreVisible: purpose.areWinnersVisible || undefined,
      untilDate: purpose.untilDate,
      currency: purpose.currency,
      amount: BigInt(purpose.amount),
      users: purpose.users,
      randomId,
    });
  }

  return new GramJs.InputStorePaymentPremiumGiveaway({
    boostPeer: buildInputPeer(purpose.chat.id, purpose.chat.accessHash),
    additionalPeers: purpose.additionalChannels?.map((chat) => buildInputPeer(chat.id, chat.accessHash)),
    countriesIso2: purpose.countries,
    prizeDescription: purpose.prizeDescription,
    onlyNewSubscribers: purpose.isOnlyForNewSubscribers || undefined,
    winnersAreVisible: purpose.areWinnersVisible || undefined,
    untilDate: purpose.untilDate,
    currency: purpose.currency,
    amount: BigInt(purpose.amount),
    randomId,
  });
}

function buildPremiumGiftCodeOption(optionData: ApiPremiumGiftCodeOption) {
  return new GramJs.PremiumGiftCodeOption({
    users: optionData.users,
    months: optionData.months,
    currency: optionData.currency,
    amount: BigInt(optionData.amount),
  });
}

export function buildInputInvoice(invoice: ApiRequestInputInvoice) {
  switch (invoice.type) {
    case 'message': {
      return new GramJs.InputInvoiceMessage({
        peer: buildInputPeer(invoice.chat.id, invoice.chat.accessHash),
        msgId: invoice.messageId,
      });
    }

    case 'slug': {
      return new GramJs.InputInvoiceSlug({
        slug: invoice.slug,
      });
    }

    case 'stargift': {
      const {
        peer, shouldHideName, giftId, message, shouldUpgrade,
      } = invoice;
      return new GramJs.InputInvoiceStarGift({
        peer: buildInputPeer(peer.id, peer.accessHash),
        hideName: shouldHideName || undefined,
        giftId: BigInt(giftId),
        message: message && buildInputTextWithEntities(message),
        includeUpgrade: shouldUpgrade,
      });
    }

    case 'stars': {
      const purpose = buildInputStorePaymentPurpose(invoice.purpose);
      return new GramJs.InputInvoiceStars({
        purpose,
      });
    }

    case 'starsgiveaway': {
      const purpose = buildInputStorePaymentPurpose(invoice.purpose);
      return new GramJs.InputInvoiceStars({
        purpose,
      });
    }

    case 'chatInviteSubscription': {
      return new GramJs.InputInvoiceChatInviteSubscription({
        hash: invoice.hash,
      });
    }

    case 'stargiftUpgrade': {
      return new GramJs.InputInvoiceStarGiftUpgrade({
        stargift: buildInputSavedStarGift(invoice.inputSavedGift),
        keepOriginalDetails: invoice.shouldKeepOriginalDetails,
      });
    }

    case 'stargiftTransfer': {
      return new GramJs.InputInvoiceStarGiftTransfer({
        stargift: buildInputSavedStarGift(invoice.inputSavedGift),
        toId: buildInputPeer(invoice.recipient.id, invoice.recipient.accessHash),
      });
    }

    case 'giveaway':
    default: {
      const purpose = buildInputStorePaymentPurpose(invoice.purpose);
      const option = buildPremiumGiftCodeOption(invoice.option);

      return new GramJs.InputInvoicePremiumGiftCode({
        purpose,
        option,
      });
    }
  }
}

export function buildInputReaction(reaction?: ApiReactionWithPaid) {
  switch (reaction?.type) {
    case 'emoji':
      return new GramJs.ReactionEmoji({
        emoticon: reaction.emoticon,
      });
    case 'custom':
      return new GramJs.ReactionCustomEmoji({
        documentId: BigInt(reaction.documentId),
      });
    case 'paid':
      return new GramJs.ReactionPaid();
    default:
      return new GramJs.ReactionEmpty();
  }
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

export function buildInputEmojiStatus(emojiStatus: ApiEmojiStatusType) {
  if (emojiStatus.type === 'collectible') {
    return new GramJs.InputEmojiStatusCollectible({
      collectibleId: BigInt(emojiStatus.collectibleId),
      until: emojiStatus.until,
    });
  }

  if (emojiStatus.documentId === DEFAULT_STATUS_ICON_ID) {
    return new GramJs.EmojiStatusEmpty();
  }

  return new GramJs.EmojiStatus({
    documentId: BigInt(emojiStatus.documentId),
    until: emojiStatus.until,
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
  if (rules.shouldAllowPremium) {
    privacyRules.push(new GramJs.InputPrivacyValueAllowPremium());
  }

  if (rules.botsPrivacy === 'allow') {
    privacyRules.push(new GramJs.InputPrivacyValueAllowBots());
  }

  if (rules.botsPrivacy === 'disallow') {
    privacyRules.push(new GramJs.InputPrivacyValueDisallowBots());
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

export function buildInputSavedStarGift(inputGift: ApiRequestInputSavedStarGift) {
  if (inputGift.type === 'user') {
    return new GramJs.InputSavedStarGiftUser({
      msgId: inputGift.messageId,
    });
  }

  return new GramJs.InputSavedStarGiftChat({
    peer: buildInputPeer(inputGift.chat.id, inputGift.chat.accessHash),
    savedId: BigInt(inputGift.savedId),
  });
}
