import type { FC } from '../../lib/teact/teact';
import React, { memo } from '../../lib/teact/teact';

import useLang from '../../hooks/useLang';
import type { ConnectionStatus } from '../../hooks/useConnectionStatus';

import Transition from '../ui/Transition';
import Spinner from '../ui/Spinner';
import Button from '../ui/Button';

import './ConnectionStatusOverlay.scss';

type OwnProps = {
  connectionStatus: ConnectionStatus;
  connectionStatusText: string;
  onClick?: NoneToVoidFunction;
};

const ConnectionStatusOverlay: FC<OwnProps> = ({
  connectionStatus,
  connectionStatusText,
  onClick,
}) => {
  const lang = useLang();

  return (
    <div id="ConnectionStatusOverlay" dir={lang.isRtl ? 'rtl' : undefined} onClick={onClick}>
      <Spinner color="black" />
      <div className="state-text">
        <Transition activeKey={connectionStatus} name="slide-fade">
          {connectionStatusText}
        </Transition>
      </div>
      <Button
        round
        size="tiny"
        color="translucent-black"
      >
        <span className="icon-close" />
      </Button>
    </div>
  );
};

export default memo(ConnectionStatusOverlay);
