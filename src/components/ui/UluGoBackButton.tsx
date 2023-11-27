/* eslint-disable react/jsx-no-bind */
import type { FC } from '../../lib/teact/teact';
import React, { memo, useEffect, useState } from '../../lib/teact/teact';

import { ElectronEvent } from '../../types/electron';

import Button from './Button';

import styles from './UluGoBackForwardButton.module.scss';

const UluGoBackButton: FC = () => {
  const [canGoBack, setCanGoBack] = useState(false);

  useEffect(() => {
    const updateCanGoBack = async () => {
      const canBack = await window.electron?.canGoBack() ?? false;
      setCanGoBack(canBack);
    };

    updateCanGoBack();

    // Подписка на событие изменения навигации
    const unsubscribe = window.electron?.on(ElectronEvent.NAVIGATION_CHANGED, updateCanGoBack);

    return () => {
      unsubscribe?.();
    };
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
