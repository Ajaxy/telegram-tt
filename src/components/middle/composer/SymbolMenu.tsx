import type { FC } from '../../../lib/teact/teact';
import React, {
  memo, useEffect, useLayoutEffect, useRef, useState,
} from '../../../lib/teact/teact';
import { withGlobal } from '../../../global';

import type { ApiSticker, ApiVideo } from '../../../api/types';
import type { GlobalActions } from '../../../global';
import type { ThreadId } from '../../../types';

import { requestMutation } from '../../../lib/fasterdom/fasterdom';
import { selectIsContextMenuTranslucent, selectTabState } from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import { IS_TOUCH_ENV } from '../../../util/windowEnvironment';

import useAppLayout from '../../../hooks/useAppLayout';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';
import useMouseInside from '../../../hooks/useMouseInside';
import useShowTransition from '../../../hooks/useShowTransition';

import CustomEmojiPicker from '../../common/CustomEmojiPicker';
import Button from '../../ui/Button';
import Menu from '../../ui/Menu';
import Portal from '../../ui/Portal';
import Transition from '../../ui/Transition';
import EmojiPicker from './EmojiPicker';
import GifPicker from './GifPicker';
import StickerPicker from './StickerPicker';
import SymbolMenuFooter, { SYMBOL_MENU_TAB_TITLES, SymbolMenuTabs } from './SymbolMenuFooter';

import './SymbolMenu.scss';

const ANIMATION_DURATION = 350;
const STICKERS_TAB_INDEX = 2;

export type OwnProps = {
  chatId: string;
  threadId?: ThreadId;
  isOpen: boolean;
  canSendStickers?: boolean;
  canSendGifs?: boolean;
  isMessageComposer?: boolean;
  idPrefix: string;
  onLoad: () => void;
  onClose: () => void;
  onEmojiSelect: (emoji: string) => void;
  onCustomEmojiSelect: (emoji: ApiSticker) => void;
  onStickerSelect?: (
    sticker: ApiSticker,
    isSilent?: boolean,
    shouldSchedule?: boolean,
    shouldPreserveInput?: boolean,
    canUpdateStickerSetsOrder?: boolean,
  ) => void;
  onGifSelect?: (gif: ApiVideo, isSilent?: boolean, shouldSchedule?: boolean) => void;
  onRemoveSymbol: () => void;
  onSearchOpen: (type: 'stickers' | 'gifs') => void;
  addRecentEmoji: GlobalActions['addRecentEmoji'];
  addRecentCustomEmoji: GlobalActions['addRecentCustomEmoji'];
  className?: string;
  isAttachmentModal?: boolean;
  canSendPlainText?: boolean;
  positionX?: 'left' | 'right';
  positionY?: 'top' | 'bottom';
  transformOriginX?: number;
  transformOriginY?: number;
  style?: string;
};

type StateProps = {
  isLeftColumnShown: boolean;
  isBackgroundTranslucent?: boolean;
};

let isActivated = false;

