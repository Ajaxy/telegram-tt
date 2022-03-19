import React, {
  FC, memo, useCallback, useEffect, useRef,
} from '../../lib/teact/teact';
import { getActions, withGlobal } from '../../global';

import { ApiSticker, ApiStickerSet } from '../../api/types';

import { STICKER_SIZE_MODAL } from '../../config';
import {
  selectCanScheduleUntilOnline,
  selectChat,
  selectCurrentMessageList,
  selectIsChatWithSelf,
  selectShouldSchedule,
  selectStickerSet,
  selectStickerSetByShortName,
} from '../../global/selectors';
import { useIntersectionObserver } from '../../hooks/useIntersectionObserver';
import useLang from '../../hooks/useLang';
import renderText from './helpers/renderText';
import { getAllowedAttachmentOptions, getCanPostInChat } from '../../global/helpers';
import useSchedule from '../../hooks/useSchedule';

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
  onClose,
}) => {
  const {
    loadStickers,
    toggleStickerSet,
    sendMessage,
  } = getActions();

  // eslint-disable-next-line no-null/no-null
  const containerRef = useRef<HTMLDivElement>(null);
  const lang = useLang();

  const [requestCalendar, calendar] = useSchedule(canScheduleUntilOnline);

  const {
    observe: observeIntersection,
  } = useIntersectionObserver({ rootRef: containerRef, throttleMs: INTERSECTION_THROTTLE, isDisabled: !isOpen });

  useEffect(() => {
    if (isOpen) {
      if (fromSticker) {
        const { stickerSetId, stickerSetAccessHash } = fromSticker;
        loadStickers({
          stickerSetId,
          stickerSetAccessHash,
        });
      } else if (stickerSetShortName) {
        loadStickers({
          stickerSetShortName,
        });
      }
    }
  }, [isOpen, fromSticker, loadStickers, stickerSetShortName]);

  const handleSelect = useCallback((sticker: ApiSticker, isSilent?: boolean, isScheduleRequested?: boolean) => {
    sticker = {
      ...sticker,
      isPreloadedGlobally: true,
    };

    if (shouldSchedule || isScheduleRequested) {
      requestCalendar((scheduledAt) => {
        sendMessage({ sticker, isSilent, scheduledAt });
        onClose();
      });
    } else {
      sendMessage({ sticker, isSilent });
      onClose();
    }
  }, [onClose, requestCalendar, sendMessage, shouldSchedule]);

  const handleButtonClick = useCallback(() => {
    if (stickerSet) {
      toggleStickerSet({ stickerSetId: stickerSet.id });
      onClose();
    }
  }, [onClose, stickerSet, toggleStickerSet]);

  return (
    <Modal
      className="StickerSetModal"
      isOpen={isOpen}
      onClose={onClose}
      hasCloseButton
      title={stickerSet ? renderText(stickerSet.title, ['emoji', 'links']) : lang('AccDescrStickerSet')}
    >
      {stickerSet?.stickers ? (
        <>
          <div ref={containerRef} className="stickers custom-scroll">
            {stickerSet.stickers.map((sticker) => (
              <StickerButton
                sticker={sticker}
                size={STICKER_SIZE_MODAL}
                observeIntersection={observeIntersection}
                onClick={canSendStickers ? handleSelect : undefined}
                clickArg={sticker}
                isSavedMessages={isSavedMessages}
              />
            ))}
          </div>
          <div className="button-wrapper">
            <Button
              size="smaller"
              fluid
              color={stickerSet.installedDate ? 'danger' : 'primary'}
              onClick={handleButtonClick}
            >
              {lang(
                stickerSet.installedDate ? 'StickerPack.RemoveStickerCount' : 'StickerPack.AddStickerCount',
                stickerSet.count,
                'i',
              )}
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

    return {
      canScheduleUntilOnline: Boolean(chatId) && selectCanScheduleUntilOnline(global, chatId),
      canSendStickers,
      isSavedMessages,
      shouldSchedule: selectShouldSchedule(global),
      stickerSet: fromSticker
        ? selectStickerSet(global, fromSticker.stickerSetId)
        : stickerSetShortName
          ? selectStickerSetByShortName(global, stickerSetShortName)
          : undefined,
    };
  },
)(StickerSetModal));
