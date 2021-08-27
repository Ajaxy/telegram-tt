import { ApiMessage } from '../../../../api/types';

import { getMessageContent } from '../../../../modules/helpers';

export function isEmojiOnlyMessage(customShape?: boolean | number) {
  return typeof customShape === 'number';
}

export function buildContentClassName(
  message: ApiMessage,
  {
    hasReply,
    customShape,
    isLastInGroup,
    asForwarded,
    hasThread,
    forceSenderName,
    hasComments,
    hasActionButton,
  }: {
    hasReply?: boolean;
    customShape?: boolean | number;
    isLastInGroup?: boolean;
    asForwarded?: boolean;
    hasThread?: boolean;
    forceSenderName?: boolean;
    hasComments?: boolean;
    hasActionButton?: boolean;
  } = {},
) {
  const {
    text, photo, video, audio, voice, document, poll, webPage, contact,
  } = getMessageContent(message);

  const classNames = ['message-content'];
  const isMedia = photo || video;
  const isMediaWithNoText = isMedia && !text;
  const isViaBot = Boolean(message.viaBotId);

  if (isEmojiOnlyMessage(customShape)) {
    classNames.push(`emoji-only emoji-only-${customShape}`);
  } else if (text) {
    classNames.push('text');
  }

  if (hasActionButton) {
    classNames.push('has-action-button');
  }

  if (customShape) {
    classNames.push('custom-shape');
    if (video?.isRound) {
      classNames.push('round');
    }

    if (hasComments) {
      classNames.push('has-comments');
    }
  }
  if (photo || video) {
    classNames.push('media');
  } else if (audio) {
    classNames.push('audio');
  } else if (voice) {
    classNames.push('voice');
  } else if (document) {
    classNames.push('document');
  } else if (contact) {
    classNames.push('contact');
  } else if (poll) {
    classNames.push('poll');
  } else if (webPage) {
    classNames.push('web-page');

    if (webPage.photo || webPage.video) {
      classNames.push('media');
    }
  }

  if (asForwarded && !customShape) {
    classNames.push('is-forwarded');
  }

  if (hasReply) {
    classNames.push('is-reply');
  }

  if (hasThread) {
    classNames.push('has-replies');
  }

  if (isViaBot) {
    classNames.push('is-via-bot');
  }

  if (forceSenderName) {
    classNames.push('force-sender-name');
  }

  if (!customShape) {
    classNames.push('has-shadow');

    if (isMedia && hasComments) {
      classNames.push('has-background');
    }

    if (hasReply || asForwarded || !isMediaWithNoText || isViaBot || forceSenderName) {
      classNames.push('has-solid-background');
    }

    if (isLastInGroup && (photo || !isMediaWithNoText)) {
      classNames.push('has-appendix');
    }
  }

  return classNames.join(' ');
}
