/* eslint-disable react/jsx-no-bind */
import type { FC } from '../../lib/teact/teact';
import React, { memo, useEffect, useState } from '../../lib/teact/teact';

import Button from './Button';

import styles from './UluGoBackForwardButton.module.scss';

const UluGoBackButton: FC = () => {
  const [canGoForward, setCanGoForward] = useState(false);

  useEffect(() => {
    window.electron?.canGoForward().then(setCanGoForward);
  }, []);

  const handleClick = () => {
    window.electron?.goForward();
  };
  return (
    <Button
      color="gray"
      ariaLabel="Go forward '⌘ + ]'"
      className={styles.wrapper}
      onClick={handleClick}
      disabled={!canGoForward}
    >
      <i className="icon icon-arrow-right" />
    </Button>
  );
};

export default memo(UluGoBackButton);
