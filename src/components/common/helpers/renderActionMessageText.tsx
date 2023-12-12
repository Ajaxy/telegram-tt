import React from '../../../lib/teact/teact';

import type {
  ApiChat, ApiGroupCall, ApiMessage, ApiTopic, ApiUser,
} from '../../../api/types';
import type { ObserveFn } from '../../../hooks/useIntersectionObserver';
import type { LangFn } from '../../../hooks/useLang';
import type { TextPart } from '../../../types';

import {
  getChatTitle,
  getMessageSummaryText,
  getUserFullName,
} from '../../../global/helpers';
import { formatCurrency } from '../../../util/formatCurrency';
import trimText from '../../../util/trimText';
import renderText from './renderText';

import ChatLink from '../ChatLink';
import CustomEmoji from '../CustomEmoji';
import GroupCallLink from '../GroupCallLink';
import MessageLink from '../MessageLink';
import MessageSummary from '../MessageSummary';
import TopicDefaultIcon from '../TopicDefaultIcon';
import UserLink from '../UserLink';

interface RenderOptions {
  asPlainText?: boolean;
  isEmbedded?: boolean;
}

const MAX_LENGTH = 32;
const NBSP = '\u00A0';

export function renderActionMessageText(
  lang: LangFn,
  message: ApiMessage,
  actionOriginUser?: ApiUser,
  actionOriginChat?: ApiChat,
  targetUsers?: ApiUser[],
  targetMessage?: ApiMessage,
  targetChatId?: string,
  topic?: ApiTopic,
  options: RenderOptions = {},
  observeIntersectionForLoading?: ObserveFn,
  observeIntersectionForPlaying?: ObserveFn,
) {
  if (!message.content.action) {
    return [];
  }

  const {
    text, translationValues, amount, currency, call, score, topicEmojiIconId, giftCryptoInfo, pluralValue,
  } = message.content.action;
  const content: TextPart[] = [];
  const noLinks = options.asPlainText || options.isEmbedded;
  const translationKey = text === 'Chat.Service.Group.UpdatedPinnedMessage1' && !targetMessage
    ? 'Message.PinnedGenericMessage'
    : text;

  let unprocessed = lang(
    translationKey, translationValues?.length ? translationValues : undefined, undefined, pluralValue,
  );
  if (translationKey.includes('ScoredInGame')) { // Translation hack for games
    unprocessed = unprocessed.replace('un1', '%action_origin%').replace('un2', '%message%');
  }
  if (translationKey === 'ActionGiftOutbound') { // Translation hack for Premium Gift
    unprocessed = unprocessed.replace('un2', '%gift_payment_amount%').replace(/\*\*/g, '');
  }
  if (translationKey === 'ActionGiftInbound') { // Translation hack for Premium Gift
    unprocessed = unprocessed
      .replace('un1', '%action_origin%')
      .replace('un2', '%gift_payment_amount%')
      .replace(/\*\*/g, '');
  }
  let processed: TextPart[];

  if (unprocessed.includes('%payment_amount%')) {
    processed = processPlaceholder(
      unprocessed,
      '%payment_amount%',
      formatCurrency(amount!, currency!, lang.code),
    );
    unprocessed = processed.pop() as string;
    content.push(...processed);
  }

  processed = processPlaceholder(
    unprocessed,
    '%action_origin%',
    actionOriginUser ? (
      renderUserContent(actionOriginUser, noLinks) || NBSP
    ) : actionOriginChat ? (
      renderChatContent(lang, actionOriginChat, noLinks) || NBSP
    ) : 'User',
    '',
  );

  unprocessed = processed.pop() as string;
  content.push(...processed);

  if (unprocessed.includes('%action_topic%')) {
    const topicEmoji = topic?.iconEmojiId
      ? <CustomEmoji documentId={topic.iconEmojiId} />
      : '';
    const topicString = topic ? `${topic.title}` : 'a topic';
    processed = processPlaceholder(
      unprocessed,
      '%action_topic%',
      [topicEmoji, topicString],
      '',
    );
    unprocessed = processed.pop() as string;
    content.push(...processed);
  }

  if (unprocessed.includes('%action_topic_icon%')) {
    const topicIcon = topicEmojiIconId || topic?.iconEmojiId;
    const hasIcon = topicIcon && topicIcon !== '0';
    processed = processPlaceholder(
      unprocessed,
      '%action_topic_icon%',
      hasIcon ? <CustomEmoji documentId={topicIcon!} />
        : topic ? <TopicDefaultIcon topicId={topic!.id} title={topic!.title} /> : '...',
    );
    unprocessed = processed.pop() as string;
    content.push(...processed);
  }

  if (unprocessed.includes('%gift_payment_amount%')) {
    const price = formatCurrency(amount!, currency!, lang.code);
    let priceText = price;

    if (giftCryptoInfo) {
      priceText = `${giftCryptoInfo.amount} ${giftCryptoInfo.currency} (~${price})`;
    }

    processed = processPlaceholder(
      unprocessed,
      '%gift_payment_amount%',
      priceText,
    );
    unprocessed = processed.pop() as string;
    content.push(...processed);
  }

  if (unprocessed.includes('%amount%')) {
    processed = processPlaceholder(
      unprocessed,
      '%amount%',
      amount,
    );
    unprocessed = processed.pop() as string;
    content.push(...processed);
  }

  if (unprocessed.includes('%score%')) {
    processed = processPlaceholder(
      unprocessed,
      '%score%',
      score!.toString(),
    );
    unprocessed = processed.pop() as string;
    content.push(...processed);
  }

  processed = processPlaceholder(
    unprocessed,
    '%target_user%',
    targetUsers
      ? targetUsers.map((user) => renderUserContent(user, noLinks)).filter(Boolean)
      : 'User',
    '',
  );

  unprocessed = processed.pop() as string;
  content.push(...processed);

  processed = processPlaceholder(
    unprocessed,
    '%message%',
    targetMessage
      ? renderMessageContent(
        lang, targetMessage, options, observeIntersectionForLoading, observeIntersectionForPlaying,
      )
      : 'a message',
  );
  unprocessed = processed.pop() as string;
  content.push(...processed);

  processed = processPlaceholder(
    unprocessed,
    '%product%',
    targetMessage
      ? renderProductContent(targetMessage)
      : 'a product',
  );
  unprocessed = processed.pop() as string;
  content.push(...processed);

  processed = processPlaceholder(
    unprocessed,
    '%target_chat%',
    targetChatId
      ? renderMigratedContent(targetChatId, noLinks)
      : 'another chat',
    '',
  );
  processed.forEach((part) => {
    content.push(...renderText(part));
  });

  if (options.asPlainText) {
    return content.join('').trim();
  }

  if (call) {
    return renderGroupCallContent(call, content);
  }

  return content;
}

