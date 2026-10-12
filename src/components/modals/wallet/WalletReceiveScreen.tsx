import {
  memo, useEffect, useLayoutEffect, useRef,
} from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import { STRICTERDOM_ENABLED } from '../../../config';
import { disableStrict, enableStrict } from '../../../lib/fasterdom/stricterdom';
import { copyTextToClipboard } from '../../../util/clipboard';
import { createStyledQrCode } from '../../../util/qrCode/buildStyledQrCode';
import { getAddressGroupSeparator, splitAddressIntoGroups } from '../../../util/tonAddress';

import useAsync from '../../../hooks/useAsync';
import useClickable from '../../../hooks/useClickable';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import Button from '../../ui/Button';

import styles from './WalletReceiveScreen.module.scss';

import QrLogo from '../../../assets/wallet-qr-logo.svg';

type OwnProps = {
  address: string;
  onBuyClick?: NoneToVoidFunction;
};

const QR_SIZE = 180;
// The card padding is the quiet zone
const QR_MARGIN = 0;
// Clears a 9×9 square in a 33×33 code, close to the 44px hole in the design
const QR_HOLE_RATIO = 0.5;

const WalletReceiveScreen = ({ address, onBuyClick }: OwnProps) => {
  const { showNotification } = getActions();

  const lang = useLang();

  const qrRef = useRef<HTMLDivElement>();
  const drawTokenRef = useRef(0);

  // The logo is laid over the blank hole in CSS; error correction covers the modules under it
  const { result: qrCode, error: qrCodeError } = useAsync(() => createStyledQrCode({
    size: QR_SIZE,
    margin: QR_MARGIN,
    imageSize: QR_HOLE_RATIO,
  }), []);

  const handleCopy = useLastCallback(() => {
    copyTextToClipboard(address);
    showNotification({ message: { key: 'WalletAddressCopied' } });
  });

  const clickableProps = useClickable(handleCopy);

  useLayoutEffect(() => {
    if (!qrCode) return;

    const container = qrRef.current!;
    const token = ++drawTokenRef.current;

    // The library draws into the mounted SVG asynchronously, outside the mutation phase
    if (STRICTERDOM_ENABLED) {
      disableStrict();
    }

    qrCode.update({ data: address });
    qrCode.append(container);

    if (STRICTERDOM_ENABLED) {
      // Only the latest draw may turn strict mode back on
      void qrCode.getRawData('svg').finally(() => {
        if (drawTokenRef.current === token) {
          enableStrict();
        }
      });
    }
  }, [qrCode, address]);

  useEffect(() => {
    if (!qrCodeError) return;

    showNotification({ message: { key: 'ErrorUnexpected' } });
  }, [qrCodeError]);

  const groups = splitAddressIntoGroups(address);

  return (
    <div className={styles.root}>
      <div className={styles.card} {...clickableProps}>
        <div className={styles.qr}>
          <div ref={qrRef} className={styles.qrCode} />
          <img src={QrLogo} alt="" draggable={false} className={styles.qrLogo} />
        </div>
        <div className={styles.addressBlock}>
          <div className={styles.address}>
            {groups.map((group, index) => (
              <span key={index} className={index % 2 ? styles.addressGroupMuted : undefined}>
                {group}
                {getAddressGroupSeparator(index, groups.length)}
              </span>
            ))}
          </div>
          <div className={styles.copyHint}>{lang('WalletReceiveCopyHint')}</div>
        </div>
      </div>
      <div className={styles.note}>{lang('WalletReceiveNetworkNote')}</div>
      <Button className={styles.buyButton} color="secondary" pill onClick={onBuyClick}>
        {lang('WalletReceiveBuy')}
      </Button>
    </div>
  );
};

export default memo(WalletReceiveScreen);
