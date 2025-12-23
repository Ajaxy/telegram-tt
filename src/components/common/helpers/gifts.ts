import type {
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

export type GiftPreviewAttributes = {
  model: ApiStarGiftAttributeModel;
  pattern: ApiStarGiftAttributePattern;
  backdrop: ApiStarGiftAttributeBackdrop;
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

export function getGiftAttributes(gift: ApiStarGift): GiftAttributes | undefined {
  if (gift.type !== 'starGiftUnique') return undefined;

  return getGiftAttributesFromList(gift.attributes);
}

function getGiftAttributesFromList(attributes: ApiStarGiftAttribute[]) {
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

export function getRandomGiftPreviewAttributes(
  list: ApiStarGiftAttribute[],
  previousSelection?: GiftPreviewAttributes,
): GiftPreviewAttributes {
  const models = list.filter((attr): attr is ApiStarGiftAttributeModel => (
    attr.type === 'model' && attr.name !== previousSelection?.model.name
  ));
  const patterns = list.filter((attr): attr is ApiStarGiftAttributePattern => (
    attr.type === 'pattern' && attr.name !== previousSelection?.pattern.name
  ));
  const backdrops = list.filter((attr): attr is ApiStarGiftAttributeBackdrop => (
    attr.type === 'backdrop' && attr.name !== previousSelection?.backdrop.name
  ));

  if (!models.length || !patterns.length || !backdrops.length) {
    // Fallback: re-filter without exclusions if any category is empty
    const fallbackModels = models.length ? models
      : list.filter((attr): attr is ApiStarGiftAttributeModel => attr.type === 'model');

    const fallbackPatterns = patterns.length ? patterns
      : list.filter((attr): attr is ApiStarGiftAttributePattern => attr.type === 'pattern');

    const fallbackBackdrops = backdrops.length ? backdrops
      : list.filter((attr): attr is ApiStarGiftAttributeBackdrop => attr.type === 'backdrop');

    return {
      model: fallbackModels[Math.floor(Math.random() * fallbackModels.length)],
      pattern: fallbackPatterns[Math.floor(Math.random() * fallbackPatterns.length)],
      backdrop: fallbackBackdrops[Math.floor(Math.random() * fallbackBackdrops.length)],
    };
  }

  const randomModel = models[Math.floor(Math.random() * models.length)];
  const randomPattern = patterns[Math.floor(Math.random() * patterns.length)];
  const randomBackdrop = backdrops[Math.floor(Math.random() * backdrops.length)];

  return {
    model: randomModel,
    pattern: randomPattern,
    backdrop: randomBackdrop,
  };
}
