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
};

const PremiumFeatureItem: FC<OwnProps> = ({
  icon,
  title,
  text,
  onClick,
}) => {
  return (
    <ListItem buttonClassName={styles.root} onClick={onClick}>
      <img src={icon} alt="" />
      <div className={styles.text}>
        <div className={styles.title}>{renderText(title, ['br'])}</div>
        <div className={styles.description}>{text}</div>
      </div>
    </ListItem>
  );
};

export default memo(PremiumFeatureItem);
