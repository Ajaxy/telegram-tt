import { ActionTypes } from '../src/global/types';
import { addReducer, getGlobal } from '../src/lib/teact/teactn';

import { selectChat, selectUser } from '../src/modules/selectors';
import { getChatTitle, getUserFullName } from '../src/modules/helpers';

export function expectIncoming(messageElement: HTMLDivElement) {
  expect(messageElement).not.toHaveClass('own');
}

export function expectOutgoing(messageElement: HTMLDivElement) {
  expect(messageElement).toHaveClass('own');
  expectNoAvatar(messageElement);
}

export function expectAsForwarded(messageElement: HTMLDivElement) {
  expect(messageElement.querySelector('.message-content')).toHaveClass('is-forwarded');
  expect(messageElement.querySelector('.message-title')).toHaveTextContent('Forwarded message');
}

export function expectNotAsForwarded(messageElement: HTMLDivElement) {
  expect(messageElement.querySelector('.message-content')).not.toHaveClass('is-forwarded');

  const messageTitle = messageElement.querySelector('.message-title');
  if (messageTitle) {
    expect(messageTitle).not.toHaveTextContent('Forwarded message');
  }
}

export function expectInteractiveSender(messageElement: HTMLDivElement, senderId: number) {
  const senderName = messageElement.querySelector('.content-inner .message-title')!;
  expect(senderName.firstChild).toHaveClass('interactive');

  if (senderId > 0) {
    const user = selectUser(getGlobal(), senderId)!;
    expect(senderName.firstChild).toHaveTextContent(getUserFullName(user)!);
    expectClickToCallAction(senderName.firstChild as Element, 'openUserInfo', { id: senderId });
  } else {
    const chat = selectChat(getGlobal(), senderId)!;
    expect(senderName.firstChild).toHaveTextContent(getChatTitle(chat)!);
    expectClickToCallAction(senderName.firstChild as Element, 'openChat', { id: senderId });
  }
}

export function expectHiddenSender(messageElement: HTMLDivElement, hiddenSenderName: string) {
  const senderName = messageElement.querySelector('.content-inner .message-title')!;
  expect(senderName.firstChild).not.toHaveClass('interactive');
  expect(senderName.firstChild).toHaveTextContent(hiddenSenderName);
  expectClickNotToCallAction(senderName.firstChild as Element, 'openUserInfo');
  expectClickNotToCallAction(senderName.firstChild as Element, 'openChat');
}

export function expectNoSender(messageElement: HTMLDivElement) {
  expect(messageElement.querySelector('.message-title')).toBeNull();
}

export function expectViaBot(messageElement: HTMLDivElement, botId: number) {
  const botName = messageElement.querySelector('.content-inner .message-title')!;
  const { children, children: { length } } = botName;
  expect(children[length - 2]).toHaveClass('via');
  expect(children[length - 1]).toHaveClass('interactive');
  const bot = selectUser(getGlobal(), botId)!;
  expect(children[length - 1]).toHaveTextContent(`@${bot.username}`);
  expectClickToCallAction(children[length - 1], 'openUserInfo', { id: botId });
}

export function expectAvatar(messageElement: HTMLDivElement, senderId?: number, hiddenNameInitial?: string) {
  const avatar = messageElement.querySelector(':scope > .Avatar')!;

  if (senderId) {
    expect(avatar).toHaveAttribute('data-test-sender-id', String(senderId));
    expectClickToCallAction(avatar, senderId > 0 ? 'openUserInfo' : 'openChat', { id: senderId });
  } else {
    expect(avatar).not.toHaveAttribute('data-test-sender-id');
    expect(avatar).toHaveTextContent(hiddenNameInitial!);
    expectClickNotToCallAction(avatar, 'openUserInfo');
    expectClickNotToCallAction(avatar, 'openChat');
  }
}

export function expectNoAvatar(messageElement: HTMLDivElement) {
  expect(messageElement.querySelector(':scope > .Avatar')).toBeNull();
}

