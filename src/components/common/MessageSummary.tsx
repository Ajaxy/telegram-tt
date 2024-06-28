import React, { memo } from '../../lib/teact/teact';

import type { ApiFormattedText, ApiMessage } from '../../api/types';
import type { ObserveFn } from '../../hooks/useIntersectionObserver';
import type { LangFn } from '../../hooks/useOldLang';
import { ApiMessageEntityTypes } from '../../api/types';

import {
  extractMessageText,
  getMessagePoll,
} from '../../global/helpers';
import {
  getMessageSummaryDescription,
  getMessageSummaryEmoji,
  getMessageSummaryText,
  TRUNCATED_SUMMARY_LENGTH,
} from '../../global/helpers/messageSummary';
import trimText from '../../util/trimText';
import renderText from './helpers/renderText';

import MessageText from './MessageText';

interface OwnProps {
  lang: LangFn;
  message: ApiMessage;
  translatedText?: ApiFormattedText;
  noEmoji?: boolean;
  highlight?: string;
  truncateLength?: number;
  observeIntersectionForLoading?: ObserveFn;
  observeIntersectionForPlaying?: ObserveFn;
  withTranslucentThumbs?: boolean;
  inChatList?: boolean;
  emojiSize?: number;
}

function MessageSummary({
  lang,
  message,
  translatedText,
  noEmoji = false,
  highlight,
  truncateLength = TRUNCATED_SUMMARY_LENGTH,
  observeIntersectionForLoading,
  observeIntersectionForPlaying,
  withTranslucentThumbs = false,
  inChatList = false,
  emojiSize,
}: OwnProps) {
  const { text, entities } = extractMessageText(message, inChatList) || {};
  const hasSpoilers = entities?.some((e) => e.type === ApiMessageEntityTypes.Spoiler);
  const hasCustomEmoji = entities?.some((e) => e.type === ApiMessageEntityTypes.CustomEmoji);
  const hasPoll = Boolean(getMessagePoll(message));

  if ((!text || (!hasSpoilers && !hasCustomEmoji)) && !hasPoll) {
    const summaryText = translatedText?.text || getMessageSummaryText(lang, message, noEmoji);
    const trimmedText = trimText(summaryText, truncateLength);

    return (
      <span>
        {highlight ? (
          renderText(trimmedText, ['emoji', 'highlight'], { highlight })
        ) : (
          renderText(trimmedText)
        )}
      </span>
    );
  }

  function renderMessageText() {
    return (
      <MessageText
        messageOrStory={message}
        translatedText={translatedText}
        highlight={highlight}
        isSimple
        observeIntersectionForLoading={observeIntersectionForLoading}
        observeIntersectionForPlaying={observeIntersectionForPlaying}
        withTranslucentThumbs={withTranslucentThumbs}
        truncateLength={truncateLength}
        inChatList={inChatList}
        emojiSize={emojiSize}
      />
    );
  }

  const emoji = !noEmoji && getMessageSummaryEmoji(message);

  return (
    <>
      {[
        emoji ? renderText(`${emoji} `) : undefined,
        getMessageSummaryDescription(lang, message, renderMessageText()),
      ].flat().filter(Boolean)}
    </>
  );
}

export default memo(MessageSummary);
