import type { FC } from '../../lib/teact/teact';
import {
  memo,
  useMemo,
  useRef,
} from '../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../global';

import type { ApiSticker } from '../../api/types';

import { selectCanPlayAnimatedEmojis } from '../../global/selectors';
import buildClassName from '../../util/buildClassName';

import { useIntersectionObserver } from '../../hooks/useIntersectionObserver';
import useLastCallback from '../../hooks/useLastCallback';
import useOldLang from '../../hooks/useOldLang';
import usePreviousDeprecated from '../../hooks/usePreviousDeprecated';

import Modal from '../ui/Modal';
import StickerSetCard from './StickerSetCard';

import styles from './CustomEmojiSetsModal.module.scss';

export type OwnProps = {
  customEmojiSetIds?: string[];
  onClose: () => void;
};

type StateProps = {
  canPlayAnimatedEmojis?: boolean;
};

const CustomEmojiSetsModal: FC<OwnProps & StateProps> = ({
  customEmojiSetIds,
  canPlayAnimatedEmojis,
  onClose,
}) => {
  const { openStickerSet } = getActions();
  const lang = useOldLang();

  const customEmojiSets = useMemo(() => {
    return customEmojiSetIds?.map((id) => getGlobal().stickers.setsById[id]);
  }, [customEmojiSetIds]);

  const customEmojiModalRef = useRef<HTMLDivElement>();
  const { observe: observeIntersectionForCovers } = useIntersectionObserver({
    rootRef: customEmojiModalRef, isDisabled: !customEmojiSets,
  });

  const prevCustomEmojiSets = usePreviousDeprecated(customEmojiSets);
  const renderingCustomEmojiSets = customEmojiSets || prevCustomEmojiSets;

  const handleSetClick = useLastCallback((sticker: ApiSticker) => {
    openStickerSet({
      stickerSetInfo: sticker.stickerSetInfo,
    });
  });

  return (
    <Modal
      isOpen={Boolean(customEmojiSets)}
      className={styles.root}
      onClose={onClose}
      hasCloseButton
      title={lang('lng_custom_emoji_used_sets')}
    >
      <div className={buildClassName(styles.sets, 'custom-scroll')} ref={customEmojiModalRef} teactFastList>
        {renderingCustomEmojiSets?.map((customEmojiSet) => {
          return (
            <StickerSetCard
              key={customEmojiSet.id}
              className={styles.setCard}
              stickerSet={customEmojiSet}
              onClick={handleSetClick}
              observeIntersection={observeIntersectionForCovers}
              noPlay={!canPlayAnimatedEmojis}
            />
          );
        })}
      </div>
    </Modal>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): Complete<StateProps> => {
    return {
      canPlayAnimatedEmojis: selectCanPlayAnimatedEmojis(global),
    };
  },
)(CustomEmojiSetsModal));
