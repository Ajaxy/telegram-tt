import type { Api as GramJs } from '../../../lib/gramjs';
import type { ApiBusinessIntro, ApiBusinessLocation, ApiBusinessWorkHours } from '../../types';

import { buildGeoPoint } from './messageContent';
import { buildStickerFromDocument } from './symbols';

export function buildApiBusinessLocation(location: GramJs.TypeBusinessLocation): ApiBusinessLocation {
  const {
    address, geoPoint,
  } = location;

  return {
    address,
    geo: geoPoint && buildGeoPoint(geoPoint),
  };
}

export function buildApiBusinessWorkHours(workHours: GramJs.TypeBusinessWorkHours): ApiBusinessWorkHours {
  const {
    timezoneId, weeklyOpen,
  } = workHours;

  return {
    timezoneId,
    workHours: weeklyOpen.map(({ startMinute, endMinute }) => ({
      startMinute,
      endMinute,
    })),
  };
}

export function buildApiBusinessIntro(intro: GramJs.TypeBusinessIntro): ApiBusinessIntro {
  const {
    title, description, sticker,
  } = intro;

  return {
    title,
    description,
    sticker: sticker && buildStickerFromDocument(sticker),
  };
}
