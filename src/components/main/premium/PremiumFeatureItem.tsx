import type { FC } from '../../../lib/teact/teact';
import React, { memo } from '../../../lib/teact/teact';

import renderText from '../../common/helpers/renderText';

import ListItem from '../../ui/ListItem';

import styles from './PremiumFeatureItem.module.scss';

type OwnProps = {
  icon: string;
  title: string;
  text: string;
  onClick: VoidFunction;
  index: number;
};

const COLORS = [
  '#F2862D', '#EB7B4D', '#E46D72', '#DD6091', '#CC5FBA', '#B464E7',
  '#9873FF', '#768DFF', '#55A5FC', '#52B0C9', '#4FBC93', '#4CC663',
];

const PremiumFeatureItem: FC<OwnProps> = ({
  icon,
  title,
  text,
  index,
  onClick,
}) => {
  return (
    <ListItem buttonClassName={styles.root} onClick={onClick}>
      <img src={icon} className={styles.icon} alt="" style={`--item-color: ${COLORS[index]}`} />
      <div className={styles.text}>
        <div className={styles.title}>{renderText(title, ['br'])}</div>
        <div className={styles.description}>{text}</div>
      </div>
    </ListItem>
  );
};

export default memo(PremiumFeatureItem);
