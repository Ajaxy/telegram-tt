import React, {
  memo, useCallback, useEffect, useMemo, useRef,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { FC } from '../../lib/teact/teact';
import type { ApiSticker, ApiStickerSet } from '../../api/types';

import { EMOJI_SIZE_MODAL, STICKER_SIZE_MODAL, TME_LINK_PREFIX } from '../../config';
import {
  selectCanScheduleUntilOnline,
  selectChat,
  selectCurrentMessageList,
  selectIsChatWithSelf, selectIsCurrentUserPremium,
  selectShouldSchedule,
  selectStickerSet, selectThreadInfo,
} from '../../global/selectors';
import renderText from './helpers/renderText';
import { copyTextToClipboard } from '../../util/clipboard';
import { getAllowedAttachmentOptions, getCanPostInChat } from '../../global/helpers';

import { useIntersectionObserver } from '../../hooks/useIntersectionObserver';
import useLang from '../../hooks/useLang';
import useAppLayout from '../../hooks/useAppLayout';
import useSchedule from '../../hooks/useSchedule';
import usePrevious from '../../hooks/usePrevious';

import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Loading from '../ui/Loading';
import StickerButton from './StickerButton';
import DropdownMenu from '../ui/DropdownMenu';
import MenuItem from '../ui/MenuItem';

import './StickerSetModal.scss';

export type OwnProps = {
  isOpen: boolean;
  fromSticker?: ApiSticker;
  stickerSetShortName?: string;
  onClose: () => void;
};

type StateProps = {
  canSendStickers?: boolean;
  stickerSet?: ApiStickerSet;
  canScheduleUntilOnline?: boolean;
  shouldSchedule?: boolean;
  isSavedMessages?: boolean;
  isCurrentUserPremium?: boolean;
};

const INTERSECTION_THROTTLE = 200;

const StickerSetModal: FC<OwnProps & StateProps> = ({
  isOpen,
  fromSticker,
  stickerSetShortName,
  stickerSet,
  canSendStickers,
  canScheduleUntilOnline,
  shouldSchedule,
  isSavedMessages,
  isCurrentUserPremium,
  onClose,
}) => {
  const {
    loadStickers,
    toggleStickerSet,
    sendMessage,
    showNotification,
  } = getActions();

  // eslint-disable-next-line no-null/no-null
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const sharedCanvasRef = useRef<HTMLCanvasElement>(null);

  const lang = useLang();

  const { isMobile } = useAppLayout();

  const prevStickerSet = usePrevious(stickerSet);
  const renderingStickerSet = stickerSet || prevStickerSet;

  const isAdded = Boolean(!renderingStickerSet?.isArchived && renderingStickerSet?.installedDate);
  const isEmoji = renderingStickerSet?.isEmoji;

  const [requestCalendar, calendar] = useSchedule(canScheduleUntilOnline);

  const {
    observe: observeIntersection,
  } = useIntersectionObserver({ rootRef: containerRef, throttleMs: INTERSECTION_THROTTLE, isDisabled: !isOpen });

  useEffect(() => {
    if (isOpen && !renderingStickerSet?.stickers) {
      loadStickers({
        stickerSetInfo: fromSticker ? fromSticker.stickerSetInfo : { shortName: stickerSetShortName! },
      });
    }
  }, [isOpen, fromSticker, loadStickers, stickerSetShortName, renderingStickerSet]);

  const handleSelect = useCallback((sticker: ApiSticker, isSilent?: boolean, isScheduleRequested?: boolean) => {
    sticker = {
      ...sticker,
      isPreloadedGlobally: true,
    };

    if (shouldSchedule || isScheduleRequested) {
      requestCalendar((scheduledAt) => {
        sendMessage({
          sticker, isSilent, scheduledAt,
        });
        onClose();
      });
    } else {
      sendMessage({ sticker, isSilent, shouldUpdateStickerSetsOrder: isAdded });
      onClose();
    }
  }, [onClose, requestCalendar, sendMessage, shouldSchedule, isAdded]);

  const handleButtonClick = useCallback(() => {
    if (renderingStickerSet) {
      toggleStickerSet({ stickerSetId: renderingStickerSet.id });
      onClose();
    }
  }, [onClose, renderingStickerSet, toggleStickerSet]);

  const handleCopyLink = useCallback(() => {
    if (!renderingStickerSet) return;
    const { shortName } = renderingStickerSet;
    const suffix = isEmoji ? 'addemoji' : 'addstickers';
    const url = `${TME_LINK_PREFIX}${suffix}/${shortName}`;
    copyTextToClipboard(url);
    showNotification({
      message: lang('LinkCopied'),
    });
  }, [isEmoji, lang, renderingStickerSet, showNotification]);

  const renderButtonText = () => {
    if (!renderingStickerSet) return lang('Loading');

    const suffix = isEmoji ? 'Emoji' : 'Sticker';

    return lang(
      isAdded ? `StickerPack.Remove${suffix}Count` : `StickerPack.Add${suffix}Count`,
      renderingStickerSet.count,
      'i',
    );
  };

  const MoreMenuButton: FC<{ onTrigger: () => void; isOpen?: boolean }> = useMemo(() => {
    return ({ onTrigger, isOpen: isMenuOpen }) => (
      <Button
        round
        ripple={!isMobile}
        size="smaller"
        color="translucent"
        className={isMenuOpen ? 'active' : ''}
        onClick={onTrigger}
        ariaLabel="More actions"
      >
        <i className="icon-more" />
      </Button>
    );
  }, [isMobile]);

  function renderHeader() {
    return (
      <div className="modal-header" dir={lang.isRtl ? 'rtl' : undefined}>
        <Button round color="translucent" size="smaller" ariaLabel={lang('Close')} onClick={onClose}>
          <i className="icon-close" />
        </Button>
        <div className="modal-title">
          {renderingStickerSet ? renderText(renderingStickerSet.title, ['emoji', 'links']) : lang('AccDescrStickerSet')}
        </div>
        <DropdownMenu
          className="stickers-more-menu with-menu-transitions"
          trigger={MoreMenuButton}
          positionX="right"
        >
          <MenuItem icon="copy" onClick={handleCopyLink}>{lang('StickersCopy')}</MenuItem>
        </DropdownMenu>
      </div>
    );
  }

  return (
    <Modal
      className="StickerSetModal"
      isOpen={isOpen}
      onClose={onClose}
      header={renderHeader()}
    >
      {renderingStickerSet?.stickers ? (
        <>
          <div ref={containerRef} className="stickers custom-scroll">
            <div className="shared-canvas-container">
              <canvas ref={sharedCanvasRef} className="shared-canvas" />
              {renderingStickerSet.stickers.map((sticker) => (
                <StickerButton
                  sticker={sticker}
                  size={isEmoji ? EMOJI_SIZE_MODAL : STICKER_SIZE_MODAL}
                  observeIntersection={observeIntersection}
                  onClick={canSendStickers && !isEmoji ? handleSelect : undefined}
                  clickArg={sticker}
                  isSavedMessages={isSavedMessages}
                  isCurrentUserPremium={isCurrentUserPremium}
                  sharedCanvasRef={sharedCanvasRef}
                />
              ))}
            </div>
          </div>
          <div className="button-wrapper">
            <Button
              size="smaller"
              fluid
              color={isAdded ? 'danger' : 'primary'}
              onClick={handleButtonClick}
            >
              {renderButtonText()}
            </Button>
          </div>
        </>
      ) : (
        <Loading />
      )}
      {calendar}
    </Modal>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { fromSticker, stickerSetShortName }): StateProps => {
    const currentMessageList = selectCurrentMessageList(global);
    const { chatId, threadId } = currentMessageList || {};
    const chat = chatId && selectChat(global, chatId);
    const sendOptions = chat ? getAllowedAttachmentOptions(chat) : undefined;
    const threadInfo = chatId && threadId ? selectThreadInfo(global, chatId, threadId) : undefined;
    const isComments = Boolean(threadInfo?.originChannelId);
    const canSendStickers = Boolean(
      chat && threadId && getCanPostInChat(chat, threadId, isComments) && sendOptions?.canSendStickers,
    );
    const isSavedMessages = Boolean(chatId) && selectIsChatWithSelf(global, chatId);

    const stickerSetInfo = fromSticker ? fromSticker.stickerSetInfo
      : stickerSetShortName ? { shortName: stickerSetShortName } : undefined;

    const stickerSet = stickerSetInfo ? selectStickerSet(global, stickerSetInfo) : undefined;

    return {
      canScheduleUntilOnline: Boolean(chatId) && selectCanScheduleUntilOnline(global, chatId),
      canSendStickers,
      isSavedMessages,
      shouldSchedule: selectShouldSchedule(global),
      stickerSet,
      isCurrentUserPremium: selectIsCurrentUserPremium(global),
    };
  },
)(StickerSetModal));
