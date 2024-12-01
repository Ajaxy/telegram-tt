import { Api as GramJs } from '../../../lib/gramjs';

import type {
  ApiAudio,
  ApiContact,
  ApiDocument,
  ApiFormattedText,
  ApiGame,
  ApiGiveaway,
  ApiGiveawayResults,
  ApiLocation,
  ApiMediaExtendedPreview,
  ApiMediaInvoice,
  ApiMessageStoryData,
  ApiPaidMedia,
  ApiPhoto,
  ApiPoll,
  ApiSticker,
  ApiVideo,
  ApiVoice,
  ApiWebDocument,
  ApiWebPage,
  ApiWebPageStickerData,
  ApiWebPageStoryData,
  BoughtPaidMedia,
  MediaContent,
} from '../../types';
import type { UniversalMessage } from './messages';

import { SUPPORTED_PHOTO_CONTENT_TYPES, SUPPORTED_VIDEO_CONTENT_TYPES, VIDEO_WEBM_TYPE } from '../../../config';
import { generateWaveform } from '../../../util/generateWaveform';
import { pick } from '../../../util/iteratees';
import {
  addMediaToLocalDb, addStoryToLocalDb, type MediaRepairContext, serializeBytes,
} from '../helpers';
import {
  buildApiFormattedText,
  buildApiMessageEntity,
  buildApiPhoto,
  buildApiPhotoPreviewSizes,
  buildApiPhotoSize,
  buildApiThumbnailFromPath,
  buildApiThumbnailFromStripped,
} from './common';
import { buildApiPeerId, getApiChatIdFromMtpPeer } from './peers';
import { buildStickerFromDocument, processStickerResult } from './symbols';

export function buildMessageContent(
  mtpMessage: UniversalMessage | GramJs.UpdateServiceNotification,
) {
  let content: MediaContent = {};

  if (mtpMessage.media) {
    const repairContext = 'peerId' in mtpMessage ? mtpMessage : undefined;
    content = {
      ...buildMessageMediaContent(mtpMessage.media, repairContext),
    };
  }

  const hasUnsupportedMedia = mtpMessage.media instanceof GramJs.MessageMediaUnsupported;

  if (mtpMessage.message && !hasUnsupportedMedia
    && !content.sticker && !content.pollId && !content.contact && !content.video?.isRound) {
    content = {
      ...content,
      text: buildMessageTextContent(mtpMessage.message, mtpMessage.entities),
    };
  }

  return content;
}

export function buildMessageTextContent(
  message: string,
  entities?: GramJs.TypeMessageEntity[],
): ApiFormattedText {
  return {
    text: message,
    ...(entities && { entities: entities.map(buildApiMessageEntity) }),
  };
}

export function buildMessageMediaContent(
  media: GramJs.TypeMessageMedia, context?: MediaRepairContext,
): MediaContent | undefined {
  addMediaToLocalDb(media, context);

  const ttlSeconds = 'ttlSeconds' in media ? media.ttlSeconds : undefined;

  const isExpiredVoice = isExpiredVoiceMessage(media);
  if (isExpiredVoice) {
    return { isExpiredVoice };
  }
  const isExpiredRoundVideo = isExpiredRoundVideoMessage(media);
  if (isExpiredRoundVideo) {
    return { isExpiredRoundVideo };
  }

  const voice = buildVoice(media);
  if (voice) return { voice, ttlSeconds };

  if ('round' in media && media.round) {
    const video = buildVideo(media);
    if (video) return { video, ttlSeconds };
  }

  // Other disappearing media types are not supported
  if (ttlSeconds !== undefined) {
    return undefined;
  }

  if (media instanceof GramJs.MessageMediaInvoice && media.extendedMedia instanceof GramJs.MessageExtendedMedia) {
    return buildMessageMediaContent(media.extendedMedia.media, context);
  }

  const sticker = buildSticker(media);
  if (sticker) return { sticker };

  const photo = buildPhoto(media);
  if (photo) return { photo };

  const video = buildVideo(media);
  const altVideos = buildAltVideos(media);
  if (video) return { video, altVideos };

  const audio = buildAudio(media);
  if (audio) return { audio };

  const document = buildDocumentFromMedia(media);
  if (document) return { document };

  const contact = buildContact(media);
  if (contact) return { contact };

  const pollId = buildPollIdFromMedia(media);
  if (pollId) return { pollId };

  const webPage = buildWebPage(media);
  if (webPage) return { webPage };

  const invoice = buildInvoiceFromMedia(media);
  if (invoice) return { invoice };

  const location = buildLocationFromMedia(media);
  if (location) return { location };

  const game = buildGameFromMedia(media);
  if (game) return { game };

  const storyData = buildMessageStoryData(media);
  if (storyData) return { storyData };

  const giveaway = buildGiweawayFromMedia(media);
  if (giveaway) return { giveaway };

  const giveawayResults = buildGiweawayResultsFromMedia(media);
  if (giveawayResults) return { giveawayResults };

  const paidMedia = buildPaidMedia(media);
  if (paidMedia) return { paidMedia };

  return undefined;
}

