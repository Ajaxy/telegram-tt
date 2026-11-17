import type {
  ApiInputSavedStarGift,
  ApiReaction,
  ApiShareTheme,
  ApiShareThemeBackdrop,
  ApiShareThemeEmojiBackdrop,
  ApiShareThemeGift,
  ApiStickerSet,
} from '../../../../api/types';

import { getReactionKey, isSameReaction } from '../../../../global/helpers';
import { buildCollectionByKey } from '../../../../util/iteratees';
import {
  DEFAULT_SHARE_THEME_CENTER_COLOR,
  DEFAULT_SHARE_THEME_EDGE_COLOR,
} from '../../../../util/qrCode/shareThemeColors';
import { getGiftAttributes } from '../../../common/helpers/gifts';

export type ShareThemeDraft = ApiShareThemeEmojiBackdrop
  | ApiShareThemeGift & { inputGift?: ApiInputSavedStarGift }
  | undefined;

export type ShareThemeBackdropOption = {
  backdropId?: number;
  name?: string;
  centerColor: string;
  edgeColor: string;
};

const MAX_EMOJI_COUNT = 6;

// The free emoji presets of the Android app, taken from the RestrictedEmoji set
const EMOJI_PRESET_IDS = [
  '5449505950283078474', '5420315771991497307', '5373141891321699086', '5373026167722876724', '5435957248314579621',
  '5440354006335495210', '5436040291507247633', '5445284980978621387', '5442983582882601962', '5409008750893734809',
  '5371017798065592581', '5472030678633684592', '5467583879948803288', '5471952986970267163', '5415696465945173620',
  '5397915559037785261', '5283020991981693429', '5283051451889756068', '5282816560128336499', '5465449362807070392',
  '5470012829983580233',
];
// The star preset is replaced by the set's snowflake
const EMOJI_PRESET_SNOW_INDEX = 4;
const SNOW_EMOJI = '❄';
const VARIATION_SELECTOR = '️';

export const DEFAULT_BACKDROP_OPTION: ShareThemeBackdropOption = {
  centerColor: DEFAULT_SHARE_THEME_CENTER_COLOR,
  edgeColor: DEFAULT_SHARE_THEME_EDGE_COLOR,
};

// A server backdrop with the default colors stands for the default option and is never sent
export function buildBackdropOptions(backdrops?: ApiShareThemeBackdrop[]): ShareThemeBackdropOption[] {
  const options = backdrops?.filter((backdrop) => !getIsDefaultBackdrop(backdrop)) || [];
  return [DEFAULT_BACKDROP_OPTION, ...options];
}

export function getShareThemeBackdrop(
  theme: ApiShareTheme | undefined, backdrops?: ApiShareThemeBackdrop[],
): ShareThemeBackdropOption {
  if (theme?.type === 'gift') {
    const backdrop = getGiftAttributes(theme.gift)?.backdrop;
    return backdrop || DEFAULT_BACKDROP_OPTION;
  }

  const backdropId = theme?.backdropId;
  const backdrop = backdropId !== undefined
    ? backdrops?.find((option) => option.backdropId === backdropId)
    : undefined;

  return backdrop && !getIsDefaultBackdrop(backdrop) ? backdrop : DEFAULT_BACKDROP_OPTION;
}

export function buildEmojiBackdropTheme(backdropId: number | undefined, emojis: ApiReaction[]): ShareThemeDraft {
  if (backdropId === undefined && !emojis.length) return undefined;

  return { type: 'emojiBackdrop', backdropId, emojis };
}

export function getEmojiPresets(restrictedEmoji?: ApiStickerSet) {
  const stickers = restrictedEmoji?.stickers;
  if (!stickers?.length) return undefined;

  const stickersById = buildCollectionByKey(stickers, 'id');
  const snow = stickers.find((sticker) => sticker.emoji?.replace(VARIATION_SELECTOR, '') === SNOW_EMOJI);

  return EMOJI_PRESET_IDS
    .map((id, i) => (i === EMOJI_PRESET_SNOW_INDEX && snow ? snow : stickersById[id]))
    .filter(Boolean);
}

// A repeated pick removes the emoji, and a pick over the limit replaces the last picked one
export function toggleEmojiPick(emojis: ApiReaction[], reaction: ApiReaction) {
  if (emojis.some((emoji) => isSameReaction(emoji, reaction))) {
    return emojis.filter((emoji) => !isSameReaction(emoji, reaction));
  }

  return [...emojis.slice(0, MAX_EMOJI_COUNT - 1), reaction];
}

export function getIsSameShareTheme(first: ShareThemeDraft, second: ShareThemeDraft) {
  if (!first || !second) return first === second;

  if (first.type === 'gift' || second.type === 'gift') {
    return first.type === 'gift' && second.type === 'gift' && first.gift.id === second.gift.id;
  }

  return first.backdropId === second.backdropId
    && first.emojis.map(getReactionKey).join() === second.emojis.map(getReactionKey).join();
}

function getIsDefaultBackdrop(backdrop: ApiShareThemeBackdrop) {
  return backdrop.centerColor === DEFAULT_SHARE_THEME_CENTER_COLOR
    && backdrop.edgeColor === DEFAULT_SHARE_THEME_EDGE_COLOR;
}
