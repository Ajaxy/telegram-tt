import type {
  ApiFormattedText,
  ApiStarGift,
  ApiStarGiftAttribute,
  ApiStarGiftAttributeBackdrop,
  ApiStarGiftAttributeModel,
  ApiStarGiftAttributeOriginalDetails,
  ApiStarGiftAttributePattern,
  ApiSticker,
} from '../../../api/types';

export type GiftAttributes = {
  model?: ApiStarGiftAttributeModel;
  originalDetails?: ApiStarGiftAttributeOriginalDetails;
  pattern?: ApiStarGiftAttributePattern;
  backdrop?: ApiStarGiftAttributeBackdrop;
};

export function getStickerFromGift(gift: ApiStarGift): ApiSticker | undefined {
  if (gift.type === 'starGift') {
    return gift.sticker;
  }

  return gift.attributes.find((attr): attr is ApiStarGiftAttributeModel => attr.type === 'model')?.sticker;
}

export function getTotalGiftAvailability(gift: ApiStarGift): number | undefined {
  if (gift.type === 'starGift') {
    return gift.availabilityTotal;
  }

  return gift.totalCount;
}

export function getGiftMessage(gift: ApiStarGift): ApiFormattedText | undefined {
  if (gift.type !== 'starGiftUnique') return undefined;

  return gift.attributes.find((attr): attr is ApiStarGiftAttributeOriginalDetails => attr.type === 'model')?.message;
}

export function getGiftAttributes(gift: ApiStarGift): GiftAttributes | undefined {
  if (gift.type !== 'starGiftUnique') return undefined;

  return getGiftAttributesFromList(gift.attributes);
}

export function getGiftAttributesFromList(attributes: ApiStarGiftAttribute[]) {
  const model = attributes.find((attr): attr is ApiStarGiftAttributeModel => attr.type === 'model');
  const backdrop = attributes.find((attr): attr is ApiStarGiftAttributeBackdrop => attr.type === 'backdrop');
  const pattern = attributes.find((attr): attr is ApiStarGiftAttributePattern => attr.type === 'pattern');
  const originalDetails = attributes.find((attr): attr is ApiStarGiftAttributeOriginalDetails => (
    attr.type === 'originalDetails'
  ));

  return {
    model,
    originalDetails,
    pattern,
    backdrop,
  };
}
