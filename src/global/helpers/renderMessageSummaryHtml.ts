import type { ApiMessage } from '../../api/types';
import type { OldLangFn } from '../../hooks/useOldLang';

import { renderMessageText } from '../../components/common/helpers/renderMessageText';
import { getGlobal } from '..';
import { getMessageStatefulContent } from './messages';
import { getMessageSummaryDescription, getMessageSummaryEmoji } from './messageSummary';

export function renderMessageSummaryHtml(
  lang: OldLangFn,
  message: ApiMessage,
) {
  const global = getGlobal();
  const emoji = getMessageSummaryEmoji(message);
  const emojiWithSpace = emoji ? `${emoji} ` : '';
  const text = renderMessageText(
    { message, shouldRenderAsHtml: true },
  )?.join('');

  const statefulContent = getMessageStatefulContent(global, message);

  const description = getMessageSummaryDescription(lang, message, statefulContent, text, true);

  return `${emojiWithSpace}${description}`;
}
