import { memo } from '@teact';

import type { ApiSticker } from '../../../../api/types';
import type { EditorPanelProps } from '../types';

import generateUniqueId from '../../../../util/generateUniqueId';

import useLastCallback from '../../../../hooks/useLastCallback';

import StickerPicker from '../../../middle/composer/StickerPicker';
import Island from '@gili/layout/Island';

import styles from '../MediaEditor.module.scss';

const NEW_LAYER_POSITION = 0.5;

function StickerPanel({
  doc,
  isActive,
  chatId,
  onCommit,
}: EditorPanelProps) {
  const handleStickerSelect = useLastCallback((sticker: ApiSticker) => {
    onCommit({
      ...doc,
      layers: [...doc.layers ?? [], {
        id: generateUniqueId(),
        type: 'sticker',
        x: NEW_LAYER_POSITION,
        y: NEW_LAYER_POSITION,
        scale: 1,
        rotation: 0,
        sticker,
      }],
    });
  });

  return (
    <div className={styles.stickerPanel}>
      <Island className={styles.stickerIsland}>
        <StickerPicker
          className={styles.stickerPicker}
          chatId={chatId}
          idPrefix="media-editor-stickers"
          isHidden={!isActive}
          loadAndPlay={Boolean(isActive)}
          canSendStickers
          noContextMenus
          noRenderDelay
          withInstantThumbs
          onStickerSelect={handleStickerSelect}
        />
      </Island>
    </div>
  );
}

export default memo(StickerPanel);
