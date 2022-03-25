import React, { FC, useCallback } from '../../lib/teact/teact';

import Button from '../ui/Button';

import appInactivePath from '../../assets/app-inactive.png';
import './AppInactive.scss';

const AppInactive: FC = () => {
  const handleReload = useCallback(() => {
    window.location.reload();
  }, []);

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
