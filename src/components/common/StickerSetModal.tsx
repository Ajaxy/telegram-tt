import React, {
  memo, useCallback, useEffect, useRef,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import type { FC } from '../../lib/teact/teact';
import type { ApiSticker, ApiStickerSet } from '../../api/types';

import { EMOJI_SIZE_MODAL, STICKER_SIZE_MODAL } from '../../config';
import {
  selectCanScheduleUntilOnline,
  selectChat,
  selectCurrentMessageList,
  selectIsChatWithSelf, selectIsCurrentUserPremium,
  selectIsSetPremium,
  selectShouldSchedule,
  selectStickerSet,
} from '../../global/selectors';
import { useIntersectionObserver } from '../../hooks/useIntersectionObserver';
import useLang from '../../hooks/useLang';
import renderText from './helpers/renderText';
import { getAllowedAttachmentOptions, getCanPostInChat } from '../../global/helpers';
import useSchedule from '../../hooks/useSchedule';
import usePrevious from '../../hooks/usePrevious';

import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Loading from '../ui/Loading';
import StickerButton from './StickerButton';

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
  isSetPremium?: boolean;
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
  isSetPremium,
  isCurrentUserPremium,
  onClose,
}) => {
  const {
    loadStickers,
    toggleStickerSet,
    sendMessage,
    openPremiumModal,
  } = getActions();

  // eslint-disable-next-line no-null/no-null
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line no-null/no-null
  const sharedCanvasRef = useRef<HTMLCanvasElement>(null);

  const lang = useLang();

  const prevStickerSet = usePrevious(stickerSet);
  const renderingStickerSet = stickerSet || prevStickerSet;

  const isAdded = Boolean(!renderingStickerSet?.isArchived && renderingStickerSet?.installedDate);
  const isEmoji = renderingStickerSet?.isEmoji;
  const isButtonLocked = !isAdded && isSetPremium && !isCurrentUserPremium;

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
      if (isButtonLocked) {
        openPremiumModal({ initialSection: 'animated_emoji' });
        return;
      }
      toggleStickerSet({ stickerSetId: renderingStickerSet.id });
      onClose();
    }
  }, [isButtonLocked, onClose, openPremiumModal, renderingStickerSet, toggleStickerSet]);

  const renderButtonText = () => {
    if (!renderingStickerSet) return lang('Loading');
    if (isButtonLocked) {
      return lang('EmojiInput.UnlockPack', renderingStickerSet.title);
    }

    const suffix = isEmoji ? 'Emoji' : 'Sticker';

    return lang(
      isAdded ? `StickerPack.Remove${suffix}Count` : `StickerPack.Add${suffix}Count`,
      renderingStickerSet.count,
      'i',
    );
  };

  return (
    <Modal
      className="StickerSetModal"
      isOpen={isOpen}
      onClose={onClose}
      hasCloseButton
      title={renderingStickerSet
        ? renderText(renderingStickerSet.title, ['emoji', 'links']) : lang('AccDescrStickerSet')}
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
              isShiny={isButtonLocked}
              withPremiumGradient={isButtonLocked}
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
    const canSendStickers = Boolean(
      chat && threadId && getCanPostInChat(chat, threadId) && sendOptions?.canSendStickers,
    );
    const isSavedMessages = Boolean(chatId) && selectIsChatWithSelf(global, chatId);

    const stickerSetInfo = fromSticker ? fromSticker.stickerSetInfo
      : stickerSetShortName ? { shortName: stickerSetShortName } : undefined;

    const stickerSet = stickerSetInfo ? selectStickerSet(global, stickerSetInfo) : undefined;
    const isSetPremium = stickerSet && selectIsSetPremium(stickerSet);

    return {
      canScheduleUntilOnline: Boolean(chatId) && selectCanScheduleUntilOnline(global, chatId),
      canSendStickers,
      isSavedMessages,
      shouldSchedule: selectShouldSchedule(global),
      stickerSet,
      isCurrentUserPremium: selectIsCurrentUserPremium(global),
      isSetPremium,
    };
  },
)(StickerSetModal));
