import React, { memo } from '../../lib/teact/teact';

import type { ApiMessage } from '../../api/types';
import type { ObserveFn } from '../../hooks/useIntersectionObserver';
import type { LangFn } from '../../hooks/useLang';

import { ApiMessageEntityTypes } from '../../api/types';
import trimText from '../../util/trimText';
import {
  getMessageSummaryDescription,
  getMessageSummaryEmoji,
  getMessageSummaryText,
  TRUNCATED_SUMMARY_LENGTH,
} from '../../global/helpers';
import renderText from './helpers/renderText';

import MessageText from './MessageText';

interface OwnProps {
  lang: LangFn;
  message: ApiMessage;
  noEmoji?: boolean;
  highlight?: string;
  truncateLength?: number;
  observeIntersectionForLoading?: ObserveFn;
  observeIntersectionForPlaying?: ObserveFn;
  withTranslucentThumbs?: boolean;
}

function MessageSummary({
  lang,
  message,
  noEmoji = false,
  highlight,
  truncateLength = TRUNCATED_SUMMARY_LENGTH,
  observeIntersectionForLoading,
  observeIntersectionForPlaying,
  withTranslucentThumbs,
}: OwnProps) {
  const { text, entities } = message.content.text || {};

  const hasSpoilers = entities?.some((e) => e.type === ApiMessageEntityTypes.Spoiler);
  const hasCustomEmoji = entities?.some((e) => e.type === ApiMessageEntityTypes.CustomEmoji);
  if (!text || (!hasSpoilers && !hasCustomEmoji)) {
    const trimmedText = trimText(getMessageSummaryText(lang, message, noEmoji), truncateLength);

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
        message={message}
        highlight={highlight}
        isSimple
        observeIntersectionForLoading={observeIntersectionForLoading}
        observeIntersectionForPlaying={observeIntersectionForPlaying}
        withTranslucentThumbs={withTranslucentThumbs}
        truncateLength={truncateLength}
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