function buildSticker(media: GramJs.TypeMessageMedia): ApiSticker | undefined {
  if (
    !(media instanceof GramJs.MessageMediaDocument)
    || !media.document
    || !(media.document instanceof GramJs.Document)
  ) {
    return undefined;
  }

  return buildStickerFromDocument(media.document, media.nopremium);
}

function buildPhoto(media: GramJs.TypeMessageMedia): ApiPhoto | undefined {
  if (!(media instanceof GramJs.MessageMediaPhoto) || !media.photo || !(media.photo instanceof GramJs.Photo)) {
    return undefined;
  }

  return buildApiPhoto(media.photo, media.spoiler);
}

export function buildVideoFromDocument(document: GramJs.Document, isSpoiler?: boolean): ApiVideo | undefined {
  if (document instanceof GramJs.DocumentEmpty) {
    return undefined;
  }

  const {
    id, mimeType, thumbs, size, videoThumbs, attributes,
  } = document;

  // eslint-disable-next-line no-restricted-globals
  if (mimeType === VIDEO_WEBM_TYPE && !(self as any).isWebmSupported) {
    return undefined;
  }

  const videoAttr = attributes
    .find((a): a is GramJs.DocumentAttributeVideo => a instanceof GramJs.DocumentAttributeVideo);

  if (!videoAttr) {
    return undefined;
  }

  const gifAttr = attributes
    .find((a): a is GramJs.DocumentAttributeAnimated => a instanceof GramJs.DocumentAttributeAnimated);

  const hasVideoPreview = videoThumbs?.some((thumb) => thumb instanceof GramJs.VideoSize && thumb.type === 'v');
  const previewPhotoSizes = thumbs && buildApiPhotoPreviewSizes(thumbs);

  const {
    duration,
    w: width,
    h: height,
    supportsStreaming = false,
    roundMessage: isRound = false,
    nosound,
  } = videoAttr;

  const waveform = isRound ? generateWaveform(duration) : undefined;

  return {
    mediaType: 'video',
    id: String(id),
    mimeType,
    duration,
    fileName: getFilenameFromDocument(document, 'video'),
    width,
    height,
    supportsStreaming,
    isRound,
    isGif: Boolean(gifAttr),
    thumbnail: buildApiThumbnailFromStripped(thumbs),
    size: size.toJSNumber(),
    isSpoiler,
    hasVideoPreview,
    previewPhotoSizes,
    waveform,
    ...(nosound && { noSound: true }),
  };
}

