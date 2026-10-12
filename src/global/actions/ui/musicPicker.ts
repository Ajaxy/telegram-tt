import type { ActionReturnType } from '../../types';
import { MAIN_THREAD_ID } from '../../../api/types';

import { getCurrentTabId } from '../../../util/establishMultitabRole';
import { addTabStateResetterAction } from '../../helpers/meta';
import { addActionHandler } from '../../index';
import { updateTabState } from '../../reducers/tabs';
import { selectDraft } from '../../selectors/threads';

addActionHandler('openMusicPicker', (global, actions, payload): ActionReturnType => {
  const {
    chatId, threadId = MAIN_THREAD_ID, messageListType, shouldInsertToRichInput, tabId = getCurrentTabId(),
  } = payload;
  const replyInfo = selectDraft(global, chatId, threadId)?.replyInfo;
  if (replyInfo?.type === 'ephemeral') return undefined;

  return updateTabState(global, {
    musicPicker: {
      chatId,
      threadId,
      messageListType,
      shouldInsertToRichInput,
    },
  }, tabId);
});

addTabStateResetterAction('closeMusicPicker', 'musicPicker');
