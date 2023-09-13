import type { FC } from '../../lib/teact/teact';
import React, { useCallback } from '../../lib/teact/teact';

import useHistoryBack from '../../hooks/useHistoryBack';

import Button from '../ui/Button';

import './AppInactive.scss';

import appInactivePath from '../../assets/app-inactive.png';

const AppInactive: FC = () => {
  const handleReload = useCallback(() => {
    window.location.reload();
  }, []);

  useHistoryBack({
    isActive: true,
    onBack: handleReload,
    shouldResetUrlHash: true,
  });

  return (
    <div id="AppInactive">
      <div className="content">
        <img src={appInactivePath} alt="" />
        <h3 className="title">Such error, many tabs</h3>
        <div className="description">
          Telegram supports only one active tab with the app.
          <br />
          Please reload this page to continue using this tab or close it.
        </div>
        <div className="actions">
          <Button isText ripple onClick={handleReload}>
            Reload app
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AppInactive;
