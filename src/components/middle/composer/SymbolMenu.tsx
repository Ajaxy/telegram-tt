import React, {
  memo, useCallback, useEffect, useLayoutEffect, useRef, useState,
} from '../../../lib/teact/teact';
import { getActions, withGlobal } from '../../../global';

import type { FC } from '../../../lib/teact/teact';
import type { ApiSticker, ApiVideo } from '../../../api/types';
import type { GlobalActions } from '../../../global/types';

import { IS_SINGLE_COLUMN_LAYOUT, IS_TOUCH_ENV } from '../../../util/environment';
import { fastRaf } from '../../../util/schedulers';
import buildClassName from '../../../util/buildClassName';
import { selectIsCurrentUserPremium } from '../../../global/selectors';

import useShowTransition from '../../../hooks/useShowTransition';
import useMouseInside from '../../../hooks/useMouseInside';
import useLang from '../../../hooks/useLang';

import Button from '../../ui/Button';
import Menu from '../../ui/Menu';
import Transition from '../../ui/Transition';
import EmojiPicker from './EmojiPicker';
import CustomEmojiPicker from './CustomEmojiPicker';
import StickerPicker from './StickerPicker';
import GifPicker from './GifPicker';
import SymbolMenuFooter, { SYMBOL_MENU_TAB_TITLES, SymbolMenuTabs } from './SymbolMenuFooter';
import Portal from '../../ui/Portal';

import './SymbolMenu.scss';

const ANIMATION_DURATION = 350;

export type OwnProps = {
  chatId: string;
  threadId?: number;
  isOpen: boolean;
  canSendStickers: boolean;
  canSendGifs: boolean;
  onLoad: () => void;
  onClose: () => void;
  onEmojiSelect: (emoji: string) => void;
  onCustomEmojiSelect: (emoji: ApiSticker) => void;
  onStickerSelect: (
    sticker: ApiSticker, isSilent?: boolean, shouldSchedule?: boolean, shouldPreserveInput?: boolean
  ) => void;
  onGifSelect: (gif: ApiVideo, isSilent?: boolean, shouldSchedule?: boolean) => void;
  onRemoveSymbol: () => void;
  onSearchOpen: (type: 'stickers' | 'gifs') => void;
  addRecentEmoji: GlobalActions['addRecentEmoji'];
  addRecentCustomEmoji: GlobalActions['addRecentCustomEmoji'];
};

type StateProps = {
  isLeftColumnShown: boolean;
  isCurrentUserPremium?: boolean;
  lastSyncTime?: number;
};

let isActivated = false;

