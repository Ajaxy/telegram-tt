import { addActionHandler } from '../../index';

import { ApiUpdate } from '../../../api/types';
import { GlobalState } from '../../types';

addActionHandler('apiUpdate', (global, actions, update: ApiUpdate): GlobalState | undefined => {
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
