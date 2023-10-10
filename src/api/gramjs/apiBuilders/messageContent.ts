import { Api as GramJs } from '../../../lib/gramjs';

import type {
  ApiAudio,
  ApiContact,
  ApiDocument,
  ApiFormattedText,
  ApiGame,
  ApiInvoice,
  ApiLocation,
  ApiMessage,
  ApiMessageExtendedMediaPreview,
  ApiMessageStoryData,
  ApiPhoto,
  ApiPoll,
  ApiSticker,
  ApiVideo,
  ApiVoice,
  ApiWebDocument,
  ApiWebPage,
  ApiWebPageStoryData,
} from '../../types';
import type { UniversalMessage } from './messages';

import { SUPPORTED_IMAGE_CONTENT_TYPES, SUPPORTED_VIDEO_CONTENT_TYPES, VIDEO_WEBM_TYPE } from '../../../config';
import { pick } from '../../../util/iteratees';
import { addStoryToLocalDb, serializeBytes } from '../helpers';
import {
  buildApiMessageEntity,
  buildApiPhoto,
  buildApiPhotoSize,
  buildApiThumbnailFromPath,
  buildApiThumbnailFromStripped,
} from './common';
import { buildApiPeerId, getApiChatIdFromMtpPeer } from './peers';
import { buildStickerFromDocument } from './symbols';

