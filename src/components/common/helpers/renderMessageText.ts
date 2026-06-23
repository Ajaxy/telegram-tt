import { getGlobal } from '../../../global';

import type {
  ApiFormattedText, ApiMessage, ApiSponsoredMessage, StatefulMediaContent,
} from '../../../api/types';
import type { TextPart, ThreadId } from '../../../types';
import { ApiMessageEntityTypes } from '../../../api/types';

import {
  getMessageStatefulContent,
  getMessageTextWithFallback,
} from '../../../global/helpers';
import {
  getMessageSummaryDescription,
  getMessageSummaryEmoji,
  getMessageSummaryText,
  TRUNCATED_SUMMARY_LENGTH,
} from '../../../global/helpers/messageSummary';
import { getMessageKey } from '../../../util/keys/messageKey';
import { getTranslationFn, type LangFn } from '../../../util/localization';
import trimText from '../../../util/trimText';
import renderText from './renderText';
import { renderTextWithEntities } from './renderTextWithEntities';

export function renderMessageText({
  message,
  highlight,
  emojiSize,
  asPreview,
  truncateLength,
  isProtected,
  forcePlayback,
  shouldRenderAsHtml,
  isForMediaViewer,
  threadId,
  maxTimestamp,
}: {
  message: ApiMessage | ApiSponsoredMessage;
  highlight?: string;
  emojiSize?: number;
  asPreview?: boolean;
  truncateLength?: number;
  isProtected?: boolean;
  forcePlayback?: boolean;
  shouldRenderAsHtml?: boolean;
  isForMediaViewer?: boolean;
  threadId?: ThreadId;
  maxTimestamp?: number;
}) {
  const { text, entities } = message.content.text || {};

  if (!text) {
    const contentNotSupportedText = getMessageTextWithFallback(getTranslationFn(), message)?.text;
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
    asPreview,
    isProtected,
    forcePlayback,
    messageId: 'id' in message ? message.id : undefined,
    chatId: message.chatId,
    threadId,
    maxTimestamp,
  });
}

// TODO Use Message Summary component instead
export function renderMessageSummary(
  lang: LangFn,
  message: ApiMessage,
  noEmoji = false,
  highlight?: string,
  truncateLength = TRUNCATED_SUMMARY_LENGTH,
): TextPart[] {
  const { entities } = message.content.text || {};

  const global = getGlobal();
  const statefulContent = getMessageStatefulContent(global, message);
  const formattedSummaryText = getFormattedSummaryText(message, statefulContent);

  const hasSpoilers = entities?.some((entity) => entity.type === ApiMessageEntityTypes.Spoiler);
  const hasCustomEmoji = entities?.some((entity) => entity.type === ApiMessageEntityTypes.CustomEmoji);
  const hasFormattedSummaryEntities = Boolean(formattedSummaryText?.entities?.length);
  if (!hasSpoilers && !hasCustomEmoji && !hasFormattedSummaryEntities) {
    const text = trimText(getMessageSummaryText(lang, message, statefulContent, noEmoji), truncateLength);

    if (highlight) {
      return renderText(text, ['emoji', 'highlight'], { highlight });
    } else {
      return renderText(text);
    }
  }

  const emoji = !noEmoji && getMessageSummaryEmoji(message);
  const emojiWithSpace = emoji ? `${emoji} ` : '';

  if (formattedSummaryText && hasFormattedSummaryEntities) {
    return [
      ...renderText(emojiWithSpace),
      ...renderFormattedSummaryText(formattedSummaryText, highlight, truncateLength),
    ].filter(Boolean);
  }

  const text = renderMessageText({
    message, highlight, asPreview: true, truncateLength,
  });
  const description = getMessageSummaryDescription(lang, message, statefulContent, text);

  return [
    ...renderText(emojiWithSpace),
    ...(Array.isArray(description) ? description : [description]),
  ].filter(Boolean);
}

function getFormattedSummaryText(
  message: ApiMessage,
  statefulContent: StatefulMediaContent | undefined,
): ApiFormattedText | undefined {
  const { todo } = message.content;
  const { poll } = statefulContent || {};

  if (todo) {
    return todo.todo.title;
  }

  if (poll) {
    return poll.summary.question;
  }

  return undefined;
}

function renderFormattedSummaryText(
  formattedText: ApiFormattedText,
  highlight?: string,
  truncateLength?: number,
): TextPart[] {
  return renderTextWithEntities({
    text: trimText(formattedText.text, truncateLength),
    entities: formattedText.entities,
    highlight,
    asPreview: true,
  });
}
