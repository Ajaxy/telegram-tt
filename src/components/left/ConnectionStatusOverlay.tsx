import type { FC } from '../../lib/teact/teact';
import { memo } from '../../lib/teact/teact';

import type { ConnectionStatus } from '../../hooks/useConnectionStatus';

import useOldLang from '../../hooks/useOldLang';

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
  const lang = useOldLang();

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
        iconName="close"
      />
    </div>
  );
};

export default memo(ConnectionStatusOverlay);
