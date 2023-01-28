import { addActionHandler } from '../../index';

import { updateStickerSet } from '../../reducers';
import type { ActionReturnType } from '../../types';

addActionHandler('apiUpdate', (global, actions, update): ActionReturnType => {
  switch (update['@type']) {
    case 'updateStickerSet': {
      return updateStickerSet(global, update.id, update.stickerSet);
    }
  }

  return undefined;
});
