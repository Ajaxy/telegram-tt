import { memo } from '../../lib/teact/teact';

import type { ApiSticker } from '../../api/types';

import useLastCallback from '../../hooks/useLastCallback';

import AnimatedIconFromSticker from './AnimatedIconFromSticker';

import styles from './AnimatedTabItem.module.scss';

type OwnProps = {
  id: string;
  title: string;
  sticker?: ApiSticker;
  onClick?: (id: string) => void;
};

const AnimatedTabItem = ({
  id,
  title,
  sticker,
  onClick,
}: OwnProps) => {
  const handleClick = useLastCallback(() => {
    onClick?.(id);
  });

  return (
    <div
      className={styles.item}
      onClick={handleClick}
    >
      {sticker && (
        <AnimatedIconFromSticker
          className={styles.icon}
          sticker={sticker}
          size={20}
          forcePreview
        />
      )}
      {title}
    </div>
  );
};

export default memo(AnimatedTabItem);
