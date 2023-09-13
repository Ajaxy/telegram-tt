import type { ApiMessage } from '../../api/types';
import type { LangFn } from '../../hooks/useLang';

import { renderMessageText } from '../../components/common/helpers/renderMessageText';
import { getMessageSummaryDescription, getMessageSummaryEmoji } from './messageSummary';

export function renderMessageSummaryHtml(
  lang: LangFn,
  message: ApiMessage,
) {
  const emoji = getMessageSummaryEmoji(message);
  const emojiWithSpace = emoji ? `${emoji} ` : '';
  const text = renderMessageText(
    { message, shouldRenderAsHtml: true },
  )?.join('');
  const description = getMessageSummaryDescription(lang, message, text, true);

  return `${emojiWithSpace}${description}`;
}
