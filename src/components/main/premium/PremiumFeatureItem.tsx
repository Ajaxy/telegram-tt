import type { FC } from '../../../lib/teact/teact';
import React, { memo } from '../../../lib/teact/teact';

import buildClassName from '../../../util/buildClassName';
import { hexToRgb, lerpRgb } from '../../../util/switchTheme';
import renderText from '../../common/helpers/renderText';

import ListItem from '../../ui/ListItem';

import styles from './PremiumFeatureItem.module.scss';

type OwnProps = {
  icon: string;
  isFontIcon?: boolean;
  title: string;
  text: string;
  index: number;
  count: number;
  onClick?: VoidFunction;
};

const COLORS = [
  '#F2862D', '#EB7B4D', '#E46D72', '#DD6091', '#CC5FBA', '#B464E7',
  '#9873FF', '#768DFF', '#55A5FC', '#52B0C9', '#4FBC93', '#4CC663',
].map(hexToRgb);

const PremiumFeatureItem: FC<OwnProps> = ({
  icon,
  isFontIcon,
  title,
  text,
  index,
  count,
  onClick,
}) => {
  const newIndex = (index / count) * COLORS.length;
  const colorA = COLORS[Math.floor(newIndex)];
  const colorB = COLORS[Math.ceil(newIndex)] ?? colorA;
  const { r, g, b } = lerpRgb(colorA, colorB, 0.5);

  return (
    <ListItem buttonClassName={styles.root} onClick={onClick} inactive={!onClick}>
      {isFontIcon ? (
        <i
          className={buildClassName(styles.fontIcon, `icon icon-${icon}`)}
          aria-hidden
          style={`--item-color: rgb(${r},${g},${b})`}
        />
      ) : (
        <img src={icon} className={styles.icon} alt="" style={`--item-color: rgb(${r},${g},${b})`} />
      )}
      <div className={styles.text}>
        <div className={styles.title}>{renderText(title, ['br'])}</div>
        <div className={styles.description}>{text}</div>
      </div>
    </ListItem>
  );
};

export default memo(PremiumFeatureItem);
