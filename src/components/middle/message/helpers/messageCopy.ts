import type { JSONContent as TiptapJsonContent } from '@tiptap/core';
import { getGlobal, getPromiseActions } from '../../../../global';

import type {
  ApiFormattedText,
  ApiMessage,
} from '../../../../api/types';
import type { GlobalState } from '../../../../global/types';
import type { MessageList } from '../../../../types';
import type { ClipboardTextContent, MessageCopyRequest } from '../../../../types/messageCopy';

import { isChatChannel } from '../../../../global/helpers';
import { getPeerTitle } from '../../../../global/helpers/peers';
import { renderMessageSummaryHtml } from '../../../../global/helpers/renderMessageSummaryHtml';
import {
  selectAllowedMessageActionsSlow,
  selectChat,
  selectChatMessages,
  selectChatScheduledMessages,
  selectEphemeralMessage,
  selectMessageTranslations,
  selectRequestedChatTranslationLanguage,
  selectRequestedChatTranslationTone,
  selectRequestedMessageTranslationLanguage,
  selectSender,
} from '../../../../global/selectors';
import { getTranslationCacheKey } from '../../../../util/keys/translationKey';
import { getTranslationFn } from '../../../../util/localization';
import {
  parseMessageCopyHtml,
  serializeMessageCopyTiptapJson,
} from '../../../../util/tiptap/messageCopy';
import {
  buildRichMessageFromFormatted,
  buildTiptapJsonFromRichMessage,
} from '../../../ui/textInput/richText';

const EMPTY_PARAGRAPH: TiptapJsonContent = { type: 'paragraph' };

export async function buildMessageCopyContent(
  messageList: MessageList,
  request: MessageCopyRequest,
  tabId: number,
): Promise<ClipboardTextContent> {
  const messageIds = request.type === 'selection' ? [request.messageId] : request.messageIds;
  let global = getGlobal();
  let messages = getMessagesForCopy(global, messageList, messageIds);
  if (!messages.length) throw new Error('NO_MESSAGES_TO_COPY');

  const partialMessageIds = request.type === 'messages'
    ? messages.filter(({ content }) => content.richMessage?.isPart).map(({ id }) => id)
    : [];
  if (partialMessageIds.length) {
    const isScheduled = messageList.type === 'scheduled' || undefined;
    await Promise.all(partialMessageIds.map((messageId) => (
      getPromiseActions().loadRichMessage({ chatId: messageList.chatId, messageId, isScheduled })
    )));

    global = getGlobal();
    messages = getMessagesForCopy(global, messageList, messageIds);
    if (partialMessageIds.some((messageId) => {
      const richMessage = messages.find(({ id }) => id === messageId)?.content.richMessage;
      return !richMessage || richMessage.isPart;
    })) {
      throw new Error('RICH_MESSAGE_LOAD_FAILED');
    }
  }

  const doc = request.type === 'selection'
    ? parseMessageCopyHtml(request.html)
    : buildMessagesDoc(global, messageList.chatId, messages, request, tabId);
  const result = serializeMessageCopyTiptapJson(doc);
  if (!result.plainText.trim()) throw new Error('EMPTY_MESSAGE_COPY_CONTENT');

  return result;
}

function buildMessagesDoc(
  global: GlobalState,
  chatId: string,
  messages: ApiMessage[],
  request: Extract<MessageCopyRequest, { type: 'messages' }>,
  tabId: number,
): TiptapJsonContent {
  const chat = selectChat(global, chatId);
  if (!chat) throw new Error('COPY_CHAT_NOT_FOUND');

  const lang = getTranslationFn();
  const content: TiptapJsonContent[] = [];
  messages.forEach((message, index) => {
    const translatedText = selectMessageCopyText(global, message, tabId);
    const sender = isChatChannel(chat) ? chat : selectSender(global, message);
    const senderTitle = sender ? getPeerTitle(lang, sender) : message.forwardInfo?.hiddenUserName;
    if (request.withSenderHeaders && senderTitle) {
      content.push({
        type: 'paragraph',
        content: [{ type: 'text', text: `${senderTitle}:`, marks: [{ type: 'bold' }] }],
      });
    }

    if (message.content.richMessage) {
      content.push(...(buildTiptapJsonFromRichMessage(message.content.richMessage, { isForCopy: true }).content || []));
    } else if (!request.withSenderHeaders) {
      content.push(...(buildTiptapJsonFromRichMessage(
        buildRichMessageFromFormatted(translatedText || message.content.text),
      ).content || []));
    } else {
      const copyMessage = translatedText === message.content.text ? message : {
        ...message,
        content: { ...message.content, text: translatedText },
      };
      content.push(...(parseMessageCopyHtml(renderMessageSummaryHtml(lang, copyMessage, true)).content || []));
    }

    if (index < messages.length - 1) content.push(EMPTY_PARAGRAPH);
  });

  return { type: 'doc', content: content.length ? content : [EMPTY_PARAGRAPH] };
}

function getMessagesForCopy(global: GlobalState, messageList: MessageList, messageIds: number[]) {
  const { chatId, threadId, type } = messageList;
  const messages = type === 'scheduled'
    ? selectChatScheduledMessages(global, chatId)
    : selectChatMessages(global, chatId);
  if (!messages) return [];

  return messageIds
    .map((id) => messages[id] || selectEphemeralMessage(global, chatId, id))
    .filter((message): message is ApiMessage => message !== undefined
      && Boolean(selectAllowedMessageActionsSlow(global, message, threadId).canCopy))
    .sort((left, right) => left.id - right.id);
}

function selectMessageCopyText(global: GlobalState, message: ApiMessage, tabId: number): ApiFormattedText | undefined {
  const chatLanguage = selectRequestedChatTranslationLanguage(global, message.chatId, tabId);
  const messageLanguage = selectRequestedMessageTranslationLanguage(global, message.chatId, message.id, tabId);
  const cacheKey = chatLanguage
    ? getTranslationCacheKey(chatLanguage, selectRequestedChatTranslationTone(global, message.chatId, tabId))
    : messageLanguage;

  return cacheKey
    ? selectMessageTranslations(global, message.chatId, cacheKey)[message.id]?.text || message.content.text
    : message.content.text;
}
