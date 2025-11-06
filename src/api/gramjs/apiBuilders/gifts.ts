import { Api as GramJs } from '../../../lib/gramjs';

import type {
  ApiDisallowedGiftsSettings,
  ApiInputSavedStarGift,
  ApiSavedStarGift,
  ApiStarGift,
  ApiStarGiftAttribute,
  ApiStarGiftAttributeCounter,
  ApiStarGiftAttributeId,
  ApiStarGiftCollection,
  ApiTypeResaleStarGifts,
} from '../../types';

import { int2hex } from '../../../util/colors';
import { toJSNumber } from '../../../util/numbers';
import { buildApiChatFromPreview } from '../apiBuilders/chats';
import { addDocumentToLocalDb } from '../helpers/localDb';
import { buildApiFormattedText } from './common';
import { buildApiCurrencyAmount } from './payments';
import { getApiChatIdFromMtpPeer } from './peers';
import { buildStickerFromDocument } from './symbols';
import { buildApiUser } from './users';

export function buildApiStarGift(starGift: GramJs.TypeStarGift): ApiStarGift {
  if (starGift instanceof GramJs.StarGiftUnique) {
    const {
      id, num, ownerId, ownerName, title, attributes, availabilityIssued, availabilityTotal, slug, ownerAddress,
      giftAddress, resellAmount, releasedBy, resaleTonOnly, requirePremium, valueCurrency, valueAmount, giftId,
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
      resellPrice: resellAmount && resellAmount.map((amount) => buildApiCurrencyAmount(amount)).filter(Boolean),
      releasedByPeerId: releasedBy && getApiChatIdFromMtpPeer(releasedBy),
      requirePremium,
      resaleTonOnly,
      valueCurrency,
      valueAmount: toJSNumber(valueAmount),
      regularGiftId: giftId.toString(),
    };
  }

  const {
    id, limited, stars, availabilityRemains, availabilityTotal, convertStars, firstSaleDate, lastSaleDate, soldOut,
    birthday, upgradeStars, resellMinStars, title, availabilityResale, releasedBy,
    requirePremium, limitedPerUser, perUserTotal, perUserRemains, lockedUntilDate,
  } = starGift;

  addDocumentToLocalDb(starGift.sticker);

  const sticker = buildStickerFromDocument(starGift.sticker)!;

  return {
    type: 'starGift',
    id: id.toString(),
    isLimited: limited,
    sticker,
    stars: toJSNumber(stars),
    availabilityRemains,
    availabilityTotal,
    starsToConvert: toJSNumber(convertStars),
    firstSaleDate,
    lastSaleDate,
    isSoldOut: soldOut,
    isBirthday: birthday,
    upgradeStars: upgradeStars !== undefined ? toJSNumber(upgradeStars) : undefined,
    title,
    resellMinStars: resellMinStars !== undefined ? toJSNumber(resellMinStars) : undefined,
    releasedByPeerId: releasedBy && getApiChatIdFromMtpPeer(releasedBy),
    availabilityResale: availabilityResale !== undefined ? toJSNumber(availabilityResale) : undefined,
    requirePremium,
    limitedPerUser,
    perUserTotal,
    perUserRemains,
    lockedUntilDate,
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
      centerColor: int2hex(centerColor),
      edgeColor: int2hex(edgeColor),
      patternColor: int2hex(patternColor),
      textColor: int2hex(textColor),
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
    savedId, canExportAt, pinnedToTop, canResellAt, canTransferAt, prepaidUpgradeHash, dropOriginalDetailsStars,
  } = userStarGift;

  const inputGift: ApiInputSavedStarGift | undefined = savedId && peerId
    ? { type: 'chat', chatId: peerId, savedId: savedId.toString() }
    : msgId ? { type: 'user', messageId: msgId } : undefined;

  return {
    gift: buildApiStarGift(gift),
    date,
    starsToConvert: toJSNumber(convertStars),
    fromId: fromId && getApiChatIdFromMtpPeer(fromId),
    message: message && buildApiFormattedText(message),
    messageId: msgId,
    isNameHidden: nameHidden,
    isUnsaved: unsaved,
    canUpgrade,
    alreadyPaidUpgradeStars: toJSNumber(upgradeStars),
    transferStars: toJSNumber(transferStars),
    inputGift,
    savedId: savedId?.toString(),
    canExportAt,
    canResellAt,
    canTransferAt,
    isPinned: pinnedToTop,
    dropOriginalDetailsStars: dropOriginalDetailsStars !== undefined ? toJSNumber(dropOriginalDetailsStars) : undefined,
    prepaidUpgradeHash,
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
        return new GramJs.StarGiftAttributeIdModel({ documentId: BigInt(attr.documentId) });

      case 'pattern':
        return new GramJs.StarGiftAttributeIdPattern({ documentId: BigInt(attr.documentId) });

      case 'backdrop':
        return new GramJs.StarGiftAttributeIdBackdrop({ backdropId: attr.backdropId });

      default: {
        // Exhaustive check
        const _exhaustive: never = attr;
        return _exhaustive;
      }
    }
  });
}

export function buildApiStarGiftCollection(collection: GramJs.StarGiftCollection): ApiStarGiftCollection | undefined {
  if (!collection) return undefined;

  const { collectionId, title, icon, giftsCount, hash } = collection;

  if (icon) {
    addDocumentToLocalDb(icon);
  }

  return {
    collectionId,
    title,
    icon: icon && buildStickerFromDocument(icon),
    giftsCount,
    hash: hash.toString(),
  };
}
