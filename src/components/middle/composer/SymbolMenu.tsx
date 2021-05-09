import React, {
  FC, memo, useCallback, useEffect, useLayoutEffect, useRef, useState,
} from '../../../lib/teact/teact';

import { ApiSticker, ApiVideo } from '../../../api/types';

import { IAllowedAttachmentOptions } from '../../../modules/helpers';
import { IS_MOBILE_SCREEN, IS_TOUCH_ENV } from '../../../util/environment';
import { fastRaf } from '../../../util/schedulers';
import buildClassName from '../../../util/buildClassName';
import useShowTransition from '../../../hooks/useShowTransition';
import useMouseInside from '../../../hooks/useMouseInside';
import useLang from '../../../hooks/useLang';

import Button from '../../ui/Button';
import Menu from '../../ui/Menu';
import Transition from '../../ui/Transition';
import EmojiPicker from './EmojiPicker';
import StickerPicker from './StickerPicker';
import GifPicker from './GifPicker';
import SymbolMenuFooter, { SYMBOL_MENU_TAB_TITLES, SymbolMenuTabs } from './SymbolMenuFooter';
import Portal from '../../ui/Portal';

import './SymbolMenu.scss';

const ANIMATION_DURATION = 350;

export type OwnProps = {
  isOpen: boolean;
  allowedAttachmentOptions: IAllowedAttachmentOptions;
  onLoad: () => void;
  onClose: () => void;
  onEmojiSelect: (emoji: string) => void;
  onStickerSelect: (sticker: ApiSticker) => void;
  onGifSelect: (gif: ApiVideo) => void;
  onRemoveSymbol: () => void;
  onSearchOpen: (type: 'stickers' | 'gifs') => void;
  addRecentEmoji: AnyToVoidFunction;
};

let isActivated = false;

const SymbolMenu: FC<OwnProps> = ({
  isOpen, allowedAttachmentOptions,
  onLoad, onClose,
  onEmojiSelect, onStickerSelect, onGifSelect,
  onRemoveSymbol, onSearchOpen, addRecentEmoji,
}) => {
  const [activeTab, setActiveTab] = useState<number>(0);
  const [recentEmojis, setRecentEmojis] = useState<string[]>([]);

  const [handleMouseEnter, handleMouseLeave] = useMouseInside(isOpen, onClose);
  const { shouldRender, transitionClassNames } = useShowTransition(isOpen, onClose, false, false);

  if (!isActivated && isOpen) {
    isActivated = true;
  }

  useEffect(() => {
    onLoad();
  }, [onLoad]);

  useLayoutEffect(() => {
    if (!IS_MOBILE_SCREEN) {
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
    if (!recentEmojisRef.current.length) {
      return;
    }

    recentEmojisRef.current.forEach((name) => {
      addRecentEmoji({ emoji: name });
    });

    setRecentEmojis([]);
  }, [isOpen, activeTab, addRecentEmoji]);

  const handleEmojiSelect = useCallback((emoji: string, name: string) => {
    setRecentEmojis((emojis) => {
      return [...emojis, name];
    });

    onEmojiSelect(emoji);
  }, [onEmojiSelect]);

  const handleSearch = useCallback((type: 'stickers' | 'gifs') => {
    onClose();
    onSearchOpen(type);
  }, [onClose, onSearchOpen]);

  const lang = useLang();

  const { canSendStickers, canSendGifs } = allowedAttachmentOptions;

  function renderContent(isActive: boolean, isFrom: boolean) {
    switch (activeTab) {
      case SymbolMenuTabs.Emoji:
        return (
          <EmojiPicker
            className="picker-tab"
            onEmojiSelect={handleEmojiSelect}
          />
        );
      case SymbolMenuTabs.Stickers:
        return (
          <StickerPicker
            className="picker-tab"
            loadAndPlay={canSendStickers ? isOpen && (isActive || isFrom) : false}
            canSendStickers={canSendStickers}
            onStickerSelect={onStickerSelect}
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
          <Transition name="slide" activeKey={activeTab} renderCount={SYMBOL_MENU_TAB_TITLES.length}>
            {renderContent}
          </Transition>
        )}
      </div>
      {IS_MOBILE_SCREEN && (
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

  if (IS_MOBILE_SCREEN) {
    if (!shouldRender) {
      return undefined;
    }

    const className = buildClassName(
      'SymbolMenu mobile-menu',
      transitionClassNames,
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
    >
      {content}
    </Menu>
  );
};

export default memo(SymbolMenu);
