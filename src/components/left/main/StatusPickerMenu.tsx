import type { RefObject } from 'react';
import React, {
  useCallback, memo, useEffect, useRef,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { FC } from '../../../lib/teact/teact';
import type { ApiSticker } from '../../../api/types';

import useFlag from '../../../hooks/useFlag';

import Menu from '../../ui/Menu';
import Portal from '../../ui/Portal';
import CustomEmojiPicker from '../../common/CustomEmojiPicker';

import styles from './StatusPickerMenu.module.scss';

export type OwnProps = {
  isOpen: boolean;
  statusButtonRef: RefObject<HTMLButtonElement>;
  onEmojiStatusSelect: (emojiStatus: ApiSticker) => void;
  onClose: () => void;
};

interface StateProps {
  areFeaturedStickersLoaded?: boolean;
}

const StatusPickerMenu: FC<OwnProps & StateProps> = ({
  isOpen,
  statusButtonRef,
  areFeaturedStickersLoaded,
  onEmojiStatusSelect,
  onClose,
}) => {
  const { loadFeaturedEmojiStickers } = getActions();

  // eslint-disable-next-line no-null/no-null
  const scrollHeaderRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const transformOriginX = useRef<number>();
  const [isContextMenuShown, markContextMenuShown, unmarkContextMenuShown] = useFlag();
  useEffect(() => {
    transformOriginX.current = statusButtonRef.current!.getBoundingClientRect().right;
  }, [isOpen, statusButtonRef]);

  useEffect(() => {
    if (isOpen && !areFeaturedStickersLoaded) {
      loadFeaturedEmojiStickers();
    }
  }, [areFeaturedStickersLoaded, isOpen, loadFeaturedEmojiStickers]);

  const handleResetScrollPosition = useCallback(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
    if (scrollHeaderRef.current) {
      scrollHeaderRef.current.scrollLeft = 0;
    }
  }, []);

  const handleEmojiSelect = useCallback((sticker: ApiSticker) => {
    onEmojiStatusSelect(sticker);
    onClose();
  }, [onClose, onEmojiStatusSelect]);

  return (
    <Portal>
      <Menu
        isOpen={isOpen}
        noCompact
        positionX="right"
        bubbleClassName={styles.menuContent}
        onClose={onClose}
        transformOriginX={transformOriginX.current}
        noCloseOnBackdrop={isContextMenuShown}
        onCloseAnimationEnd={handleResetScrollPosition}
      >
        <CustomEmojiPicker
          idPrefix="status-emoji-set-"
          loadAndPlay={isOpen}
          isStatusPicker
          scrollHeaderRef={scrollHeaderRef}
          scrollContainerRef={scrollContainerRef}
          onContextMenuOpen={markContextMenuShown}
          onContextMenuClose={unmarkContextMenuShown}
          onCustomEmojiSelect={handleEmojiSelect}
          onContextMenuClick={onClose}
        />
      </Menu>
    </Portal>
  );
};

export default memo(withGlobal<OwnProps>((global): StateProps => {
  return {
    areFeaturedStickersLoaded: Boolean(global.customEmojis.featuredIds?.length),
  };
})(StatusPickerMenu));
