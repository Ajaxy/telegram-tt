import { Api as GramJs } from '../../../lib/gramjs';

import type {
  ApiInputSavedStarGift,
  ApiSavedStarGift,
  ApiStarGift,
  ApiStarGiftAttribute,
} from '../../types';

import { numberToHexColor } from '../../../util/colors';
import { addDocumentToLocalDb } from '../helpers/localDb';
import { buildApiFormattedText } from './common';
import { getApiChatIdFromMtpPeer } from './peers';
import { buildStickerFromDocument } from './symbols';

export function buildApiStarGift(starGift: GramJs.TypeStarGift): ApiStarGift {
  if (starGift instanceof GramJs.StarGiftUnique) {
    const {
      id, num, ownerId, ownerName, title, attributes, availabilityIssued, availabilityTotal, slug, ownerAddress,
      giftAddress,
    } = starGift;

    return {
      type: 'starGiftUnique',
      id: id.toString(),
      number: num,
      ownerId: ownerId && getApiChatIdFromMtpPeer(ownerId),
      ownerName,
      ownerAddress,
      attributes: attributes.map(buildApiStarGiftAttribute).filter(Boolean),
      title,
      totalCount: availabilityTotal,
      issuedCount: availabilityIssued,
      slug,
      giftAddress,
    };
  }

  const {
    id, limited, stars, availabilityRemains, availabilityTotal, convertStars, firstSaleDate, lastSaleDate, soldOut,
    birthday, upgradeStars,
  } = starGift;

  addDocumentToLocalDb(starGift.sticker);

  const sticker = buildStickerFromDocument(starGift.sticker)!;

  return {
    type: 'starGift',
    id: id.toString(),
    isLimited: limited,
    sticker,
    stars: stars.toJSNumber(),
    availabilityRemains,
    availabilityTotal,
    starsToConvert: convertStars.toJSNumber(),
    firstSaleDate,
    lastSaleDate,
    isSoldOut: soldOut,
    isBirthday: birthday,
    upgradeStars: upgradeStars?.toJSNumber(),
  };
}

export function buildApiStarGiftAttribute(attribute: GramJs.TypeStarGiftAttribute): ApiStarGiftAttribute | undefined {
  if (attribute instanceof GramJs.StarGiftAttributeModel) {
    const sticker = buildStickerFromDocument(attribute.document);
    if (!sticker) {
      return undefined;
    }

    addDocumentToLocalDb(attribute.document);

    return {
      type: 'model',
      name: attribute.name,
      rarityPercent: attribute.rarityPermille / 10,
      sticker,
    };
  }

  if (attribute instanceof GramJs.StarGiftAttributePattern) {
    const sticker = buildStickerFromDocument(attribute.document);
    if (!sticker) {
      return undefined;
    }

    addDocumentToLocalDb(attribute.document);

    return {
      type: 'pattern',
      name: attribute.name,
      rarityPercent: attribute.rarityPermille / 10,
      sticker,
    };
  }

  if (attribute instanceof GramJs.StarGiftAttributeBackdrop) {
    const {
      name, rarityPermille, centerColor, edgeColor, patternColor, textColor,
    } = attribute;

    return {
      type: 'backdrop',
      name,
      rarityPercent: rarityPermille / 10,
      centerColor: numberToHexColor(centerColor),
      edgeColor: numberToHexColor(edgeColor),
      patternColor: numberToHexColor(patternColor),
      textColor: numberToHexColor(textColor),
    };
  }

  if (attribute instanceof GramJs.StarGiftAttributeOriginalDetails) {
    const {
      date, recipientId, message, senderId,
    } = attribute;

    return {
      type: 'originalDetails',
      date,
      recipientId: recipientId && getApiChatIdFromMtpPeer(recipientId),
      message: message && buildApiFormattedText(message),
      senderId: senderId && getApiChatIdFromMtpPeer(senderId),
    };
  }

  return undefined;
}

export function buildApiSavedStarGift(userStarGift: GramJs.SavedStarGift, peerId: string): ApiSavedStarGift {
  const {
    gift, date, convertStars, fromId, message, msgId, nameHidden, unsaved, upgradeStars, transferStars, canUpgrade,
    savedId, canExportAt, pinnedToTop,
  } = userStarGift;

  const inputGift: ApiInputSavedStarGift | undefined = savedId && peerId
    ? { type: 'chat', chatId: peerId, savedId: savedId.toString() }
    : msgId ? { type: 'user', messageId: msgId } : undefined;

  return {
    gift: buildApiStarGift(gift),
    date,
    starsToConvert: convertStars?.toJSNumber(),
    fromId: fromId && getApiChatIdFromMtpPeer(fromId),
    message: message && buildApiFormattedText(message),
    messageId: msgId,
    isNameHidden: nameHidden,
    isUnsaved: unsaved,
    canUpgrade,
    alreadyPaidUpgradeStars: upgradeStars?.toJSNumber(),
    transferStars: transferStars?.toJSNumber(),
    inputGift,
    savedId: savedId?.toString(),
    canExportAt,
    isPinned: pinnedToTop,
  };
}
