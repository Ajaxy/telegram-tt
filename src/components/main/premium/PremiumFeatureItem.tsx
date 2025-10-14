import { memo } from '../../../lib/teact/teact';

import type { IconName } from '../../../types/icons';

import { hex2rgbaObj, lerpRgbaObj } from '../../../util/colors.ts';
import renderText from '../../common/helpers/renderText';

import useLastCallback from '../../../hooks/useLastCallback';

import Icon from '../../common/icons/Icon';
import ListItem from '../../ui/ListItem';

import styles from './PremiumFeatureItem.module.scss';

type OwnProps<T> = {
  title: string;
  text: string;
  index: number;
  count: number;
  section: T;
  onClick?: (section: T) => void;
} & ({
  icon: IconName;
  isFontIcon: true;
} | {
  icon: string;
  isFontIcon?: false;
});

const COLORS = [
  '#F2862D', '#EB7B4D', '#E46D72', '#DD6091', '#CC5FBA', '#B464E7',
  '#9873FF', '#768DFF', '#55A5FC', '#52B0C9', '#4FBC93', '#4CC663',
].map(hex2rgbaObj);

const PremiumFeatureItem = <T,>({
  icon,
  isFontIcon,
  title,
  text,
  index,
  count,
  section,
  onClick,
}: OwnProps<T>) => {
  const newIndex = (index / count) * COLORS.length;
  const colorA = COLORS[Math.floor(newIndex)];
  const colorB = COLORS[Math.ceil(newIndex)] ?? colorA;
  const { r, g, b } = lerpRgbaObj(colorA, colorB, 0.5);

  const handleClick = useLastCallback(() => {
    onClick?.(section);
  });

  return (
    <ListItem buttonClassName={styles.root} onClick={handleClick} inactive={!onClick}>
      {isFontIcon ? (
        <Icon name={icon} className={styles.fontIcon} style={`--item-color: rgb(${r},${g},${b})`} />
      ) : (
        <img src={icon} className={styles.icon} alt="" style={`--item-color: rgb(${r},${g},${b})`} draggable={false} />
      )}
      <div className={styles.text}>
        <div className={styles.title}>{renderText(title, ['br'])}</div>
        <div className={styles.description}>{text}</div>
      </div>
    </ListItem>
  );
};

export default memo(PremiumFeatureItem);
