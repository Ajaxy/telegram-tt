import { Api as GramJs } from '../../../lib/gramjs';

import type {
  ApiAudio,
  ApiContact,
  ApiDice,
  ApiFormattedText,
  ApiGame,
  ApiGiveaway,
  ApiGiveawayResults,
  ApiLocation,
  ApiMediaExtendedPreview,
  ApiMediaInvoice,
  ApiMediaTodo,
  ApiMessagePoll,
  ApiMessageStoryData,
  ApiMessageWebPage,
  ApiPaidMedia,
  ApiPhoto,
  ApiPoll,
  ApiPollAnswer,
  ApiPollResults,
  ApiRichMessage,
  ApiStarGiftUnique,
  ApiSticker,
  ApiTodoItem,
  ApiVideo,
  ApiVoice,
  ApiWebDocument,
  ApiWebPage,
  ApiWebPageAuctionData,
  ApiWebPageStickerData,
  ApiWebPageStoryData,
  BoughtPaidMedia,
  MediaContent,
} from '../../types';
import type { UniversalMessage } from './messages';

import { addTimestampEntities } from '../../../util/dates/timestamp';
import { buildCollectionByKey, pick } from '../../../util/iteratees';
import { toJSNumber } from '../../../util/numbers';
import {
  addMediaToLocalDb, addStoryToLocalDb, addWebPageMediaToLocalDb, type MediaRepairContext,
} from '../helpers/localDb';
import { serializeBytes } from '../helpers/misc';
import {
  buildApiFormattedText,
  buildApiMessageEntity,
  buildApiPhoto,
  buildApiThumbnailFromStripped,
} from './common';
import { buildApiStarGift } from './gifts';
import {
  buildApiInstantViewPage,
  buildApiPageBlock,
  buildApiPageMediaContext,
} from './instantView';
import {
  buildApiAudioFromDocument,
  buildApiDocument,
  buildApiVideoFromDocument,
  buildApiVoiceFromDocument,
} from './media';
import { buildApiPeerId, getApiChatIdFromMtpPeer } from './peers';
import { buildStickerFromDocument, processStickerResult } from './symbols';

export { buildApiDocument };

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

  const richMessage = 'richMessage' in mtpMessage && mtpMessage.richMessage
    ? buildApiRichMessage(mtpMessage.richMessage, 'peerId' in mtpMessage ? mtpMessage : undefined)
    : undefined;
  if (richMessage) {
    content = {
      ...content,
      richMessage,
    };
  }

  const hasUnsupportedMedia = mtpMessage.media instanceof GramJs.MessageMediaUnsupported;

  if (!richMessage && mtpMessage.message && !hasUnsupportedMedia
    && !content.sticker && !content.todo && !content.contact && !content.video?.isRound) {
    const text = buildMessageTextContent(mtpMessage.message, mtpMessage.entities);
    const textWithTimestamps = addTimestampEntities(text);
    content = {
      ...content,
      text: textWithTimestamps,
    };
  }

  return content;
}

