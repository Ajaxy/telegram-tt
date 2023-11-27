/* eslint-disable react/jsx-no-bind */
import type { FC } from '../../lib/teact/teact';
import React, { memo, useEffect, useState } from '../../lib/teact/teact';

import { ElectronEvent } from '../../types/electron';

import Button from './Button';

import styles from './UluGoBackForwardButton.module.scss';

const UluGoForwardButton: FC = () => {
  const [canGoForward, setCanGoForward] = useState(false);

  useEffect(() => {
    const updateCanGoForward = async () => {
      const canForward = await window.electron?.canGoForward() ?? false;
      setCanGoForward(canForward);
    };

    updateCanGoForward();

    // Подписка на событие изменения навигации
    const unsubscribe = window.electron?.on(ElectronEvent.NAVIGATION_CHANGED, updateCanGoForward);

    return () => {
      // Отписка от события при размонтировании компонента
      unsubscribe?.();
    };
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

export default memo(UluGoForwardButton);
