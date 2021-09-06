import { useMemo } from '../lib/teact/teact';

import {
  ApiAudio, ApiChat, ApiMessage, ApiUser, ApiVoice,
} from '../api/types';

import useMedia from './useMedia';
import { useAsync } from './useAsync';
import {
  getAudioHasCover, getChatAvatarHash, getChatTitle, getMessageContent, getMessageMediaHash, getSenderTitle,
} from '../modules/helpers';
import { getTranslation } from '../util/langProvider';
import { buildMediaMetadata } from '../util/mediaSession';
import { scaleImage, resizeImage } from '../util/imageResize';
import { AVATAR_FULL_DIMENSIONS } from '../components/common/helpers/mediaDimensions';

// @ts-ignore
import telegramLogoPath from '../assets/telegram-logo-filled.svg';

const LOGO_DIMENSIONS = { width: 200, height: 200 };
const MINIMAL_SIZE = 115; // spec says 100, but on Chrome 93 it's not showing

// TODO Add support for video in future
export default (message: ApiMessage, sender?: ApiUser | ApiChat, chat?: ApiChat): MediaMetadata | undefined => {
  const { audio, voice } = getMessageContent(message);
  const title = audio ? (audio.title || audio.fileName) : voice ? 'Voice message' : '';
  const artist = (audio && audio.performer) || (sender && getSenderTitle(getTranslation, sender));
  const album = (chat && getChatTitle(getTranslation, chat)) || 'Telegram';

  const audioCoverHash = (audio && getAudioHasCover(audio) && getMessageMediaHash(message, 'pictogram'));
  const avatarHash = sender && getChatAvatarHash(sender, 'big');
  const hash = (audio && audioCoverHash) || (voice && avatarHash);
  const media = useMedia(hash);

  const size = getCoverSize(audio, voice, media);
  const { result: url } = useAsync(() => makeGoodArtwork(media, size), [media, size], telegramLogoPath);
  return useMemo(() => {
    return buildMediaMetadata({
      title,
      artist,
      album,
      artwork: [{ src: url }],
    });
  }, [album, artist, title, url]);
};

function makeGoodArtwork(url?: string, size?: { width: number; height: number }): Promise<string> {
  if (!url) return Promise.resolve(telegramLogoPath);
  if (!size) return resizeImage(url, MINIMAL_SIZE, MINIMAL_SIZE);
  const min = Math.min(size.width, size.height);
  if (min < MINIMAL_SIZE) {
    const ratio = MINIMAL_SIZE / min;
    return scaleImage(url, ratio);
  }
  return Promise.resolve(url);
}

function getCoverSize(audio?: ApiAudio, voice?: ApiVoice, url?: string) {
  if (!url) return LOGO_DIMENSIONS;
  if (audio) {
    if (!audio.thumbnailSizes || audio.thumbnailSizes.length === 0) return undefined;
    const preferred = audio.thumbnailSizes.find((size) => size.type === 'm');
    return preferred || audio.thumbnailSizes[0]; // Sometimes `m` is not present
  }

  if (voice) {
    return AVATAR_FULL_DIMENSIONS;
  }

  return undefined;
}
