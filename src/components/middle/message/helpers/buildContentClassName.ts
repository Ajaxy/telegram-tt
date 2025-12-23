import type { ApiMessage, ApiPoll, ApiWebPage } from '../../../../api/types';
import type { IAlbum } from '../../../../types';

import { EMOJI_SIZES, MESSAGE_CONTENT_CLASS_NAME } from '../../../../config';
import { getMessageContent } from '../../../../global/helpers';
import getSingularPaidMedia from './getSingularPaidMedia';

export function buildContentClassName(
  message: ApiMessage,
  album?: IAlbum,
  {
    poll,
    webPage,
    hasSubheader,
    isCustomShape,
    isLastInGroup,
    asForwarded,
    hasThread,
    forceSenderName,
    hasCommentCounter,
    hasBottomCommentButton,
    hasActionButton,
    hasReactions,
    isGeoLiveActive,
    withVoiceTranscription,
    peerColorClass,
    hasOutsideReactions,
  }: {
    poll?: ApiPoll;
    webPage?: ApiWebPage;
    hasSubheader?: boolean;
    isCustomShape?: boolean | number;
    isLastInGroup?: boolean;
    asForwarded?: boolean;
    hasThread?: boolean;
    forceSenderName?: boolean;
    hasCommentCounter?: boolean;
    hasBottomCommentButton?: boolean;
    hasActionButton?: boolean;
    hasReactions?: boolean;
    isGeoLiveActive?: boolean;
    withVoiceTranscription?: boolean;
    peerColorClass?: string;
    hasOutsideReactions?: boolean;
  } = {},
) {
  const { paidMedia } = getMessageContent(message);
  const { photo: paidMediaPhoto, video: paidMediaVideo } = getSingularPaidMedia(paidMedia);

  const content = getMessageContent(message);
  const {
    photo = paidMediaPhoto, video = paidMediaVideo,
    audio, voice, document, contact, location, invoice, storyData,
    giveaway, giveawayResults,
  } = content;
  const text = album?.hasMultipleCaptions ? undefined : getMessageContent(album?.captionMessage || message).text;
  const hasFactCheck = Boolean(message.factCheck?.text);

  const isRoundVideo = video?.mediaType === 'video' && video.isRound;
  const isInvertedMedia = message.isInvertedMedia;
  const isInvertibleMedia = photo || (video && !isRoundVideo) || album || webPage;

  const classNames = [MESSAGE_CONTENT_CLASS_NAME];
  const isMedia = storyData || photo || video || location || invoice?.extendedMedia || paidMedia;
  const hasText = text || location?.mediaType === 'venue' || isGeoLiveActive || hasFactCheck;
  const isMediaWithNoText = isMedia && !hasText;
  const hasInlineKeyboard = Boolean(message.inlineButtons);
  const isViaBot = Boolean(message.viaBotId);

  const hasFooter = (() => {
    if (isInvertedMedia && isInvertibleMedia) {
      if (hasReactions && !hasOutsideReactions) return true;
      if (hasFactCheck) return true;
      if (webPage && hasText) return true;
      return false;
    }
    return hasText;
  })();

  if (peerColorClass) {
    classNames.push(peerColorClass);
  }

  if (!isMedia && text?.emojiOnlyCount) {
    classNames.push('emoji-only');
    if (text.emojiOnlyCount <= EMOJI_SIZES) {
      classNames.push(`emoji-only-${text.emojiOnlyCount}`);
    }
  } else if (hasText) {
    classNames.push('text');
  } else {
    classNames.push('no-text');
  }

  if (!Object.keys(content).length) {
    classNames.push('unsupported');
  }

  if (hasActionButton) {
    classNames.push('has-action-button');
  }

  if (isCustomShape) {
    classNames.push('custom-shape');

    if (isRoundVideo) {
      classNames.push('round');
    }

    if (hasCommentCounter) {
      classNames.push('has-comment-counter');
    }
  }
  if (isMedia && !withVoiceTranscription) {
    classNames.push('media');
  } else if (video) {
    classNames.push('video');
  } else if (audio) {
    classNames.push('audio');
  } else if (voice) {
    classNames.push('voice');
    if (withVoiceTranscription) {
      classNames.push('with-voice-transcription');
    }
  } else if (document) {
    classNames.push('document');
  } else if (contact) {
    classNames.push('contact');
  } else if (poll) {
    classNames.push('poll');
  } else if (giveaway || giveawayResults) {
    classNames.push('giveaway');
  } else if (webPage?.webpageType === 'full') {
    classNames.push('web-page');

    if (webPage.photo || webPage.video) {
      classNames.push('media');
    }

    if (webPage.document) {
      classNames.push('document');
    }

    if (webPage.gift) {
      classNames.push('gift');
    }

    if (webPage.auction) {
      classNames.push('auction');
    }
  }

  if (invoice && !invoice.extendedMedia) {
    classNames.push('invoice');
  }

  if (invoice && invoice.photo) {
    classNames.push('has-photo');
  }

  if (storyData) {
    classNames.push('story');
  }

  if (asForwarded) {
    classNames.push('is-forwarded');
  }

  if (hasSubheader) {
    classNames.push('has-subheader');
  }

  if (hasThread) {
    classNames.push('has-replies');
  }

  if (hasReactions) {
    classNames.push('has-reactions');
  }

  if (hasOutsideReactions) {
    classNames.push('has-outside-reactions');
  }

  if (isViaBot) {
    classNames.push('is-via-bot');
  }

  if (forceSenderName) {
    classNames.push('force-sender-name');
  }

  if (!isCustomShape) {
    classNames.push('has-shadow');

    if (isMedia && hasThread) {
      classNames.push('has-background');
    }

    if (hasSubheader || asForwarded || isViaBot || !isMediaWithNoText
      || forceSenderName || hasFactCheck || withVoiceTranscription) {
      classNames.push('has-solid-background');
    }

    if (hasFactCheck) {
      classNames.push('has-fact-check');
    }

    if (isLastInGroup && !hasInlineKeyboard && (photo || !isMediaWithNoText || hasBottomCommentButton)) {
      classNames.push('has-appendix');
    }
  }

  if (isInvertibleMedia && isInvertedMedia) {
    classNames.push('is-inverted-media');
  }

  if (hasFooter) {
    classNames.push('has-footer');
  } else {
    classNames.push('no-footer');
  }

  return classNames.join(' ');
}
