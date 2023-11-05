import React, { memo } from '../../../lib/teact/teact';

import buildClassName from '../../../util/buildClassName';
import buildStyle from '../../../util/buildStyle';

import CustomEmoji from '../CustomEmoji';

import styles from './EmojiIconBackground.module.scss';

type IconPosition = {
  inline: number;
  block: number;
  opacity: number;
  scale: number;
};

const ICON_POSITIONS: IconPosition[] = [
  {
    inline: 5, block: 15, opacity: 0.35, scale: 1,
  },
  {
    inline: 10, block: 45, opacity: 0.3, scale: 0.9,
  },
  {
    inline: 20, block: 75, opacity: 0.3, scale: 0.75,
  },
  {
    inline: 40, block: 20, opacity: 0.25, scale: 0.8,
  },
  {
    inline: 60, block: 50, opacity: 0.25, scale: 0.85,
  },
  {
    inline: 55, block: -5, opacity: 0.20, scale: 0.75,
  },
  {
    inline: 80, block: 15, opacity: 0.15, scale: 0.95,
  },
  {
    inline: 100, block: 70, opacity: 0.15, scale: 0.9,
  },
  {
    inline: 120, block: 25, opacity: 0.10, scale: 0.65,
  },
  {
    inline: 140, block: 0, opacity: 0.10, scale: 0.75,
  },
];

type OwnProps = {
  emojiDocumentId: string;
  className?: string;
};

const EmojiIconBackground = ({
  emojiDocumentId,
  className,
}: OwnProps) => {
  return (
    <div className={buildClassName(styles.root, className)}>
      {ICON_POSITIONS.map((position) => {
        const {
          inline, block, opacity, scale,
        } = position;

        const style = buildStyle(
          `inset-inline-end: ${inline}px`,
          `inset-block-start: ${block}px`,
          `opacity: ${opacity}`,
          `transform: scale(${scale})`,
        );

        return (
          <CustomEmoji
            documentId={emojiDocumentId}
            className={styles.emoji}
            noPlay
            style={style}
          />
        );
      })}
    </div>
  );
};

export default memo(EmojiIconBackground);
