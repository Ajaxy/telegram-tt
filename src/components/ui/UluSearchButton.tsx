import type { FC } from '../../lib/teact/teact';
import React, { memo } from '../../lib/teact/teact';

import Button from './Button';

import styles from './UluSearchButton.module.scss';

type OwnProps = {
  onClick: () => void;
};

const UluSearchButton: FC<OwnProps> = ({ onClick }) => {
  return (
    <Button isText color="secondary" ariaLabel="Search '⌘ + /'" className={styles.wrapper} onClick={onClick}>
      <i className="icon icon-search search-icon" />
    </Button>
  );
};

export default memo(UluSearchButton);
