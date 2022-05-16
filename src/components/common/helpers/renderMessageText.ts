import { ApiMessage, ApiMessageEntityTypes } from '../../../api/types';
import { TextPart } from '../../../types';

import {
  getMessageSummaryDescription,
  getMessageSummaryEmoji,
  getMessageSummaryText,
  getMessageText,
  TRUNCATED_SUMMARY_LENGTH,
} from '../../../global/helpers';
import { LangFn } from '../../../hooks/useLang';
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
  );
}

export function renderMessageSummary(
  lang: LangFn,
  message: ApiMessage,
  noEmoji = false,
  highlight?: string,
  truncateLength = TRUNCATED_SUMMARY_LENGTH,
): TextPart[] {
  const { entities } = message.content.text || {};

  const hasSpoilers = entities?.some((e) => e.type === ApiMessageEntityTypes.Spoiler);
  if (!hasSpoilers) {
    const text = trimText(getMessageSummaryText(lang, message, noEmoji), truncateLength);

    if (highlight) {
      return renderText(text, ['emoji', 'highlight'], { highlight });
    } else {
      return renderText(text);
    }
  }

  const emoji = !noEmoji && getMessageSummaryEmoji(message);
  const emojiWithSpace = emoji ? `${emoji} ` : '';

  const text = renderMessageText(message, highlight, undefined, true, truncateLength);
  const description = getMessageSummaryDescription(lang, message, text);

  return [
    emojiWithSpace,
    ...(Array.isArray(description) ? description : [description]),
  ].filter<TextPart>(Boolean);
}
