import type { ApiMessage } from '../../../api/types';
import { ApiMessageEntityTypes } from '../../../api/types';
import type { TextPart } from '../../../types';
import type { ObserveFn } from '../../../hooks/useIntersectionObserver';
import type { LangFn } from '../../../hooks/useLang';

import {
  getMessageSummaryDescription,
  getMessageSummaryEmoji,
  getMessageSummaryText,
  getMessageText,
  TRUNCATED_SUMMARY_LENGTH,
} from '../../../global/helpers';
import renderText from './renderText';
import { renderTextWithEntities } from './renderTextWithEntities';
import trimText from '../../../util/trimText';

export function renderMessageText(
  message: ApiMessage,
  highlight?: string,
  shouldRenderHqEmoji?: boolean,
  isSimple?: boolean,
  truncateLength?: number,
  isProtected?: boolean,
  observeIntersection?: ObserveFn,
) {
  const { text, entities } = message.content.text || {};

  if (!text) {
    const contentNotSupportedText = getMessageText(message);
    return contentNotSupportedText ? [trimText(contentNotSupportedText, truncateLength)] : undefined;
  }

  return renderTextWithEntities(
    trimText(text, truncateLength),
    entities,
    highlight,
    shouldRenderHqEmoji,
    undefined,
    message.id,
    isSimple,
    isProtected,
    observeIntersection,
  );
}

export function renderMessageSummary(
  lang: LangFn,
  message: ApiMessage,
  noEmoji = false,
  highlight?: string,
  truncateLength = TRUNCATED_SUMMARY_LENGTH,
  observeIntersection?: ObserveFn,
): TextPart[] {
  const { entities } = message.content.text || {};

  const hasSpoilers = entities?.some((e) => e.type === ApiMessageEntityTypes.Spoiler);
  const hasCustomEmoji = entities?.some((e) => e.type === ApiMessageEntityTypes.CustomEmoji);
  if (!hasSpoilers && !hasCustomEmoji) {
    const text = trimText(getMessageSummaryText(lang, message, noEmoji), truncateLength);

    if (highlight) {
      return renderText(text, ['emoji', 'highlight'], { highlight });
    } else {
      return renderText(text);
    }
  }

  const emoji = !noEmoji && getMessageSummaryEmoji(message);
  const emojiWithSpace = emoji ? `${emoji} ` : '';

  const text = renderMessageText(
    message, highlight, undefined, true, truncateLength, undefined, observeIntersection,
  );
  const description = getMessageSummaryDescription(lang, message, text);

  return [
    ...renderText(emojiWithSpace),
    ...(Array.isArray(description) ? description : [description]),
  ].filter(Boolean);
}