export function buildAudioFromDocument(document: GramJs.Document): ApiAudio | undefined {
  if (document instanceof GramJs.DocumentEmpty) {
    return undefined;
  }

  const {
    id, mimeType, size, attributes,
  } = document;

  const audioAttributes = attributes
    .find((a: any): a is GramJs.DocumentAttributeAudio => a instanceof GramJs.DocumentAttributeAudio);

  if (!audioAttributes) {
    return undefined;
  }

  const {
    duration,
    title,
    performer,
  } = audioAttributes;

  return {
    mediaType: 'audio',
    id: String(id),
    mimeType,
    duration,
    fileName: getFilenameFromDocument(document, 'audio'),
    title,
    performer,
    size: size.toJSNumber(),
  };
}

function buildVideo(media: GramJs.TypeMessageMedia): ApiVideo | undefined {
  if (
    !(media instanceof GramJs.MessageMediaDocument)
    || !(media.document instanceof GramJs.Document)
    || !media.document.mimeType.startsWith('video')
  ) {
    return undefined;
  }

  return buildVideoFromDocument(media.document, media.spoiler);
}

function buildAltVideos(media: GramJs.TypeMessageMedia): ApiVideo[] | undefined {
  if (!(media instanceof GramJs.MessageMediaDocument) || !media.altDocuments) {
    return undefined;
  }

  const altVideos = media.altDocuments.filter((d): d is GramJs.Document => (
    d instanceof GramJs.Document && d.mimeType.startsWith('video')
  )).map((alt) => buildVideoFromDocument(alt, media.spoiler))
    .filter(Boolean);
  if (!altVideos.length) {
    return undefined;
  }

  return altVideos;
}

function buildAudio(media: GramJs.TypeMessageMedia): ApiAudio | undefined {
  if (
    !(media instanceof GramJs.MessageMediaDocument)
    || !media.document
    || !(media.document instanceof GramJs.Document)
  ) {
    return undefined;
  }

  const audioAttribute = media.document.attributes
    .find((attr: any): attr is GramJs.DocumentAttributeAudio => (
      attr instanceof GramJs.DocumentAttributeAudio
    ));

  if (!audioAttribute || audioAttribute.voice) {
    return undefined;
  }

  const thumbnailSizes = media.document.thumbs && media.document.thumbs
    .filter((thumb): thumb is GramJs.PhotoSize => thumb instanceof GramJs.PhotoSize)
    .map((thumb) => buildApiPhotoSize(thumb));

  return {
    mediaType: 'audio',
    id: String(media.document.id),
    fileName: getFilenameFromDocument(media.document, 'audio'),
    thumbnailSizes,
    size: media.document.size.toJSNumber(),
    ...pick(media.document, ['mimeType']),
    ...pick(audioAttribute, ['duration', 'performer', 'title']),
  };
}

function isExpiredVoiceMessage(media: GramJs.TypeMessageMedia): MediaContent['isExpiredVoice'] {
  if (!(media instanceof GramJs.MessageMediaDocument)) {
    return false;
  }
  return !media.document && media.voice;
}

function isExpiredRoundVideoMessage(media: GramJs.TypeMessageMedia): MediaContent['isExpiredRoundVideo'] {
  if (!(media instanceof GramJs.MessageMediaDocument)) {
    return false;
  }
  return !media.document && media.round;
}

function buildVoice(media: GramJs.TypeMessageMedia): ApiVoice | undefined {
  if (
    !(media instanceof GramJs.MessageMediaDocument)
    || !media.document
    || !(media.document instanceof GramJs.Document)
  ) {
    return undefined;
  }

  const audioAttribute = media.document.attributes
    .find((attr: any): attr is GramJs.DocumentAttributeAudio => (
      attr instanceof GramJs.DocumentAttributeAudio
    ));

  if (!audioAttribute || !audioAttribute.voice) {
    return undefined;
  }

  const { duration, waveform } = audioAttribute;

  return {
    mediaType: 'voice',
    id: String(media.document.id),
    size: media.document.size.toJSNumber(),
    duration,
    waveform: waveform ? Array.from(waveform) : undefined,
  };
}

function buildDocumentFromMedia(media: GramJs.TypeMessageMedia) {
  if (!(media instanceof GramJs.MessageMediaDocument) || !media.document) {
    return undefined;
  }

  return buildApiDocument(media.document);
}

