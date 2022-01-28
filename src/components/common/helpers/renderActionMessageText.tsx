import React from '../../../lib/teact/teact';

import {
  ApiChat, ApiMessage, ApiUser, ApiGroupCall,
} from '../../../api/types';
import { LangFn } from '../../../hooks/useLang';
import {
  getChatTitle,
  getMessageContent, getMessageSummaryText,
  getUserFullName,
} from '../../../modules/helpers';
import trimText from '../../../util/trimText';
import { formatCurrency } from '../../../util/formatCurrency';
import { renderMessageSummary, TextPart } from './renderMessageText';
import renderText from './renderText';

import UserLink from '../UserLink';
import MessageLink from '../MessageLink';
import ChatLink from '../ChatLink';
import GroupCallLink from '../GroupCallLink';

interface ActionMessageTextOptions {
  maxTextLength?: number;
  asPlain?: boolean;
  isEmbedded?: boolean;
}

const NBSP = '\u00A0';

export function renderActionMessageText(
  lang: LangFn,
  message: ApiMessage,
  actionOriginUser?: ApiUser,
  actionOriginChat?: ApiChat,
  targetUsers?: ApiUser[],
  targetMessage?: ApiMessage,
  targetChatId?: string,
  options: ActionMessageTextOptions = {},
) {
  if (!message.content.action) {
    return [];
  }
  const {
    text, translationValues, amount, currency, call,
  } = message.content.action;
  const content: TextPart[] = [];
  const textOptions: ActionMessageTextOptions = { ...options, maxTextLength: 32 };
  const translationKey = text === 'Chat.Service.Group.UpdatedPinnedMessage1' && !targetMessage
    ? 'Message.PinnedGenericMessage'
    : text;

  let unprocessed = lang(translationKey, translationValues && translationValues.length ? translationValues : undefined);
  let processed: TextPart[];

  if (unprocessed.includes('%payment_amount%')) {
    processed = processPlaceholder(
      unprocessed,
      '%payment_amount%',
      formatCurrency(amount!, currency, lang.code),
    );
    unprocessed = processed.pop() as string;
    content.push(...processed);
  }

  processed = processPlaceholder(
    unprocessed,
    '%action_origin%',
    actionOriginUser ? (
      (!options.isEmbedded && renderUserContent(actionOriginUser, options.asPlain)) || NBSP

    ) : actionOriginChat ? (
      (!options.isEmbedded && renderChatContent(lang, actionOriginChat, options.asPlain)) || NBSP
    ) : 'User',
  );

  unprocessed = processed.pop() as string;
  content.push(...processed);

  processed = processPlaceholder(
    unprocessed,
    '%target_user%',
    targetUsers
      ? targetUsers.map((user) => renderUserContent(user, options.asPlain)).filter<TextPart>(Boolean as any)
      : 'User',
  );

  unprocessed = processed.pop() as string;
  content.push(...processed);

  processed = processPlaceholder(
    unprocessed,
    '%message%',
    targetMessage
      ? renderMessageContent(lang, targetMessage, textOptions)
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
      ? renderMigratedContent(targetChatId, options.asPlain)
      : 'another chat',
  );
  content.push(...processed);

  if (options.asPlain) {
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

function renderMessageContent(lang: LangFn, message: ApiMessage, options: ActionMessageTextOptions = {}) {
  const { maxTextLength, isEmbedded, asPlain } = options;

  const text = asPlain
    ? [trimText(getMessageSummaryText(lang, message), maxTextLength)]
    : renderMessageSummary(lang, message, undefined, undefined, maxTextLength, true);
  const {
    photo, video, document, sticker,
  } = getMessageContent(message);

  const showQuotes = isEmbedded && text && !photo && !video && !document && !sticker;
  let messageText = text;

  if (isEmbedded) {
    if (photo) {
      messageText = ['a photo'];
    } else if (video) {
      messageText = [video.isGif ? 'a GIF' : 'a video'];
    } else if (document) {
      messageText = ['a document'];
    } else if (sticker) {
      messageText = text;
    }
  }

  if (asPlain && messageText) {
    return (showQuotes ? ['«', ...messageText, '»'] : messageText).join('');
  }

  if (showQuotes) {
    return (
      <span>
        &laquo;
        <MessageLink className="action-link" message={message}>{messageText}</MessageLink>
        &raquo;
      </span>
    );
  }

  return (
    <MessageLink className="action-link" message={message}>{messageText}</MessageLink>
  );
}

function renderGroupCallContent(groupCall: Partial<ApiGroupCall>, text: TextPart[]): string | TextPart | undefined {
  return (
    <GroupCallLink groupCall={groupCall}>
      {text}
    </GroupCallLink>
  );
}

function renderUserContent(sender: ApiUser, asPlain?: boolean): string | TextPart | undefined {
  const text = trimText(getUserFullName(sender));

  if (asPlain) {
    return text;
  }

  return <UserLink className="action-link" sender={sender}>{sender && renderText(text!)}</UserLink>;
}

function renderChatContent(lang: LangFn, chat: ApiChat, asPlain?: boolean): string | TextPart | undefined {
  const text = trimText(getChatTitle(lang, chat));

  if (asPlain) {
    return text;
  }

  return <ChatLink className="action-link" chatId={chat.id}>{chat && renderText(text!)}</ChatLink>;
}

function renderMigratedContent(chatId: string, asPlain?: boolean): string | TextPart | undefined {
  const text = 'another chat';

  if (asPlain) {
    return text;
  }

  return <ChatLink className="action-link" chatId={chatId}>{text}</ChatLink>;
}

function processPlaceholder(text: string, placeholder: string, replaceValue?: TextPart | TextPart[]): TextPart[] {
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
        content.push(', ');
      }
    });
  } else {
    content.push(replaceValue);
  }
  content.push(text.substring(placeholderPosition + placeholder.length));

  return content;
}
