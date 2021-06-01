import React from '../../../lib/teact/teact';

import { ApiChat, ApiMessage, ApiUser } from '../../../api/types';
import { LangFn } from '../../../hooks/useLang';
import {
  getChatTitle,
  getMessageContent,
  getMessageSummaryText,
  getUserFullName,
  isChat,
} from '../../../modules/helpers';
import trimText from '../../../util/trimText';
import { TextPart } from './renderMessageText';
import renderText from './renderText';

import UserLink from '../UserLink';
import MessageLink from '../MessageLink';
import ChatLink from '../ChatLink';

interface ActionMessageTextOptions {
  maxTextLength?: number;
  asPlain?: boolean;
  isEmbedded?: boolean;
}

const NBSP = '\u00A0';

export function renderActionMessageText(
  lang: LangFn,
  message: ApiMessage,
  actionOrigin?: ApiUser | ApiChat,
  targetUser?: ApiUser,
  targetMessage?: ApiMessage,
  targetChatId?: number,
  options: ActionMessageTextOptions = {},
) {
  if (!message.content.action) {
    return [];
  }
  const { text } = message.content.action;
  const content: TextPart[] = [];
  const textOptions: ActionMessageTextOptions = { ...options, maxTextLength: 16 };

  let unprocessed: string;
  let processed = processPlaceholder(
    text,
    '%action_origin%',
    actionOrigin
      ? (!options.isEmbedded && renderOriginContent(lang, actionOrigin, options.asPlain)) || NBSP
      : 'User',
  );

  unprocessed = processed.pop() as string;
  content.push(...processed);

  processed = processPlaceholder(
    unprocessed,
    '%target_user%',
    targetUser
      ? renderUserContent(targetUser, options.asPlain)
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

  return content;
}

function renderProductContent(message: ApiMessage) {
  return message.content && message.content.invoice
    ? message.content.invoice.title
    : 'a product';
}

function renderMessageContent(lang: LangFn, message: ApiMessage, options: ActionMessageTextOptions = {}) {
  const text = getMessageSummaryText(lang, message);
  const {
    photo, video, document, sticker,
  } = getMessageContent(message);

  const showQuotes = text && !photo && !video && !document && !sticker;
  let messageText = trimText(text as string, options.maxTextLength)!;

  if (photo) {
    messageText = 'a photo';
  } else if (video) {
    messageText = video.isGif ? 'a GIF' : 'a video';
  } else if (document) {
    messageText = 'a document';
  } else if (sticker) {
    messageText = `«${text}»`;
  }

  if (options.asPlain) {
    return showQuotes ? `«${messageText}»` : messageText;
  }

  if (showQuotes) {
    return (
      <span>
        &laquo;
        <MessageLink className="action-link" message={message}>{renderText(messageText)}</MessageLink>
        &raquo;
      </span>
    );
  }

  return (
    <MessageLink className="action-link" message={message}>{renderText(messageText)}</MessageLink>
  );
}

function renderOriginContent(lang: LangFn, origin: ApiUser | ApiChat, asPlain?: boolean) {
  return isChat(origin)
    ? renderChatContent(lang, origin, asPlain)
    : renderUserContent(origin, asPlain);
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

function renderMigratedContent(chatId: number, asPlain?: boolean): string | TextPart | undefined {
  const text = 'another chat';

  if (asPlain) {
    return text;
  }

  return <ChatLink className="action-link" chatId={chatId}>{text}</ChatLink>;
}

function processPlaceholder(text: string, placeholder: string, replaceValue?: TextPart): TextPart[] {
  const placeholderPosition = text.indexOf(placeholder);
  if (placeholderPosition < 0 || !replaceValue) {
    return [text];
  }

  const content: TextPart[] = [];
  content.push(text.substring(0, placeholderPosition));
  content.push(replaceValue);
  content.push(text.substring(placeholderPosition + placeholder.length));

  return content;
}