export function buildApiDocument(document: GramJs.TypeDocument): ApiDocument | undefined {
  if (!(document instanceof GramJs.Document)) {
    return undefined;
  }

  const {
    id, size, mimeType, date, thumbs, attributes,
  } = document;

  const photoSize = thumbs && thumbs.find((s): s is GramJs.PhotoSize => s instanceof GramJs.PhotoSize);
  let thumbnail = thumbs && buildApiThumbnailFromStripped(thumbs);
  if (!thumbnail && thumbs && photoSize) {
    const photoPath = thumbs.find((s): s is GramJs.PhotoPathSize => s instanceof GramJs.PhotoPathSize);
    if (photoPath) {
      thumbnail = buildApiThumbnailFromPath(photoPath, photoSize);
    }
  }
  const previewPhotoSizes = thumbs && buildApiPhotoPreviewSizes(thumbs);

  let innerMediaType: ApiDocument['innerMediaType'] | undefined;
  let mediaSize: ApiDocument['mediaSize'] | undefined;
  if (photoSize) {
    mediaSize = {
      width: photoSize.w,
      height: photoSize.h,
    };

    if (SUPPORTED_PHOTO_CONTENT_TYPES.has(mimeType)) {
      innerMediaType = 'photo';

      const imageAttribute = attributes
        .find((a): a is GramJs.DocumentAttributeImageSize => a instanceof GramJs.DocumentAttributeImageSize);

      if (imageAttribute) {
        const { w: width, h: height } = imageAttribute;
        mediaSize = {
          width,
          height,
        };
      }
    } else if (SUPPORTED_VIDEO_CONTENT_TYPES.has(mimeType)) {
      innerMediaType = 'video';
      const videoAttribute = attributes
        .find((a: any): a is GramJs.DocumentAttributeVideo => a instanceof GramJs.DocumentAttributeVideo);

      if (videoAttribute) {
        const { w: width, h: height } = videoAttribute;
        mediaSize = {
          width,
          height,
        };
      }
    }
  }

  return {
    mediaType: 'document',
    id: String(id),
    size: size.toJSNumber(),
    mimeType,
    timestamp: date,
    fileName: getFilenameFromDocument(document),
    thumbnail,
    innerMediaType,
    mediaSize,
    previewPhotoSizes,
  };
}

function buildContact(media: GramJs.TypeMessageMedia): ApiContact | undefined {
  if (!(media instanceof GramJs.MessageMediaContact)) {
    return undefined;
  }

  const {
    firstName, lastName, phoneNumber, userId,
  } = media;

  return {
    mediaType: 'contact',
    firstName,
    lastName,
    phoneNumber,
    userId: buildApiPeerId(userId, 'user'),
  };
}

function buildPollIdFromMedia(media: GramJs.TypeMessageMedia): string | undefined {
  if (!(media instanceof GramJs.MessageMediaPoll)) {
    return undefined;
  }

  return media.poll.id.toString();
}

export function buildPollFromMedia(media: GramJs.TypeMessageMedia): ApiPoll | undefined {
  if (!(media instanceof GramJs.MessageMediaPoll)) {
    return undefined;
  }

  return buildPoll(media.poll, media.results);
}

function buildInvoiceFromMedia(media: GramJs.TypeMessageMedia): ApiMediaInvoice | undefined {
  if (!(media instanceof GramJs.MessageMediaInvoice)) {
    return undefined;
  }

  return buildMediaInvoice(media);
}

function buildLocationFromMedia(media: GramJs.TypeMessageMedia): ApiLocation | undefined {
  if (media instanceof GramJs.MessageMediaGeo) {
    return buildGeo(media);
  }

  if (media instanceof GramJs.MessageMediaVenue) {
    return buildVenue(media);
  }

  if (media instanceof GramJs.MessageMediaGeoLive) {
    return buildGeoLive(media);
  }

  return undefined;
}

