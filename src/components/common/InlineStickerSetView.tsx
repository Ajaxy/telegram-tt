import { memo, useCallback, useRef } from '../../lib/teact/teact';
import { getActions } from '../../global';

import type { ApiSticker, ApiStickerSet } from '../../api/types';
import type { ObserveFn } from '../../hooks/useIntersectionObserver';

import { selectStickerSet } from '../../global/selectors';
import renderText from './helpers/renderText';

import useSelector from '../../hooks/data/useSelector';
import useContentWidth from '../../hooks/useContentWidth';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';

import Button from '../ui/Button';
import Loading from '../ui/Loading';
import Transition from '../ui/Transition';
import StickerButton from './StickerButton';

import styles from './InlineStickerSetView.module.scss';

type OwnProps = {
  stickerSet: ApiStickerSet;
  stickerSize: number;
  observeIntersection: ObserveFn;
  noPlay?: boolean;
  noContextMenus?: boolean;
  isSavedMessages?: boolean;
  isCurrentUserPremium?: boolean;
  isTranslucent?: boolean;
  onStickerSelect?: (sticker: ApiSticker) => void;
};

const InlineStickerSetView = ({
  stickerSet,
  stickerSize,
  observeIntersection,
  noPlay,
  noContextMenus,
  isSavedMessages,
  isCurrentUserPremium,
  isTranslucent,
  onStickerSelect,
}: OwnProps) => {
  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <p className={styles.title}>{renderText(stickerSet.title, ['emoji', 'links'])}</p>
      </div>
      {stickerSet.stickers?.length ? (
        <div className={styles.grid} style={`--inline-set-item-size: ${stickerSize / 16}rem`}>
          {stickerSet.stickers.map((sticker) => (
            <StickerButton
              key={sticker.id}
              sticker={sticker}
              size={stickerSize}
              observeIntersection={observeIntersection}
              noPlay={noPlay}
              noContextMenu={noContextMenus}
              isSavedMessages={isSavedMessages}
              isCurrentUserPremium={isCurrentUserPremium}
              withTranslucentThumb={isTranslucent}
              onClick={onStickerSelect}
              clickArg={sticker}
              forcePlayback
            />
          ))}
        </div>
      ) : (
        <Loading />
      )}
    </div>
  );
};

export default memo(InlineStickerSetView);

export function StickerSetToggleButton({ stickerSet }: { stickerSet: ApiStickerSet }) {
  const { toggleStickerSet } = getActions();

  const buttonRef = useRef<HTMLButtonElement>();
  const labelRef = useRef<HTMLSpanElement>();

  const lang = useLang();

  const isRegistered = useSelector(useCallback(
    (global) => Boolean(selectStickerSet(global, stickerSet.id)),
    [stickerSet.id],
  ));

  const isAdded = Boolean(!stickerSet.isArchived && stickerSet.installedDate);
  const suffix = stickerSet.isEmoji ? 'Emoji' : 'Sticker';
  const label = lang(
    isAdded ? `StickerPackRemove${suffix}Count` : `StickerPackAdd${suffix}Count`,
    { count: stickerSet.count },
    { pluralValue: stickerSet.count },
  );

  useContentWidth(buttonRef, labelRef, [label]);

  const handleClick = useLastCallback(() => {
    toggleStickerSet({ stickerSetId: stickerSet.id });
  });

  return (
    <Button
      ref={buttonRef}
      className={styles.toggleButton}
      size="tiny"
      color={isAdded ? 'danger' : 'primary'}
      pill
      noClickTransitionReset
      disabled={!isRegistered}
      onClick={handleClick}
    >
      <span ref={labelRef} className={styles.toggleMeasure} aria-hidden>{label}</span>
      <Transition name="fade" activeKey={isAdded ? 1 : 0} className={styles.toggleTransition} shouldCleanup>
        <span className={styles.toggleLabel}>{label}</span>
      </Transition>
    </Button>
  );
}
