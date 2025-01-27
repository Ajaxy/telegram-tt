import type { ActionReturnType } from '../../types';

import { addActionHandler } from '../../index';

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
          errorKey: update.messageKey,
        },
      };
    }
  }

  return undefined;
});
