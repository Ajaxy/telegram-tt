import bigInt from 'big-integer';
import { Api as GramJs } from '../../../lib/gramjs';

import type {
  ApiDisallowedGiftsSettings,
  ApiInputSavedStarGift,
  ApiSavedStarGift,
  ApiStarGift,
  ApiStarGiftAttribute,
  ApiStarGiftAttributeCounter,
  ApiStarGiftAttributeId,
  ApiTypeResaleStarGifts,
} from '../../types';

import { numberToHexColor } from '../../../util/colors';
import { buildApiChatFromPreview } from '../apiBuilders/chats';
import { addDocumentToLocalDb } from '../helpers/localDb';
import { buildApiFormattedText } from './common';
import { getApiChatIdFromMtpPeer } from './peers';
import { buildStickerFromDocument } from './symbols';
import { buildApiUser } from './users';

export function buildApiStarGift(starGift: GramJs.TypeStarGift): ApiStarGift {
  if (starGift instanceof GramJs.StarGiftUnique) {
    const {
      id, num, ownerId, ownerName, title, attributes, availabilityIssued, availabilityTotal, slug, ownerAddress,
      giftAddress, resellStars,
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
      resellPriceInStars: resellStars?.toJSNumber(),
    };
  }

  const {
    id, limited, stars, availabilityRemains, availabilityTotal, convertStars, firstSaleDate, lastSaleDate, soldOut,
    birthday, upgradeStars, resellMinStars, title, availabilityResale,
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
    title,
    resellMinStars: resellMinStars?.toJSNumber(),
    availabilityResale: availabilityResale?.toJSNumber(),
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
      name, rarityPermille, centerColor, edgeColor, patternColor, textColor, backdropId,
    } = attribute;

    return {
      type: 'backdrop',
      backdropId,
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
    savedId, canExportAt, pinnedToTop, canResellAt, canTransferAt,
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
    canResellAt,
    canTransferAt,
    isPinned: pinnedToTop,
  };
}

export function buildApiDisallowedGiftsSettings(
  result: GramJs.TypeDisallowedGiftsSettings,
): ApiDisallowedGiftsSettings {
  const {
    disallowUnlimitedStargifts,
    disallowLimitedStargifts,
    disallowUniqueStargifts,
    disallowPremiumGifts,
  } = result;

  return {
    shouldDisallowUnlimitedStarGifts: disallowUnlimitedStargifts,
    shouldDisallowLimitedStarGifts: disallowLimitedStargifts,
    shouldDisallowUniqueStarGifts: disallowUniqueStargifts,
    shouldDisallowPremiumGifts: disallowPremiumGifts,
  };
}

export function buildApiStarGiftAttributeId(
  result: GramJs.TypeStarGiftAttributeId,
): ApiStarGiftAttributeId | undefined {
  if (result instanceof GramJs.StarGiftAttributeIdModel) {
    return {
      type: 'model',
      documentId: result.documentId.toString(),
    };
  }

  if (result instanceof GramJs.StarGiftAttributeIdPattern) {
    return {
      type: 'pattern',
      documentId: result.documentId.toString(),
    };
  }

  if (result instanceof GramJs.StarGiftAttributeIdBackdrop) {
    return {
      type: 'backdrop',
      backdropId: result.backdropId,
    };
  }

  return undefined;
}

export function buildApiStarGiftAttributeCounter(
  result: GramJs.TypeStarGiftAttributeCounter,
): ApiStarGiftAttributeCounter | undefined {
  const {
    count,
  } = result;

  const attribute = buildApiStarGiftAttributeId(result.attribute);
  if (!attribute) return undefined;

  return {
    count,
    attribute,
  };
}

export function buildApiResaleGifts(
  result: GramJs.payments.TypeResaleStarGifts,
): ApiTypeResaleStarGifts {
  const {
    count,
    nextOffset,
    attributesHash,
  } = result;

  const gifts = result.gifts.map((g) => buildApiStarGift(g));
  const attributes = result.attributes?.map((a) => buildApiStarGiftAttribute(a)).filter(Boolean);
  const users = result.users.map((u) => buildApiUser(u)).filter(Boolean);
  const chats = result.chats.map((c) => buildApiChatFromPreview(c)).filter(Boolean);
  const counters = result.counters?.map((c) => buildApiStarGiftAttributeCounter(c)).filter(Boolean);

  return {
    count,
    gifts,
    nextOffset,
    attributes,
    attributesHash: attributesHash?.toString(),
    chats,
    counters,
    users,
  };
}

export function buildInputResaleGiftsAttributes(attributes: ApiStarGiftAttributeId[]):
GramJs.TypeStarGiftAttributeId[] {
  return attributes.map((attr) => {
    switch (attr.type) {
      case 'model':
        return new GramJs.StarGiftAttributeIdModel({ documentId: bigInt(attr.documentId) });

      case 'pattern':
        return new GramJs.StarGiftAttributeIdPattern({ documentId: bigInt(attr.documentId) });

      case 'backdrop':
        return new GramJs.StarGiftAttributeIdBackdrop({ backdropId: attr.backdropId });

      default:
        throw new Error(`Unknown attribute type: ${(attr as any).type}`);
    }
  });
}
