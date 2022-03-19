import { addActionHandler } from '../..';

import { ApiUpdate } from '../../../api/types';

import { updateStickerSet } from '../../reducers';

addActionHandler('apiUpdate', (global, actions, update: ApiUpdate) => {
  switch (update['@type']) {
    case 'updateStickerSet': {
      return updateStickerSet(global, update.id, update.stickerSet);
    }
  }

  return undefined;
});
