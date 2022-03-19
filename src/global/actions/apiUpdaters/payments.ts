import { addActionHandler } from '../../index';

import { ApiUpdate } from '../../../api/types';

import { clearPayment } from '../../reducers';

addActionHandler('apiUpdate', (global, actions, update: ApiUpdate) => {
  switch (update['@type']) {
    case 'updatePaymentStateCompleted': {
      return clearPayment(global);
    }
  }

  return undefined;
});