function renderProductContent(message: ApiMessage) {
  return message.content && message.content.invoice
    ? message.content.invoice.title
    : 'a product';
}

function renderMessageContent(
  lang: LangFn,
  message: ApiMessage,
  options: RenderOptions = {},
  observeIntersectionForLoading?: ObserveFn,
  observeIntersectionForPlaying?: ObserveFn,
) {
  const { asPlainText, isEmbedded } = options;

  if (asPlainText) {
    return getMessageSummaryText(lang, message, undefined, MAX_LENGTH);
  }

  const messageSummary = (
    <MessageSummary
      lang={lang}
      message={message}
      truncateLength={MAX_LENGTH}
      observeIntersectionForLoading={observeIntersectionForLoading}
      observeIntersectionForPlaying={observeIntersectionForPlaying}
      withTranslucentThumbs
    />
  );

  if (isEmbedded) {
    return messageSummary;
  }

  return (
    <MessageLink className="action-link" message={message}>{messageSummary}</MessageLink>
  );
}

function renderGroupCallContent(groupCall: Partial<ApiGroupCall>, text: TextPart[]): string | TextPart | undefined {
  return (
    <GroupCallLink groupCall={groupCall}>
      {text}
    </GroupCallLink>
  );
}

function renderUserContent(sender: ApiUser, noLinks?: boolean): string | TextPart | undefined {
  const text = trimText(getUserFullName(sender), MAX_LENGTH);

  if (noLinks) {
    return renderText(text!);
  }

  return <UserLink className="action-link" sender={sender}>{sender && renderText(text!)}</UserLink>;
}

function renderChatContent(lang: LangFn, chat: ApiChat, noLinks?: boolean): string | TextPart | undefined {
  const text = trimText(getChatTitle(lang, chat), MAX_LENGTH);

  if (noLinks) {
    return renderText(text!);
  }

  return <ChatLink className="action-link" chatId={chat.id}>{chat && renderText(text!)}</ChatLink>;
}

function renderMigratedContent(chatId: string, noLinks?: boolean): string | TextPart | undefined {
  const text = 'another chat';

  if (noLinks) {
    return text;
  }

  return <ChatLink className="action-link underlined-link" chatId={chatId}>{text}</ChatLink>;
}

function processPlaceholder(
  text: string, placeholder: string, replaceValue?: TextPart | TextPart[], separator = ',',
): TextPart[] {
  const placeholderPosition = text.indexOf(placeholder);
  if (placeholderPosition < 0 || !replaceValue) {
    return [text];
  }

  const content: TextPart[] = [];
  content.push(text.substring(0, placeholderPosition));
  if (Array.isArray(replaceValue)) {
    replaceValue.forEach((value, index) => {
      content.push(value);
      if (index + 1 < replaceValue.length) {
        content.push(`${separator} `);
      }
    });
  } else {
    content.push(replaceValue);
  }
  content.push(text.substring(placeholderPosition + placeholder.length));

  return content.flat();
}