function buildGeo(media: GramJs.MessageMediaGeo): ApiLocation | undefined {
  const point = buildGeoPoint(media.geo);
  return point && { mediaType: 'geo', geo: point };
}

function buildVenue(media: GramJs.MessageMediaVenue): ApiLocation | undefined {
  const {
    geo, title, provider, address, venueId, venueType,
  } = media;
  const point = buildGeoPoint(geo);
  return point && {
    mediaType: 'venue',
    geo: point,
    title,
    provider,
    address,
    venueId,
    venueType,
  };
}

function buildGeoLive(media: GramJs.MessageMediaGeoLive): ApiLocation | undefined {
  const { geo, period, heading } = media;
  const point = buildGeoPoint(geo);
  return point && {
    mediaType: 'geoLive',
    geo: point,
    period,
    heading,
  };
}

export function buildGeoPoint(geo: GramJs.TypeGeoPoint): ApiLocation['geo'] | undefined {
  if (geo instanceof GramJs.GeoPointEmpty) return undefined;
  const {
    long, lat, accuracyRadius, accessHash,
  } = geo;
  return {
    long,
    lat,
    accessHash: accessHash.toString(),
    accuracyRadius,
  };
}

function buildGameFromMedia(media: GramJs.TypeMessageMedia): ApiGame | undefined {
  if (!(media instanceof GramJs.MessageMediaGame)) {
    return undefined;
  }

  return buildGame(media);
}

function buildGame(media: GramJs.MessageMediaGame): ApiGame | undefined {
  const {
    id, accessHash, shortName, title, description, photo: apiPhoto, document: apiDocument,
  } = media.game;

  const photo = apiPhoto instanceof GramJs.Photo ? buildApiPhoto(apiPhoto) : undefined;
  const document = apiDocument instanceof GramJs.Document ? buildApiDocument(apiDocument) : undefined;

  return {
    mediaType: 'game',
    id: id.toString(),
    accessHash: accessHash.toString(),
    shortName,
    title,
    description,
    photo,
    document,
  };
}

function buildGiweawayFromMedia(media: GramJs.TypeMessageMedia): ApiGiveaway | undefined {
  if (!(media instanceof GramJs.MessageMediaGiveaway)) {
    return undefined;
  }

  return buildGiveaway(media);
}

function buildGiveaway(media: GramJs.MessageMediaGiveaway): ApiGiveaway | undefined {
  const {
    channels, months, stars, quantity, untilDate, countriesIso2, onlyNewSubscribers, prizeDescription,
  } = media;

  const channelIds = channels.map((channel) => buildApiPeerId(channel, 'channel'));

  return {
    mediaType: 'giveaway',
    channelIds,
    months,
    stars: stars?.toJSNumber(),
    quantity,
    untilDate,
    countries: countriesIso2,
    isOnlyForNewSubscribers: onlyNewSubscribers,
    prizeDescription,
  };
}

function buildGiweawayResultsFromMedia(media: GramJs.TypeMessageMedia): ApiGiveawayResults | undefined {
  if (!(media instanceof GramJs.MessageMediaGiveawayResults)) {
    return undefined;
  }

  return buildGiveawayResults(media);
}

function buildGiveawayResults(media: GramJs.MessageMediaGiveawayResults): ApiGiveawayResults | undefined {
  const {
    months, untilDate, onlyNewSubscribers, launchMsgId, unclaimedCount, winners, winnersCount,
    additionalPeersCount, prizeDescription, refunded, channelId,
  } = media;

  const winnerIds = winners.map((winner) => buildApiPeerId(winner, 'user'));

  return {
    mediaType: 'giveawayResults',
    months,
    untilDate,
    isOnlyForNewSubscribers: onlyNewSubscribers,
    launchMessageId: launchMsgId,
    channelId: buildApiPeerId(channelId, 'channel'),
    unclaimedCount,
    additionalPeersCount,
    isRefunded: refunded,
    prizeDescription,
    winnerIds,
    winnersCount,
  };
}

