import QrCreator from 'qr-creator';
import React, {
  FC, useEffect, useRef, memo,
} from '../../lib/teact/teact';
import { withGlobal } from '../../lib/teact/teactn';
import { GlobalState, GlobalActions } from '../../global/types';

import { pick } from '../../util/iteratees';

import Loading from '../ui/Loading';
import Button from '../ui/Button';
import useHistoryBack from '../../hooks/useHistoryBack';

type StateProps = Pick<GlobalState, 'connectionState' | 'authQrCode'>;
type DispatchProps = Pick<GlobalActions, 'returnToAuthPhoneNumber'>;

const DATA_PREFIX = 'tg://login?token=';

const AuthCode: FC<StateProps & DispatchProps> = ({
  connectionState, authQrCode, returnToAuthPhoneNumber,
}) => {
  // eslint-disable-next-line no-null/no-null
  const qrCodeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!authQrCode || connectionState !== 'connectionStateReady') {
      return;
    }

    const container = qrCodeRef.current!;

    container.innerHTML = '';
    container.classList.remove('pre-animate');

    QrCreator.render({
      text: `${DATA_PREFIX}${authQrCode.token}`,
      radius: 0.5,
      ecLevel: 'M',
      fill: '#4E96D4',
      size: 280,
    }, container);
  }, [connectionState, authQrCode]);

  useHistoryBack(returnToAuthPhoneNumber);

  return (
    <div id="auth-qr-form" className="custom-scroll">
      <div className="auth-form qr">
        {authQrCode ? (
          <div key="qr-container" className="qr-container pre-animate" ref={qrCodeRef} />
        ) : (
          <div key="qr-loading" className="qr-loading"><Loading /></div>
        )}
        <h3>Log in to Telegram by QR Code</h3>
        <ol>
          <li><span>Open Telegram on your phone</span></li>
          <li><span>Go to&nbsp;<b>Settings</b>&nbsp;&gt;&nbsp;<b>Devices</b>&nbsp;&gt;&nbsp;<b>Scan QR</b></span></li>
          <li><span>Point your phone at this screen to confirm login</span></li>
        </ol>
        <Button isText onClick={returnToAuthPhoneNumber}>Log in by phone number</Button>
      </div>
    </div>
  );
};

export default memo(withGlobal(
  (global): StateProps => pick(global, ['connectionState', 'authQrCode']),
  (setGlobal, actions): DispatchProps => pick(actions, ['returnToAuthPhoneNumber']),
)(AuthCode));
