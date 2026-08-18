import type { TeactNode } from '../../../lib/teact/teact';

import type { IAlbumLayoutItem } from './helpers/calculateAlbumLayout';

import buildClassName from '../../../util/buildClassName';
import buildStyle from '../../../util/buildStyle';
import { AlbumRectPart } from './helpers/calculateAlbumLayout';

import styles from './AlbumItem.module.scss';

type OwnProps = {
  item: IAlbumLayoutItem;
  children: TeactNode;
  className?: string;
};

const AlbumItem = ({ item: { rect, sides }, children, className }: OwnProps) => {
  return (
    <div
      className={buildClassName(
        styles.root,
        !(sides & AlbumRectPart.Left) && styles.withLeftGap,
        !(sides & AlbumRectPart.Top) && styles.withTopGap,
        !(sides & AlbumRectPart.Right) && styles.withRightGap,
        !(sides & AlbumRectPart.Bottom) && styles.withBottomGap,
        className,
      )}
      style={buildStyle(
        `left: ${rect.x * 100}%`,
        `top: ${rect.y * 100}%`,
        `width: ${rect.width * 100}%`,
        `height: ${rect.height * 100}%`,
      )}
    >
      {children}
    </div>
  );
};

export default AlbumItem;
