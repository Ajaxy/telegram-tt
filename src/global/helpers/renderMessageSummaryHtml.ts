import type { LangFn } from '../../hooks/useLang';
import type { ApiMessage } from '../../api/types';
import { renderMessageText } from '../../components/common/helpers/renderMessageText';
import { getMessageSummaryDescription, getMessageSummaryEmoji } from './messageSummary';

export function renderMessageSummaryHtml(
  lang: LangFn,
  message: ApiMessage,
) {
  const emoji = getMessageSummaryEmoji(message);
  const emojiWithSpace = emoji ? `${emoji} ` : '';
  const text = renderMessageText(
    message, undefined, undefined, undefined, undefined, undefined, undefined, undefined, true,
  )?.join('');
  const description = getMessageSummaryDescription(lang, message, text, true, true);

  return `${emojiWithSpace}${description}`;
}