const SymbolMenu: FC<OwnProps & StateProps> = ({
  chatId,
  threadId,
  isOpen,
  canSendStickers,
  canSendGifs,
  isMessageComposer,
  isLeftColumnShown,
  idPrefix,
  isAttachmentModal,
  canSendPlainText,
  className,
  positionX,
  positionY,
  transformOriginX,
  transformOriginY,
  style,
  isBackgroundTranslucent,
  onLoad,
  onClose,
  onEmojiSelect,
  onCustomEmojiSelect,
  onStickerSelect,
  onGifSelect,
  onRemoveSymbol,
  onSearchOpen,
  addRecentEmoji,
  addRecentCustomEmoji,
}) => {
  const [activeTab, setActiveTab] = useState<number>(0);
  const [recentEmojis, setRecentEmojis] = useState<string[]>([]);
  const [recentCustomEmojis, setRecentCustomEmojis] = useState<string[]>([]);
  const { isMobile } = useAppLayout();

  const [handleMouseEnter, handleMouseLeave] = useMouseInside(isOpen, onClose, undefined, isMobile);
  const { shouldRender, transitionClassNames } = useShowTransition(isOpen, onClose, false, false);

  const lang = useLang();

  if (!isActivated && isOpen) {
    isActivated = true;
  }

  useEffect(() => {
    onLoad();
  }, [onLoad]);

  // If we can't send plain text, we should always show the stickers tab
  useEffect(() => {
    if (canSendPlainText) return;
    setActiveTab(STICKERS_TAB_INDEX);
  }, [canSendPlainText]);

  useLayoutEffect(() => {
    if (!isMobile || !isOpen || isAttachmentModal) {
      return undefined;
    }

    document.body.classList.add('enable-symbol-menu-transforms');
    document.body.classList.add('is-symbol-menu-open');

    return () => {
      document.body.classList.remove('is-symbol-menu-open');

      setTimeout(() => {
        requestMutation(() => {
          document.body.classList.remove('enable-symbol-menu-transforms');
        });
      }, ANIMATION_DURATION);
    };
  }, [isAttachmentModal, isMobile, isOpen]);

  const recentEmojisRef = useRef(recentEmojis);
  recentEmojisRef.current = recentEmojis;
  useEffect(() => {
    if (!recentEmojisRef.current.length || isOpen) {
      return;
    }

    recentEmojisRef.current.forEach((name) => {
      addRecentEmoji({ emoji: name });
    });

    setRecentEmojis([]);
  }, [isOpen, addRecentEmoji]);

  const handleEmojiSelect = useLastCallback((emoji: string, name: string) => {
    setRecentEmojis((emojis) => [...emojis, name]);

    onEmojiSelect(emoji);
  });

  const recentCustomEmojisRef = useRef(recentCustomEmojis);
  recentCustomEmojisRef.current = recentCustomEmojis;
  useEffect(() => {
    if (!recentCustomEmojisRef.current.length || isOpen) {
      return;
    }

    recentCustomEmojisRef.current.forEach((documentId) => {
      addRecentCustomEmoji({
        documentId,
      });
    });

    setRecentEmojis([]);
  }, [isOpen, addRecentCustomEmoji]);

  const handleCustomEmojiSelect = useLastCallback((emoji: ApiSticker) => {
    setRecentCustomEmojis((ids) => [...ids, emoji.id]);

    onCustomEmojiSelect(emoji);
  });

  const handleSearch = useLastCallback((type: 'stickers' | 'gifs') => {
    onClose();
    onSearchOpen(type);
  });

  const handleStickerSelect = useLastCallback((
    sticker: ApiSticker, isSilent?: boolean, shouldSchedule?: boolean, canUpdateStickerSetsOrder?: boolean,
  ) => {
    onStickerSelect?.(sticker, isSilent, shouldSchedule, true, canUpdateStickerSetsOrder);
  });

  function renderContent(isActive: boolean, isFrom: boolean) {
    switch (activeTab) {
      case SymbolMenuTabs.Emoji:
        return (
          <EmojiPicker
            className="picker-tab"
            onEmojiSelect={handleEmojiSelect}
          />
        );
      case SymbolMenuTabs.CustomEmoji:
        return (
          <CustomEmojiPicker
            className="picker-tab"
            isHidden={!isOpen || !isActive}
            idPrefix={idPrefix}
            loadAndPlay={isOpen && (isActive || isFrom)}
            chatId={chatId}
            isTranslucent={!isMobile && isBackgroundTranslucent}
            onCustomEmojiSelect={handleCustomEmojiSelect}
          />
        );
      case SymbolMenuTabs.Stickers:
        return (
          <StickerPicker
            className="picker-tab"
            isHidden={!isOpen || !isActive}
            loadAndPlay={canSendStickers ? isOpen && (isActive || isFrom) : false}
            idPrefix={idPrefix}
            canSendStickers={canSendStickers}
            noContextMenus={!isMessageComposer}
            chatId={chatId}
            threadId={threadId}
            isTranslucent={!isMobile && isBackgroundTranslucent}
            onStickerSelect={handleStickerSelect}
          />
        );
      case SymbolMenuTabs.GIFs:
        return (
          <GifPicker
            className="picker-tab"
            loadAndPlay={canSendGifs ? isOpen && (isActive || isFrom) : false}
            canSendGifs={canSendGifs}
            onGifSelect={onGifSelect}
          />
        );
    }

    return undefined;
  }

  function stopPropagation(event: any) {
    event.stopPropagation();
  }

  const content = (
    <>
      <div className="SymbolMenu-main" onClick={stopPropagation}>
        {isActivated && (
          <Transition
            name="slide"
            activeKey={activeTab}
            renderCount={Object.values(SYMBOL_MENU_TAB_TITLES).length}
          >
            {renderContent}
          </Transition>
        )}
      </div>
      {isMobile && (
        <Button
          round
          faded
          color="translucent"
          ariaLabel={lang('Close')}
          className="symbol-close-button"
          size="tiny"
          onClick={onClose}
        >
          <i className="icon icon-close" />
        </Button>
      )}
      <SymbolMenuFooter
        activeTab={activeTab}
        onSwitchTab={setActiveTab}
        onRemoveSymbol={onRemoveSymbol}
        canSearch={isMessageComposer}
        onSearchOpen={handleSearch}
        isAttachmentModal={isAttachmentModal}
        canSendPlainText={canSendPlainText}
      />
    </>
  );

  if (isMobile) {
    if (!shouldRender) {
      return undefined;
    }

    const mobileClassName = buildClassName(
      'SymbolMenu mobile-menu',
      transitionClassNames,
      isLeftColumnShown && 'left-column-open',
      isAttachmentModal && 'in-attachment-modal',
      isMessageComposer && 'in-middle-column',
    );

    if (isAttachmentModal) {
      return (
        <div className={mobileClassName}>
          {content}
        </div>
      );
    }

    return (
      <Portal>
        <div className={mobileClassName}>
          {content}
        </div>
      </Portal>
    );
  }

  return (
    <Menu
      isOpen={isOpen}
      positionX={isAttachmentModal ? positionX : 'left'}
      positionY={isAttachmentModal ? positionY : 'bottom'}
      onClose={onClose}
      withPortal={isAttachmentModal}
      className={buildClassName('SymbolMenu', className)}
      onCloseAnimationEnd={onClose}
      onMouseEnter={!IS_TOUCH_ENV ? handleMouseEnter : undefined}
      onMouseLeave={!IS_TOUCH_ENV ? handleMouseLeave : undefined}
      noCloseOnBackdrop={!IS_TOUCH_ENV}
      noCompact
      transformOriginX={transformOriginX}
      transformOriginY={transformOriginY}
      style={style}
    >
      {content}
    </Menu>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    return {
      isLeftColumnShown: selectTabState(global).isLeftColumnShown,
      isBackgroundTranslucent: selectIsContextMenuTranslucent(global),
    };
  },
)(SymbolMenu));