export function buildMessageContent(
  mtpMessage: UniversalMessage | GramJs.UpdateServiceNotification,
) {
  let content: ApiMessage['content'] = {};

  if (mtpMessage.media) {
    content = {
      ...buildMessageMediaContent(mtpMessage.media),
    };
  }

  const hasUnsupportedMedia = mtpMessage.media instanceof GramJs.MessageMediaUnsupported;

  if (mtpMessage.message && !hasUnsupportedMedia
    && !content.sticker && !content.poll && !content.contact && !(content.video?.isRound)) {
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

export function buildMessageMediaContent(media: GramJs.TypeMessageMedia): ApiMessage['content'] | undefined {
  if ('ttlSeconds' in media && media.ttlSeconds) {
    return undefined;
  }

  if ('extendedMedia' in media && media.extendedMedia instanceof GramJs.MessageExtendedMedia) {
    return buildMessageMediaContent(media.extendedMedia.media);
  }

  const sticker = buildSticker(media);
  if (sticker) return { sticker };

  const photo = buildPhoto(media);
  if (photo) return { photo };

  const video = buildVideo(media);
  const altVideo = buildAltVideo(media);
  if (video) return { video, altVideo };

  const audio = buildAudio(media);
  if (audio) return { audio };

  const voice = buildVoice(media);
  if (voice) return { voice };

  const document = buildDocumentFromMedia(media);
  if (document) return { document };

  const contact = buildContact(media);
  if (contact) return { contact };

  const poll = buildPollFromMedia(media);
  if (poll) return { poll };

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
    id, mimeType, thumbs, size, attributes,
  } = document;

  // eslint-disable-next-line no-restricted-globals
  if (mimeType === VIDEO_WEBM_TYPE && !(self as any).isWebmSupported) {
    return undefined;
  }

  const videoAttr = attributes
    .find((a: any): a is GramJs.DocumentAttributeVideo => a instanceof GramJs.DocumentAttributeVideo);

  if (!videoAttr) {
    return undefined;
  }

  const gifAttr = attributes
    .find((a: any): a is GramJs.DocumentAttributeAnimated => a instanceof GramJs.DocumentAttributeAnimated);

  const {
    duration,
    w: width,
    h: height,
    supportsStreaming = false,
    roundMessage: isRound = false,
    nosound,
  } = videoAttr;

  return {
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
    ...(nosound && { noSound: true }),
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

function buildAltVideo(media: GramJs.TypeMessageMedia): ApiVideo | undefined {
  if (
    !(media instanceof GramJs.MessageMediaDocument)
    || !(media.altDocument instanceof GramJs.Document)
    || !media.altDocument.mimeType.startsWith('video')
  ) {
    return undefined;
  }

  return buildVideoFromDocument(media.altDocument, media.spoiler);
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
    id: String(media.document.id),
    fileName: getFilenameFromDocument(media.document, 'audio'),
    thumbnailSizes,
    size: media.document.size.toJSNumber(),
    ...pick(media.document, ['mimeType']),
    ...pick(audioAttribute, ['duration', 'performer', 'title']),
  };
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
    id: String(media.document.id),
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

  const photoSize = thumbs && thumbs.find((s: any): s is GramJs.PhotoSize => s instanceof GramJs.PhotoSize);
  let thumbnail = thumbs && buildApiThumbnailFromStripped(thumbs);
  if (!thumbnail && thumbs && photoSize) {
    const photoPath = thumbs.find((s: any): s is GramJs.PhotoPathSize => s instanceof GramJs.PhotoPathSize);
    if (photoPath) {
      thumbnail = buildApiThumbnailFromPath(photoPath, photoSize);
    }
  }

  let mediaType: ApiDocument['mediaType'] | undefined;
  let mediaSize: ApiDocument['mediaSize'] | undefined;
  if (photoSize) {
    mediaSize = {
      width: photoSize.w,
      height: photoSize.h,
    };

    if (SUPPORTED_IMAGE_CONTENT_TYPES.has(mimeType)) {
      mediaType = 'photo';

      const imageAttribute = attributes
        .find((a: any): a is GramJs.DocumentAttributeImageSize => a instanceof GramJs.DocumentAttributeImageSize);

      if (imageAttribute) {
        const { w: width, h: height } = imageAttribute;
        mediaSize = {
          width,
          height,
        };
      }
    } else if (SUPPORTED_VIDEO_CONTENT_TYPES.has(mimeType)) {
      mediaType = 'video';
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
    id: String(id),
    size: size.toJSNumber(),
    mimeType,
    timestamp: date,
    fileName: getFilenameFromDocument(document),
    thumbnail,
    mediaType,
    mediaSize,
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
    firstName, lastName, phoneNumber, userId: buildApiPeerId(userId, 'user'),
  };
}

function buildPollFromMedia(media: GramJs.TypeMessageMedia): ApiPoll | undefined {
  if (!(media instanceof GramJs.MessageMediaPoll)) {
    return undefined;
  }

  return buildPoll(media.poll, media.results);
}

function buildInvoiceFromMedia(media: GramJs.TypeMessageMedia): ApiInvoice | undefined {
  if (!(media instanceof GramJs.MessageMediaInvoice)) {
    return undefined;
  }

  return buildInvoice(media);
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
  return point && { type: 'geo', geo: point };
}

function buildVenue(media: GramJs.MessageMediaVenue): ApiLocation | undefined {
  const {
    geo, title, provider, address, venueId, venueType,
  } = media;
  const point = buildGeoPoint(geo);
  return point && {
    type: 'venue',
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
    type: 'geoLive',
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
    id: id.toString(),
    accessHash: accessHash.toString(),
    shortName,
    title,
    description,
    photo,
    document,
  };
}

export function buildMessageStoryData(media: GramJs.TypeMessageMedia): ApiMessageStoryData | undefined {
  if (!(media instanceof GramJs.MessageMediaStory)) {
    return undefined;
  }

  const peerId = getApiChatIdFromMtpPeer(media.peer);

  return { id: media.id, peerId, ...(media.viaMention && { isMention: true }) };
}

export function buildPoll(poll: GramJs.Poll, pollResults: GramJs.PollResults): ApiPoll {
  const { id, answers: rawAnswers } = poll;
  const answers = rawAnswers.map((answer) => ({
    text: answer.text,
    option: serializeBytes(answer.option),
  }));

  return {
    id: String(id),
    summary: {
      isPublic: poll.publicVoters,
      ...pick(poll, [
        'closed',
        'multipleChoice',
        'quiz',
        'question',
        'closePeriod',
        'closeDate',
      ]),
      answers,
    },
    results: buildPollResults(pollResults),
  };
}

export function buildInvoice(media: GramJs.MessageMediaInvoice): ApiInvoice {
  const {
    description: text, title, photo, test, totalAmount, currency, receiptMsgId, extendedMedia,
  } = media;

  const preview = extendedMedia instanceof GramJs.MessageExtendedMediaPreview
    ? buildApiMessageExtendedMediaPreview(extendedMedia) : undefined;

  return {
    title,
    text,
    photo: buildApiWebDocument(photo),
    receiptMsgId,
    amount: Number(totalAmount),
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
  if (document instanceof GramJs.Document && document.mimeType.startsWith('video/')) {
    video = buildVideoFromDocument(document);
  }
  let story: ApiWebPageStoryData | undefined;
  const attributeStory = attributes
    ?.find((a: any): a is GramJs.WebPageAttributeStory => a instanceof GramJs.WebPageAttributeStory);
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

  return {
    id: Number(id),
    ...pick(media.webpage, [
      'url',
      'displayUrl',
      'type',
      'siteName',
      'title',
      'description',
      'duration',
    ]),
    photo: photo instanceof GramJs.Photo ? buildApiPhoto(photo) : undefined,
    document: !video && document ? buildApiDocument(document) : undefined,
    video,
    story,
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
): ApiMessageExtendedMediaPreview {
  const {
    w, h, thumb, videoDuration,
  } = preview;

  return {
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
    url,
    accessHash,
    size,
    mimeType,
    dimensions,
  };
}