const SymbolMenu: FC<OwnProps & StateProps> = ({
  chatId,
  threadId,
  isOpen,
  canSendStickers,
  canSendGifs,
  isLeftColumnShown,
  isCurrentUserPremium,
  lastSyncTime,
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
  const { loadPremiumSetStickers, loadFeaturedEmojiStickers } = getActions();
  const [activeTab, setActiveTab] = useState<number>(0);
  const [recentEmojis, setRecentEmojis] = useState<string[]>([]);
  const [recentCustomEmojis, setRecentCustomEmojis] = useState<string[]>([]);

  const [handleMouseEnter, handleMouseLeave] = useMouseInside(isOpen, onClose, undefined, IS_SINGLE_COLUMN_LAYOUT);
  const { shouldRender, transitionClassNames } = useShowTransition(isOpen, onClose, false, false);

  if (!isActivated && isOpen) {
    isActivated = true;
  }

  useEffect(() => {
    onLoad();
  }, [onLoad]);

  useEffect(() => {
    if (!lastSyncTime) return;
    if (isCurrentUserPremium) {
      loadPremiumSetStickers();
    }
    loadFeaturedEmojiStickers();
  }, [isCurrentUserPremium, lastSyncTime, loadFeaturedEmojiStickers, loadPremiumSetStickers]);

  useLayoutEffect(() => {
    if (!IS_SINGLE_COLUMN_LAYOUT) {
      return undefined;
    }

    if (isOpen) {
      document.body.classList.add('enable-symbol-menu-transforms');
      document.body.classList.add('is-symbol-menu-open');
    }

    return () => {
      if (isOpen) {
        fastRaf(() => {
          document.body.classList.remove('is-symbol-menu-open');
          setTimeout(() => {
            document.body.classList.remove('enable-symbol-menu-transforms');
          }, ANIMATION_DURATION);
        });
      }
    };
  }, [isOpen]);

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

  const handleEmojiSelect = useCallback((emoji: string, name: string) => {
    setRecentEmojis((emojis) => [...emojis, name]);

    onEmojiSelect(emoji);
  }, [onEmojiSelect]);

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

  const handleCustomEmojiSelect = useCallback((emoji: ApiSticker) => {
    setRecentCustomEmojis((ids) => [...ids, emoji.id]);

    onCustomEmojiSelect(emoji);
  }, [onCustomEmojiSelect]);

  const handleSearch = useCallback((type: 'stickers' | 'gifs') => {
    onClose();
    onSearchOpen(type);
  }, [onClose, onSearchOpen]);

  const handleStickerSelect = useCallback((sticker: ApiSticker, isSilent?: boolean, shouldSchedule?: boolean) => {
    onStickerSelect(sticker, isSilent, shouldSchedule, true);
  }, [onStickerSelect]);

  const lang = useLang();

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
            loadAndPlay={isOpen && (isActive || isFrom)}
            onCustomEmojiSelect={handleCustomEmojiSelect}
            chatId={chatId}
          />
        );
      case SymbolMenuTabs.Stickers:
        return (
          <StickerPicker
            className="picker-tab"
            loadAndPlay={canSendStickers ? isOpen && (isActive || isFrom) : false}
            canSendStickers={canSendStickers}
            onStickerSelect={handleStickerSelect}
            chatId={chatId}
            threadId={threadId}
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
          <Transition name="slide" activeKey={activeTab} renderCount={Object.values(SYMBOL_MENU_TAB_TITLES).length}>
            {renderContent}
          </Transition>
        )}
      </div>
      {IS_SINGLE_COLUMN_LAYOUT && (
        <Button
          round
          faded
          color="translucent"
          ariaLabel={lang('Close')}
          className="symbol-close-button"
          size="tiny"
          onClick={onClose}
        >
          <i className="icon-close" />
        </Button>
      )}
      <SymbolMenuFooter
        activeTab={activeTab}
        onSwitchTab={setActiveTab}
        onRemoveSymbol={onRemoveSymbol}
        onSearchOpen={handleSearch}
      />
    </>
  );

  if (IS_SINGLE_COLUMN_LAYOUT) {
    if (!shouldRender) {
      return undefined;
    }

    const className = buildClassName(
      'SymbolMenu mobile-menu',
      transitionClassNames,
      isLeftColumnShown && 'left-column-open',
    );

    return (
      <Portal>
        <div className={className}>
          {content}
        </div>
      </Portal>
    );
  }

  return (
    <Menu
      isOpen={isOpen}
      positionX="left"
      positionY="bottom"
      onClose={onClose}
      className="SymbolMenu"
      onCloseAnimationEnd={onClose}
      onMouseEnter={!IS_TOUCH_ENV ? handleMouseEnter : undefined}
      onMouseLeave={!IS_TOUCH_ENV ? handleMouseLeave : undefined}
      noCloseOnBackdrop={!IS_TOUCH_ENV}
      noCompact
    >
      {content}
    </Menu>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    return {
      isLeftColumnShown: global.isLeftColumnShown,
      isCurrentUserPremium: selectIsCurrentUserPremium(global),
      lastSyncTime: global.lastSyncTime,
    };
  },
)(SymbolMenu));
