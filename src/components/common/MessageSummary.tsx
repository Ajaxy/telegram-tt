import React, { memo } from '../../lib/teact/teact';
import { withGlobal } from '../../global';

import type {
  ApiFormattedText, ApiMessage, ApiPoll, ApiTypeStory,
} from '../../api/types';
import type { ObserveFn } from '../../hooks/useIntersectionObserver';

import {
  extractMessageText,
  getMessagePollId,
  groupStatefulContent,
  isActionMessage,
} from '../../global/helpers';
import {
  getMessageSummaryDescription,
  getMessageSummaryEmoji,
  getMessageSummaryText,
  TRUNCATED_SUMMARY_LENGTH,
} from '../../global/helpers/messageSummary';
import { selectPeerStory, selectPollFromMessage } from '../../global/selectors';
import trimText from '../../util/trimText';
import renderText from './helpers/renderText';

import useOldLang from '../../hooks/useOldLang';

import ActionMessageText from '../middle/message/ActionMessageText';
import MessageText from './MessageText';

type OwnProps = {
  message: ApiMessage;
  translatedText?: ApiFormattedText;
  noEmoji?: boolean;
  highlight?: string;
  truncateLength?: number;
  withTranslucentThumbs?: boolean;
  inChatList?: boolean;
  emojiSize?: number;
  observeIntersectionForLoading?: ObserveFn;
  observeIntersectionForPlaying?: ObserveFn;
};

type StateProps = {
  poll?: ApiPoll;
  story?: ApiTypeStory;
};

function MessageSummary({
  message,
  translatedText,
  noEmoji = false,
  highlight,
  truncateLength = TRUNCATED_SUMMARY_LENGTH,
  withTranslucentThumbs = false,
  inChatList = false,
  emojiSize,
  poll,
  story,
  observeIntersectionForLoading,
  observeIntersectionForPlaying,
}: OwnProps & StateProps) {
  const lang = useOldLang();
  const extractedText = extractMessageText(message, inChatList);
  const hasPoll = Boolean(getMessagePollId(message));
  const isAction = isActionMessage(message);

  const statefulContent = groupStatefulContent({ poll, story });

  if (!extractedText && !hasPoll && !isAction) {
    const summaryText = translatedText?.text
      || getMessageSummaryText(lang, message, statefulContent, noEmoji, truncateLength);
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
    if (isAction) {
      return <ActionMessageText message={message} asPreview />;
    }

    return (
      <MessageText
        messageOrStory={message}
        translatedText={translatedText}
        highlight={highlight}
        asPreview
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
        getMessageSummaryDescription(lang, message, statefulContent, renderMessageText()),
      ].flat().filter(Boolean)}
    </>
  );
}

export default memo(withGlobal<OwnProps>(
  (global, { message }): StateProps => {
    const poll = selectPollFromMessage(global, message);
    const storyData = message.content.storyData;
    const story = storyData && selectPeerStory(global, storyData.peerId, storyData.id);

    return {
      poll,
      story,
    };
  },
)(MessageSummary));
