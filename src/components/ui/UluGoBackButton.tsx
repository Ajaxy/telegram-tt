/* eslint-disable react/jsx-no-bind */
import type { FC } from '../../lib/teact/teact';
import React, { memo, useEffect, useState } from '../../lib/teact/teact';

import Button from './Button';

import styles from './UluGoBackForwardButton.module.scss';

const UluGoBackButton: FC = () => {
  const [canGoBack, setCanGoBack] = useState(false);

  useEffect(() => {
    window.electron?.canGoBack().then(setCanGoBack);
  }, []);

  const handleClick = () => {
    window.electron?.goBack();
  };

  return (
    <Button
      color="gray"
      ariaLabel="Go back '⌘ + ['"
      className={styles.wrapper}
      onClick={handleClick}
      disabled={!canGoBack}
    >
      <i className="icon icon-arrow-left" />
    </Button>
  );
};

export default memo(UluGoBackButton);
