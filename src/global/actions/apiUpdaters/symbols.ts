import { addActionHandler } from '../../index';

import { updateStickerSet } from '../../reducers';

addActionHandler('apiUpdate', (global, actions, update) => {
  switch (update['@type']) {
    case 'updateStickerSet': {
      return updateStickerSet(global, update.id, update.stickerSet);
    }
  }

  return undefined;
});