export function buildMessageStoryData(media: GramJs.TypeMessageMedia): ApiMessageStoryData | undefined {
  if (!(media instanceof GramJs.MessageMediaStory)) {
    return undefined;
  }

  const peerId = getApiChatIdFromMtpPeer(media.peer);

  return {
    mediaType: 'storyData',
    id: media.id,
    peerId,
    ...(media.viaMention && { isMention: true }),
  };
}

export function buildPoll(poll: GramJs.Poll, pollResults: GramJs.PollResults): ApiPoll {
  const { id, answers: rawAnswers } = poll;
  const answers = rawAnswers.map((answer) => ({
    text: buildApiFormattedText(answer.text),
    option: serializeBytes(answer.option),
  }));

  return {
    mediaType: 'poll',
    id: String(id),
    summary: {
      isPublic: poll.publicVoters,
      question: buildApiFormattedText(poll.question),
      ...pick(poll, [
        'closed',
        'multipleChoice',
        'quiz',
        'closePeriod',
        'closeDate',
      ]),
      answers,
    },
    results: buildPollResults(pollResults),
  };
}

export function buildMediaInvoice(media: GramJs.MessageMediaInvoice): ApiMediaInvoice {
  const {
    description, title, photo, test, totalAmount, currency, receiptMsgId, extendedMedia,
  } = media;

  const preview = extendedMedia instanceof GramJs.MessageExtendedMediaPreview
    ? buildApiMessageExtendedMediaPreview(extendedMedia) : undefined;

  return {
    mediaType: 'invoice',
    title,
    description,
    photo: buildApiWebDocument(photo),
    receiptMessageId: receiptMsgId,
    amount: totalAmount.toJSNumber(),
    currency,
    isTest: test,
    extendedMedia: preview,
  };
}

export function buildPollResults(pollResults: GramJs.PollResults): ApiPoll['results'] {
  const {
    results: rawResults, totalVoters, recentVoters, solution, solutionEntities: entities, min,
  } = pollResults;
  const results = rawResults?.map(({
    option, chosen, correct, voters,
  }) => ({
    isChosen: chosen,
    isCorrect: correct,
    option: serializeBytes(option),
    votersCount: voters,
  }));

  return {
    isMin: min,
    totalVoters,
    recentVoterIds: recentVoters?.map((peer) => getApiChatIdFromMtpPeer(peer)),
    results,
    solution,
    ...(entities && { solutionEntities: entities.map(buildApiMessageEntity) }),
  };
}

export function buildWebPage(media: GramJs.TypeMessageMedia): ApiWebPage | undefined {
  if (
    !(media instanceof GramJs.MessageMediaWebPage)
    || !(media.webpage instanceof GramJs.WebPage)
  ) {
    return undefined;
  }

  const {
    id, photo, document, attributes,
  } = media.webpage;

  let video;
  let audio;
  if (document instanceof GramJs.Document && document.mimeType.startsWith('video/')) {
    video = buildVideoFromDocument(document);
  }
  if (document instanceof GramJs.Document && document.mimeType.startsWith('audio/')) {
    audio = buildAudioFromDocument(document);
  }
  let story: ApiWebPageStoryData | undefined;
  let stickers: ApiWebPageStickerData | undefined;
  const attributeStory = attributes
    ?.find((a): a is GramJs.WebPageAttributeStory => a instanceof GramJs.WebPageAttributeStory);
  if (attributeStory) {
    const peerId = getApiChatIdFromMtpPeer(attributeStory.peer);
    story = {
      id: attributeStory.id,
      peerId,
    };

    if (attributeStory.story instanceof GramJs.StoryItem) {
      addStoryToLocalDb(attributeStory.story, peerId);
    }
  }
  const attributeStickers = attributes?.find((a): a is GramJs.WebPageAttributeStickerSet => (
    a instanceof GramJs.WebPageAttributeStickerSet
  ));
  if (attributeStickers) {
    stickers = {
      documents: processStickerResult(attributeStickers.stickers),
      isEmoji: attributeStickers.emojis,
      isWithTextColor: attributeStickers.textColor,
    };
  }

  const mediaSize = media.forceSmallMedia ? 'small' : media.forceLargeMedia ? 'large' : undefined;

  return {
    mediaType: 'webpage',
    id: Number(id),
    ...pick(media.webpage, [
      'url',
      'displayUrl',
      'type',
      'siteName',
      'title',
      'description',
      'duration',
      'hasLargeMedia',
    ]),
    photo: photo instanceof GramJs.Photo ? buildApiPhoto(photo) : undefined,
    document: !video && !audio && document ? buildApiDocument(document) : undefined,
    video,
    audio,
    story,
    stickers,
    mediaSize,
  };
}

