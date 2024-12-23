import type { ActionReturnType } from '../../types';

import { addActionHandler } from '../../index';

addActionHandler('apiUpdate', (global, actions, update): ActionReturnType => {
  switch (update['@type']) {
    case 'updatePasswordError': {
      return {
        ...global,
        monetizationInfo: {
          ...global.monetizationInfo,
          isLoading: false,
          error: update.error,
        },
      };
    }
  }

  return undefined;
});
