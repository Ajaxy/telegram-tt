import { addReducer } from '../..';

import { ApiUpdate } from '../../../api/types';

import { clearPayment } from '../../reducers';

addReducer('apiUpdate', (global, actions, update: ApiUpdate) => {
  switch (update['@type']) {
    case 'updatePaymentStateCompleted': {
      return clearPayment(global);
    }
  }

  return undefined;
});
