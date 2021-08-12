import React, {
  FC, memo, useCallback, useEffect, useRef,
} from '../../lib/teact/teact';
import { withGlobal } from '../../lib/teact/teactn';

import { ApiSticker, ApiStickerSet } from '../../api/types';
import { GlobalActions } from '../../global/types';

import { STICKER_SIZE_MODAL } from '../../config';
import { pick } from '../../util/iteratees';
import { selectStickerSet, selectStickerSetByShortName } from '../../modules/selectors';
import { useIntersectionObserver } from '../../hooks/useIntersectionObserver';
import useLang from '../../hooks/useLang';
import renderText from './helpers/renderText';

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
  stickerSet?: ApiStickerSet;
};

type DispatchProps = Pick<GlobalActions, 'loadStickers' | 'toggleStickerSet' | 'sendMessage'>;

const INTERSECTION_THROTTLE = 200;

const StickerSetModal: FC<OwnProps & StateProps & DispatchProps> = ({
  isOpen,
  fromSticker,
  stickerSetShortName,
  stickerSet,
  onClose,
  loadStickers,
  toggleStickerSet,
  sendMessage,
}) => {
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
      } else {
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
      {stickerSet && stickerSet.stickers ? (
        <>
          <div ref={containerRef} className="stickers custom-scroll">
            {stickerSet.stickers.map((sticker) => (
              <StickerButton
                sticker={sticker}
                size={STICKER_SIZE_MODAL}
                observeIntersection={observeIntersection}
                onClick={handleSelect}
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

export default memo(withGlobal(
  (global, { fromSticker, stickerSetShortName }: OwnProps) => {
    return {
      stickerSet: fromSticker
        ? selectStickerSet(global, fromSticker.stickerSetId)
        : selectStickerSetByShortName(global, stickerSetShortName!),
    };
  },
  (setGlobal, actions): DispatchProps => pick(actions, [
    'loadStickers',
    'toggleStickerSet',
    'sendMessage',
  ]),
)(StickerSetModal));
