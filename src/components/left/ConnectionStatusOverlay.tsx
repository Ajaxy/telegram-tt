import type { FC } from '../../lib/teact/teact';
import React, { memo } from '../../lib/teact/teact';

import type { ConnectionStatus } from '../../hooks/useConnectionStatus';

import useLang from '../../hooks/useLang';

import Button from '../ui/Button';
import Spinner from '../ui/Spinner';
import Transition from '../ui/Transition';

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
        <Transition activeKey={connectionStatus} name="slideFade">
          {connectionStatusText}
        </Transition>
      </div>
      <Button
        round
        size="tiny"
        color="translucent-black"
      >
        <span className="icon icon-close" />
      </Button>
    </div>
  );
};

export default memo(ConnectionStatusOverlay);
