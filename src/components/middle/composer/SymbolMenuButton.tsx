import React, {
  memo, useCallback, useRef, useState,
} from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import type { FC } from '../../../lib/teact/teact';
import type { IAnchorPosition } from '../../../types';
import type { ApiVideo, ApiSticker } from '../../../api/types';

import { EDITABLE_INPUT_CSS_SELECTOR, EDITABLE_INPUT_MODAL_CSS_SELECTOR } from '../../../config';
import buildClassName from '../../../util/buildClassName';
import useFlag from '../../../hooks/useFlag';
import useContextMenuPosition from '../../../hooks/useContextMenuPosition';

import Button from '../../ui/Button';
import Spinner from '../../ui/Spinner';
import ResponsiveHoverButton from '../../ui/ResponsiveHoverButton';
import SymbolMenu from './SymbolMenu.async';

const MOBILE_KEYBOARD_HIDE_DELAY_MS = 100;

type OwnProps = {
  chatId: string;
  threadId?: number;
  isMobile?: boolean;
  isReady?: boolean;
  isSymbolMenuOpen?: boolean;
  canSendGifs?: boolean;
  canSendStickers?: boolean;
  openSymbolMenu: VoidFunction;
  closeSymbolMenu: VoidFunction;
  onCustomEmojiSelect: (emoji: ApiSticker) => void;
  onStickerSelect?: (
    sticker: ApiSticker,
    isSilent?: boolean,
    shouldSchedule?: boolean,
    shouldPreserveInput?: boolean,
    shouldUpdateStickerSetsOrder?: boolean
  ) => void;
  onGifSelect?: (gif: ApiVideo, isSilent?: boolean, shouldSchedule?: boolean) => void;
  onRemoveSymbol: VoidFunction;
  onEmojiSelect: (emoji: string) => void;
  closeBotCommandMenu?: VoidFunction;
  closeSendAsMenu?: VoidFunction;
  isSymbolMenuForced?: boolean;
  isAttachmentModal?: boolean;
  className?: string;
};

const SymbolMenuButton: FC<OwnProps> = ({
  chatId,
  threadId,
  isMobile,
  canSendGifs,
  canSendStickers,
  isReady,
  isSymbolMenuOpen,
  openSymbolMenu,
  closeSymbolMenu,
  onCustomEmojiSelect,
  onStickerSelect,
  onGifSelect,
  isAttachmentModal,
  onRemoveSymbol,
  onEmojiSelect,
  closeBotCommandMenu,
  closeSendAsMenu,
  isSymbolMenuForced,
  className,
}) => {
  const {
    setStickerSearchQuery,
    setGifSearchQuery,
    addRecentEmoji,
    addRecentCustomEmoji,
  } = getActions();

  // eslint-disable-next-line no-null/no-null
  const triggerRef = useRef<HTMLDivElement>(null);

  const [isSymbolMenuLoaded, onSymbolMenuLoadingComplete] = useFlag();
  const [contextMenuPosition, setContextMenuPosition] = useState<IAnchorPosition | undefined>(undefined);

  const symbolMenuButtonClassName = buildClassName(
    'mobile-symbol-menu-button',
    !isReady && 'not-ready',
    isSymbolMenuLoaded
      ? (isSymbolMenuOpen && 'menu-opened')
      : (isSymbolMenuOpen && 'is-loading'),
  );

  const handleActivateSymbolMenu = useCallback(() => {
    closeBotCommandMenu?.();
    closeSendAsMenu?.();
    openSymbolMenu();
    const triggerEl = triggerRef.current;
    if (!triggerEl) return;
    const { x, y } = triggerEl.getBoundingClientRect();
    setContextMenuPosition({ x, y });
  }, [closeBotCommandMenu, closeSendAsMenu, openSymbolMenu]);

  const handleSearchOpen = useCallback((type: 'stickers' | 'gifs') => {
    if (type === 'stickers') {
      setStickerSearchQuery({ query: '' });
      setGifSearchQuery({ query: undefined });
    } else {
      setGifSearchQuery({ query: '' });
      setStickerSearchQuery({ query: undefined });
    }
  }, [setStickerSearchQuery, setGifSearchQuery]);

  const handleSymbolMenuOpen = useCallback(() => {
    const messageInput = document.querySelector<HTMLDivElement>(
      isAttachmentModal ? EDITABLE_INPUT_MODAL_CSS_SELECTOR : EDITABLE_INPUT_CSS_SELECTOR,
    );

    if (!isMobile || messageInput !== document.activeElement) {
      openSymbolMenu();
      return;
    }

    messageInput?.blur();
    setTimeout(() => {
      closeBotCommandMenu?.();
      openSymbolMenu();
    }, MOBILE_KEYBOARD_HIDE_DELAY_MS);
  }, [isAttachmentModal, isMobile, openSymbolMenu, closeBotCommandMenu]);

  const getTriggerElement = useCallback(() => triggerRef.current, []);

  const getRootElement = useCallback(
    () => triggerRef.current?.closest('.custom-scroll, .no-scrollbar'),
    [],
  );

  const getMenuElement = useCallback(
    () => document.querySelector('#portals .SymbolMenu .bubble'),
    [],
  );

  const getLayout = useCallback(() => ({
    withPortal: true,
  }), []);

  const {
    positionX, positionY, transformOriginX, transformOriginY, style: menuStyle,
  } = useContextMenuPosition(
    contextMenuPosition,
    getTriggerElement,
    getRootElement,
    getMenuElement,
    getLayout,
  );

  return (
    <>
      {isMobile ? (
        <Button
          className={symbolMenuButtonClassName}
          round
          color="translucent"
          onClick={isSymbolMenuOpen ? closeSymbolMenu : handleSymbolMenuOpen}
          ariaLabel="Choose emoji, sticker or GIF"
        >
          <i className="icon-smile" />
          <i className="icon-keyboard" />
          {isSymbolMenuOpen && !isSymbolMenuLoaded && <Spinner color="gray" />}
        </Button>
      ) : (
        <ResponsiveHoverButton
          className={buildClassName('symbol-menu-button', isSymbolMenuOpen && 'activated')}
          round
          color="translucent"
          onActivate={handleActivateSymbolMenu}
          ariaLabel="Choose emoji, sticker or GIF"
        >
          <div ref={triggerRef} className="symbol-menu-trigger" />
          <i className="icon-smile" />
        </ResponsiveHoverButton>
      )}

      <SymbolMenu
        chatId={chatId}
        threadId={threadId}
        isOpen={isSymbolMenuOpen || Boolean(isSymbolMenuForced)}
        canSendGifs={canSendGifs}
        canSendStickers={canSendStickers}
        onLoad={onSymbolMenuLoadingComplete}
        onClose={closeSymbolMenu}
        onEmojiSelect={onEmojiSelect}
        onStickerSelect={onStickerSelect}
        onCustomEmojiSelect={onCustomEmojiSelect}
        onGifSelect={onGifSelect}
        onRemoveSymbol={onRemoveSymbol}
        onSearchOpen={handleSearchOpen}
        addRecentEmoji={addRecentEmoji}
        addRecentCustomEmoji={addRecentCustomEmoji}
        isAttachmentModal={isAttachmentModal}
        className={className}
        positionX={isAttachmentModal ? positionX : undefined}
        positionY={isAttachmentModal ? positionY : undefined}
        transformOriginX={isAttachmentModal ? transformOriginX : undefined}
        transformOriginY={isAttachmentModal ? transformOriginY : undefined}
        style={isAttachmentModal ? menuStyle : undefined}
      />
    </>
  );
};

export default memo(SymbolMenuButton);
