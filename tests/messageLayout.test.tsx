import { getDispatch } from '../src/lib/teact/teactn';

import { AFTER_ALL_DELAY, BEFORE_ALL_TIMEOUT, REQUEST_DELAY } from './config';
import initApp from './initApp';
import { getMessageElement } from './helpers';
import {
  expectAvatar,
  expectNoAvatar,
  expectAdminTitle,
  expectNoAdminTitle,
  expectFocusButton,
  expectNoFocusButton,
  expectIncoming,
  expectOutgoing,
  expectInteractiveSender,
  expectNoSender,
  expectHiddenSender,
  expectThreadTop,
  expectReply,
  expectNoReply,
  expectSingleGroup,
  expectInGroup,
  expectAsForwarded,
  expectNotAsForwarded,
  expectViaBot,
  expectForwardButton,
  expectCommentButton,
  expectNoCommentButton,
  expectNoSignature,
  expectSignature,
} from './assertions';
import { pause } from '../src/util/schedulers';
import { LoadMoreDirection } from '../src/types';

describe('Message layout', () => {
  beforeAll(async () => {
    await initApp();
  }, BEFORE_ALL_TIMEOUT);

  describe('Saved Messages', () => {
    beforeAll(async () => {
      getDispatch().openChat({ id: 628495532 });
      await pause(REQUEST_DELAY);
    }, BEFORE_ALL_TIMEOUT);

    afterAll(async () => {
      await pause(AFTER_ALL_DELAY);
    });

    test('Incoming forwarded simple (`isFirstInGroup`, not `isLastInGroup`)', () => {
      const messageElement = getMessageElement(2955);
      expectIncoming(messageElement);
      expectInteractiveSender(messageElement, 314552265);
      expectNoAvatar(messageElement);
      expectFocusButton(messageElement, -178999811, 2950);
    });

    test('Incoming forwarded simple (`isLastInGroup`, not `isFirstInGroup`)', () => {
      const messageElement = getMessageElement(2956);
      expectIncoming(messageElement);
      expectNoSender(messageElement);
      expectAvatar(messageElement, 314552265);
      expectFocusButton(messageElement, -178999811, 2951);
    });

    test('Outgoing simple (`isFirstInGroup`, `isLastInGroup`)', () => {
      const messageElement = getMessageElement(2957);
      expectOutgoing(messageElement);
      expectNoSender(messageElement);
    });

    test('Incoming forwarded direct from hidden ', () => {
      const messageElement = getMessageElement(2959);
      expectIncoming(messageElement);
      expectNotAsForwarded(messageElement);
      expectHiddenSender(messageElement, 'Mike Ravdonikas');
      expectAvatar(messageElement, undefined, 'MR');
      expectNoFocusButton(messageElement);
    });

    test('Incoming forwarded from group from hidden ', () => {
      const messageElement = getMessageElement(2958);
      expectIncoming(messageElement);
      expectNotAsForwarded(messageElement);
      expectHiddenSender(messageElement, 'Антон');
      expectAvatar(messageElement, undefined, 'А');
      expectFocusButton(messageElement, -178999811, 2935);
    });

    test('Incoming forwarded via bot', () => {
      const messageElement = getMessageElement(2960);
      expectIncoming(messageElement);
      expectNotAsForwarded(messageElement);
      expectInteractiveSender(messageElement, 408193052);
      expectViaBot(messageElement, 140267078);
      expectAvatar(messageElement, 408193052);
      expectFocusButton(messageElement, -178999811, 2934);
    });

    test('Outgoing forwarded via bot', () => {
      const messageElement = getMessageElement(2964);
      expectOutgoing(messageElement);
      expectNotAsForwarded(messageElement);
      expect(messageElement.querySelector('.content-inner .message-title')!.childElementCount).toEqual(2);
      expectViaBot(messageElement, 140267078);
    });

    test('Incoming forwarded channel post', () => {
      const messageElement = getMessageElement(2965);
      expectIncoming(messageElement);
      expectNotAsForwarded(messageElement);
      expectInteractiveSender(messageElement, -1038976893);
      expectAvatar(messageElement, -1038976893);
      expectFocusButton(messageElement, -1038976893, 192);
    });
  });

  describe('Group', () => {
    beforeAll(async () => {
      getDispatch().openChat({ id: -178999811 });
      await pause(REQUEST_DELAY);

      getDispatch().loadViewportMessages({ direction: LoadMoreDirection.Backwards });
      await pause(REQUEST_DELAY);
    }, BEFORE_ALL_TIMEOUT * 2);

    afterAll(async () => {
      await pause(AFTER_ALL_DELAY);
    });

    test('Incoming simple (`isFirstInGroup`, not `isLastInGroup`)', () => {
      const messageElement = getMessageElement(2945);
      expectIncoming(messageElement);
      expectInteractiveSender(messageElement, 3718260);
      expectNoAvatar(messageElement);
    });

    test('Incoming simple (`isLastInGroup`, not `isFirstInGroup`)', () => {
      const messageElement = getMessageElement(2946);
      expectIncoming(messageElement);
      expectNoSender(messageElement);
      expectAvatar(messageElement, 3718260);
    });

    test('Outgoing simple (`isFirstInGroup`, `isLastInGroup`)', () => {
      const messageElement = getMessageElement(2943);
      expectOutgoing(messageElement);
      expectNoSender(messageElement);
    });

    test('Incoming forwarded (not `isLastInGroup`)', () => {
      const messageElement = getMessageElement(2950);
      expectIncoming(messageElement);
      expectAsForwarded(messageElement);
      expectInteractiveSender(messageElement, 314552265);
      expectNoAvatar(messageElement);
    });

    test('Incoming forwarded (`isLastInGroup`)', () => {
      const messageElement = getMessageElement(2951);
      expectIncoming(messageElement);
      expectAsForwarded(messageElement);
      expectInteractiveSender(messageElement, 314552265);
      expectAvatar(messageElement, 3718260);
    });

    test('Outgoing forwarded', () => {
      const messageElement = getMessageElement(2954);
      expectOutgoing(messageElement);
      expectAsForwarded(messageElement);
      expectInteractiveSender(messageElement, 3718260);
    });

    test('Incoming forwarded from hidden', () => {
      const messageElement = getMessageElement(2935);
      expectIncoming(messageElement);
      expectAsForwarded(messageElement);
      expectHiddenSender(messageElement, 'Антон');
      expectAvatar(messageElement, 3718260);
    });

    test('Outgoing forwarded from hidden', () => {
      const messageElement = getMessageElement(2936);
      expectOutgoing(messageElement);
      expectAsForwarded(messageElement);
      expectHiddenSender(messageElement, 'Антон');
    });

    test('Incoming forwarded via bot', () => {
      const messageElement = getMessageElement(2934);
      expectIncoming(messageElement);
      expectAsForwarded(messageElement);
      expectInteractiveSender(messageElement, 408193052);
      expectViaBot(messageElement, 140267078);
      expectAvatar(messageElement, 3718260);
    });

    test('Outgoing forwarded via bot', () => {
      const messageElement = getMessageElement(2732);
      expectOutgoing(messageElement);
      expectAsForwarded(messageElement);
      expectInteractiveSender(messageElement, 408193052);
      expectViaBot(messageElement, 140267078);
    });

    test('Incoming forwarded channel post', () => {
      const messageElement = getMessageElement(2952);
      expectIncoming(messageElement);
      expectAsForwarded(messageElement);
      expectInteractiveSender(messageElement, -1038976893);
      expectAvatar(messageElement, 3718260);
      expectFocusButton(messageElement, -1038976893, 192);
    });

    test('Outgoing forwarded channel post', () => {
      const messageElement = getMessageElement(2953);
      expectOutgoing(messageElement);
      expectAsForwarded(messageElement);
      expectInteractiveSender(messageElement, -1038976893);
      expectFocusButton(messageElement, -1038976893, 192);
    });
  });

  describe('Channel', () => {
    beforeAll(async () => {
      getDispatch().openChat({ id: -1386471086 });
      await pause(REQUEST_DELAY);
    }, BEFORE_ALL_TIMEOUT);

    afterAll(async () => {
      await pause(AFTER_ALL_DELAY);
    });

    test('Single post with comments', () => {
      const messageElement = getMessageElement(2);
      expectIncoming(messageElement);
      expectNoSender(messageElement);
      expectNoAvatar(messageElement);
      expectForwardButton(messageElement);
      expectNoAdminTitle(messageElement);
      expectSingleGroup(messageElement);
      expectCommentButton(messageElement, 4, 2, 2, -1403448678);
      expectNoSignature(messageElement);
    });

    test('Post in group (first)', () => {
      const messageElement = getMessageElement(3);
      expectIncoming(messageElement);
      expectNoSender(messageElement);
      expectNoAvatar(messageElement);
      expectForwardButton(messageElement);
      expectNoAdminTitle(messageElement);
      expectInGroup(messageElement);
      expectCommentButton(messageElement, 0, 0, 3, -1403448678);
    });

    test('Post in group (last)', () => {
      const messageElement = getMessageElement(4);
      expectIncoming(messageElement);
      expectNoSender(messageElement);
      expectNoAvatar(messageElement);
      expectForwardButton(messageElement);
      expectNoAdminTitle(messageElement);
      expectInGroup(messageElement);
      expectCommentButton(messageElement, 0, 0, 4, -1403448678);
    });

    test('Signed post', () => {
      const messageElement = getMessageElement(10);
      expectSignature(messageElement, 'Sasha Alejandro');
      expectNoSender(messageElement);
      expectNoAdminTitle(messageElement);
    });

    test('Post which was removed from discussion', () => {
      const messageElement = getMessageElement(15);
      expectNoCommentButton(messageElement);
    });
  });

  describe('Discussion', () => {
    beforeAll(async () => {
      getDispatch().openChat({ id: -1403448678 });
      await pause(REQUEST_DELAY);
    }, BEFORE_ALL_TIMEOUT);

    afterAll(async () => {
      await pause(AFTER_ALL_DELAY);
    });

    test('Linked channel post', () => {
      const messageElement = getMessageElement(14);
      expectIncoming(messageElement);
      expectNotAsForwarded(messageElement);
      expectInteractiveSender(messageElement, -1386471086);
      expectNoAvatar(messageElement);
      expectFocusButton(messageElement, -1386471086, 3);
      expectAdminTitle(messageElement, 'channel');
      expectInGroup(messageElement);
    });

    test('Linked channel post (following previous)', () => {
      const messageElement = getMessageElement(15);
      expectIncoming(messageElement);
      expectNotAsForwarded(messageElement);
      expectNoSender(messageElement);
      expectAvatar(messageElement, -1386471086);
      expectFocusButton(messageElement, -1386471086, 4);
      expectNoAdminTitle(messageElement);
      expectInGroup(messageElement);
    });

    test('Incoming forwarded not linked channel post', () => {
      const messageElement = getMessageElement(6);
      expectIncoming(messageElement);
      expectAsForwarded(messageElement);
      expectInteractiveSender(messageElement, -1038976893);
      expectAvatar(messageElement, 3718260);
      expectFocusButton(messageElement, -1038976893, 192);
      expectNoAdminTitle(messageElement);
    });

    test('Incoming simple (`isFirstInGroup`, `isLastInGroup`)', () => {
      const messageElement = getMessageElement(4);
      expectIncoming(messageElement);
      expectInteractiveSender(messageElement, 3718260);
      expectAvatar(messageElement, 3718260);
    });

    test('Outgoing as anonymous (`isFirstInGroup`)', () => {
      const messageElement = getMessageElement(11);
      expectOutgoing(messageElement);
      expectInteractiveSender(messageElement, -1403448678);
    });

    test('Incoming reply to linked post', () => {
      const messageElement = getMessageElement(7);
      expectIncoming(messageElement);
      expectInteractiveSender(messageElement, 3718260);
      expectAvatar(messageElement, 3718260);
      expectReply(messageElement, -1386471086);
    });

    test('Outgoing reply to anonymous post', () => {
      const messageElement = getMessageElement(13);
      expectOutgoing(messageElement);
      expectInteractiveSender(messageElement, -1403448678);
      expectReply(messageElement, -1403448678);
    });

    test('Outgoing reply to linked post (with admin title)', () => {
      const messageElement = getMessageElement(42);
      expectOutgoing(messageElement);
      expectInteractiveSender(messageElement, -1403448678);
      expectReply(messageElement, -1386471086);
      expectAdminTitle(messageElement, 'Super Name');
      expectNoSignature(messageElement);
    });

    test('Incoming linked channel post (signed)', () => {
      const messageElement = getMessageElement(111);
      expectIncoming(messageElement);
      expectNotAsForwarded(messageElement);
      expectInteractiveSender(messageElement, -1386471086);
      expectFocusButton(messageElement, -1386471086, 10);
      expectAdminTitle(messageElement, 'channel');
      expectSignature(messageElement, 'Sasha Alejandro');
    });
  });

  describe('Comment Thread', () => {
    beforeAll(async () => {
      getDispatch().openChat({ id: -1386471086 });
      await pause(REQUEST_DELAY);

      getDispatch().openChat({ id: -1403448678, threadId: 2 });
      await pause(REQUEST_DELAY);
    }, BEFORE_ALL_TIMEOUT * 2);

    afterAll(async () => {
      await pause(AFTER_ALL_DELAY);
    });

    test('Original channel post', () => {
      const messageElement = getMessageElement(2);
      expectIncoming(messageElement);
      expectNotAsForwarded(messageElement);
      expectInteractiveSender(messageElement, -1386471086);
      expectNoAvatar(messageElement);
      expectFocusButton(messageElement, -1386471086, 2);
      expectAdminTitle(messageElement, 'channel');
      expectSingleGroup(messageElement);
      expectThreadTop(messageElement);
    });

    test('Incoming reply to original post', () => {
      const messageElement = getMessageElement(7);
      expectIncoming(messageElement);
      expectInteractiveSender(messageElement, 3718260);
      expectAvatar(messageElement, 3718260);
      expectNoReply(messageElement);
    });

    test('Outgoing reply', () => {
      const messageElement = getMessageElement(39);
      expectOutgoing(messageElement);
      expectInteractiveSender(messageElement, -1403448678);
      expectNoReply(messageElement);
    });

    test('Incoming reply to another comment', () => {
      const messageElement = getMessageElement(41);
      expectIncoming(messageElement);
      expectInteractiveSender(messageElement, 3718260);
      expectAvatar(messageElement, 3718260);
      expectReply(messageElement, -1403448678);
    });

    test('Outgoing reply (with admin title)', () => {
      const messageElement = getMessageElement(42);
      expectOutgoing(messageElement);
      expectInteractiveSender(messageElement, -1403448678);
      expectNoReply(messageElement);
      expectAdminTitle(messageElement, 'Super Name');
      expectNoSignature(messageElement);
    });
  });
});
