import type { ActionReturnType } from '../../types';

import { scrollGradientBackground } from '../../../util/gradientBackground';
import { addActionHandler } from '../../index';
import { selectCurrentMessageList, selectPerformanceSettingsValue } from '../../selectors';

addActionHandler('animateMessageSending', (global, actions, payload): ActionReturnType => {
  const { chatId, threadId, tabId } = payload;
  if (!selectPerformanceSettingsValue(global, 'messageSendingAnimations')) return;

  const currentMessageList = selectCurrentMessageList(global, tabId);
  if (currentMessageList?.chatId !== chatId || currentMessageList.threadId !== threadId) return;

  scrollGradientBackground();
});
