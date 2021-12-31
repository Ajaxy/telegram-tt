import React, {
  FC, memo, useCallback, useEffect, useRef,
} from '../../lib/teact/teact';
import { getDispatch, withGlobal } from '../../lib/teact/teactn';

import { ApiSticker, ApiStickerSet } from '../../api/types';

import { STICKER_SIZE_MODAL } from '../../config';
import {
  selectChat, selectCurrentMessageList, selectStickerSet, selectStickerSetByShortName,
} from '../../modules/selectors';
import { useIntersectionObserver } from '../../hooks/useIntersectionObserver';
import useLang from '../../hooks/useLang';
import renderText from './helpers/renderText';
import { getAllowedAttachmentOptions, getCanPostInChat } from '../../modules/helpers';

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
};

const INTERSECTION_THROTTLE = 200;

const StickerSetModal: FC<OwnProps & StateProps> = ({
  isOpen,
  fromSticker,
  stickerSetShortName,
  stickerSet,
  canSendStickers,
  onClose,
}) => {
  const {
    loadStickers,
    toggleStickerSet,
    sendMessage,
  } = getDispatch();

  // eslint-disable-next-line no-null/no-null
  const containerRef = useRef<HTMLDivElement>(null);
  const lang = useLang();

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

  const handleSelect = useCallback((sticker: ApiSticker) => {
    sticker = {
      ...sticker,
      isPreloadedGlobally: true,
    };

    sendMessage({ sticker });
    onClose();
  }, [onClose, sendMessage]);

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

    return {
      canSendStickers,
      stickerSet: fromSticker
        ? selectStickerSet(global, fromSticker.stickerSetId)
        : stickerSetShortName
          ? selectStickerSetByShortName(global, stickerSetShortName)
          : undefined,
    };
  },
)(StickerSetModal));
