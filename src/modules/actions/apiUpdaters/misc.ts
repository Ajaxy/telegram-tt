import {
  addReducer, getGlobal, setGlobal,
} from '../../../lib/teact/teactn';

import { ApiUpdate } from '../../../api/types';
import { ApiPrivacyKey } from '../../../types';

import { addBlockedContact, removeBlockedContact } from '../../reducers';

addReducer('apiUpdate', (global, actions, update: ApiUpdate) => {
  switch (update['@type']) {
    case 'updatePeerBlocked':
      if (update.isBlocked) {
        return addBlockedContact(getGlobal(), update.id);
      } else {
        return removeBlockedContact(getGlobal(), update.id);
      }

    case 'updateResetContactList':
      setGlobal({
        ...getGlobal(),
        contactList: {
          hash: 0,
          userIds: [],
        },
      });
      break;

    case 'updateFavoriteStickers':
      actions.loadFavoriteStickers();
      break;

    case 'updatePrivacy':
      global.settings.privacy[update.key as ApiPrivacyKey] = update.rules;
      break;
  }

  return undefined;
});
