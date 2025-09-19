import type { FC } from '../../../lib/teact/teact';
import { memo, useRef } from '../../../lib/teact/teact';
import { withGlobal } from '../../../global';

import type { ApiSticker } from '../../../api/types';
import type { ThemeKey } from '../../../types';

import { selectTheme } from '../../../global/selectors';
import buildClassName from '../../../util/buildClassName';
import { REM } from '../../common/helpers/mediaDimensions';

import useDynamicColorListener from '../../../hooks/stickers/useDynamicColorListener';
import { type ObserveFn } from '../../../hooks/useIntersectionObserver';

import StickerView from '../../common/StickerView';

import styles from './ResaleGiftMenuAttributeSticker.module.scss';

type OwnProps = {
  className?: string;
  type: 'model' | 'pattern';
  sticker: ApiSticker;
  observeIntersectionForLoading?: ObserveFn;
  observeIntersectionForPlaying?: ObserveFn;
};

type StateProps = {
  theme: ThemeKey;
};

const ATTRIBUTE_STICKER_SIZE = 1.5 * REM;

const ResaleGiftMenuAttributeSticker: FC<StateProps & OwnProps> = ({
  className,
  type,
  sticker,
  observeIntersectionForLoading,
  observeIntersectionForPlaying,
  theme,
}) => {
  const stickerRef = useRef<HTMLDivElement>();

  const customColor = useDynamicColorListener(stickerRef, undefined, type !== 'pattern');

  return (
    <div
      ref={stickerRef}
      className={buildClassName(styles.root, className)}
      style={`width: ${ATTRIBUTE_STICKER_SIZE}px; height: ${ATTRIBUTE_STICKER_SIZE}px`}
    >
      <StickerView
        containerRef={stickerRef}
        sticker={sticker}
        size={ATTRIBUTE_STICKER_SIZE}
        shouldPreloadPreview
        observeIntersectionForLoading={observeIntersectionForLoading}
        observeIntersectionForPlaying={observeIntersectionForPlaying}
        thumbClassName={styles.thumb}
        customColor={customColor}
      />
    </div>
  );
};

export default memo(withGlobal<OwnProps>((global): Complete<StateProps> => {
  return {
    theme: selectTheme(global),
  };
})(ResaleGiftMenuAttributeSticker));