export function buildApiRichMessage(
  richMessage: GramJs.RichMessage,
  context?: MediaRepairContext,
): ApiRichMessage | undefined {
  if (!(richMessage instanceof GramJs.RichMessage)) {
    return undefined;
  }

  const {
    blocks, photos, documents, rtl, part,
  } = richMessage;
  const pageMediaContext = buildApiPageMediaContext(photos, documents, { message: context });

  return {
    blocks: blocks.map((block) => buildApiPageBlock(block, pageMediaContext)),
    isRtl: rtl,
    isPart: part,
    partCutoff: part ? blocks.length : undefined,
  };
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
    return {
      action: {
        mediaType: 'action',
        type: 'expired',
        isVoice: true,
      },
    };
  }
  const isExpiredRoundVideo = isExpiredRoundVideoMessage(media);
  if (isExpiredRoundVideo) {
    return {
      action: {
        mediaType: 'action',
        type: 'expired',
        isRoundVideo: true,
      },
    };
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
  if (video) return { video };

  const audio = buildAudio(media);
  if (audio) return { audio };

  const document = buildDocumentFromMedia(media);
  if (document) return { document };

  const contact = buildContact(media);
  if (contact) return { contact };

  const pollId = buildPollIdFromMedia(media);
  if (pollId) return { pollId };

  const todo = buildTodoFromMedia(media);
  if (todo) return { todo };

  const webPage = buildMessageWebPageFromMedia(media);
  if (webPage) return { webPage };

  const invoice = buildInvoiceFromMedia(media);
  if (invoice) return { invoice };

  const location = buildLocationFromMedia(media);
  if (location) return { location };

  const game = buildGameFromMedia(media);
  if (game) return { game };

  const dice = buildDiceFromMedia(media);
  if (dice) return { dice };

  const storyData = buildMessageStoryData(media);
  if (storyData) return { storyData };

  const giveaway = buildGiveawayFromMedia(media);
  if (giveaway) return { giveaway };

  const giveawayResults = buildGiveawayResultsFromMedia(media);
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

export function buildVideoFromDocument(document: GramJs.Document, altDocuments?: GramJs.TypeDocument[], params?: {
  isSpoiler?: boolean;
  timestamp?: number;
}): ApiVideo | undefined {
  return buildApiVideoFromDocument(document, altDocuments, params);
}

export function buildAudioFromDocument(document: GramJs.Document): ApiAudio | undefined {
  return buildApiAudioFromDocument(document, true);
}

function buildVideo(media: GramJs.TypeMessageMedia): ApiVideo | undefined {
  if (
    !(media instanceof GramJs.MessageMediaDocument)
    || !(media.document instanceof GramJs.Document)
    || !media.document.mimeType.startsWith('video')
  ) {
    return undefined;
  }

  return buildVideoFromDocument(
    media.document,
    media.altDocuments,
    { isSpoiler: media.spoiler, timestamp: media.videoTimestamp },
  );
}

function buildAudio(media: GramJs.TypeMessageMedia): ApiAudio | undefined {
  if (
    !(media instanceof GramJs.MessageMediaDocument)
    || !media.document
    || !(media.document instanceof GramJs.Document)
  ) {
    return undefined;
  }

  return buildApiAudioFromDocument(media.document);
}

function isExpiredVoiceMessage(media: GramJs.TypeMessageMedia): boolean {
  if (!(media instanceof GramJs.MessageMediaDocument)) {
    return false;
  }
  return Boolean(!media.document && media.voice);
}

function isExpiredRoundVideoMessage(media: GramJs.TypeMessageMedia): boolean {
  if (!(media instanceof GramJs.MessageMediaDocument)) {
    return false;
  }
  return Boolean(!media.document && media.round);
}

function buildVoice(media: GramJs.TypeMessageMedia): ApiVoice | undefined {
  if (
    !(media instanceof GramJs.MessageMediaDocument)
    || !media.document
    || !(media.document instanceof GramJs.Document)
  ) {
    return undefined;
  }

  return buildApiVoiceFromDocument(media.document);
}

function buildDocumentFromMedia(media: GramJs.TypeMessageMedia) {
  if (!(media instanceof GramJs.MessageMediaDocument) || !media.document) {
    return undefined;
  }

  return buildApiDocument(media.document);
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

export function buildMessagePollFromMedia(media: GramJs.TypeMessageMedia): ApiMessagePoll | undefined {
  if (!(media instanceof GramJs.MessageMediaPoll)) {
    return undefined;
  }

  return buildMessagePoll(media);
}

export function buildWebPagesFromMedia(media: GramJs.TypeMessageMedia): ApiWebPage[] | undefined {
  const webPages: ApiWebPage[] = [];

  addWebPageFromMedia(webPages, media);

  if (media instanceof GramJs.MessageMediaPoll) {
    if (media.attachedMedia) {
      addWebPageFromMedia(webPages, media.attachedMedia);
    }
    addWebPagesFromPoll(webPages, media.poll, media.results);
  }

  return webPages.length ? webPages : undefined;
}

export function buildWebPagesFromPoll(
  poll?: GramJs.Poll,
  pollResults?: GramJs.PollResults,
): ApiWebPage[] | undefined {
  const webPages: ApiWebPage[] = [];

  addWebPagesFromPoll(webPages, poll, pollResults);

  return webPages.length ? webPages : undefined;
}

function buildTodoFromMedia(media: GramJs.TypeMessageMedia): ApiMediaTodo | undefined {
  if (!(media instanceof GramJs.MessageMediaToDo)) {
    return undefined;
  }

  return buildTodo(media.todo, media.completions);
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

function buildDiceFromMedia(media: GramJs.TypeMessageMedia): ApiDice | undefined {
  if (!(media instanceof GramJs.MessageMediaDice)) {
    return undefined;
  }

  return buildDice(media);
}

function buildDice(media: GramJs.MessageMediaDice): ApiDice | undefined {
  const { value, emoticon } = media;
  return {
    mediaType: 'dice',
    value,
    emoticon,
  };
}

function buildGiveawayFromMedia(media: GramJs.TypeMessageMedia): ApiGiveaway | undefined {
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
    stars: toJSNumber(stars),
    quantity,
    untilDate,
    countries: countriesIso2,
    isOnlyForNewSubscribers: onlyNewSubscribers,
    prizeDescription,
  };
}

function buildGiveawayResultsFromMedia(media: GramJs.TypeMessageMedia): ApiGiveawayResults | undefined {
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

export function buildMessagePoll(media: GramJs.MessageMediaPoll): ApiMessagePoll {
  const { poll, results, attachedMedia } = media;

  return {
    mediaType: 'poll',
    summary: buildPoll(poll),
    results: buildPollResults(results),
    attachedMedia: attachedMedia ? buildMessageMediaContent(attachedMedia) : undefined,
  };
}

export function buildPollAnswer(answer: GramJs.TypePollAnswer): ApiPollAnswer | undefined {
  if (!(answer instanceof GramJs.PollAnswer)) return undefined;
  const { text, option, media, addedBy, date } = answer;

  return {
    text: buildApiFormattedText(text),
    option: serializeBytes(option),
    media: media ? buildMessageMediaContent(media) : undefined,
    addedByPeerId: addedBy ? getApiChatIdFromMtpPeer(addedBy) : undefined,
    date,
  };
}

export function buildPoll(poll: GramJs.Poll): ApiPoll {
  const {
    id, closed, publicVoters, multipleChoice, quiz, closePeriod, closeDate, answers, question, creator,
    hideResultsUntilClose, revotingDisabled, shuffleAnswers, openAnswers, subscribersOnly, countriesIso2, hash,
  } = poll;
  const apiAnswers = answers.map(buildPollAnswer).filter(Boolean);

  return {
    id: id.toString(),
    isClosed: closed,
    isPublic: publicVoters,
    isMultipleChoice: multipleChoice,
    isQuiz: quiz,
    closePeriod,
    closeDate,
    isCreator: creator,
    shouldHideResultsUntilClose: hideResultsUntilClose,
    isRevoteDisabled: revotingDisabled,
    shouldShuffleAnswers: shuffleAnswers,
    isRestrictedToSubscribers: subscribersOnly,
    allowedCountryCodes: countriesIso2,
    question: buildApiFormattedText(question),
    answers: apiAnswers,
    hash: hash.toString(),
    canAddAnswers: openAnswers,
  };
}

function addWebPagesFromPoll(
  webPages: ApiWebPage[],
  poll?: GramJs.Poll,
  pollResults?: GramJs.PollResults,
) {
  poll?.answers.forEach((answer) => {
    if (!(answer instanceof GramJs.PollAnswer) || !answer.media) {
      return;
    }

    addWebPageFromMedia(webPages, answer.media);
  });

  if (pollResults?.solutionMedia) {
    addWebPageFromMedia(webPages, pollResults.solutionMedia);
  }
}

function addWebPageFromMedia(webPages: ApiWebPage[], media: GramJs.TypeMessageMedia) {
  const webPage = buildWebPageFromMedia(media);
  if (!webPage) return;

  webPages.push(webPage);
}

export function buildTodoItem(item: GramJs.TodoItem): ApiTodoItem {
  return {
    id: item.id,
    title: buildApiFormattedText(item.title),
  };
}

export function buildTodo(todo: GramJs.TodoList, completions?: GramJs.TodoCompletion[]): ApiMediaTodo {
  const { title, list: items } = todo;

  const todoItems = items.map(buildTodoItem);

  const todoCompletions = completions?.map((completion) => ({
    itemId: completion.id,
    completedBy: getApiChatIdFromMtpPeer(completion.completedBy),
    completedAt: completion.date,
  }));

  return {
    mediaType: 'todo',
    todo: {
      title: buildApiFormattedText(title),
      items: todoItems,
      othersCanAppend: todo.othersCanAppend,
      othersCanComplete: todo.othersCanComplete,
    },
    completions: todoCompletions,
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
    amount: toJSNumber(totalAmount),
    currency,
    isTest: test,
    extendedMedia: preview,
  };
}

export function buildPollResults(pollResults: GramJs.PollResults): ApiPollResults {
  const {
    results: rawResults, totalVoters, recentVoters, solution, solutionEntities: entities, min, solutionMedia,
  } = pollResults;
  const results = rawResults?.map(({
    option, chosen, correct, voters, recentVoters: recentAnswerVoters,
  }) => ({
    isChosen: chosen,
    isCorrect: correct,
    option: serializeBytes(option),
    votersCount: voters ?? 0,
    recentVoterIds: recentAnswerVoters?.map((peer) => getApiChatIdFromMtpPeer(peer)),
  }));

  if (solutionMedia) {
    addMediaToLocalDb(solutionMedia);
  }

  return {
    isMin: min,
    totalVoters,
    recentVoterIds: recentVoters?.map((peer) => getApiChatIdFromMtpPeer(peer)),
    resultByOption: results && buildCollectionByKey(results, 'option'),
    solution,
    solutionEntities: entities?.map(buildApiMessageEntity),
    solutionMedia: solutionMedia ? buildMessageMediaContent(solutionMedia) : undefined,
  };
}

export function buildMessageWebPageFromMedia(media: GramJs.TypeMessageMedia): ApiMessageWebPage | undefined {
  if (!(media instanceof GramJs.MessageMediaWebPage) || media.webpage instanceof GramJs.WebPageNotModified) {
    return undefined;
  }
  const {
    webpage, forceLargeMedia, forceSmallMedia, safe,
  } = media;

  return {
    id: webpage.id.toString(),
    isSafe: safe,
    mediaSize: forceSmallMedia ? 'small' : forceLargeMedia ? 'large' : undefined,
  };
}

export function buildWebPageFromMedia(media: GramJs.TypeMessageMedia): ApiWebPage | undefined {
  if (!(media instanceof GramJs.MessageMediaWebPage)) {
    return undefined;
  }
  const {
    webpage,
  } = media;

  return buildWebPage(webpage);
}

export function buildWebPage(webPage: GramJs.TypeWebPage): ApiWebPage | undefined {
  addWebPageMediaToLocalDb(webPage);

  if (webPage instanceof GramJs.WebPageEmpty) {
    return {
      mediaType: 'webpage',
      webpageType: 'empty',
      id: webPage.id.toString(),
      url: webPage.url,
    };
  }

  if (webPage instanceof GramJs.WebPagePending) {
    return {
      mediaType: 'webpage',
      webpageType: 'pending',
      id: webPage.id.toString(),
      url: webPage.url,
    };
  }

  if (webPage instanceof GramJs.WebPage) {
    const {
      id, photo, document, attributes, cachedPage,
    } = webPage;

    const video = document instanceof GramJs.Document ? buildVideoFromDocument(document) : undefined;
    const audio = document instanceof GramJs.Document ? buildAudioFromDocument(document) : undefined;

    let story: ApiWebPageStoryData | undefined;
    let gift: ApiStarGiftUnique | undefined;
    let auction: ApiWebPageAuctionData | undefined;
    let stickers: ApiWebPageStickerData | undefined;
    const attributeStory = attributes
      ?.find((a): a is GramJs.WebPageAttributeStory => a instanceof GramJs.WebPageAttributeStory);
    const attributeGift = attributes
      ?.find((a): a is GramJs.WebPageAttributeUniqueStarGift => a instanceof GramJs.WebPageAttributeUniqueStarGift);
    const attributeAuction = attributes
      ?.find((a): a is GramJs.WebPageAttributeStarGiftAuction => (
        a instanceof GramJs.WebPageAttributeStarGiftAuction
      ));
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
    if (attributeGift) {
      const starGift = buildApiStarGift(attributeGift.gift);
      gift = starGift.type === 'starGiftUnique' ? starGift : undefined;
    }
    if (attributeAuction) {
      const starGift = buildApiStarGift(attributeAuction.gift);
      if (starGift.type === 'starGift') {
        auction = {
          gift: starGift,
          endDate: attributeAuction.endDate,
        };
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

    const attributeAiTone = attributes?.find((a): a is GramJs.WebPageAttributeAiComposeTone => (
      a instanceof GramJs.WebPageAttributeAiComposeTone
    ));

    return {
      mediaType: 'webpage',
      webpageType: 'full',
      id: id.toString(),
      ...pick(webPage, [
        'url',
        'displayUrl',
        'type',
        'siteName',
        'title',
        'description',
        'duration',
        'hash',
        'hasLargeMedia',
      ]),
      photo: photo instanceof GramJs.Photo ? buildApiPhoto(photo) : undefined,
      document: !video && !audio && document ? buildApiDocument(document) : undefined,
      video,
      audio,
      story,
      gift,
      auction,
      stickers,
      cachedPage: cachedPage instanceof GramJs.Page ? buildApiInstantViewPage(cachedPage, webPage) : undefined,
      aiComposeToneEmojiId: attributeAiTone?.emojiId.toString(),
    };
  }

  return undefined;
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
      starsAmount: toJSNumber(starsAmount),
      isBought,
      extendedMedia: buildBoughtMediaContent(extendedMedia)!,
    };
  }

  return {
    mediaType: 'paidMedia',
    starsAmount: toJSNumber(starsAmount),
    extendedMedia: extendedMedia
      .filter((paidMedia): paidMedia is GramJs.MessageExtendedMediaPreview => (
        paidMedia instanceof GramJs.MessageExtendedMediaPreview
      ))
      .map((paidMedia) => buildApiMessageExtendedMediaPreview(paidMedia)),
  };
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
