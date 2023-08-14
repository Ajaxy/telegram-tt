import React, {
  memo, useEffect, useLayoutEffect, useRef, useState,
} from '../../../lib/teact/teact';
import { requestMutation } from '../../../lib/fasterdom/fasterdom';
import { getActions, withGlobal } from '../../../global';

import type { FC } from '../../../lib/teact/teact';
import type { ApiSticker, ApiVideo } from '../../../api/types';
import type { GlobalActions } from '../../../global';

import { IS_TOUCH_ENV } from '../../../util/windowEnvironment';
import buildClassName from '../../../util/buildClassName';
import { selectTabState, selectIsCurrentUserPremium, selectIsContextMenuTranslucent } from '../../../global/selectors';

import useLastCallback from '../../../hooks/useLastCallback';
import useShowTransition from '../../../hooks/useShowTransition';
import useMouseInside from '../../../hooks/useMouseInside';
import useLang from '../../../hooks/useLang';
import useAppLayout from '../../../hooks/useAppLayout';

import Button from '../../ui/Button';
import Menu from '../../ui/Menu';
import Transition from '../../ui/Transition';
import EmojiPicker from './EmojiPicker';
import CustomEmojiPicker from '../../common/CustomEmojiPicker';
import StickerPicker from './StickerPicker';
import GifPicker from './GifPicker';
import SymbolMenuFooter, { SYMBOL_MENU_TAB_TITLES, SymbolMenuTabs } from './SymbolMenuFooter';
import Portal from '../../ui/Portal';

import './SymbolMenu.scss';

const ANIMATION_DURATION = 350;
const STICKERS_TAB_INDEX = 2;

export type OwnProps = {
  chatId: string;
  threadId?: number;
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
  isCurrentUserPremium?: boolean;
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
  isCurrentUserPremium,
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
  const { loadPremiumSetStickers } = getActions();
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

  useEffect(() => {
    if (isCurrentUserPremium) {
      loadPremiumSetStickers();
    }
  }, [isCurrentUserPremium, loadPremiumSetStickers]);

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
      isCurrentUserPremium: selectIsCurrentUserPremium(global),
      isBackgroundTranslucent: selectIsContextMenuTranslucent(global),
    };
  },
)(SymbolMenu));
