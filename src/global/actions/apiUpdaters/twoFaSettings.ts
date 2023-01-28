import { addActionHandler } from '../../index';
import type { ActionReturnType } from '../../types';

addActionHandler('apiUpdate', (global, actions, update): ActionReturnType => {
  switch (update['@type']) {
    case 'updateTwoFaStateWaitCode': {
      return {
        ...global,
        twoFaSettings: {
          ...global.twoFaSettings,
          isLoading: false,
          waitingEmailCodeLength: update.length,
        },
      };
    }

    case 'updateTwoFaError': {
      return {
        ...global,
        twoFaSettings: {
          ...global.twoFaSettings,
          error: update.message,
        },
      };
    }
  }

  return undefined;
});
