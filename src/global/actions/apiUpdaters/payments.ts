import { addActionHandler } from '../../index';

import { clearPayment } from '../../reducers';

addActionHandler('apiUpdate', (global, actions, update) => {
  switch (update['@type']) {
    case 'updatePaymentStateCompleted': {
      return clearPayment(global);
    }
  }

  return undefined;
});
