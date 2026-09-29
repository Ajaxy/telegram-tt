import type { JSONContent as TiptapJsonContent } from '@tiptap/core';
import { getGlobal, getPromiseActions } from '../../../../global';

import type { ApiMessage } from '../../../../api/types';
import type { GlobalState } from '../../../../global/types';
import type { MessageList } from '../../../../types';
import type { ClipboardTextContent, MessageCopyRequest } from '../../../../types/messageCopy';

import { isChatChannel } from '../../../../global/helpers';
import { getPeerTitle } from '../../../../global/helpers/peers';
import { renderMessageSummaryHtml } from '../../../../global/helpers/renderMessageSummaryHtml';
import {
  selectAllowedMessageActionsSlow,
  selectChat,
  selectChatMessageOrEphemeral,
  selectChatScheduledMessages,
  selectMessageCopyContent,
  selectSender,
} from '../../../../global/selectors';
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
    ? messages.filter((message) => selectMessageCopyContent(global, message, tabId).richMessage?.isPart)
      .map(({ id }) => id)
    : [];
  if (partialMessageIds.length) {
    const isScheduled = messageList.type === 'scheduled' || undefined;
    await Promise.all(partialMessageIds.map((messageId) => (
      getPromiseActions().loadRichMessage({ chatId: messageList.chatId, messageId, isScheduled })
    )));

    global = getGlobal();
    messages = getMessagesForCopy(global, messageList, messageIds);
    if (partialMessageIds.some((messageId) => {
      const message = messages.find(({ id }) => id === messageId);
      const richMessage = message && selectMessageCopyContent(global, message, tabId).richMessage;
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
    const { text: translatedText, richMessage } = selectMessageCopyContent(global, message, tabId);
    const sender = isChatChannel(chat) ? chat : selectSender(global, message);
    const senderTitle = sender ? getPeerTitle(lang, sender) : message.forwardInfo?.hiddenUserName;
    if (request.withSenderHeaders && senderTitle) {
      content.push({
        type: 'paragraph',
        content: [{ type: 'text', text: `${senderTitle}:`, marks: [{ type: 'bold' }] }],
      });
    }

    if (richMessage) {
      content.push(...(buildTiptapJsonFromRichMessage(richMessage, { isForCopy: true }).content || []));
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
  const scheduledMessages = type === 'scheduled' ? selectChatScheduledMessages(global, chatId) : undefined;

  return messageIds
    .map((id) => type === 'scheduled' ? scheduledMessages?.[id] : selectChatMessageOrEphemeral(global, chatId, id))
    .filter((message): message is ApiMessage => message !== undefined
      && Boolean(selectAllowedMessageActionsSlow(global, message, threadId).canCopy))
    .sort((left, right) => left.id - right.id);
}