function buildPaidMedia(media: GramJs.TypeMessageMedia): ApiPaidMedia | undefined {
  if (!(media instanceof GramJs.MessageMediaPaidMedia)) {
    return undefined;
  }

  const { starsAmount, extendedMedia } = media;

  const isBought = extendedMedia[0] instanceof GramJs.MessageExtendedMedia;

  if (isBought) {
    return {
      mediaType: 'paidMedia',
      starsAmount: starsAmount.toJSNumber(),
      isBought,
      extendedMedia: buildBoughtMediaContent(extendedMedia)!,
    };
  }

  return {
    mediaType: 'paidMedia',
    starsAmount: starsAmount.toJSNumber(),
    extendedMedia: extendedMedia
      .filter((paidMedia): paidMedia is GramJs.MessageExtendedMediaPreview => (
        paidMedia instanceof GramJs.MessageExtendedMediaPreview
      ))
      .map((paidMedia) => buildApiMessageExtendedMediaPreview(paidMedia)),
  };
}

function getFilenameFromDocument(document: GramJs.Document, defaultBase = 'file') {
  const { mimeType, attributes } = document;
  const filenameAttribute = attributes
    .find((a: any): a is GramJs.DocumentAttributeFilename => a instanceof GramJs.DocumentAttributeFilename);

  if (filenameAttribute) {
    return filenameAttribute.fileName;
  }

  const extension = mimeType.split('/')[1];

  return `${defaultBase}${String(document.id)}.${extension}`;
}

export function buildApiMessageExtendedMediaPreview(
  preview: GramJs.MessageExtendedMediaPreview,
): ApiMediaExtendedPreview {
  const {
    w, h, thumb, videoDuration,
  } = preview;

  return {
    mediaType: 'extendedMediaPreview',
    width: w,
    height: h,
    duration: videoDuration,
    thumbnail: thumb ? buildApiThumbnailFromStripped([thumb]) : undefined,
  };
}

export function buildApiWebDocument(document?: GramJs.TypeWebDocument): ApiWebDocument | undefined {
  if (!document) return undefined;

  const {
    url, size, mimeType,
  } = document;
  const accessHash = document instanceof GramJs.WebDocument ? document.accessHash.toString() : undefined;
  const sizeAttr = document.attributes.find((attr): attr is GramJs.DocumentAttributeImageSize => (
    attr instanceof GramJs.DocumentAttributeImageSize
  ));
  const dimensions = sizeAttr && { width: sizeAttr.w, height: sizeAttr.h };

  return {
    mediaType: 'webDocument',
    url,
    accessHash,
    size,
    mimeType,
    dimensions,
  };
}

export function buildBoughtMediaContent(
  media: GramJs.TypeMessageExtendedMedia[],
): BoughtPaidMedia[] | undefined {
  const boughtMedia = media
    .filter((m): m is GramJs.MessageExtendedMedia => m instanceof GramJs.MessageExtendedMedia)
    .map((m) => buildMessageMediaContent(m.media))
    .filter(Boolean);

  if (!boughtMedia.length) {
    return undefined;
  }

  return boughtMedia;
}
