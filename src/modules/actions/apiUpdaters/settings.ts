import { addReducer } from '../../../lib/teact/teactn';

import { ApiUpdate } from '../../../api/types';
import { GlobalState } from '../../../global/types';
import { updateNotifySettings } from '../../reducers';

addReducer('apiUpdate', (global, actions, update: ApiUpdate): GlobalState | undefined => {
  switch (update['@type']) {
    case 'updateNotifySettings': {
      return updateNotifySettings(global, update.peerType, update.isSilent, update.isShowPreviews);
    }
  }

  return undefined;
});
