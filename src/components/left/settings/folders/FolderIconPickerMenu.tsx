import { memo, useCallback } from '@teact';

import type { ApiSticker } from '../../../../api/types';

import { folderIconMap } from '../../../../util/folderIconMap';

import CustomEmojiPicker from '../../../common/CustomEmojiPicker';
import Icon from '../../../common/icons/Icon';
import Menu from '../../../ui/Menu';

export type OwnProps = {
  isOpen: boolean;
  onEmojiSelect: (emoji: string | ApiSticker) => void;
  onClose: () => void;
};

const FolderIconPickerMenu = ({
  isOpen,
  onEmojiSelect,
  onClose,
}: OwnProps) => {
  const handleEmojiSelect = useCallback((sticker: string | ApiSticker) => {
    onEmojiSelect(sticker);
    onClose();
  }, [onClose, onEmojiSelect]);

  return (
    <Menu
      isOpen={isOpen}
      positionX="left"
      onClose={onClose}
      withPortal
      className="settings-folders-icon-picker-menu SymbolMenu"
    >
      <div className="SymbolMenu-main">
        <div className="settings-folders-icon-picker-menu-folders">
          {
            Object.keys(folderIconMap).map((emoji) => (
              <div className="EmojiButton" onClick={() => handleEmojiSelect(emoji)}>
                <Icon name={folderIconMap[emoji]} />
              </div>
            ))
          }
        </div>
        <CustomEmojiPicker
          idPrefix="folder-emoji-set-"
          loadAndPlay={isOpen}
          isHidden={!isOpen}
          onCustomEmojiSelect={(emoji) => handleEmojiSelect(emoji)}
          onDismiss={onClose}
        />
      </div>
    </Menu>
  );
};

export default memo(FolderIconPickerMenu);