export function expectFocusButton(messageElement: HTMLDivElement, chatId: number, messageId: number) {
  const button = messageElement.querySelector('.message-action-button')!;
  expect(button).not.toBeNull();
  expect(button.querySelector('i')).toHaveClass('icon-arrow-right');
  expectClickToCallAction(button, 'focusMessage', { chatId, messageId });
}

export function expectForwardButton(messageElement: HTMLDivElement) {
  const button = messageElement.querySelector('.message-action-button .icon-share-filled')!;
  expect(button).not.toBeNull();
}

export function expectNoFocusButton(messageElement: HTMLDivElement) {
  const button = messageElement.querySelector('.message-action-button')!;
  expect(button).toBeNull();
}

export function expectAdminTitle(messageElement: HTMLDivElement, value: string) {
  expect(messageElement.querySelector('.admin-title')).toHaveTextContent(value);
}

export function expectNoAdminTitle(messageElement: HTMLDivElement) {
  expect(messageElement.querySelector('.admin-title')).toBeNull();
}

export function expectSignature(messageElement: HTMLDivElement, value: string) {
  expect(messageElement.querySelector('.message-signature')).toHaveTextContent(value);
}

export function expectNoSignature(messageElement: HTMLDivElement) {
  expect(messageElement.querySelector('.message-signature')).toBeNull();
}

export function expectSingleGroup(messageElement: HTMLDivElement) {
  expect(messageElement).toHaveClass('first-in-group', 'last-in-group');
}

export function expectInGroup(messageElement: HTMLDivElement) {
  expect(messageElement).not.toHaveClass('first-in-group', 'last-in-group');
}

export function expectCommentButton(
  messageElement: HTMLDivElement,
  commentsCount: number,
  authorsCount: number,
  messageId: number,
  discussionChatId: number,
) {
  const button = messageElement.querySelector<HTMLDivElement>('.CommentButton')!;
  expect(button).not.toBeNull();

  if (commentsCount) {
    expect(button.querySelector('.label')).toHaveTextContent(`${commentsCount} Comments`);
    expect(button.querySelectorAll('.Avatar')).toHaveLength(Math.min(authorsCount, 3));
  } else {
    expect(button.querySelector('.label')).toHaveTextContent('Leave a comment');
    expect(button.querySelectorAll('.Avatar')).toHaveLength(0);
  }

  expectClickToCallAction(button, 'openChat', { id: discussionChatId, threadId: messageId });
}

export function expectNoCommentButton(messageElement: HTMLDivElement) {
  const button = messageElement.querySelector<HTMLDivElement>('.CommentButton')!;
  expect(button).toBeNull();
}

export function expectReply(messageElement: HTMLDivElement, originSenderId: number) {
  const senderName = messageElement.querySelector('.EmbeddedMessage .message-title')!;
  expect(senderName).not.toHaveClass('interactive');

  if (originSenderId > 0) {
    const user = selectUser(getGlobal(), originSenderId)!;
    expect(senderName).toHaveTextContent(getUserFullName(user)!);
  } else {
    const chat = selectChat(getGlobal(), originSenderId)!;
    expect(senderName).toHaveTextContent(getChatTitle(chat)!);
  }
}

export function expectNoReply(messageElement: HTMLDivElement) {
  expect(messageElement.querySelector('.EmbeddedMessage')).toBeNull();
}

export function expectThreadTop(messageElement: HTMLDivElement) {
  expect(messageElement).toHaveClass('is-thread-top');
  expect(messageElement.nextElementSibling).toHaveTextContent('Discussion started');
}

export function expectClickToCallAction(element: Element, action: ActionTypes, args: any) {
  const reducer = jest.fn();
  addReducer(action, reducer);
  element.dispatchEvent(new Event('click', { bubbles: true }));
  expect(reducer).toBeCalledWith(expect.anything(), expect.anything(), args);
}

export function expectClickNotToCallAction(element: Element, action: ActionTypes) {
  const reducer = jest.fn();
  addReducer(action, reducer);
  element.dispatchEvent(new Event('click', { bubbles: true }));
  expect(reducer).not.toBeCalled();
}
