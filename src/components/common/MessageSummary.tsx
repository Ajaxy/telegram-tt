import { memo } from '../../lib/teact/teact';
import { withGlobal } from '../../global';

import type {
  ApiFormattedText, ApiMessage, ApiMessagePoll, ApiTypeStory,
  ApiWebPage,
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
  TRUNCATED_SUMMARY_LENGTH,
} from '../../global/helpers/messageSummary';
import { selectPeerStory, selectPollFromMessage, selectWebPageFromMessage } from '../../global/selectors';
import trimText from '../../util/trimText';
import renderText from './helpers/renderText';
import { renderTextWithEntities } from './helpers/renderTextWithEntities';

import useLang from '../../hooks/useLang';

import ActionMessageText from '../middle/message/ActionMessageText';
import MessageText from './MessageText';

type OwnProps = {
  message: ApiMessage;
  forcedText?: ApiFormattedText;
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
  poll?: ApiMessagePoll;
  story?: ApiTypeStory;
  webPage?: ApiWebPage;
};

function MessageSummary({
  message,
  forcedText,
  noEmoji,
  highlight,
  truncateLength = TRUNCATED_SUMMARY_LENGTH,
  withTranslucentThumbs,
  inChatList,
  emojiSize,
  poll,
  story,
  webPage,
  observeIntersectionForLoading,
  observeIntersectionForPlaying,
}: OwnProps & StateProps) {
  const lang = useLang();
  const extractedText = extractMessageText(message, inChatList);
  const hasPoll = Boolean(getMessagePollId(message));
  const isAction = isActionMessage(message);

  const statefulContent = groupStatefulContent({ poll, story, webPage });
  const emoji = !noEmoji && getMessageSummaryEmoji(message);

  if (!extractedText && !hasPoll && !isAction) {
    if (forcedText?.text) {
      const trimmedText = trimText(forcedText.text, truncateLength);

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

    const description = getMessageSummaryDescription(lang, message, statefulContent);

    if (typeof description !== 'string') {
      const { todo } = message.content;
      const formattedSummaryText = todo?.todo.title;
      const renderedDescription = formattedSummaryText
        ? renderFormattedSummaryText({
          formattedText: formattedSummaryText,
          highlight,
          truncateLength,
          emojiSize,
          observeIntersectionForLoading,
          observeIntersectionForPlaying,
          withTranslucentThumbs,
        })
        : description;

      return (
        <span>
          {[
            emoji ? renderText(`${emoji} `) : undefined,
            renderedDescription,
          ].flat().filter(Boolean)}
        </span>
      );
    }

    const emojiWithSpace = emoji ? `${emoji} ` : '';
    const summaryText = `${emojiWithSpace}${description}`;
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
        forcedText={forcedText}
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
  (global, { message }): Complete<StateProps> => {
    const poll = selectPollFromMessage(global, message);
    const webPage = selectWebPageFromMessage(global, message);
    const storyData = message.content.storyData;
    const story = storyData && selectPeerStory(global, storyData.peerId, storyData.id);

    return {
      poll,
      story,
      webPage,
    };
  },
)(MessageSummary));

function renderFormattedSummaryText({
  formattedText,
  highlight,
  truncateLength,
  emojiSize,
  observeIntersectionForLoading,
  observeIntersectionForPlaying,
  withTranslucentThumbs,
}: {
  formattedText: ApiFormattedText;
  highlight?: string;
  truncateLength?: number;
  emojiSize?: number;
  observeIntersectionForLoading?: ObserveFn;
  observeIntersectionForPlaying?: ObserveFn;
  withTranslucentThumbs?: boolean;
}) {
  return renderTextWithEntities({
    text: trimText(formattedText.text, truncateLength),
    entities: formattedText.entities,
    highlight,
    emojiSize,
    asPreview: true,
    observeIntersectionForLoading,
    observeIntersectionForPlaying,
    withTranslucentThumbs,
  });
}
