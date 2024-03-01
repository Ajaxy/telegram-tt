import type { ApiMessage } from '../../../../api/types';

import { EMOJI_SIZES, MESSAGE_CONTENT_CLASS_NAME } from '../../../../config';
import { getMessageContent } from '../../../../global/helpers';

export function buildContentClassName(
  message: ApiMessage,
  {
    hasSubheader,
    isCustomShape,
    isLastInGroup,
    asForwarded,
    hasThread,
    forceSenderName,
    hasCommentCounter,
    hasActionButton,
    hasReactions,
    isGeoLiveActive,
    withVoiceTranscription,
    peerColorClass,
  }: {
    hasSubheader?: boolean;
    isCustomShape?: boolean | number;
    isLastInGroup?: boolean;
    asForwarded?: boolean;
    hasThread?: boolean;
    forceSenderName?: boolean;
    hasCommentCounter?: boolean;
    hasActionButton?: boolean;
    hasReactions?: boolean;
    isGeoLiveActive?: boolean;
    withVoiceTranscription?: boolean;
    peerColorClass?: string;
  } = {},
) {
  const {
    text, photo, video, audio, voice, document, poll, webPage, contact, location, invoice, storyData,
    giveaway, giveawayResults,
  } = getMessageContent(message);

  const classNames = [MESSAGE_CONTENT_CLASS_NAME];
  const isMedia = storyData || photo || video || location || invoice?.extendedMedia;
  const hasText = text || location?.type === 'venue' || isGeoLiveActive;
  const isMediaWithNoText = isMedia && !hasText;
  const isViaBot = Boolean(message.viaBotId);

  if (peerColorClass) {
    classNames.push(peerColorClass);
  }

  if (!isMedia && message.emojiOnlyCount) {
    classNames.push('emoji-only');
    if (message.emojiOnlyCount <= EMOJI_SIZES) {
      classNames.push(`emoji-only-${message.emojiOnlyCount}`);
    }
  } else if (hasText) {
    classNames.push('text');
  } else {
    classNames.push('no-text');
  }

  if (hasActionButton) {
    classNames.push('has-action-button');
  }

  if (isCustomShape) {
    classNames.push('custom-shape');
    if (video?.isRound) {
      classNames.push('round');
    }

    if (hasCommentCounter) {
      classNames.push('has-comment-counter');
    }
  }
  if (isMedia) {
    classNames.push('media');
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
  } else if (webPage) {
    classNames.push('web-page');

    if (webPage.photo || webPage.video) {
      classNames.push('media');
    }

    if (webPage.document) {
      classNames.push('document');
    }
  }

  if (invoice && !invoice.extendedMedia) {
    classNames.push('invoice');
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

    if (hasSubheader || asForwarded || isViaBot || !isMediaWithNoText || forceSenderName) {
      classNames.push('has-solid-background');
    }

    if (isLastInGroup && (photo || !isMediaWithNoText || (location && asForwarded))) {
      classNames.push('has-appendix');
    }
  }

  return classNames.join(' ');
}
