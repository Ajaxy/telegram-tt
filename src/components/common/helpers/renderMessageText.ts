import { getGlobal } from '../../../global';

import type { ApiMessage, ApiSponsoredMessage } from '../../../api/types';
import type { OldLangFn } from '../../../hooks/useOldLang';
import type { TextPart } from '../../../types';
import { ApiMessageEntityTypes } from '../../../api/types';

import {
  getMessageStatefulContent,
  getMessageText,
} from '../../../global/helpers';
import {
  getMessageSummaryDescription,
  getMessageSummaryEmoji,
  getMessageSummaryText,
  TRUNCATED_SUMMARY_LENGTH,
} from '../../../global/helpers/messageSummary';
import { getMessageKey } from '../../../util/keys/messageKey';
import trimText from '../../../util/trimText';
import renderText from './renderText';
import { renderTextWithEntities } from './renderTextWithEntities';

export function renderMessageText({
  message,
  highlight,
  emojiSize,
  isSimple,
  truncateLength,
  isProtected,
  forcePlayback,
  shouldRenderAsHtml,
  isForMediaViewer,
} : {
  message: ApiMessage | ApiSponsoredMessage;
  highlight?: string;
  emojiSize?: number;
  isSimple?: boolean;
  truncateLength?: number;
  isProtected?: boolean;
  forcePlayback?: boolean;
  shouldRenderAsHtml?: boolean;
  isForMediaViewer?: boolean;
}) {
  const { text, entities } = message.content.text || {};

  if (!text) {
    const contentNotSupportedText = getMessageText(message);
    return contentNotSupportedText ? [trimText(contentNotSupportedText, truncateLength)] : undefined;
  }

  const messageKey = getMessageKey(message);

  return renderTextWithEntities({
    text: trimText(text, truncateLength),
    entities,
    highlight,
    emojiSize,
    shouldRenderAsHtml,
    containerId: `${isForMediaViewer ? 'mv-' : ''}${messageKey}`,
    isSimple,
    isProtected,
    forcePlayback,
  });
}

// TODO Use Message Summary component instead
export function renderMessageSummary(
  lang: OldLangFn,
  message: ApiMessage,
  noEmoji = false,
  highlight?: string,
  truncateLength = TRUNCATED_SUMMARY_LENGTH,
): TextPart[] {
  const { entities } = message.content.text || {};

  const global = getGlobal();
  const statefulContent = getMessageStatefulContent(global, message);

  const hasSpoilers = entities?.some((e) => e.type === ApiMessageEntityTypes.Spoiler);
  const hasCustomEmoji = entities?.some((e) => e.type === ApiMessageEntityTypes.CustomEmoji);
  if (!hasSpoilers && !hasCustomEmoji) {
    const text = trimText(getMessageSummaryText(lang, message, statefulContent, noEmoji), truncateLength);

    if (highlight) {
      return renderText(text, ['emoji', 'highlight'], { highlight });
    } else {
      return renderText(text);
    }
  }

  const emoji = !noEmoji && getMessageSummaryEmoji(message);
  const emojiWithSpace = emoji ? `${emoji} ` : '';

  const text = renderMessageText({
    message, highlight, isSimple: true, truncateLength,
  });
  const description = getMessageSummaryDescription(lang, message, statefulContent, text);

  return [
    ...renderText(emojiWithSpace),
    ...(Array.isArray(description) ? description : [description]),
  ].filter(Boolean);
}
