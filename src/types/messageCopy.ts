import type { MessageListType, ThreadId } from './index';

export type ClipboardTextContent = {
  plainText: string;
  html: string;
  markdown: string;
};

export type ClipboardTextFormat = keyof ClipboardTextContent;

type MessageCopyContext = {
  chatId: string;
  threadId: ThreadId;
  messageListType: MessageListType;
};

export type MessageCopyRequest = MessageCopyContext & ({
  type: 'selection';
  messageId: number;
  html: string;
} | {
  type: 'messages';
  messageIds: number[];
  withSenderHeaders?: boolean;
});
